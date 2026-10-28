from dataclasses import dataclass

from app.infrastructure.api.admin.panel_variants import _make_room_before


@dataclass
class Row:
    id: str
    sort_order: int


def test_catalog_copy_is_inserted_immediately_before_source():
    rows = [Row("source", 1), Row("below", 2)]

    copy_order = _make_room_before(rows, source_order=1)
    rows.append(Row("copy", copy_order))
    ordered = sorted(rows, key=lambda row: (row.sort_order, row.id))

    assert [(row.id, row.sort_order) for row in ordered] == [
        ("copy", 1),
        ("source", 2),
        ("below", 3),
    ]
