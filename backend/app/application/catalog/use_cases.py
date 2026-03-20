from app.domain.catalog.entities import Design, Category, DesignReview
from app.domain.catalog.repositories import DesignRepository, CategoryRepository, ReviewRepository


class ListDesigns:
    def __init__(self, repo: DesignRepository):
        self.repo = repo

    async def execute(
        self, category_id: str | None = None, search: str | None = None,
        sort_by: str = "name", offset: int = 0, limit: int = 20,
    ) -> tuple[list[Design], int]:
        return await self.repo.list_designs(category_id, search, sort_by, offset, limit)


class GetDesignDetails:
    def __init__(self, repo: DesignRepository):
        self.repo = repo

    async def execute(self, design_id: str) -> Design | None:
        return await self.repo.get_by_id(design_id)


class ListCategories:
    def __init__(self, repo: CategoryRepository):
        self.repo = repo

    async def execute(self) -> list[Category]:
        return await self.repo.list_all()


class AddReview:
    def __init__(self, design_repo: DesignRepository, review_repo: ReviewRepository):
        self.design_repo = design_repo
        self.review_repo = review_repo

    async def execute(self, design_id: str, user_id: str, user_name: str, rating: int, text: str) -> DesignReview:
        design = await self.design_repo.get_by_id(design_id)
        if not design:
            raise ValueError(f"Design {design_id} not found")

        review = DesignReview(
            design_id=design_id,
            user_id=user_id,
            user_name=user_name,
            rating=rating,
            text=text,
        )
        design.add_review(review)
        return await self.review_repo.add(review)


class ListReviews:
    def __init__(self, repo: ReviewRepository):
        self.repo = repo

    async def execute(self, design_id: str, offset: int = 0, limit: int = 20) -> list[DesignReview]:
        return await self.repo.list_by_design(design_id, offset, limit)
