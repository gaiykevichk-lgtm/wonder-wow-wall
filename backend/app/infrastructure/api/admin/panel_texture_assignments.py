"""Admin CRUD for panel-to-texture assignments."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.container import get_db_session, get_panel_repo, get_texture_repo, get_audit_repo
from app.infrastructure.persistence.models import PanelTextureAssignmentModel, PanelModel
from app.utils.dependencies import get_current_admin_id

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType

router = APIRouter()


class PanelTextureAssignmentResponse(BaseModel):
    id: str
    panel_id: str
    texture_id: str
    is_active: bool
    is_catalog_row: bool = False
    sort_order: int = 0
    created_at: str
    updated_at: str


class ReplacePanelTextureAssignmentsRequest(BaseModel):
    texture_ids: list[str] = Field(default_factory=list)
    expected_texture_ids: list[str] | None = None


def _to_response(row: PanelTextureAssignmentModel) -> PanelTextureAssignmentResponse:
    return PanelTextureAssignmentResponse(
        id=row.id,
        panel_id=row.panel_id,
        texture_id=row.texture_id,
        is_active=row.is_active,
        is_catalog_row=row.is_catalog_row,
        sort_order=row.sort_order,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )


@router.get(
    "/panel-texture-assignments",
    response_model=list[PanelTextureAssignmentResponse],
)
async def list_panel_texture_assignments(
    panel_id: str | None = None,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    query = select(PanelTextureAssignmentModel).where(
        PanelTextureAssignmentModel.is_active.is_(True)
    )
    if panel_id:
        query = query.where(PanelTextureAssignmentModel.panel_id == panel_id)
    rows = (await session.execute(query.order_by(
        PanelTextureAssignmentModel.sort_order,
        PanelTextureAssignmentModel.created_at,
        PanelTextureAssignmentModel.id,
    ))).scalars().all()
    return [_to_response(row) for row in rows]


@router.put(
    "/panels/{panel_id}/texture-assignments",
    response_model=list[PanelTextureAssignmentResponse],
)
async def replace_panel_texture_assignments(
    panel_id: str,
    body: ReplacePanelTextureAssignmentsRequest,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
    panel_repo=Depends(get_panel_repo),
    texture_repo=Depends(get_texture_repo),
    audit_repo=Depends(get_audit_repo),
):
    """Idempotently replace the allowed texture set for one panel.

    Removing an assignment never removes variants or their image paths. If the
    moderator enables it later, existing product data becomes available again.
    """
    panel = await panel_repo.get_by_id(panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")

    # Serialize replacement of the set, including when it has no rows yet.
    await session.execute(select(PanelModel.id).where(
        PanelModel.id == panel_id
    ).with_for_update())

    requested = list(dict.fromkeys(body.texture_ids))
    for texture_id in requested:
        if not await texture_repo.get_by_id(texture_id):
            raise HTTPException(
                status_code=404,
                detail=f"Texture {texture_id} not found",
            )

    existing_rows = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == panel_id
        )
    )).scalars().all()
    if body.expected_texture_ids is not None:
        current = {row.texture_id for row in existing_rows if row.is_active}
        if current != set(body.expected_texture_ids):
            raise HTTPException(status_code=409, detail="Назначения изменены другим редактором. Откройте форму заново.")
    before = sorted(row.texture_id for row in existing_rows if row.is_active)
    existing = {row.texture_id: row for row in existing_rows}
    now = datetime.utcnow()

    for texture_id, row in existing.items():
        row.is_active = texture_id in requested
        row.updated_at = now
    for texture_id in requested:
        if texture_id not in existing:
            session.add(PanelTextureAssignmentModel(
                id=str(uuid4()),
                panel_id=panel_id,
                texture_id=texture_id,
                is_active=True,
                created_at=now,
                updated_at=now,
            ))
    await session.flush()
    if before != sorted(requested):
        await RecordAuditEntry(audit_repo).execute(
            actor_id=_admin_id,
            action=AuditAction.PANEL_TEXTURE_ASSIGNMENTS_UPDATE,
            target_type=AuditTargetType.PANEL, target_id=panel_id,
            payload={"before_texture_ids": before, "after_texture_ids": sorted(requested)},
        )

    rows = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == panel_id,
            PanelTextureAssignmentModel.is_active.is_(True),
        ).order_by(PanelTextureAssignmentModel.created_at)
    )).scalars().all()
    return [_to_response(row) for row in rows]


@router.delete("/panel-texture-assignments/{assignment_id}", status_code=204)
async def disable_panel_texture_assignment(
    assignment_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
    audit_repo=Depends(get_audit_repo),
):
    row = await session.get(PanelTextureAssignmentModel, assignment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    was_active = row.is_active
    row.is_active = False
    row.updated_at = datetime.utcnow()
    if was_active:
        await RecordAuditEntry(audit_repo).execute(
            actor_id=_admin_id, action=AuditAction.PANEL_TEXTURE_ASSIGNMENTS_UPDATE,
            target_type=AuditTargetType.PANEL, target_id=row.panel_id,
            payload={"disabled_texture_id": row.texture_id},
        )


class BatchAssignmentsRequest(BaseModel):
    panel_ids: list[str] = Field(min_length=1)
    texture_ids: list[str] = Field(default_factory=list)
    mode: str = Field(pattern="^(add|remove|replace)$")


@router.post('/panel-texture-assignments/batch')
async def batch_panel_texture_assignments(
    body: BatchAssignmentsRequest,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
    panel_repo=Depends(get_panel_repo),
    texture_repo=Depends(get_texture_repo),
    audit_repo=Depends(get_audit_repo),
):
    """One transaction for the selected panels; never create product variants."""
    panel_ids = sorted(set(body.panel_ids))
    for panel_id in panel_ids:
        if not await panel_repo.get_by_id(panel_id):
            raise HTTPException(404, 'Panel not found')
    for texture_id in set(body.texture_ids):
        if not await texture_repo.get_by_id(texture_id):
            raise HTTPException(404, 'Texture not found')
    # Deterministic ordering prevents overlapping batches from deadlocking.
    await session.execute(select(PanelModel.id).where(
        PanelModel.id.in_(panel_ids)
    ).order_by(PanelModel.id).with_for_update())
    for panel_id in panel_ids:
        rows = (await session.execute(select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == panel_id,
            PanelTextureAssignmentModel.is_active.is_(True),
        ))).scalars().all()
        current = {row.texture_id for row in rows}
        requested = set(body.texture_ids)
        target = current | requested if body.mode == 'add' else current - requested if body.mode == 'remove' else requested
        await replace_panel_texture_assignments(
            panel_id=panel_id,
            body=ReplacePanelTextureAssignmentsRequest(texture_ids=sorted(target)),
            _admin_id=_admin_id, session=session,
            panel_repo=panel_repo, texture_repo=texture_repo, audit_repo=audit_repo,
        )
    return {'updated_panels': len(panel_ids)}
