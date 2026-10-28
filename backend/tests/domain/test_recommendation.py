"""Phase 10 — `Recommendation` aggregate domain tests.

Covers every invariant (self-reference, dup, limit) on every mutator
(`__post_init__`, `add_target`, `replace_all`, `remove_target`,
`reorder`) so a regression in any code path raises the same typed
exception. Keeps the boundary tests (length 0, length 1, length =
limit) explicit because they're the most common bug surface.
"""
import pytest

from app.domain.catalog.recommendation import (
    DEFAULT_RECOMMENDATIONS_LIMIT,
    DuplicateRecommendationTargetError,
    Recommendation,
    RecommendationLimitExceededError,
    RecommendationSourceType,
    RecommendationTarget,
    RecommendationTargetNotFoundError,
    RecommendationTargetType,
    SelfRecommendationError,
)


def _t(target_id: str, type_: RecommendationTargetType = RecommendationTargetType.DESIGN):
    return RecommendationTarget(target_type=type_, target_id=target_id)


def _rec(
    *,
    source_id: str = "src-1",
    source_type: RecommendationSourceType = RecommendationSourceType.DESIGN,
    targets=None,
) -> Recommendation:
    return Recommendation(
        source_type=source_type,
        source_id=source_id,
        targets=list(targets or []),
    )


# ─── Construction ────────────────────────────────────────────────────


class TestConstruction:
    def test_default_targets_empty(self):
        rec = _rec()
        assert rec.targets == []
        assert rec.id  # uuid auto-assigned
        assert rec.updated_at is not None

    def test_empty_source_id_rejected(self):
        with pytest.raises(ValueError, match="source_id"):
            Recommendation(
                source_type=RecommendationSourceType.DESIGN,
                source_id="",
            )

    def test_initial_targets_dedup_enforced(self):
        with pytest.raises(DuplicateRecommendationTargetError):
            _rec(targets=[_t("a"), _t("a")])

    def test_initial_self_reference_rejected(self):
        # DESIGN source cannot have a DESIGN target with the same id.
        with pytest.raises(SelfRecommendationError):
            _rec(source_id="abc", targets=[_t("abc")])

    def test_cross_type_with_same_id_is_legal(self):
        # `DESIGN:abc` recommending `PANEL:abc` is fine — different
        # bounded contexts share the same id namespace.
        rec = _rec(
            source_id="abc",
            targets=[_t("abc", RecommendationTargetType.PANEL)],
        )
        assert len(rec.targets) == 1


# ─── add_target ──────────────────────────────────────────────────────


class TestAddTarget:
    def test_appends_in_order(self):
        rec = _rec()
        rec.add_target(_t("a"))
        rec.add_target(_t("b"))
        assert [t.target_id for t in rec.targets] == ["a", "b"]

    def test_duplicate_rejected(self):
        rec = _rec(targets=[_t("a")])
        with pytest.raises(DuplicateRecommendationTargetError):
            rec.add_target(_t("a"))

    def test_self_reference_rejected(self):
        rec = _rec(source_id="abc")
        with pytest.raises(SelfRecommendationError):
            rec.add_target(_t("abc"))

    def test_limit_enforced(self):
        # Pass a tiny limit so the test isn't bound to the default 12.
        rec = _rec(targets=[_t("a"), _t("b")])
        with pytest.raises(RecommendationLimitExceededError):
            rec.add_target(_t("c"), limit=2)

    def test_default_limit_12(self):
        rec = _rec()
        for i in range(DEFAULT_RECOMMENDATIONS_LIMIT):
            rec.add_target(_t(f"d{i}"))
        with pytest.raises(RecommendationLimitExceededError):
            rec.add_target(_t("overflow"))


# ─── remove_target ───────────────────────────────────────────────────


class TestRemoveTarget:
    def test_removes_existing(self):
        rec = _rec(targets=[_t("a"), _t("b")])
        rec.remove_target(RecommendationTargetType.DESIGN, "a")
        assert [t.target_id for t in rec.targets] == ["b"]

    def test_missing_raises(self):
        rec = _rec(targets=[_t("a")])
        with pytest.raises(RecommendationTargetNotFoundError):
            rec.remove_target(RecommendationTargetType.DESIGN, "missing")

    def test_type_must_match(self):
        rec = _rec(targets=[_t("a", RecommendationTargetType.DESIGN)])
        # Same id but wrong type — no match.
        with pytest.raises(RecommendationTargetNotFoundError):
            rec.remove_target(RecommendationTargetType.PANEL, "a")


# ─── replace_all ─────────────────────────────────────────────────────


class TestReplaceAll:
    def test_replaces_wholesale(self):
        rec = _rec(targets=[_t("a"), _t("b")])
        rec.replace_all([_t("c"), _t("d"), _t("e")])
        assert [t.target_id for t in rec.targets] == ["c", "d", "e"]

    def test_clears_to_empty(self):
        rec = _rec(targets=[_t("a")])
        rec.replace_all([])
        assert rec.targets == []

    def test_dup_in_input_rejected(self):
        rec = _rec()
        with pytest.raises(DuplicateRecommendationTargetError):
            rec.replace_all([_t("a"), _t("a")])

    def test_self_reference_in_input_rejected(self):
        rec = _rec(source_id="abc")
        with pytest.raises(SelfRecommendationError):
            rec.replace_all([_t("abc")])

    def test_limit_enforced_on_input(self):
        rec = _rec()
        with pytest.raises(RecommendationLimitExceededError):
            rec.replace_all(
                [_t(f"d{i}") for i in range(5)], limit=4,
            )

    def test_external_list_mutation_does_not_leak(self):
        # Caller's list must not affect the aggregate after replace_all.
        rec = _rec()
        external = [_t("a"), _t("b")]
        rec.replace_all(external)
        external.append(_t("c"))
        assert [t.target_id for t in rec.targets] == ["a", "b"]


# ─── reorder ─────────────────────────────────────────────────────────


class TestReorder:
    def test_strict_permutation(self):
        rec = _rec(targets=[_t("a"), _t("b"), _t("c")])
        rec.reorder([
            (RecommendationTargetType.DESIGN, "c"),
            (RecommendationTargetType.DESIGN, "a"),
            (RecommendationTargetType.DESIGN, "b"),
        ])
        assert [t.target_id for t in rec.targets] == ["c", "a", "b"]

    def test_length_mismatch_rejected(self):
        rec = _rec(targets=[_t("a"), _t("b")])
        with pytest.raises(RecommendationTargetNotFoundError):
            rec.reorder([(RecommendationTargetType.DESIGN, "a")])

    def test_missing_key_rejected(self):
        rec = _rec(targets=[_t("a"), _t("b")])
        with pytest.raises(RecommendationTargetNotFoundError):
            rec.reorder([
                (RecommendationTargetType.DESIGN, "a"),
                (RecommendationTargetType.DESIGN, "missing"),
            ])
