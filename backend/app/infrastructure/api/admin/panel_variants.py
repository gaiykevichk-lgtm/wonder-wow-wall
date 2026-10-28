"""Phase 12 — admin PanelVariant CRUD endpoints.

* `GET    /api/admin/panel-variants`          — paginated list
* `GET    /api/admin/panel-variants/{id}`     — single variant
* `POST   /api/admin/panel-variants`          — create single
* `POST   /api/admin/panel-variants/batch`     — create batch (wizard)
* `PATCH  /api/admin/panel-variants/{id}`     — update
* `DELETE /api/admin/panel-variants/{id}`      — delete
* `POST   /api/admin/panel-variants/{id}/images`    — add image
* `DELETE /api/admin/panel-variants/{id}/images/{path}` — remove image
* `PATCH  /api/admin/panel-variants/{id}/reorder`    — reorder images
"""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.application.catalog.panel_variant_use_cases import (
    AddVariantImageAdmin,
    CreatePanelVariantAdmin,
    CreatePanelVariantBatch,
    DeletePanelVariantAdmin,
    GetPanelVariantAdmin,
    ListPanelVariantsAdmin,
    PanelVariantNotFoundError,
    ReorderPanelVariantsAdmin,
    ReorderVariantImagesAdmin,
    RemoveVariantImageAdmin,
    UpdatePanelVariantAdmin,
)
from app.container import get_db_session, get_panel_variant_repo, get_panel_repo, get_texture_repo, get_texture_color_repo
from app.infrastructure.persistence.models import (
    PanelModel,
    PanelTextureAssignmentModel,
    PanelVariantModel,
)
from app.domain.catalog.panel_variant import PanelVariant
from app.utils.dependencies import get_current_admin_id

router = APIRouter()


# ─── Response Schemas ─────────────────────────────────────────────────


class PanelVariantResponse(BaseModel):
    name: str = ""
    slug: str = ""
    id: str
    panel_id: str
    texture_id: str
    color_id: str | None
    color_hex: str | None
    image_paths: list[str]
    design_image_paths: list[str] = Field(default_factory=list)
    recommendation_image_paths: list[str] = Field(default_factory=list)
    sort_order: int = 0
    is_active: bool
    created_at: str
    updated_at: str


class PanelVariantListResponse(BaseModel):
    items: list[PanelVariantResponse] = Field(default_factory=list)
    total: int
    offset: int
    limit: int


class BatchCreateRequest(BaseModel):
    panel_id: str
    variants: list[dict]  # Each: texture_id, color_id, color_hex, image_paths


class BatchCreateResponse(BaseModel):
    created: int
    variants: list[PanelVariantResponse]


class ImageOrderRequest(BaseModel):
    image_paths: list[str]
    design_image_paths: list[str] = Field(default_factory=list)
    recommendation_image_paths: list[str] = Field(default_factory=list)


