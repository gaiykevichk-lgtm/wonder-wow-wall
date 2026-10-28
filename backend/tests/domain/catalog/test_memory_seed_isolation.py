"""Demo fixtures are explicit and cannot leak into isolated repositories."""

from app.infrastructure.persistence.repositories.memory import (
    InMemoryPanelRepository,
    InMemoryTextureRepository,
    InMemoryUserRepository,
)


def test_isolated_repositories_start_empty():
    assert InMemoryPanelRepository()._panels == []
    assert InMemoryTextureRepository()._textures == []
    assert InMemoryUserRepository()._users == []
    assert InMemoryPanelRepository([])._panels == []
    assert InMemoryTextureRepository([])._textures == []


def test_explicit_demo_seed_does_not_change_default():
    assert len(InMemoryPanelRepository(seed_demo=True)._panels) == 3
    assert len(InMemoryTextureRepository(seed_demo=True)._textures) == 5
    assert [u.id for u in InMemoryUserRepository(seed_demo=True)._users] == ["admin-root"]
    assert InMemoryUserRepository()._users == []
