"""Phase 4B — `Order.add_note` domain behaviour."""
from __future__ import annotations

import pytest

from app.domain.order.entities import Order, OrderNote


def test_add_note_appends_to_order():
    order = Order()
    note = order.add_note(author_id="admin-1", text="Позвонил клиенту")
    assert note in order.notes
    assert isinstance(note, OrderNote)
    assert note.author_id == "admin-1"
    assert note.text == "Позвонил клиенту"


def test_add_note_strips_outer_whitespace():
    """Outer whitespace removed; inner spaces preserved verbatim."""
    order = Order()
    note = order.add_note(author_id="admin-1", text="  trim  me  ")
    assert note.text == "trim  me"


def test_add_note_rejects_blank_text():
    order = Order()
    with pytest.raises(ValueError):
        order.add_note(author_id="admin-1", text="   ")


def test_add_note_rejects_missing_author():
    order = Order()
    with pytest.raises(ValueError):
        order.add_note(author_id="", text="hi")


def test_notes_preserve_insertion_order():
    """Render order on the detail page = chronological author input."""
    order = Order()
    n1 = order.add_note(author_id="a-1", text="First")
    n2 = order.add_note(author_id="a-2", text="Second")
    n3 = order.add_note(author_id="a-1", text="Third")
    assert [n.id for n in order.notes] == [n1.id, n2.id, n3.id]