def _to_response(v: PanelVariant) -> PanelVariantResponse:
    return PanelVariantResponse(
        name=v.name,
        slug=v.slug,
        id=v.id,
        panel_id=v.panel_id,
        texture_id=v.texture_id,
        color_id=v.color_id,
        color_hex=v.color_hex,
        image_paths=v.image_paths,
        design_image_paths=v.design_image_paths,
        recommendation_image_paths=v.recommendation_image_paths,
        sort_order=v.sort_order,
        is_active=v.is_active,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


def _to_response_model(v: PanelVariantModel) -> PanelVariantResponse:
    return PanelVariantResponse(
        name=v.name,
        slug=v.slug,
        id=v.id,
        panel_id=v.panel_id,
        texture_id=v.texture_id,
        color_id=v.color_id,
        color_hex=v.color_hex,
        image_paths=list(v.image_paths or []),
        design_image_paths=list(v.design_image_paths or []),
        recommendation_image_paths=list(v.recommendation_image_paths or []),
        sort_order=v.sort_order,
        is_active=v.is_active,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


# ─── Dependencies ────────────────────────────────────────────────────
#
# The container providers are used DIRECTLY as FastAPI dependencies.
# Local wrappers that called `get_panel_variant_repo()` by hand used to
# live here; they broke the dependency chain because the provider's own
# `session=Depends(get_db_session)` never got resolved, so the repo was
# constructed with a raw `Depends` object and every write blew up with
# "'Depends' object has no attribute 'execute'". Let FastAPI resolve it.


# ─── List ────────────────────────────────────────────────────────────


@router.get("/panel-variants", response_model=PanelVariantListResponse)
async def list_panel_variants_admin(
    panel_id: str | None = Query(None, description="Filter by panel ID"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """List panel variants with optional filters."""
    use_case = ListPanelVariantsAdmin(repo)
    items, total = await use_case.execute(
        panel_id=panel_id,
        is_active=is_active,
        offset=offset,
        limit=limit,
    )
    return PanelVariantListResponse(
        items=[_to_response(v) for v in items],
        total=total,
        offset=offset,
        limit=limit,
    )


# ─── Detail ──────────────────────────────────────────────────────────


@router.get("/panel-variants/{variant_id}", response_model=PanelVariantResponse)
async def get_panel_variant_admin(
    variant_id: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """Get a single panel variant."""
    try:
        variant = await GetPanelVariantAdmin(repo).execute(variant_id)
        return _to_response(variant)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


# ─── Create Single ───────────────────────────────────────────────────


class CreatePanelVariantRequest(BaseModel):
    name: str = Field(default="", max_length=160)
    slug: str = Field(default="", max_length=160, pattern=r"^[a-z0-9]*(?:-[a-z0-9]+)*$")
    panel_id: str
    texture_id: str
    color_id: str | None = None
    color_hex: str | None = None
    design_image_paths: list[str] = Field(default_factory=list)
    recommendation_image_paths: list[str] = Field(default_factory=list)
    image_paths: list[str] = Field(default_factory=list)
    is_active: bool = True


@router.post("/panel-variants", response_model=PanelVariantResponse, status_code=201)
async def create_panel_variant_admin(
    body: CreatePanelVariantRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
    panel_repo=Depends(get_panel_repo),
    texture_repo=Depends(get_texture_repo),
    session: AsyncSession = Depends(get_db_session),
):
    """Create a single panel variant and keep its catalog row visible."""
    
    # Validate panel exists
    panel = await panel_repo.get_by_id(body.panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    # Validate texture exists
    texture = await texture_repo.get_by_id(body.texture_id)
    if not texture:
        raise HTTPException(status_code=404, detail="Texture not found")
    
    try:
        # Сериализуем создание первой строки одной панели. Репозиторий и
        # assignment используют общую request-транзакцию.
        await session.execute(select(PanelModel.id).where(PanelModel.id == body.panel_id).with_for_update())
        variant = await CreatePanelVariantAdmin(repo).execute(
            panel_id=body.panel_id,
            texture_id=body.texture_id,
            color_id=body.color_id,
            name=body.name,
            slug=body.slug,
            color_hex=body.color_hex,
            image_paths=body.image_paths,
            design_image_paths=body.design_image_paths,
            recommendation_image_paths=body.recommendation_image_paths,
            is_active=body.is_active,
        )
        assignment = (await session.execute(select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == body.panel_id,
            PanelTextureAssignmentModel.texture_id == body.texture_id,
        ).with_for_update())).scalar_one_or_none()
        if assignment is None:
            max_order = await session.scalar(select(func.max(PanelTextureAssignmentModel.sort_order)).where(
                PanelTextureAssignmentModel.is_catalog_row.is_(True),
            ))
            session.add(PanelTextureAssignmentModel(
                id=str(uuid4()), panel_id=body.panel_id, texture_id=body.texture_id,
                is_active=body.is_active, is_catalog_row=True,
                sort_order=int(max_order if max_order is not None else -1) + 1,
                created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
            ))
        else:
            assignment.is_catalog_row = True
            # Сохранённое неактивное назначение не активируем неявно:
            # модератор управляет его видимостью отдельно от исполнения.
        await session.flush()
        return _to_response(variant)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


# ─── Batch Create (Wizard) ───────────────────────────────────────────


@router.post("/panel-variants/batch", response_model=BatchCreateResponse, status_code=201)
async def create_panel_variants_batch_admin(
    body: BatchCreateRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
    panel_repo=Depends(get_panel_repo),
    texture_repo=Depends(get_texture_repo),
):
    """Batch create panel variants from wizard.
    
    Each variant in the batch can have:
    - texture_id: required
    - color_id: optional (from texture_colors table)
    - color_hex: optional (custom color)
    - image_paths: list of S3 paths
    """
    # Validate panel exists
    panel = await panel_repo.get_by_id(body.panel_id)
    if not panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    
    # Validate all textures exist
    texture_ids = set(v.get('texture_id') for v in body.variants if v.get('texture_id'))
    for tid in texture_ids:
        texture = await texture_repo.get_by_id(tid)
        if not texture:
            raise HTTPException(status_code=404, detail=f"Texture {tid} not found")
    
    created, count = await CreatePanelVariantBatch(repo).execute(
        panel_id=body.panel_id,
        variants=body.variants,
    )
    
    return BatchCreateResponse(
        created=count,
        variants=[_to_response(v) for v in created],
    )


# ─── Update ─────────────────────────────────────────────────────────


class UpdatePanelVariantRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    slug: str | None = Field(default=None, max_length=160, pattern=r"^[a-z0-9]*(?:-[a-z0-9]+)*$")
    """PATCH semantics — `None` means "don't touch".

    `texture_id` is patchable so an admin can fix a mis-assigned texture
    without deleting the variant and re-uploading its photos. `panel_id`
    is deliberately absent: the images belong to a specific panel size.
    """
    texture_id: str | None = Field(default=None, min_length=1, max_length=36)
    color_id: str | None = None
    color_hex: str | None = None
    design_image_paths: list[str] | None = None
    recommendation_image_paths: list[str] | None = None
    image_paths: list[str] | None = None
    is_active: bool | None = None


@router.patch("/panel-variants/{variant_id}", response_model=PanelVariantResponse)
async def update_panel_variant_admin(
    variant_id: str,
    body: UpdatePanelVariantRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
    texture_repo=Depends(get_texture_repo),
):
    """Update metadata and galleries in the shared request transaction."""
    if body.texture_id is not None and not await texture_repo.get_by_id(body.texture_id):
        raise HTTPException(status_code=404, detail="Texture not found")
    try:
        variant = await UpdatePanelVariantAdmin(repo).execute(
            variant_id=variant_id,
            texture_id=body.texture_id,
            color_id=body.color_id,
            name=body.name,
            slug=body.slug,
            color_hex=body.color_hex,
            image_paths=body.image_paths,
            design_image_paths=body.design_image_paths,
            recommendation_image_paths=body.recommendation_image_paths,
            is_active=body.is_active,
        )
        return _to_response(variant)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


# ─── Reorder executions ──────────────────────────────────────────────


class ReorderPanelVariantsRequest(BaseModel):
    panel_id: str
    texture_id: str
    ordered_ids: list[str] = Field(min_length=1)


class PanelVariantGroupRequest(BaseModel):
    panel_id: str
    texture_id: str


class DuplicatePanelVariantGroupResponse(BaseModel):
    panel: dict
    variants: list[PanelVariantResponse]


class PanelVariantRowTextureRequest(BaseModel):
    panel_id: str
    texture_id: str


class UpdatePanelVariantRowTextureRequest(PanelVariantRowTextureRequest):
    current_texture_id: str = ""


@router.patch("/panel-variant-rows/texture", response_model=list[PanelVariantResponse])
async def update_panel_variant_row_texture_admin(
    body: UpdatePanelVariantRowTextureRequest,
    _admin_id: str = Depends(get_current_admin_id),
    texture_repo=Depends(get_texture_repo),
    session: AsyncSession = Depends(get_db_session),
):
    """Move one visible row and all its executions to another texture.

    Пустая `current_texture_id` означает виртуальную строку новой базовой
    панели без catalog assignment: тогда создаём catalog row для выбранной
    текстуры в той же транзакции (вариантов пока нет — возвращаем []).
    """
    if not await texture_repo.get_by_id(body.texture_id):
        raise HTTPException(status_code=404, detail="Texture not found")

    if not body.panel_id:
        raise HTTPException(status_code=400, detail="Сначала выберите базовую форму")

    if not body.current_texture_id:
        panel = (await session.execute(select(PanelModel).where(
            PanelModel.id == body.panel_id,
        ).with_for_update())).scalar_one_or_none()
        if panel is None:
            raise HTTPException(status_code=404, detail="Panel not found")
        target_assignment = (await session.execute(
            select(PanelTextureAssignmentModel).where(
                PanelTextureAssignmentModel.panel_id == body.panel_id,
                PanelTextureAssignmentModel.texture_id == body.texture_id,
            ).with_for_update()
        )).scalar_one_or_none()
        if target_assignment is None:
            now = datetime.utcnow()
            target_assignment = PanelTextureAssignmentModel(
                id=str(uuid4()),
                panel_id=body.panel_id,
                texture_id=body.texture_id,
                is_active=panel.is_active,
                is_catalog_row=True,
                # Keep this former virtual row in the new-forms section.
                # The UI orders that section by the panel's creation date.
                sort_order=-1,
                created_at=now,
                updated_at=now,
            )
            session.add(target_assignment)
        else:
            target_assignment.is_active = True
            target_assignment.is_catalog_row = True
            target_assignment.updated_at = datetime.utcnow()
        await session.flush()
        rows = (await session.execute(
            select(PanelVariantModel).where(
                PanelVariantModel.panel_id == body.panel_id,
                PanelVariantModel.texture_id == body.texture_id,
            ).order_by(PanelVariantModel.sort_order, PanelVariantModel.id)
        )).scalars().all()
        return [_to_response_model(row) for row in rows]

    assignment = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == body.panel_id,
            PanelTextureAssignmentModel.texture_id == body.current_texture_id,
            PanelTextureAssignmentModel.is_catalog_row.is_(True),
        ).with_for_update()
    )).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Catalog row not found")
    if body.texture_id == body.current_texture_id:
        rows = (await session.execute(
            select(PanelVariantModel).where(
                PanelVariantModel.panel_id == body.panel_id,
                PanelVariantModel.texture_id == body.current_texture_id,
            ).order_by(PanelVariantModel.sort_order, PanelVariantModel.id)
        )).scalars().all()
        return [_to_response_model(row) for row in rows]

    target_assignment = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == body.panel_id,
            PanelTextureAssignmentModel.texture_id == body.texture_id,
        ).with_for_update()
    )).scalar_one_or_none()
    if target_assignment is not None:
        raise HTTPException(
            status_code=409,
            detail="У этой панели уже есть строка с выбранной текстурой",
        )

    rows = (await session.execute(
        select(PanelVariantModel).where(
            PanelVariantModel.panel_id == body.panel_id,
            PanelVariantModel.texture_id == body.current_texture_id,
        ).order_by(PanelVariantModel.sort_order, PanelVariantModel.id).with_for_update()
    )).scalars().all()
    # Пустая каталожная строка также может менять текстуру.
    assignment.texture_id = body.texture_id
    assignment.updated_at = datetime.utcnow()
    for row in rows:
        row.texture_id = body.texture_id
        row.updated_at = datetime.utcnow()
    await session.flush()
    return [_to_response_model(row) for row in rows]


