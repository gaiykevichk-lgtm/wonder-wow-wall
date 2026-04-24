"""Use cases for the Visualizer bounded context.

Phase 5C extensions:
- `UpdateVisualizationProject` now passes the optimistic-lock `version` through
  to the repository so multi-tab races surface as `StaleSceneVersionError`
  instead of silent last-write-wins.
- New focused use cases `UpdatePerspective` / `UpdateCalibration` perform
  partial updates without forcing the client to send the whole `Scene` payload
  on every drag of a corner — that path debounces ~1 s on the frontend.
"""

from dataclasses import replace
from datetime import datetime

from app.domain.visualizer.entities import VisualizationProject
from app.domain.visualizer.repositories import VisualizationProjectRepository
from app.domain.visualizer.value_objects import (
    PerspectiveCorners,
    ScaleCalibration,
)


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
    """Full-scene PUT.

    Phase 5C wires the `version` field end-to-end (B34 closure):
      * If the client supplies a `version` in `project`, it propagates to the
        repository, which raises `StaleSceneVersionError` on mismatch.
      * If the client omits it (entity carries the default `1`), we copy the
        server's current `version` so the existing pre-5C contract — last-write-
        wins for clients that don't yet know about optimistic locking — keeps
        working. The frontend opts in to safer updates by sending the version it
        last loaded.
    """

    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(
        self,
        project_id: str,
        user_id: str,
        project: VisualizationProject,
        version: int | None = None,
    ) -> VisualizationProject | None:
        existing = await self.repo.get_by_id(project_id)
        if not existing or existing.user_id != user_id:
            return None
        project.id = project_id
        project.user_id = user_id
        project.created_at = existing.created_at
        project.updated_at = datetime.utcnow()
        # B34 closure — passthrough of expected version.
        # `None` means the caller did not opt into optimistic locking and we
        # carry the server's version forward (legacy behaviour preserved).
        project.version = version if version is not None else existing.version
        return await self.repo.update(project)


class DeleteVisualizationProject:
    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(self, project_id: str, user_id: str) -> bool:
        project = await self.repo.get_by_id(project_id)
        if not project or project.user_id != user_id:
            return False
        return await self.repo.delete(project_id)


# ─── Phase 5C — partial updates ──────────────────────────────────────


class UpdatePerspective:
    """Partial update for the four perspective corners.

    Why a dedicated use case (rather than reusing `UpdateVisualizationProject`):
    the frontend debounces corner drags at ~1 s and ships a 4-point payload —
    forcing it to round-trip the entire `Scene` (photo, mask, panels) on every
    save would balloon traffic. Mirrors the equivalent split on the API
    (PATCH `/perspective`).

    Behaviour:
    * `corners=None` clears the perspective and resets the auto-detected flag.
    * Any other value goes through `PerspectiveCorners.from_dicts` validation —
      a degenerate quad raises `CollinearCornersError`, which the API layer
      maps to HTTP 422.
    * `perspective_auto_detected` is forced to `False` because *the user is
      typing*; the green "auto" banner only applies to detector output.
    * Optimistic-lock via `version` flows to the repository unchanged.
    """

    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(
        self,
        project_id: str,
        user_id: str,
        corners: PerspectiveCorners | None,
        version: int,
    ) -> VisualizationProject | None:
        existing = await self.repo.get_by_id(project_id)
        if not existing or existing.user_id != user_id:
            return None
        # B41 closure — never mutate `existing` before calling repo.update().
        # InMemoryRepo.get_by_id returns the same dataclass reference it stores,
        # so writing `existing.version = version` would silently update the
        # stored row in-place and the repo's optimistic-lock check (compare
        # stored.version vs incoming.version) would trivially pass against
        # itself. Copying via dataclasses.replace decouples the entity we hand
        # to the repo from the row it owns.
        update = replace(
            existing,
            perspective_corners=corners.as_dicts() if corners is not None else None,
            perspective_auto_detected=False,
            updated_at=datetime.utcnow(),
            version=version,  # client-supplied; repo compares against its row
        )
        return await self.repo.update(update)


class UpdateCalibration:
    """Partial update for `ScaleCalibration`.

    Mirrors `UpdatePerspective`. Also keeps the legacy float
    `calibration_pixels_per_cm` mirror in sync — it is the source of truth for
    pre-5C clients (and for the few places in the codebase that haven't been
    promoted to the typed VO yet, see B40 deferred to a follow-up).
    """

    def __init__(self, repo: VisualizationProjectRepository):
        self.repo = repo

    async def execute(
        self,
        project_id: str,
        user_id: str,
        calibration: ScaleCalibration,
        version: int,
    ) -> VisualizationProject | None:
        existing = await self.repo.get_by_id(project_id)
        if not existing or existing.user_id != user_id:
            return None
        # B41 closure — see UpdatePerspective.execute for rationale. Build a
        # fresh entity instead of mutating `existing` so the InMemory repo's
        # optimistic-lock check doesn't compare a stored row against itself.
        update = replace(
            existing,
            calibration=calibration,
            calibration_pixels_per_cm=calibration.pixels_per_cm,  # legacy mirror
            calibration_auto_detected=False,
            updated_at=datetime.utcnow(),
            version=version,
        )
        return await self.repo.update(update)
