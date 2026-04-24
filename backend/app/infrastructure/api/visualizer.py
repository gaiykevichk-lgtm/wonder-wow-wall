"""FastAPI router for the Visualizer bounded context.

Phase 5C extensions:
- POST/PUT bodies and the GET response gain typed `calibration`,
  `perspective_auto_detected`, `calibration_auto_detected`, and `version`.
- New PATCH endpoints for partial updates: `/perspective` and `/calibration`.
  These are what the frontend's debounced corner-drag/calibration-save calls.
- Domain exceptions (`CollinearCornersError`, `StaleSceneVersionError`) bubble
  up to the global handlers wired in `main.py` and render as 422 / 409.
"""

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
from app.container import get_visualization_repo
from app.domain.visualizer.entities import PlacedPanelData, VisualizationProject
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


class PointSchema(BaseModel):
    x: float
    y: float


class CalibrationSchema(BaseModel):
    """API DTO for `ScaleCalibration` VO. Snake_case wire format — Phase 5C
    intentionally keeps backend DTOs snake_case (matching legacy fields like
    `calibration_pixels_per_cm`); the frontend layer converts to camelCase."""

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
    def from_vo(cls, vo: ScaleCalibration) -> "CalibrationSchema":
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
    perspective_corners: list[PointSchema] | None = None
    placement_mode: str = "manual"
    # ─── Phase 5C additions ───
    calibration: CalibrationSchema | None = None
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
    perspective_corners: list[PointSchema] | None = None
    placement_mode: str = "manual"
    # ─── Phase 5C additions ───
    calibration: CalibrationSchema | None = None
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
    perspective_corners: list[PointSchema] | None
    placement_mode: str
    created_at: str
    updated_at: str
    # ─── Phase 5C additions ───
    calibration: CalibrationSchema | None = None
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

    corners: list[PointSchema] | None = Field(
        default=None,
        description="Four points TL→TR→BR→BL, or null to clear the perspective.",
    )
    version: int = Field(ge=1, description="Server-side version the client last loaded.")


class CalibrationUpdateBody(BaseModel):
    """Body for `PATCH /calibration`."""

    calibration: CalibrationSchema
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
    calibration_dict = CalibrationSchema.from_vo(p.calibration).model_dump() if p.calibration else None
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


@router.put("/{project_id}", response_model=VisualizationProjectResponse)
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
