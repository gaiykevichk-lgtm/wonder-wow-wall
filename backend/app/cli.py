"""Admin CLI — bootstraps the first admin and related operational tasks.

Invocation:
    python -m app.cli grant_admin <email>
    python -m app.cli revoke_admin <email>

Uses the SAME repositories as the FastAPI app (SQL by default; in-memory
when `USE_MEMORY_REPOS=true` — useful for smoke tests). The CLI opens its
own DB session because the FastAPI request-scoped session is not in play.

The bootstrap actor is `SYSTEM` — `_ensure_actor_is_admin` in the use case
special-cases it so we can grant the very first admin without a pre-
existing admin (chicken-and-egg).
"""

import argparse
import asyncio
import sys

from app.application.user.use_cases import GrantAdminRole, RevokeAdminRole
from app.config import settings


class _UserNotFound(Exception):
    """CLI-local sentinel: `get_by_email` returned None.

    Raised inside `_with_repo`'s transaction so the async-with block exits
    via the `except` branch (rolling back the empty read-only txn) instead
    of via `sys.exit`, which would escape as `SystemExit` and bypass the
    `except Exception` rollback.
    """


async def _with_repo(coro_factory):
    """Open a repo (SQL or in-memory) and pass it to `coro_factory(repo)`.

    The SQL branch mirrors `container.get_db_session`: one transaction,
    commit on success, rollback on error.
    """
    if settings.USE_MEMORY_REPOS:
        from app.container import _mem_user_repo  # type: ignore
        return await coro_factory(_mem_user_repo)

    from app.infrastructure.persistence.database import async_session
    from app.infrastructure.persistence.repositories.sql import SqlUserRepository

    async with async_session() as session:
        try:
            repo = SqlUserRepository(session)
            result = await coro_factory(repo)
            await session.commit()
            return result
        except Exception:
            await session.rollback()
            raise


async def _grant_admin(email: str) -> None:
    async def _run(repo):
        user = await repo.get_by_email(email)
        if user is None:
            raise _UserNotFound(email)
        uc = GrantAdminRole(repo)
        updated = await uc.execute(GrantAdminRole.SYSTEM_ACTOR, user.id)
        print(f"OK: {updated.email} (id={updated.id}) is now {updated.role.value}")
    try:
        await _with_repo(_run)
    except _UserNotFound as exc:
        print(f"error: user not found by email: {exc}", file=sys.stderr)
        sys.exit(2)


async def _revoke_admin(email: str) -> None:
    async def _run(repo):
        user = await repo.get_by_email(email)
        if user is None:
            raise _UserNotFound(email)
        uc = RevokeAdminRole(repo)
        updated = await uc.execute(RevokeAdminRole.SYSTEM_ACTOR, user.id)
        print(f"OK: {updated.email} (id={updated.id}) is now {updated.role.value}")
    try:
        await _with_repo(_run)
    except _UserNotFound as exc:
        print(f"error: user not found by email: {exc}", file=sys.stderr)
        sys.exit(2)


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="app.cli", description="Admin operations CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    p_grant = sub.add_parser("grant_admin", help="Promote a user to ADMIN by email")
    p_grant.add_argument("email")

    p_revoke = sub.add_parser("revoke_admin", help="Demote an ADMIN back to CUSTOMER by email")
    p_revoke.add_argument("email")

    args = parser.parse_args(argv)

    if args.command == "grant_admin":
        asyncio.run(_grant_admin(args.email))
    elif args.command == "revoke_admin":
        asyncio.run(_revoke_admin(args.email))


if __name__ == "__main__":
    main()
