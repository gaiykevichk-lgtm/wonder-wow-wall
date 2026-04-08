from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.application.visualizer.use_cases import (
    SaveVisualizationProject,
    GetVisualizationProjects,
    GetVisualizationProject,
    UpdateVisualizationProject,
    DeleteVisualizationProject,
)
from app.container import get_visualization_repo
from app.domain.visualizer.entities import VisualizationProject, PlacedPanelData
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


class VisualizationProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    photo_url: str = ""
    photo_width: int = Field(0, ge=0)
    photo_height: int = Field(0, ge=0)
    wall_mask_base64: str = Field("", max_length=10_000_000)  # ~7.5 MB base64
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelSchema] = Field(default_factory=list, max_length=500)
    perspective_corners: list[PointSchema] | None = None
    placement_mode: str = "manual"


class VisualizationProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    photo_url: str = ""
    photo_width: int = Field(0, ge=0)
    photo_height: int = Field(0, ge=0)
    wall_mask_base64: str = Field("", max_length=10_000_000)
    calibration_pixels_per_cm: float = 5.0
    panels: list[PlacedPanelSchema] = Field(default_factory=list, max_length=500)
    perspective_corners: list[PointSchema] | None = None
    placement_mode: str = "manual"


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


class VisualizationProjectListItem(BaseModel):
    id: str
    name: str
    photo_width: int
    photo_height: int
    panel_count: int
    placement_mode: str
    created_at: str
    updated_at: str


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
    return VisualizationProject(
        name=data.name,
        photo_url=data.photo_url,
        photo_width=data.photo_width,
        photo_height=data.photo_height,
        wall_mask_base64=data.wall_mask_base64,
        calibration_pixels_per_cm=data.calibration_pixels_per_cm,
        panels=panels,
        perspective_corners=corners,
        placement_mode=data.placement_mode,
    )


def _entity_to_response(p: VisualizationProject) -> dict:
    corners = None
    if p.perspective_corners:
        corners = [{"x": c["x"], "y": c["y"]} for c in p.perspective_corners]
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

@router.post("", response_model=VisualizationProjectResponse, status_code=201)
async def create_visualization_project(
    request: Request,
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
    request: Request,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    uc = GetVisualizationProjects(repo)
    projects = await uc.execute(user_id)
    return [_entity_to_list_item(p) for p in projects]


@router.get("/{project_id}", response_model=VisualizationProjectResponse)
async def get_visualization_project(
    request: Request,
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
    request: Request,
    project_id: str,
    body: VisualizationProjectUpdate,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    entity = _schema_to_entity(body)
    uc = UpdateVisualizationProject(repo)
    updated = await uc.execute(project_id, user_id, entity)
    if not updated:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return _entity_to_response(updated)


@router.delete("/{project_id}")
async def delete_visualization_project(
    request: Request,
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_visualization_repo),
):
    uc = DeleteVisualizationProject(repo)
    deleted = await uc.execute(project_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Visualization project not found")
    return {"status": "deleted"}
