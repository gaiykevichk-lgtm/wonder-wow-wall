"""FastAPI router for the Visualizer bounded context.

Phase 5C extensions:
- POST/PUT bodies and the GET response gain typed `calibration`,
  `perspective_auto_detected`, `calibration_auto_detected`, and `version`.
- New PATCH endpoints for partial updates: `/perspective` and `/calibration`.
  These are what the frontend's debounced corner-drag/calibration-save calls.
- Domain exceptions (`CollinearCornersError`, `StaleSceneVersionError`) bubble
  up to the global handlers wired in `main.py` and render as 422 / 409.

Phase 6 extension:
- POST `/{project_id}/auto-perspective` runs the depth-based fallback when
  the client's OpenCV vanishing-point detector failed (empty walls, low line
  count). Orchestrates `DetectPerspectiveFromDepth` but does the mask resize
  and coord re-scaling at this adapter boundary because those concerns are
  transport-shaped, not domain-shaped.
"""

import base64
import binascii
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.application.visualizer.use_cases import (
    DeleteVisualizationProject,
    GetVisualizationProject,
    GetVisualizationProjects,
    SaveVisualizationProject,
    UpdateCalibration,
    UpdatePerspective,
    UpdateVisualizationProject,
)
from app.container import get_depth_estimator, get_visualization_repo
from app.domain.visualizer.depth_estimator import DepthEstimator
from app.domain.visualizer.entities import PlacedPanelData, VisualizationProject
from app.domain.visualizer.exceptions import PlaneFittingError
from app.domain.visualizer.services import PlaneFittingService
from app.domain.visualizer.value_objects import (
    PerspectiveCorners,
    ScaleCalibration,
)
from app.utils.dependencies import get_current_user_id

router = APIRouter()


# ─── Schemas ─────────────────────────────────────────────────────────

class PlacedPanelSchema(BaseModel):
    design_id: str = ""
    design_name: str = ""
    design_image: str = ""
    size_key: str = "30x30"
    color: str = "#CCCCCC"
    color_name: str = ""
    x: float = 0.0
    y: float = 0.0
    render_width: float = 150.0
    render_height: float = 150.0


class PointDTO(BaseModel):
    x: float
    y: float


class CalibrationDTO(BaseModel):
    """API DTO for `ScaleCalibration` VO. Snake_case wire format — Phase 5C
    intentionally keeps backend DTOs snake_case (matching legacy fields like
    `calibration_pixels_per_cm`); the frontend layer converts to camelCase.

    X13 closure — renamed from `CalibrationSchema` (and `PointSchema`) to the
    `*DTO` suffix. These classes are shared between the Create, Update and
    Response shapes, so a `*Update`/`*Response` suffix would be misleading;
    `*DTO` is the neutral label the codebase uses elsewhere for cross-direction
    payload types.
    """

    method: Literal["reference", "manual", "auto"]
    pixels_per_cm: float = Field(gt=0)
    wall_width_cm: float | None = Field(default=None, gt=0)
    wall_height_cm: float | None = Field(default=None, gt=0)

    def to_vo(self) -> ScaleCalibration:
        return ScaleCalibration(
            method=self.method,
            pixels_per_cm=self.pixels_per_cm,
            wall_width_cm=self.wall_width_cm,
            wall_height_cm=self.wall_height_cm,
        )

    @classmethod
    def from_vo(cls, vo: ScaleCalibration) -> "CalibrationDTO":
        return cls(
            method=vo.method,
            pixels_per_cm=vo.pixels_per_cm,
            wall_width_cm=vo.wall_width_cm,
            wall_height_cm=vo.wall_height_cm,
        )


class VisualizationProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    photo_url: str = Field("", max_length=20_000_000)  # ~15 MB base64 data URL
    photo_width: int = Field(0, ge=0)
    photo_height: int = Field(0, ge=0)
    wall_mask_base64: str = Field("", max_length=10_000_000)  # ~7.5 MB base64
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelSchema] = Field(default_factory=list, max_length=500)
    perspective_corners: list[PointDTO] | None = None
    placement_mode: str = "manual"
    # ─── Phase 5C additions ───
    calibration: CalibrationDTO | None = None
    perspective_auto_detected: bool = False
    calibration_auto_detected: bool = False


class VisualizationProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    photo_url: str = Field("", max_length=20_000_000)
    photo_width: int = Field(0, ge=0)
    photo_height: int = Field(0, ge=0)
    wall_mask_base64: str = Field("", max_length=10_000_000)
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelSchema] = Field(default_factory=list, max_length=500)
    perspective_corners: list[PointDTO] | None = None
    placement_mode: str = "manual"
    # ─── Phase 5C additions ───
    calibration: CalibrationDTO | None = None
    perspective_auto_detected: bool = False
    calibration_auto_detected: bool = False
    # Optimistic-lock — clients that omit it get last-write-wins (legacy).
    version: int | None = Field(default=None, ge=1)


class VisualizationProjectResponse(BaseModel):
    id: str
    name: str
    photo_url: str
    photo_width: int
    photo_height: int
    wall_mask_base64: str
    calibration_pixels_per_cm: float
    panels: list[PlacedPanelSchema]
    perspective_corners: list[PointDTO] | None
    placement_mode: str
    created_at: str
    updated_at: str
    # ─── Phase 5C additions ───
    calibration: CalibrationDTO | None = None
    perspective_auto_detected: bool = False
    calibration_auto_detected: bool = False
    version: int = 1


class VisualizationProjectListItem(BaseModel):
    id: str
    name: str
    photo_width: int
    photo_height: int
    panel_count: int
    placement_mode: str
    created_at: str
    updated_at: str


class PerspectiveCornersUpdateBody(BaseModel):
    """Body for `PATCH /perspective`. `corners=None` clears the perspective."""

    corners: list[PointDTO] | None = Field(
        default=None,
        description="Four points TL→TR→BR→BL, or null to clear the perspective.",
    )
    version: int = Field(ge=1, description="Server-side version the client last loaded.")


class CalibrationUpdateBody(BaseModel):
    """Body for `PATCH /calibration`."""

    calibration: CalibrationDTO
    version: int = Field(ge=1, description="Server-side version the client last loaded.")


# ─── Helpers ─────────────────────────────────────────────────────────

def _schema_to_entity(data: VisualizationProjectCreate | VisualizationProjectUpdate) -> VisualizationProject:
    panels = [
        PlacedPanelData(
            design_id=p.design_id, design_name=p.design_name, design_image=p.design_image,
            size_key=p.size_key, color=p.color, color_name=p.color_name,
            x=p.x, y=p.y, render_width=p.render_width, render_height=p.render_height,
        )
        for p in data.panels
    ]
    corners = [{"x": c.x, "y": c.y} for c in data.perspective_corners] if data.perspective_corners else None
    calibration_vo = data.calibration.to_vo() if data.calibration else None
    # Mirror: when client sends typed `calibration`, treat its pixels_per_cm
    # as authoritative — overrides the legacy float field if both are present.
    pixels_per_cm = (
        calibration_vo.pixels_per_cm if calibration_vo else data.calibration_pixels_per_cm
    )
    return VisualizationProject(
        name=data.name,
        photo_url=data.photo_url,
        photo_width=data.photo_width,
        photo_height=data.photo_height,
        wall_mask_base64=data.wall_mask_base64,
        calibration_pixels_per_cm=pixels_per_cm,
        panels=panels,
        perspective_corners=corners,
        placement_mode=data.placement_mode,
        calibration=calibration_vo,
        perspective_auto_detected=data.perspective_auto_detected,
        calibration_auto_detected=data.calibration_auto_detected,
    )


def _entity_to_response(p: VisualizationProject) -> dict:
    corners = None
    if p.perspective_corners:
        corners = [{"x": c["x"], "y": c["y"]} for c in p.perspective_corners]
    calibration_dict = CalibrationDTO.from_vo(p.calibration).model_dump() if p.calibration else None
    return {
        "id": p.id,
        "name": p.name,
        "photo_url": p.photo_url,
        "photo_width": p.photo_width,
        "photo_height": p.photo_height,
        "wall_mask_base64": p.wall_mask_base64,
        "calibration_pixels_per_cm": p.calibration_pixels_per_cm,
        "panels": [
            {
                "design_id": panel.design_id, "design_name": panel.design_name,
                "design_image": panel.design_image, "size_key": panel.size_key,
                "color": panel.color, "color_name": panel.color_name,
                "x": panel.x, "y": panel.y,
                "render_width": panel.render_width, "render_height": panel.render_height,
            }
            for panel in p.panels
        ],
        "perspective_corners": corners,
        "placement_mode": p.placement_mode,
        "created_at": p.created_at.isoformat() if hasattr(p.created_at, "isoformat") else str(p.created_at),
        "updated_at": p.updated_at.isoformat() if hasattr(p.updated_at, "isoformat") else str(p.updated_at),
        "calibration": calibration_dict,
        "perspective_auto_detected": p.perspective_auto_detected,
        "calibration_auto_detected": p.calibration_auto_detected,
        "version": p.version,
    }


