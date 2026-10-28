"""Phase 8B — admin Banner CRUD use cases + public listing.

Mirrors the `*Admin` shape from Phase 7B `panel_use_cases.py` and
Phase 7A `admin_use_cases.py`: one use case per verb, repo injected via
constructor, `execute(...)` is the single public method.

Validation strategy:
  Pydantic catches shape errors (length, type) at the API. *Domain*
  invariants live in the entity (`Banner.__post_init__` rejects negative
  priority and active+missing-image). Use cases enforce the additional
  rule that `is_active=True` requires `image_path` to be present (so an
  admin cannot publish a half-built draft via a sloppy PATCH).

Phase 9 — `DeleteBannerAdmin` accepts an optional `audit_recorder`
collaborator (same pattern as `DeletePanelAdmin` / `DeleteDesignAdmin`).
A `SETTINGS_UPDATE` audit action is reused for banner mutations to
avoid enum churn — the payload `{op: "banner_delete"|..., id, title}`
disambiguates. (If we later need granular filtering in the audit list
view, we can split into `BANNER_*` actions.)
"""
from __future__ import annotations

from datetime import datetime

from app.application.audit.use_cases import RecordAuditEntry
from app.domain.audit.value_objects import AuditAction, AuditTargetType
from app.domain.shop.banner import Banner, BannerPosition
from app.domain.shop.banner_exceptions import BannerNotFoundError
from app.domain.shop.repositories import BannerRepository


class CreateBannerAdmin:
    """Persist a new banner.

    `is_active=True` + empty `image_path` is rejected at the entity level
    (`Banner.__post_init__`). The use case re-checks here so the API
    layer can surface a 422 with a stable message before the entity
    raises.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        title: str,
        subtitle: str = "",
        image_path: str = "",
        cta_label: str = "",
        cta_url: str = "",
        position: BannerPosition = BannerPosition.HOMEPAGE_HERO,
        priority: int = 0,
        is_active: bool = True,
    ) -> Banner:
        if not title:
            raise ValueError("Banner.title must not be empty")
        if priority < 0:
            raise ValueError("Banner.priority cannot be negative")
        if is_active and not image_path:
            raise ValueError(
                "Banner.image_path is required when is_active=True"
            )
        banner = Banner(
            title=title,
            subtitle=subtitle,
            image_path=image_path,
            cta_label=cta_label,
            cta_url=cta_url,
            position=position,
            priority=priority,
            is_active=is_active,
        )
        return await self.repo.create(banner)


class UpdateBannerAdmin:
    """Patch-style update — `None` = "don't touch", `""` = "clear".

    Same semantics as `UpdatePanelAdmin`. Re-checks the active+image
    invariant after applying the patch so an admin cannot flip
    `is_active=True` while leaving `image_path` blank.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        banner_id: str,
        title: str | None = None,
        subtitle: str | None = None,
        image_path: str | None = None,
        cta_label: str | None = None,
        cta_url: str | None = None,
        position: BannerPosition | None = None,
        priority: int | None = None,
        is_active: bool | None = None,
    ) -> Banner:
        banner = await self.repo.get_by_id(banner_id)
        if banner is None:
            raise BannerNotFoundError(f"Banner {banner_id} not found")

        if title is not None:
            if not title:
                raise ValueError("Banner.title must not be empty")
            banner.title = title
        if subtitle is not None:
            banner.subtitle = subtitle
        if image_path is not None:
            banner.image_path = image_path
        if cta_label is not None:
            banner.cta_label = cta_label
        if cta_url is not None:
            banner.cta_url = cta_url
        if position is not None:
            banner.position = position
        if priority is not None:
            if priority < 0:
                raise ValueError("Banner.priority cannot be negative")
            banner.priority = priority
        if is_active is not None:
            banner.is_active = is_active

        # Re-check the active + image invariant POST-patch so we catch
        # admins who flipped `is_active` without setting an image.
        if banner.is_active and not banner.image_path:
            raise ValueError(
                "Banner.image_path is required when is_active=True"
            )
        banner.updated_at = datetime.utcnow()
        return await self.repo.update(banner)


class DeleteBannerAdmin:
    """Hard-delete a banner.

    No "in-use" guard — banners aren't FK'd from anywhere.
    Returns True on success, False on miss (the API turns False into
    `BannerNotFoundError` → 404).

    Phase 9 — when an `audit_recorder` collaborator is wired in, a
    successful delete records a `SETTINGS_UPDATE` audit entry with
    `payload={"op": "banner_delete", "id", "title", "position"}`.
    Skipped on miss (nothing to attribute) and without `actor_id`
    (CLI seeder, legacy callers).
    """

    def __init__(
        self,
        repo: BannerRepository,
        audit_recorder: RecordAuditEntry | None = None,
    ):
        self.repo = repo
        self.audit_recorder = audit_recorder

    async def execute(
        self, banner_id: str, *, actor_id: str | None = None,
    ) -> bool:
        banner = await self.repo.get_by_id(banner_id)
        if banner is None:
            return False
        deleted = await self.repo.delete(banner_id)
        if not deleted:
            return False
        if self.audit_recorder is not None and actor_id:
            await self.audit_recorder.execute(
                actor_id=actor_id,
                action=AuditAction.SETTINGS_UPDATE,
                target_type=AuditTargetType.SETTINGS,
                target_id=banner_id,
                payload={
                    "op": "banner_delete",
                    "id": banner_id,
                    "title": banner.title,
                    "position": banner.position.value,
                },
            )
        return True


class GetBannerAdmin:
    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(self, banner_id: str) -> Banner:
        banner = await self.repo.get_by_id(banner_id)
        if banner is None:
            raise BannerNotFoundError(f"Banner {banner_id} not found")
        return banner


class ListBannersAdmin:
    """Admin list — every banner (active + inactive), filterable by position.

    Public listing uses `ListBannersPublic` which hard-codes
    `active_only=True`. Splitting the two use cases means a public
    endpoint cannot accidentally expose drafts via query-string fiddling.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        position: BannerPosition | None = None,
    ) -> list[Banner]:
        return await self.repo.list_banners(
            position=position, active_only=False,
        )


class ListBannersPublic:
    """Public listing — active banners only, ordered by priority.

    Hard-codes `active_only=True` for defence-in-depth.
    """

    def __init__(self, repo: BannerRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        position: BannerPosition | None = None,
    ) -> list[Banner]:
        return await self.repo.list_banners(
            position=position, active_only=True,
        )