@router.patch("/panel-variant-groups/reorder", response_model=list[PanelVariantResponse])
async def reorder_panel_variants_admin(
    body: ReorderPanelVariantsRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    try:
        variants = await ReorderPanelVariantsAdmin(repo).execute(
            body.panel_id, body.texture_id, body.ordered_ids,
        )
        return [_to_response(variant) for variant in variants]
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


# ─── Add Image ───────────────────────────────────────────────────────


class AddImageRequest(BaseModel):
    image_path: str


@router.post("/panel-variants/{variant_id}/images", response_model=PanelVariantResponse)
async def add_variant_image_admin(
    variant_id: str,
    body: AddImageRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """Add an image to a variant."""
    try:
        variant = await AddVariantImageAdmin(repo).execute(
            variant_id=variant_id,
            image_path=body.image_path,
        )
        return _to_response(variant)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


# ─── Remove Image ───────────────────────────────────────────────────


@router.delete("/panel-variants/{variant_id}/images/{image_path:path}", response_model=PanelVariantResponse)
async def remove_variant_image_admin(
    variant_id: str,
    image_path: str,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """Remove an image from a variant."""
    try:
        variant = await RemoveVariantImageAdmin(repo).execute(
            variant_id=variant_id,
            image_path=image_path,
        )
        return _to_response(variant)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


# ─── Reorder Images ──────────────────────────────────────────────────


@router.patch("/panel-variants/{variant_id}/reorder", response_model=PanelVariantResponse)
async def reorder_variant_images_admin(
    variant_id: str,
    body: ImageOrderRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """Reorder images in a variant."""
    try:
        variant = await ReorderVariantImagesAdmin(repo).execute(
            variant_id=variant_id,
            new_order=body.image_paths,
        )
        return _to_response(variant)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


# ─── Duplicate / clear visible groups ───────────────────────────────


def _make_room_before(rows, source_order: int) -> int:
    """Shift rows at/after source and return the copy's persisted position."""
    for row in rows:
        if row.sort_order >= source_order:
            row.sort_order += 1
    return source_order


@router.post("/panel-variant-groups/duplicate", response_model=DuplicatePanelVariantGroupResponse, status_code=201)
async def duplicate_panel_variant_group_admin(
    body: PanelVariantGroupRequest,
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
    panel_repo=Depends(get_panel_repo),
    session: AsyncSession = Depends(get_db_session),
):
    """Duplicate one visible panel+texture row into a new panel row."""
    from app.application.catalog.panel_use_cases import CreatePanelAdmin

    source_panel = await panel_repo.get_by_id(body.panel_id)
    if not source_panel:
        raise HTTPException(status_code=404, detail="Panel not found")
    source_variants = [
        item for item in await repo.list_by_panel(body.panel_id)
        if item.texture_id == body.texture_id
    ]

    source_assignment = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == body.panel_id,
            PanelTextureAssignmentModel.texture_id == body.texture_id,
            PanelTextureAssignmentModel.is_catalog_row.is_(True),
        ).with_for_update()
    )).scalar_one_or_none()
    if source_assignment is None:
        raise HTTPException(status_code=404, detail="Catalog row not found")


    copied_panel = await CreatePanelAdmin(panel_repo).execute(
        name=source_panel.name,
        slug=source_panel.slug,
        size=source_panel.size,
        base_price=source_panel.base_price,
        description=source_panel.description,
        photo_path=source_panel.photo_path,
        photo_paths=list(source_panel.photo_paths),
        form_preview_path=source_panel.form_preview_path,
        is_active=source_panel.is_active,
    )
    # Insert the copy immediately before its source row. Shift the source and
    # every following visible row by one position inside the same transaction.
    following_assignments = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.is_catalog_row.is_(True),
            PanelTextureAssignmentModel.sort_order >= source_assignment.sort_order,
        ).with_for_update()
    )).scalars().all()
    copy_sort_order = _make_room_before(
        following_assignments,
        source_assignment.sort_order,
    )

    assignment = (await session.execute(select(PanelTextureAssignmentModel).where(
        PanelTextureAssignmentModel.panel_id == copied_panel.id,
        PanelTextureAssignmentModel.texture_id == body.texture_id,
    ))).scalar_one_or_none()
    if assignment is None:
        from datetime import datetime
        from uuid import uuid4
        now = datetime.utcnow()
        session.add(PanelTextureAssignmentModel(
            id=str(uuid4()), panel_id=copied_panel.id, texture_id=body.texture_id,
            is_active=source_assignment.is_active, is_catalog_row=True,
            sort_order=copy_sort_order,
            created_at=now, updated_at=now,
        ))
    else:
        assignment.is_active = source_assignment.is_active
        assignment.is_catalog_row = True
        assignment.sort_order = copy_sort_order

    copied_variants = []
    for source in sorted(source_variants, key=lambda item: item.sort_order):
        copied_variants.append(await CreatePanelVariantAdmin(repo).execute(
            panel_id=copied_panel.id,
            texture_id=source.texture_id,
            name=source.name,
            slug=source.slug,
            color_id=source.color_id,
            color_hex=source.color_hex,
            image_paths=list(source.image_paths),
            design_image_paths=list(source.design_image_paths),
            recommendation_image_paths=list(source.recommendation_image_paths),
            is_active=source.is_active,
        ))
    return DuplicatePanelVariantGroupResponse(
        panel={
            "id": copied_panel.id,
            "name": copied_panel.name,
            "slug": copied_panel.slug,
        },
        variants=[_to_response(item) for item in copied_variants],
    )


