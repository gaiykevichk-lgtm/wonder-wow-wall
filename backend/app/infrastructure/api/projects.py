from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.container import get_project_repo
from app.utils.dependencies import get_current_user_id

router = APIRouter()


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
async def create_project(
    body: ProjectRequest,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_project_repo),
):
    project = await repo.create(user_id, body.model_dump())
    return project


@router.get("", response_model=list[ProjectSchema])
async def list_projects(
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_project_repo),
):
    return await repo.list_by_user(user_id)


@router.get("/{project_id}", response_model=ProjectSchema)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_project_repo),
):
    project = await repo.get_by_id(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectSchema)
async def update_project(
    project_id: str,
    body: ProjectRequest,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_project_repo),
):
    project = await repo.get_by_id(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    updated = await repo.update(project_id, body.model_dump())
    return updated


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    repo=Depends(get_project_repo),
):
    project = await repo.get_by_id(project_id)
    if not project or project["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    await repo.delete(project_id)
    return {"status": "deleted"}
