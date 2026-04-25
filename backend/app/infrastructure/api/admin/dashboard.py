"""Phase 3 — admin dashboard snapshot endpoint.

`GET /api/admin/analytics/dashboard?days=30` returns a single aggregated
snapshot. `days` is the only query param (7/30/90 — the frontend selector)
so we don't have to validate two dates against each other; the domain VO
`DateRange.last_n_days` owns that logic.
"""

from enum import IntEnum

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.application.analytics.use_cases import GetDashboardSnapshot
from app.container import get_analytics_repo
from app.domain.analytics.value_objects import DateRange
from app.utils.cache import cached
from app.utils.dependencies import get_current_admin_id

router = APIRouter()

# Window options locked to the three buttons in the UI. Enumerating them
# rather than taking an open integer keeps the cache fan-out bounded (at
# most 3 live entries per `today`) and rejects garbage input with 422.
# IntEnum (not Literal[int]) is used because Pydantic v2 treats Literal
# members as strict — `?days=7` arrives as the string "7" from the query
# string and would fail validation. IntEnum coerces "7" → 7 cleanly.
class DaysWindow(IntEnum):
    WEEK = 7
    MONTH = 30
    QUARTER = 90


class MetricResponse(BaseModel):
    key: str
    label: str
    value: int | float
    unit: str = ""
    delta_pct: float | None = None


class SeriesPointResponse(BaseModel):
    day: str  # ISO date, for JSON stability
    value: int | float


class MetricSeriesResponse(BaseModel):
    key: str
    label: str
    points: list[SeriesPointResponse]


class StatusBucketResponse(BaseModel):
    status: str
    count: int


class TopDesignResponse(BaseModel):
    design_id: str
    design_name: str
    orders_count: int


class DashboardResponse(BaseModel):
    range_start: str
    range_end: str
    metrics: list[MetricResponse]
    revenue_series: MetricSeriesResponse
    new_users_series: MetricSeriesResponse
    orders_by_status: list[StatusBucketResponse]
    top_designs: list[TopDesignResponse] = Field(default_factory=list)


# Cache is keyed by (days,) because the repo identity is `self` (stripped
# by the decorator's `skip_self`). TTL = 60s matches the plan's MVP choice
# — dashboard is refreshed on tab focus anyway.
@cached(ttl_seconds=60.0)
async def _snapshot(repo, days: int) -> DashboardResponse:
    rng = DateRange.last_n_days(days)
    uc = GetDashboardSnapshot(repo)
    dto = await uc.execute(rng)
    return DashboardResponse(
        range_start=dto.range_start,
        range_end=dto.range_end,
        metrics=[MetricResponse(**m.__dict__) for m in dto.metrics],
        revenue_series=MetricSeriesResponse(
            key=dto.revenue_series.key,
            label=dto.revenue_series.label,
            points=[
                SeriesPointResponse(day=p.day.isoformat(), value=p.value)
                for p in dto.revenue_series.points
            ],
        ),
        new_users_series=MetricSeriesResponse(
            key=dto.new_users_series.key,
            label=dto.new_users_series.label,
            points=[
                SeriesPointResponse(day=p.day.isoformat(), value=p.value)
                for p in dto.new_users_series.points
            ],
        ),
        orders_by_status=[
            StatusBucketResponse(status=b.status, count=b.count)
            for b in dto.orders_by_status
        ],
        top_designs=[
            TopDesignResponse(
                design_id=t.design_id,
                design_name=t.design_name,
                orders_count=t.orders_count,
            )
            for t in dto.top_designs
        ],
    )


@router.get("/analytics/dashboard", response_model=DashboardResponse)
async def dashboard(
    days: DaysWindow = Query(
        DaysWindow.MONTH, description="Rolling window, 7/30/90 days",
    ),
    _admin_id: str = Depends(get_current_admin_id),
    analytics_repo=Depends(get_analytics_repo),
):
    return await _snapshot(analytics_repo, int(days))
