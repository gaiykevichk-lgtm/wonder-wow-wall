"""Alembic graph regression: no ambiguous IDs or detached heads.

This test does not connect to, stamp, or migrate a database.
"""
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory


def test_catalog_migrations_form_one_chain():
    root = Path(__file__).resolve().parents[2]
    cfg = Config(str(root / 'alembic.ini'))
    cfg.set_main_option('script_location', str(root / 'alembic'))
    graph = ScriptDirectory.from_config(cfg)
    assert graph.get_heads() == ['019_add_size_key_and_hex_to_variant_images']
    chain = {revision.revision for revision in graph.walk_revisions()}
    assert len(chain) == len(list((root / 'alembic' / 'versions').glob('[0-9]*.py')))
    assert graph.get_revision('013').path.endswith('013_create_audit_entries.py')
    assert graph.get_revision('018_panel_variants').down_revision == '018'
    assert graph.get_revision('019').down_revision == '018_panel_variants'
    assert graph.get_revision('019_add_size_key_and_hex_to_variant_images').down_revision == '035'
