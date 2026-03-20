import pytest
from app.domain.catalog.entities import Design, Category
from app.domain.catalog.value_objects import Color
from app.application.catalog.use_cases import ListDesigns, GetDesignDetails, ListCategories, AddReview, ListReviews
from app.infrastructure.persistence.repositories.memory import (
    InMemoryDesignRepository, InMemoryCategoryRepository, InMemoryReviewRepository,
)


@pytest.fixture
def designs():
    return [
        Design(id="d1", name="Alpha", slug="alpha", category_id="c1", price=1200,
               colors=[Color("#000", "Black")], rating=4.5, reviews_count=10),
        Design(id="d2", name="Beta", slug="beta", category_id="c2", price=1200,
               colors=[Color("#fff", "White")], rating=4.0, reviews_count=5),
        Design(id="d3", name="Gamma", slug="gamma", category_id="c1", price=1200,
               colors=[], rating=4.8, reviews_count=20),
    ]


@pytest.fixture
def design_repo(designs):
    return InMemoryDesignRepository(designs)


@pytest.fixture
def category_repo():
    return InMemoryCategoryRepository([
        Category(id="c1", name="Nature", slug="nature", count=2),
        Category(id="c2", name="Abstract", slug="abstract", count=1),
    ])


@pytest.fixture
def review_repo():
    return InMemoryReviewRepository()


class TestListDesigns:
    @pytest.mark.asyncio
    async def test_list_all(self, design_repo):
        uc = ListDesigns(design_repo)
        designs, total = await uc.execute()
        assert total == 3
        assert len(designs) == 3

    @pytest.mark.asyncio
    async def test_filter_by_category(self, design_repo):
        uc = ListDesigns(design_repo)
        designs, total = await uc.execute(category_id="c1")
        assert total == 2

    @pytest.mark.asyncio
    async def test_search(self, design_repo):
        uc = ListDesigns(design_repo)
        designs, total = await uc.execute(search="alpha")
        assert total == 1
        assert designs[0].id == "d1"

    @pytest.mark.asyncio
    async def test_sort_by_rating(self, design_repo):
        uc = ListDesigns(design_repo)
        designs, _ = await uc.execute(sort_by="rating")
        assert designs[0].id == "d3"  # highest rating

    @pytest.mark.asyncio
    async def test_pagination(self, design_repo):
        uc = ListDesigns(design_repo)
        designs, total = await uc.execute(offset=0, limit=2)
        assert len(designs) == 2
        assert total == 3


class TestGetDesignDetails:
    @pytest.mark.asyncio
    async def test_found(self, design_repo):
        uc = GetDesignDetails(design_repo)
        d = await uc.execute("d1")
        assert d is not None
        assert d.name == "Alpha"

    @pytest.mark.asyncio
    async def test_not_found(self, design_repo):
        uc = GetDesignDetails(design_repo)
        d = await uc.execute("nonexistent")
        assert d is None


class TestListCategories:
    @pytest.mark.asyncio
    async def test_list(self, category_repo):
        uc = ListCategories(category_repo)
        cats = await uc.execute()
        assert len(cats) == 2


class TestAddReview:
    @pytest.mark.asyncio
    async def test_add_review(self, design_repo, review_repo):
        uc = AddReview(design_repo, review_repo)
        review = await uc.execute("d1", "user-1", "Test User", 5, "Great design!")
        assert review.rating == 5
        assert review.design_id == "d1"

    @pytest.mark.asyncio
    async def test_design_not_found(self, design_repo, review_repo):
        uc = AddReview(design_repo, review_repo)
        with pytest.raises(ValueError):
            await uc.execute("nonexistent", "user-1", "User", 5, "text")


class TestListReviews:
    @pytest.mark.asyncio
    async def test_empty(self, review_repo):
        uc = ListReviews(review_repo)
        reviews = await uc.execute("d1")
        assert reviews == []
