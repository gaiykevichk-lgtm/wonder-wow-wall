from datetime import datetime

from app.domain.visualizer.entities import VisualizationProject
from app.domain.visualizer.repositories import VisualizationProjectRepository


class SaveVisualizationProject:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(self, user_id: str, project: VisualizationProject) -> VisualizationProject:
        project.user_id = user_id
        return await self.repo.save(project)


class GetVisualizationProjects:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(self, user_id: str) -> list[VisualizationProject]:
        return await self.repo.get_by_user(user_id)


class GetVisualizationProject:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(self, project_id: str, user_id: str) -> VisualizationProject | None:
        project = await self.repo.get_by_id(project_id)
        if project and project.user_id != user_id:
            return None
        return project


class UpdateVisualizationProject:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(
        self, project_id: str, user_id: str, project: VisualizationProject,
    ) -> VisualizationProject | None:
        existing = await self.repo.get_by_id(project_id)
        if not existing or existing.user_id != user_id:
            return None
        project.id = project_id
        project.user_id = user_id
        project.created_at = existing.created_at
        project.updated_at = datetime.utcnow()
        return await self.repo.update(project)


class DeleteVisualizationProject:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(self, project_id: str, user_id: str) -> bool:
        project = await self.repo.get_by_id(project_id)
        if not project or project.user_id != user_id:
            return False
        return await self.repo.delete(project_id)
