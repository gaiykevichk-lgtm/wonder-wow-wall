"""Normalize the initial execution order by the number in `Вариант N` names.

This is intentionally a one-time data migration. Subsequent manual reordering remains
stored in `sort_order` and is not recalculated on reads.
"""
from importlib import import_module

op = import_module("alembic.op")
revision = "027"
down_revision = "026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY panel_id, texture_id
                    ORDER BY
                        CASE
                            WHEN name ~* '^\\s*вариант\\s+[0-9]+\\s*$'
                            THEN substring(name FROM '[0-9]+')::integer
                            ELSE 2147483647
                        END,
                        sort_order,
                        created_at,
                        id
                ) - 1 AS normalized_order
            FROM panel_variants
        )
        UPDATE panel_variants AS variant
        SET sort_order = ranked.normalized_order
        FROM ranked
        WHERE variant.id = ranked.id
          AND variant.sort_order IS DISTINCT FROM ranked.normalized_order
        """
    )


def downgrade() -> None:
    # The previous accidental order cannot be reconstructed reliably.
    pass
