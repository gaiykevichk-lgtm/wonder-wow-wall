"""Visualization project repositories — In-Memory + SQL implementations."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.visualizer.entities import VisualizationProject, PlacedPanelData
from app.domain.visualizer.repositories import VisualizationProjectRepository
from app.infrastructure.persistence.models import VisualizationProjectModel


# ═══════════════════════════════════════════════════════════════════════
# Mappers: ORM ↔ Domain
# ═══════════════════════════════════════════════════════════════════════

def _model_to_entity(m: VisualizationProjectModel) -> VisualizationProject:
    panels_raw = m.panels_json if isinstance(m.panels_json, list) else []
    panels = [
        PlacedPanelData(
            design_id=p.get("design_id", ""),
            design_name=p.get("design_name", ""),
            design_image=p.get("design_image", ""),
            size_key=p.get("size_key", "30x30"),
            color=p.get("color", "#CCCCCC"),
            color_name=p.get("color_name", ""),
            x=p.get("x", 0),
            y=p.get("y", 0),
            render_width=p.get("render_width", 150),
            render_height=p.get("render_height", 150),
        )
        for p in panels_raw
    ]
    return VisualizationProject(
        id=m.id,
        user_id=m.user_id,
        name=m.name,
        photo_url=m.photo_url,
        photo_width=m.photo_width,
        photo_height=m.photo_height,
        wall_mask_base64=m.wall_mask_base64,
        calibration_pixels_per_cm=m.calibration_pixels_per_cm,
        panels=panels,
        perspective_corners=m.perspective_corners,
        placement_mode=m.placement_mode,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _entity_to_panels_json(panels: list[PlacedPanelData]) -> list[dict]:
    return [
        {
            "design_id": p.design_id,
            "design_name": p.design_name,
            "design_image": p.design_image,
            "size_key": p.size_key,
            "color": p.color,
            "color_name": p.color_name,
            "x": p.x,
            "y": p.y,
            "render_width": p.render_width,
            "render_height": p.render_height,
        }
        for p in panels
    ]


# ═══════════════════════════════════════════════════════════════════════
# In-Memory (for tests / USE_MEMORY_REPOS=true)
# ═══════════════════════════════════════════════════════════════════════

class InMemoryVisualizationProjectRepository(VisualizationProjectRepository):

    def __init__(self):
        self._projects: dict[str, VisualizationProject] = {}

    async def get_by_id(self, project_id: str) -> VisualizationProject | None:
        return self._projects.get(project_id)

    async def get_by_user(self, user_id: str) -> list[VisualizationProject]:
        return sorted(
            [p for p in self._projects.values() if p.user_id == user_id],
            key=lambda p: p.created_at,
            reverse=True,
        )

    async def save(self, project: VisualizationProject) -> VisualizationProject:
        if not project.id:
            project.id = str(uuid4())
        now = datetime.utcnow()
        project.created_at = now
        project.updated_at = now
        self._projects[project.id] = project
        return project

    async def update(self, project: VisualizationProject) -> VisualizationProject:
        self._projects[project.id] = project
        return project

    async def delete(self, project_id: str) -> bool:
        if project_id in self._projects:
            del self._projects[project_id]
            return True
        return False


# ═══════════════════════════════════════════════════════════════════════
# SQL (PostgreSQL via SQLAlchemy async)
# ═══════════════════════════════════════════════════════════════════════

class SqlVisualizationProjectRepository(VisualizationProjectRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_id(self, project_id: str) -> VisualizationProject | None:
        model = await self._session.get(VisualizationProjectModel, project_id)
        return _model_to_entity(model) if model else None

    async def get_by_user(self, user_id: str) -> list[VisualizationProject]:
        result = await self._session.execute(
            select(VisualizationProjectModel)
            .where(VisualizationProjectModel.user_id == user_id)
            .order_by(desc(VisualizationProjectModel.created_at))
        )
        return [_model_to_entity(m) for m in result.scalars().all()]

    async def save(self, project: VisualizationProject) -> VisualizationProject:
        now = datetime.utcnow()
        model = VisualizationProjectModel(
            id=project.id or str(uuid4()),
            user_id=project.user_id,
            name=project.name,
            photo_url=project.photo_url,
            photo_width=project.photo_width,
            photo_height=project.photo_height,
            wall_mask_base64=project.wall_mask_base64,
            calibration_pixels_per_cm=project.calibration_pixels_per_cm,
            panels_json=_entity_to_panels_json(project.panels),
            perspective_corners=project.perspective_corners,
            placement_mode=project.placement_mode,
            created_at=now,
            updated_at=now,
        )
        self._session.add(model)
        await self._session.flush()
        return _model_to_entity(model)

    async def update(self, project: VisualizationProject) -> VisualizationProject:
        model = await self._session.get(VisualizationProjectModel, project.id)
        if not model:
            raise ValueError(f"VisualizationProject {project.id} not found")
        model.name = project.name
        model.photo_url = project.photo_url
        model.photo_width = project.photo_width
        model.photo_height = project.photo_height
        model.wall_mask_base64 = project.wall_mask_base64
        model.calibration_pixels_per_cm = project.calibration_pixels_per_cm
        model.panels_json = _entity_to_panels_json(project.panels)
        model.perspective_corners = project.perspective_corners
        model.placement_mode = project.placement_mode
        model.updated_at = project.updated_at
        await self._session.flush()
        return _model_to_entity(model)

    async def delete(self, project_id: str) -> bool:
        model = await self._session.get(VisualizationProjectModel, project_id)
        if not model:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True