def _entity_to_list_item(p: VisualizationProject) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "photo_width": p.photo_width,
        "photo_height": p.photo_height,
        "panel_count": len(p.panels),
        "placement_mode": p.placement_mode,
        "created_at": p.created_at.isoformat() if hasattr(p.created_at, "isoformat") else str(p.created_at),
        "updated_at": p.updated_at.isoformat() if hasattr(p.updated_at, "isoformat") else str(p.updated_at),
    }


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post(
    "",
    response_model=VisualizationProjectResponse,
    status_code=201,
    summary="Create a new visualization project",
)
async def create_visualization_project(
    body: VisualizationProjectCreate,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    entity = _schema_to_entity(body)
    uc = SaveVisualizationProject(repo)
    saved = await uc.execute(user_id, entity)
    return _entity_to_response(saved)


@router.get("", response_model=list[VisualizationProjectListItem])
async def list_visualization_projects(
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    uc = GetVisualizationProjects(repo)
    projects = await uc.execute(user_id)
    return [_entity_to_list_item(p) for p in projects]


@router.get("/{project_id}", response_model=VisualizationProjectResponse)
async def get_visualization_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    uc = GetVisualizationProject(repo)
    project = await uc.execute(project_id, user_id)
    if not project:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return _entity_to_response(project)


@router.put(
    "/{project_id}",
    response_model=VisualizationProjectResponse,
    responses={
        409: {"description": "Stale version (multi-tab race) — caller must refetch"},
    },
)
async def update_visualization_project(
    project_id: str,
    body: VisualizationProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    entity = _schema_to_entity(body)
    uc = UpdateVisualizationProject(repo)
    updated = await uc.execute(project_id, user_id, entity, version=body.version)
    if not updated:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return _entity_to_response(updated)


@router.delete("/{project_id}")
async def delete_visualization_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    uc = DeleteVisualizationProject(repo)
    deleted = await uc.execute(project_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return {"status": "deleted"}


# ─── Phase 5C — partial PATCH endpoints ──────────────────────────────


@router.patch(
    "/{project_id}/perspective",
    response_model=VisualizationProjectResponse,
    summary="Partial update — perspective corners",
    responses={
        409: {"description": "Stale version (multi-tab race) — caller must refetch"},
        422: {"description": "Degenerate quadrilateral (`code: degenerate_corners`)"},
    },
)
async def patch_perspective(
    project_id: str,
    body: PerspectiveCornersUpdateBody,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    """Replace the four perspective corners atomically.

    * `corners=null` clears the perspective.
    * `corners` must form a non-degenerate quadrilateral (area > 1 px²); a
      degenerate input raises `CollinearCornersError` → HTTP 422 with
      `{"detail": ..., "code": "degenerate_corners"}`. The frontend pre-validates
      so degenerate payloads only arrive on out-of-order debounced submissions.
    """
    raw = [{"x": c.x, "y": c.y} for c in body.corners] if body.corners is not None else None
    # Defer validation to the VO — it raises CollinearCornersError on bad input,
    # which the global handler maps to 422.
    corners_vo = PerspectiveCorners.from_dicts(raw) if raw is not None else None
    uc = UpdatePerspective(repo)
    updated = await uc.execute(project_id, user_id, corners_vo, version=body.version)
    if not updated:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return _entity_to_response(updated)


@router.patch(
    "/{project_id}/calibration",
    response_model=VisualizationProjectResponse,
    summary="Partial update — scale calibration",
    responses={
        409: {"description": "Stale version (multi-tab race) — caller must refetch"},
    },
)
async def patch_calibration(
    project_id: str,
    body: CalibrationUpdateBody,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    """Replace the scale calibration atomically. Sets
    `calibration_auto_detected=False` because the user is editing manually."""
    uc = UpdateCalibration(repo)
    updated = await uc.execute(
        project_id, user_id, body.calibration.to_vo(), version=body.version
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return _entity_to_response(updated)


# ─── Phase 6 — depth-based auto-perspective ──────────────────────────


class AutoPerspectiveResponse(BaseModel):
    """Response body for `POST /auto-perspective`.

    `corners` are in *photo pixel* coordinates (the depth-map coords have been
    scaled back), matching the wire format the frontend uses for
    `perspective_corners` everywhere else. The client can immediately PATCH
    these via `/perspective` — no coordinate reinterpretation needed.

    `confidence` is the RANSAC inlier ratio (0..1). The frontend uses it to
    decide whether to silently apply or surface an "is this right?" banner.
    For the v1 plane fitter we expose the inlier ratio directly; future
    versions may blend in edge-quality or mask-size signals.
    """

    corners: list[PointDTO]
    confidence: float = Field(ge=0.0, le=1.0)


def _decode_data_url(photo_url: str) -> bytes:
    """Decode a `data:image/...;base64,...` URL into raw bytes.

    Why here and not in the use case: data-URL decoding is a transport
    concern (the frontend uploads images as data URLs to avoid a separate
    multipart/form-data path). The domain/application layers only deal in
    raw bytes.
    """
    if not photo_url:
        raise HTTPException(status_code=422, detail="Project has no photo_url")
    if not photo_url.startswith("data:"):
        # Non-data URLs would require an HTTP fetch from this process — not
        # in scope for Phase 6 (we only accept uploads-as-data-URLs today).
        raise HTTPException(
            status_code=422,
            detail="Only data: URLs are supported for auto-perspective",
        )
    try:
        header, b64 = photo_url.split(",", 1)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Malformed data URL: {e}") from e
    if ";base64" not in header:
        raise HTTPException(status_code=422, detail="Only base64 data URLs supported")
    try:
        return base64.b64decode(b64, validate=False)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Cannot decode image: {e}") from e


def _resize_mask_nearest(
    src: list[bool],
    src_w: int,
    src_h: int,
    dst_w: int,
    dst_h: int,
) -> list[bool]:
    """Nearest-neighbour resize of a boolean mask.

    Pure-stdlib — keeps this module free of numpy at the API layer. The depth
    maps are small (64×64 stub, 256×256 MiDaS) so the O(dst_w × dst_h) cost is
    negligible. Nearest-neighbour preserves mask semantics (no fractional
    pixels); bilinear would introduce false-positive edges.
    """
    if src_w <= 0 or src_h <= 0 or dst_w <= 0 or dst_h <= 0:
        raise HTTPException(status_code=422, detail="Invalid mask dimensions")
    if len(src) != src_w * src_h:
        raise HTTPException(
            status_code=422,
            detail=f"Mask length {len(src)} != {src_w}*{src_h}",
        )
    out: list[bool] = [False] * (dst_w * dst_h)
    x_scale = src_w / dst_w
    y_scale = src_h / dst_h
    for dy in range(dst_h):
        sy = min(int(dy * y_scale), src_h - 1)
        src_row = sy * src_w
        dst_row = dy * dst_w
        for dx in range(dst_w):
            sx = min(int(dx * x_scale), src_w - 1)
            out[dst_row + dx] = src[src_row + sx]
    return out


@router.post(
    "/{project_id}/auto-perspective",
    response_model=AutoPerspectiveResponse,
    summary="Depth-based auto-perspective detection",
    responses={
        422: {
            "description": "Plane fit failed (`code: plane_fit_failed`) or "
            "malformed photo/mask payload"
        },
        503: {"description": "Depth backend unavailable (`code: depth_unavailable`)"},
    },
)
async def auto_perspective(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
    depth_estimator: DepthEstimator = Depends(get_depth_estimator),
):
    """Run monocular depth + RANSAC plane fit on the stored photo/mask and
    return perspective corners for the client to adopt.

    Why server-side: the depth model is ~150 MB and runs ~1 s/image on CPU —
    keeping it in the backend avoids a WASM download on every client and lets
    us upgrade to GPU inference without a client redeploy. The frontend's
    OpenCV LSD path stays the primary fast-path; this endpoint is the
    fallback when edge-based detection returned low confidence (empty walls,
    single-tone paint).

    Coord contract: corners are returned in **photo pixel coordinates** (not
    depth-map coords). The API layer handles the rescaling so the frontend
    doesn't need to know the estimator's output resolution — which is a
    provider-implementation detail (64 px stub vs 256 px MiDaS).

    The use case is not invoked directly because its `execute()` expects the
    mask to already be aligned with the depth map dimensions. That alignment
    is infrastructure glue, so we do it here and call `PlaneFittingService`
    (domain) straight away. The use case remains as-is for callers that
    already have matched dims (e.g., internal scripts that probe the
    estimator first).
    """
    # ─── 1. Ownership + payload sanity ──────────────────────────────
    uc_get = GetVisualizationProject(repo)
    project = await uc_get.execute(project_id, user_id)
    if not project:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    if not project.wall_mask_base64:
        raise HTTPException(
            status_code=422, detail="Project has no wall mask; draw/segment first"
        )
    if project.photo_width <= 0 or project.photo_height <= 0:
        raise HTTPException(status_code=422, detail="Project has no photo dimensions")

    # ─── 2. Decode photo → bytes, mask → list[bool] at photo size ───
    image_bytes = _decode_data_url(project.photo_url)

    try:
        mask_bytes = base64.b64decode(project.wall_mask_base64, validate=False)
    except (binascii.Error, ValueError) as e:
        raise HTTPException(status_code=422, detail=f"Cannot decode mask: {e}") from e
    expected_len = project.photo_width * project.photo_height
    if len(mask_bytes) != expected_len:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Wall mask length {len(mask_bytes)} does not match "
                f"photo_width*photo_height={expected_len}"
            ),
        )
    photo_mask = [b != 0 for b in mask_bytes]

    # ─── 3. Depth estimation — the provider controls output size ───
    # `DepthEstimator.estimate` raises `DepthEstimationError` on failure,
    # which the global handler maps to 503. We don't swallow it here.
    depth = await depth_estimator.estimate(image_bytes)

    # ─── 4. Resize mask to depth dims and fit plane ────────────────
    depth_mask = _resize_mask_nearest(
        photo_mask,
        project.photo_width,
        project.photo_height,
        depth.width,
        depth.height,
    )
    # `PlaneFittingService` is deliberately instantiated per-request: it is
    # stateless except for a RNG the default of which seeds to 42 for
    # deterministic RANSAC. The cost is a few tuple/list allocations — far
    # cheaper than holding shared state that would leak test randomness
    # across requests.
    fitter = PlaneFittingService()
    try:
        corners_depth = fitter.fit(depth, depth_mask)
    except PlaneFittingError:
        # Surface via the registered handler → 422 + `code: plane_fit_failed`.
        raise

    # ─── 5. Scale corners back to photo coordinates ────────────────
    sx = project.photo_width / depth.width
    sy = project.photo_height / depth.height
    pts = [
        {"x": corners_depth.top_left.x * sx, "y": corners_depth.top_left.y * sy},
        {"x": corners_depth.top_right.x * sx, "y": corners_depth.top_right.y * sy},
        {"x": corners_depth.bottom_right.x * sx, "y": corners_depth.bottom_right.y * sy},
        {"x": corners_depth.bottom_left.x * sx, "y": corners_depth.bottom_left.y * sy},
    ]

    # Confidence: inliers/total from the plane fitter. The VO doesn't carry it
    # today, so we re-count how many mask pixels the final BBox encloses as a
    # cheap proxy (fraction of depth-map mask that falls inside the returned
    # quad). For axis-aligned BBoxes this is exact; future quad projections
    # would need a proper point-in-quad test. Kept here (not in the domain)
    # because it's a transport-level reporting concern.
    enclosed = 0
    total_mask_px = sum(1 for px in depth_mask if px)
    if total_mask_px > 0:
        x_min = corners_depth.top_left.x
        x_max = corners_depth.top_right.x
        y_min = corners_depth.top_left.y
        y_max = corners_depth.bottom_left.y
        for y in range(depth.height):
            row_off = y * depth.width
            if y < y_min or y > y_max:
                continue
            for x in range(depth.width):
                if depth_mask[row_off + x] and x_min <= x <= x_max:
                    enclosed += 1
        confidence = min(1.0, max(0.0, enclosed / total_mask_px))
    else:
        confidence = 0.0

    return {
        "corners": pts,
        "confidence": confidence,
    }
