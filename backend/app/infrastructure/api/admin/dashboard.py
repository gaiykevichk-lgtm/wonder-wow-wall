"""Phase 3 — admin dashboard snapshot endpoint.

`GET /api/admin/analytics/dashboard?days=30` returns a single aggregated
snapshot. `days` is the only query param (7/30/90 — the frontend selector)
so we don't have to validate two dates against each other; the domain VO
`DateRange.last_n_days` owns that logic.

Phase 11 — extended with 8 widget projections (subscriptions, funnel,
abandoned carts, orders-needing-attention, tool usage, panel-size
breakdown, geography, registrations vs orders). All travel in one
response so the frontend stays at a single round-trip.
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


# ─── Phase 11 widget response models ────────────────────────────────────


class SubscriptionPlanBucketResponse(BaseModel):
    plan_id: str
    plan_name: str
    monthly_price: int
    active_count: int


class SubscriptionsSummaryResponse(BaseModel):
    active_count: int
    mrr: int
    churn_pct: float
    new_in_period: int
    by_plan: list[SubscriptionPlanBucketResponse] = Field(default_factory=list)


class FunnelStageResponse(BaseModel):
    key: str
    label: str
    count: int
    conversion_pct: float | None = None


class AbandonedCartResponse(BaseModel):
    project_id: str
    user_id: str
    user_email: str
    user_name: str
    project_name: str
    total_price: int
    panels_count: int
    last_activity: str


class OrderAttentionResponse(BaseModel):
    order_id: str
    order_number: str
    status: str
    age_hours: int
    total: int
    user_id: str
    user_email: str
    user_name: str
    reason: str


class ToolUsageResponse(BaseModel):
    constructor_sessions: int
    visualizer_projects: int
    engaged_users: int
    converted_users: int
    conversion_pct: float


class SizeBucketResponse(BaseModel):
    size_key: str
    size_label: str
    items_count: int
    revenue: int


class CityBucketResponse(BaseModel):
    city: str
    orders_count: int
    revenue: int


class RegistrationsCompareResponse(BaseModel):
    new_users: MetricSeriesResponse
    new_orders: MetricSeriesResponse
    total_users: int
    total_orders: int


class DashboardResponse(BaseModel):
    range_start: str
    range_end: str
    metrics: list[MetricResponse]
    revenue_series: MetricSeriesResponse
    new_users_series: MetricSeriesResponse
    orders_by_status: list[StatusBucketResponse]
    top_designs: list[TopDesignResponse] = Field(default_factory=list)
    # ─── Phase 11 widgets ──────────────────────────────────────────────
    subscriptions: SubscriptionsSummaryResponse | None = None
    funnel: list[FunnelStageResponse] = Field(default_factory=list)
    abandoned_carts: list[AbandonedCartResponse] = Field(default_factory=list)
    orders_attention: list[OrderAttentionResponse] = Field(default_factory=list)
    tool_usage: ToolUsageResponse | None = None
    size_breakdown: list[SizeBucketResponse] = Field(default_factory=list)
    top_cities: list[CityBucketResponse] = Field(default_factory=list)
    registrations_compare: RegistrationsCompareResponse | None = None


# Cache is keyed by (days,) because the repo identity is `self` (stripped
# by the decorator's `skip_self`). TTL = 60s matches the plan's MVP choice
# — dashboard is refreshed on tab focus anyway.
def _series_to_response(s) -> MetricSeriesResponse:
    """Map a domain `MetricSeries` to the wire `MetricSeriesResponse`.

    Extracted so widget code reusing the same point format
    (`registrations_compare`) doesn't repeat the dict comprehension.
    """
    return MetricSeriesResponse(
        key=s.key,
        label=s.label,
        points=[
            SeriesPointResponse(day=p.day.isoformat(), value=p.value)
            for p in s.points
        ],
    )


@cached(ttl_seconds=60.0)
async def _snapshot(repo, days: int) -> DashboardResponse:
    rng = DateRange.last_n_days(days)
    uc = GetDashboardSnapshot(repo)
    dto = await uc.execute(rng)
    # ─── Phase 11 widget mapping ───────────────────────────────────────
    subscriptions = (
        SubscriptionsSummaryResponse(
            active_count=dto.subscriptions.active_count,
            mrr=dto.subscriptions.mrr,
            churn_pct=dto.subscriptions.churn_pct,
            new_in_period=dto.subscriptions.new_in_period,
            by_plan=[
                SubscriptionPlanBucketResponse(
                    plan_id=b.plan_id,
                    plan_name=b.plan_name,
                    monthly_price=b.monthly_price,
                    active_count=b.active_count,
                )
                for b in dto.subscriptions.by_plan
            ],
        )
        if dto.subscriptions is not None
        else None
    )
    tool_usage = (
        ToolUsageResponse(
            constructor_sessions=dto.tool_usage.constructor_sessions,
            visualizer_projects=dto.tool_usage.visualizer_projects,
            engaged_users=dto.tool_usage.engaged_users,
            converted_users=dto.tool_usage.converted_users,
            conversion_pct=dto.tool_usage.conversion_pct,
        )
        if dto.tool_usage is not None
        else None
    )
    registrations_compare = (
        RegistrationsCompareResponse(
            new_users=_series_to_response(dto.registrations_compare.new_users),
            new_orders=_series_to_response(dto.registrations_compare.new_orders),
            total_users=dto.registrations_compare.total_users,
            total_orders=dto.registrations_compare.total_orders,
        )
        if dto.registrations_compare is not None
        else None
    )

    return DashboardResponse(
        range_start=dto.range_start,
        range_end=dto.range_end,
        metrics=[MetricResponse(**m.__dict__) for m in dto.metrics],
        revenue_series=_series_to_response(dto.revenue_series),
        new_users_series=_series_to_response(dto.new_users_series),
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
        subscriptions=subscriptions,
        funnel=[
            FunnelStageResponse(
                key=s.key,
                label=s.label,
                count=s.count,
                conversion_pct=s.conversion_pct,
            )
            for s in (dto.funnel or [])
        ],
        abandoned_carts=[
            AbandonedCartResponse(
                project_id=c.project_id,
                user_id=c.user_id,
                user_email=c.user_email,
                user_name=c.user_name,
                project_name=c.project_name,
                total_price=c.total_price,
                panels_count=c.panels_count,
                last_activity=c.last_activity,
            )
            for c in (dto.abandoned_carts or [])
        ],
        orders_attention=[
            OrderAttentionResponse(
                order_id=o.order_id,
                order_number=o.order_number,
                status=o.status,
                age_hours=o.age_hours,
                total=o.total,
                user_id=o.user_id,
                user_email=o.user_email,
                user_name=o.user_name,
                reason=o.reason,
            )
            for o in (dto.orders_attention or [])
        ],
        tool_usage=tool_usage,
        size_breakdown=[
            SizeBucketResponse(
                size_key=b.size_key,
                size_label=b.size_label,
                items_count=b.items_count,
                revenue=b.revenue,
            )
            for b in (dto.size_breakdown or [])
        ],
        top_cities=[
            CityBucketResponse(
                city=b.city,
                orders_count=b.orders_count,
                revenue=b.revenue,
            )
            for b in (dto.top_cities or [])
        ],
        registrations_compare=registrations_compare,
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
