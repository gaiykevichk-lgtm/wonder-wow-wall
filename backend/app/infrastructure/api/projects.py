from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.utils.dependencies import get_current_user_id

router = APIRouter()

# In-memory project storage (will be replaced by DB)
_projects: dict[str, dict] = {}


class ProjectRequest(BaseModel):
    name: str
    wall_cols: int = 5
    wall_rows: int = 3
    wall_color: str = "#ffffff"
    panels: list[dict] = []
    total_price: int = 0


class ProjectSchema(BaseModel):
    id: str
    name: str
    wall_cols: int
    wall_rows: int
    wall_color: str
    panels: list[dict]
    total_price: int
    created_at: str
    updated_at: str


@router.post("", response_model=ProjectSchema, status_code=201)
async def create_project(body: ProjectRequest, user_id: str = Depends(get_current_user_id)):
    now = datetime.utcnow().isoformat()
    project = {
        "id": str(uuid4()),
        "user_id": user_id,
        "name": body.name,
        "wall_cols": body.wall_cols,
        "wall_rows": body.wall_rows,
        "wall_color": body.wall_color,
        "panels": body.panels,
        "total_price": body.total_price,
        "created_at": now,
        "updated_at": now,
    }
    _projects[project["id"]] = project
    return project


@router.get("", response_model=list[ProjectSchema])
async def list_projects(user_id: str = Depends(get_current_user_id)):
    return sorted(
        [p for p in _projects.values() if p["user_id"] == user_id],
        key=lambda p: p["created_at"],
        reverse=True,
    )


@router.get("/{project_id}", response_model=ProjectSchema)
async def get_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectSchema)
async def update_project(project_id: str, body: ProjectRequest, user_id: str = Depends(get_current_user_id)):
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    project.update({
        "name": body.name,
        "wall_cols": body.wall_cols,
        "wall_rows": body.wall_rows,
        "wall_color": body.wall_color,
        "panels": body.panels,
        "total_price": body.total_price,
        "updated_at": datetime.utcnow().isoformat(),
    })
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    project = _projects.get(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    del _projects[project_id]
    return {"status": "deleted"}