@router.delete("/panel-variant-rows", status_code=204)
async def delete_panel_variant_row_admin(
    panel_id: str = Query(...),
    texture_id: str = Query(...),
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
    session: AsyncSession = Depends(get_db_session),
):
    assignment = (await session.execute(select(PanelTextureAssignmentModel).where(
        PanelTextureAssignmentModel.panel_id == panel_id,
        PanelTextureAssignmentModel.texture_id == texture_id,
        PanelTextureAssignmentModel.is_catalog_row.is_(True),
    ).with_for_update())).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Catalog row not found")
    await repo.delete_group(panel_id, texture_id)
    assignment.is_catalog_row = False
    await session.flush()

    remaining_rows = await session.scalar(
        select(func.count(PanelTextureAssignmentModel.id)).where(
            PanelTextureAssignmentModel.panel_id == panel_id,
            PanelTextureAssignmentModel.is_catalog_row.is_(True),
        )
    )
    if remaining_rows == 0:
        panel = await session.get(PanelModel, panel_id)
        if panel is not None:
            await session.delete(panel)
            await session.flush()
    return Response(status_code=204)


@router.delete("/panel-variant-groups", status_code=204)
async def delete_panel_variant_group_admin(
    panel_id: str = Query(...),
    texture_id: str = Query(...),
    _admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    deleted = await repo.delete_group(panel_id, texture_id)
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Variant group not found")
    return Response(status_code=204)


# ─── Delete ─────────────────────────────────────────────────────────


@router.delete("/panel-variants/{variant_id}", status_code=204)
async def delete_panel_variant_admin(
    variant_id: str,
    admin_id: str = Depends(get_current_admin_id),
    repo=Depends(get_panel_variant_repo),
):
    """Delete a panel variant."""
    try:
        await DeletePanelVariantAdmin(repo).execute(variant_id)
        return Response(status_code=204)
    except PanelVariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")


class UpdatePanelVariantRowActivityRequest(PanelVariantGroupRequest):
    is_active: bool


@router.patch("/panel-variant-rows/activity", status_code=204)
async def update_panel_variant_row_activity_admin(
    body: UpdatePanelVariantRowActivityRequest,
    _admin_id: str = Depends(get_current_admin_id),
    session: AsyncSession = Depends(get_db_session),
):
    assignment = (await session.execute(
        select(PanelTextureAssignmentModel).where(
            PanelTextureAssignmentModel.panel_id == body.panel_id,
            PanelTextureAssignmentModel.texture_id == body.texture_id,
            PanelTextureAssignmentModel.is_catalog_row.is_(True),
        ).with_for_update()
    )).scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Catalog row not found")
    variants = (await session.execute(select(PanelVariantModel).where(
        PanelVariantModel.panel_id == body.panel_id,
        PanelVariantModel.texture_id == body.texture_id,
    ).with_for_update())).scalars().all()
    now = datetime.utcnow()
    for item in [assignment, *variants]:
        item.is_active = body.is_active
        item.updated_at = now
    await session.flush()
    return Response(status_code=204)
