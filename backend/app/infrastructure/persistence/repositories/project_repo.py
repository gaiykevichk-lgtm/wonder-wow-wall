"""Project repositories — ABC + In-Memory + SQL implementations.

Projects don't have a domain layer (they are simple CRUD for constructor state).
Repository abstraction lives here in infrastructure as a thin persistence interface.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models import ProjectModel


class ProjectRepository(ABC):
    @abstractmethod
    async def create(self, user_id: str, data: dict) -> dict: ...

    @abstractmethod
    async def list_by_user(self, user_id: str) -> list[dict]: ...

    @abstractmethod
    async def get_by_id(self, project_id: str) -> dict | None: ...

    @abstractmethod
    async def update(self, project_id: str, data: dict) -> dict | None: ...

    @abstractmethod
    async def delete(self, project_id: str) -> bool: ...


class InMemoryProjectRepository(ProjectRepository):

    def __init__(self):
        self._projects: dict[str, dict] = {}

    async def create(self, user_id: str, data: dict) -> dict:
        now = datetime.utcnow().isoformat()
        project = {
            "id": str(uuid4()),
            "user_id": user_id,
            "name": data.get("name", ""),
            "wall_cols": data.get("wall_cols", 5),
            "wall_rows": data.get("wall_rows", 3),
            "wall_color": data.get("wall_color", "#ffffff"),
            "panels": data.get("panels", []),
            "total_price": data.get("total_price", 0),
            "created_at": now,
            "updated_at": now,
        }
        self._projects[project["id"]] = project
        return project

    async def list_by_user(self, user_id: str) -> list[dict]:
        return sorted(
            [p for p in self._projects.values() if p["user_id"] == user_id],
            key=lambda p: p["created_at"],
            reverse=True,
        )

    async def get_by_id(self, project_id: str) -> dict | None:
        return self._projects.get(project_id)

    async def update(self, project_id: str, data: dict) -> dict | None:
        project = self._projects.get(project_id)
        if not project:
            return None
        project.update({
            "name": data.get("name", project["name"]),
            "wall_cols": data.get("wall_cols", project["wall_cols"]),
            "wall_rows": data.get("wall_rows", project["wall_rows"]),
            "wall_color": data.get("wall_color", project["wall_color"]),
            "panels": data.get("panels", project["panels"]),
            "total_price": data.get("total_price", project["total_price"]),
            "updated_at": datetime.utcnow().isoformat(),
        })
        return project

    async def delete(self, project_id: str) -> bool:
        if project_id in self._projects:
            del self._projects[project_id]
            return True
        return False


class SqlProjectRepository(ProjectRepository):

    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, user_id: str, data: dict) -> dict:
        now = datetime.utcnow()
        model = ProjectModel(
            id=str(uuid4()), user_id=user_id,
            name=data.get("name", ""),
            wall_cols=data.get("wall_cols", 5),
            wall_rows=data.get("wall_rows", 3),
            wall_color=data.get("wall_color", "#ffffff"),
            panels=data.get("panels", []),
            total_price=data.get("total_price", 0),
            created_at=now, updated_at=now,
        )
        self._session.add(model)
        await self._session.flush()
        return _model_to_dict(model)

    async def list_by_user(self, user_id: str) -> list[dict]:
        result = await self._session.execute(
            select(ProjectModel)
            .where(ProjectModel.user_id == user_id)
            .order_by(desc(ProjectModel.created_at))
        )
        return [_model_to_dict(m) for m in result.scalars().all()]

    async def get_by_id(self, project_id: str) -> dict | None:
        model = await self._session.get(ProjectModel, project_id)
        return _model_to_dict(model) if model else None

    async def update(self, project_id: str, data: dict) -> dict | None:
        model = await self._session.get(ProjectModel, project_id)
        if not model:
            return None
        model.name = data.get("name", model.name)
        model.wall_cols = data.get("wall_cols", model.wall_cols)
        model.wall_rows = data.get("wall_rows", model.wall_rows)
        model.wall_color = data.get("wall_color", model.wall_color)
        model.panels = data.get("panels", model.panels)
        model.total_price = data.get("total_price", model.total_price)
        model.updated_at = datetime.utcnow()
        await self._session.flush()
        return _model_to_dict(model)

    async def delete(self, project_id: str) -> bool:
        model = await self._session.get(ProjectModel, project_id)
        if not model:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True


def _model_to_dict(m: ProjectModel) -> dict:
    return {
        "id": m.id,
        "user_id": m.user_id,
        "name": m.name,
        "wall_cols": m.wall_cols,
        "wall_rows": m.wall_rows,
        "wall_color": m.wall_color,
        "panels": m.panels if isinstance(m.panels, list) else [],
        "total_price": m.total_price,
        "created_at": m.created_at.isoformat() if isinstance(m.created_at, datetime) else str(m.created_at),
        "updated_at": m.updated_at.isoformat() if isinstance(m.updated_at, datetime) else str(m.updated_at),
    }
