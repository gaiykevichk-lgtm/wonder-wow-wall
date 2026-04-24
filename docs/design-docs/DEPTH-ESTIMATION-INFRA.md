# Depth Estimation — Infrastructure Decision (Phase 6, free variant)

**Status:** approved · **Decision date:** 2026-04-24 · **Owner:** visualizer/backend
**Plan reference:** `docs/exec-plans/active/PLAN-PHOTO-EDITOR-PERSPECTIVE-AUTO.md` § Фаза 6

## Context

Phase 3 added vanishing-point detection from line segments (LSD). On
high-contrast scenes (rooms with visible cornices, picture-rail trim, baseboards)
the detector hits ≥0.6 confidence and fills `perspectiveCorners` automatically.

For the **empty single-tone wall** corner case — the dominant photo type for our
B2C funnel — LSD returns very few line segments and the detector bails with
low confidence. Today the user has to build perspective manually by dragging
four corners on `KonvaCanvas`.

Phase 6 closes that gap with **monocular depth estimation**: feed the photo to
a depth model, fit a plane to the points inside the wall mask, and project that
plane back to four corners.

## Decision

**Variant A — local CPU inference via `onnxruntime`.** Model: MiDaS Small v2.1
(depth-anything-v2-small is the future-proof upgrade, deferred).

## Options considered

| Variant | Cost | Latency | Quality | Operability |
|---|---|---|---|---|
| **A. Local CPU (onnxruntime)** | 0 ₽ | 3–6 s/photo | acceptable for plane-fitting | self-contained, no third-party SLA |
| B. Self-hosted GPU | 3–10k ₽/mo | 0.3–0.8 s/photo | best | requires GPU node + CUDA in CI |
| C. Managed (Replicate / Modal) | ~$0.005/req | 1–3 s/photo + cold start | best | per-request quota, secret rotation, vendor lock-in |

## Why A (free variant)

1. **No upfront infra spend.** The current Phase-6 budget is "ship a working
   fallback that improves the empty-wall conversion rate"; we have no signal
   that the latency tail of CPU inference is unacceptable until the feature
   is in front of users. A is the cheapest experiment.
2. **DDD-clean.** A pluggable `IDepthEstimator` ABC keeps the choice swappable.
   We can promote to B or C by writing one new adapter — no domain rewrite.
3. **CI parity.** A pure-Python stub adapter (`StubDepthEstimator`) ships in
   the same module so domain/application/API tests do not depend on
   downloading a 60–80 MB ONNX checkpoint. The real adapter loads the model
   lazily on first call and is exercised only in deployment-environment
   smoke tests.
4. **Worst-case behaviour is acceptable.** If the request times out or the
   model fails, the user still has the manual perspective editor — Phase 6 is
   strictly additive, not blocking.

## Tradeoffs

- **Latency.** 3–6 s on a `t3.small`-class CPU is at the edge of what feels
  responsive. Mitigation: async endpoint (202 + progress polling) is on the
  roadmap if CPU inference proves slow in production. v1 ships **synchronous
  long-poll** (single POST returns when done, no separate progress channel)
  to keep the first cut small.
- **Cold-start memory.** The ONNX session holds ~150–200 MB resident. Acceptable
  on the production node we already run; flagged in the runbook.
- **Model accuracy.** MiDaS Small is the smallest variant we considered.
  If empty-wall coverage falls below the DoD (≥70% on the acceptance set),
  the next iteration upgrades to MiDaS DPT-Hybrid (~330 MB) — same adapter
  interface, different checkpoint path.

## Migration path to paid variants

When/if we choose to upgrade:

- **B (self-hosted GPU):** swap `LocalMiDaSDepthEstimator` for a
  `LocalMiDaSGpuDepthEstimator` that selects the CUDA execution provider in
  `onnxruntime.InferenceSession`. No domain or use-case changes.
- **C (managed API):** add `ReplicateDepthEstimator(IDepthEstimator)` that
  calls the HTTPS endpoint and parses the response. Configure via
  `settings.DEPTH_PROVIDER = "replicate"` and `settings.DEPTH_API_KEY`.

The dependency-injection seam is in `app/container.py`:
`get_depth_estimator()` reads `settings.DEPTH_PROVIDER` and returns the right
adapter. The use case never sees the choice.

## Out of scope for Phase 6 v1

- GPU inference (B), managed API (C).
- Asynchronous job queue / progress polling (sync POST is sufficient until
  we measure tail latency in prod).
- EXIF orientation normalization (T8 in plan) — split into its own follow-up;
  the depth estimator assumes the upload is already in display orientation.
- Acceptance dataset of 50 "hard" photos — non-CI manual benchmark, run
  before promoting to GPU/managed.

## Configuration

`backend/app/config.py`:

| Var | Default | Notes |
|---|---|---|
| `DEPTH_PROVIDER` | `"stub"` | `"stub" \| "local"` (Phase 6); future `"replicate"` (Phase 6.5) |
| `DEPTH_MODEL_PATH` | `""` | Path to ONNX checkpoint; used only by `local` provider |
| `DEPTH_INPUT_SIZE` | `256` | Square model input edge in px |

`stub` is the default so unit tests, CI, and local dev never need the
checkpoint on disk. Production sets `DEPTH_PROVIDER=local` plus a baked-in
checkpoint path in the Docker image.
