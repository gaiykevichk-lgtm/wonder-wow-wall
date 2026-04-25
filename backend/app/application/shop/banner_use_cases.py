"""Phase 8B — `Banner` admin/public use cases.

Mirrors the Phase 7B Panel split: separate `ListBannersAdmin` (sees
inactive) and `ListBannersPublic` (active only) so a public endpoint
cannot be coerced into leaking hidden banners by query-string fiddling.

PATCH semantics: `None` = don't touch, explicit `""` = clear (relevant
for `cta_text` and `cta_link`). The DTO at the API layer must use
`Optional[T] = None` for every patchable field.
"""
from __future__ import annotations

from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.domain.shop.repositories import BannerRepository


class CreateBannerAdmin:
    """Persist a new Banner.

    `image_path` is a soft pointer to `media_assets.path` (Phase 6) —
    no FK so deleting a `MediaAsset` doesn't cascade-null the banner
    column (the URL would 404 instead, which the admin UI handles).
    Same trade-off as `Panel.photo_path`.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        image_path: str,
        title: str = "",
        cta_text: str = "",
        cta_link: str = "",
        position: BannerPosition = BannerPosition.HOMEPAGE_HERO,
        is_active: bool = True,
        priority: int = 0,
    ) -> Banner:
        # Entity __post_init__ enforces non-empty image_path + non-negative priority.
        banner = Banner(
            image_path=image_path,
            title=title,
            cta_text=cta_text,
            cta_link=cta_link,
            position=position,
            is_active=is_active,
            priority=priority,
        )
        return await self.repo.create(banner)


class UpdateBannerAdmin:
    """Patch-style update: only fields passed (non-None) are written.

    Same PATCH contract as `UpdatePanelAdmin` and `UpdateOrderStatusAdmin`.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        banner_id: str,
        image_path: str | None = None,
        title: str | None = None,
        cta_text: str | None = None,
        cta_link: str | None = None,
        position: BannerPosition | None = None,
        is_active: bool | None = None,
        priority: int | None = None,
    ) -> Banner:
        banner = await self.repo.get_by_id(banner_id)
        if banner is None:
            raise BannerNotFoundError(f"Banner {banner_id} not found")

        if image_path is not None:
            if not image_path:
                raise ValueError("Banner.image_path must not be empty")
            banner.image_path = image_path
        if title is not None:
            banner.title = title
        if cta_text is not None:
            banner.cta_text = cta_text
        if cta_link is not None:
            banner.cta_link = cta_link
        if position is not None:
            banner.position = position
        if is_active is not None:
            banner.is_active = is_active
        if priority is not None:
            if priority < 0:
                raise ValueError("Banner.priority cannot be negative")
            banner.priority = priority

        return await self.repo.update(banner)


class DeleteBannerAdmin:
    """Hard-delete a banner. Returns True on success, False if id unknown."""

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(self, banner_id: str) -> bool:
        return await self.repo.delete(banner_id)


class GetBannerAdmin:
    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(self, banner_id: str) -> Banner:
        banner = await self.repo.get_by_id(banner_id)
        if banner is None:
            raise BannerNotFoundError(f"Banner {banner_id} not found")
        return banner


class ListBannersAdmin:
    """Paginated admin list — includes inactive rows.

    Public list uses `ListBannersPublic`. Splitting prevents accidental
    inactive-leak through a flag flip on the public endpoint.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        position: BannerPosition | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Banner], int]:
        return await self.repo.list_banners(
            position=position,
            include_inactive=True,
            offset=offset,
            limit=limit,
        )


class ListBannersPublic:
    """Public read — active banners only, optionally filtered by position.

    Hard-codes `include_inactive=False`. Frontend pages pass the
    position they care about (`homepage_hero` for the hero rotator,
    `catalog_top` for the catalog header, etc.).
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        position: BannerPosition | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> tuple[list[Banner], int]:
        return await self.repo.list_banners(
            position=position,
            include_inactive=False,
            offset=offset,
            limit=limit,
        )
