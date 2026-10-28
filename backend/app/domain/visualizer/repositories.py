from abc import ABC, abstractmethod

from .entities import VisualizationProject


class VisualizationProjectRepository(ABC):
    @abstractmethod
    async def get_by_id(self, project_id: str) -> VisualizationProject | None: ...

    @abstractmethod
    async def get_by_user(self, user_id: str) -> list[VisualizationProject]: ...

    @abstractmethod
    async def save(self, project: VisualizationProject) -> VisualizationProject: ...

    @abstractmethod
    async def update(self, project: VisualizationProject) -> VisualizationProject: ...

    @abstractmethod
    async def delete(self, project_id: str) -> bool: ...
