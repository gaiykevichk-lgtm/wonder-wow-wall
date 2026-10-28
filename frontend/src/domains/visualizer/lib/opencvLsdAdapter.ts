/**
 * Adapter that supplies `vanishingPointDetector` with line segments extracted
 * by OpenCV.js.
 *
 * STATUS — Stage-2 (client-side) currently **disabled**. See
 * [`docs/design-docs/AUTO-PERSPECTIVE-FALLBACK-STRATEGY.md`](../../../../../docs/design-docs/AUTO-PERSPECTIVE-FALLBACK-STRATEGY.md).
 *
 * Why disabled: the `@techstark/opencv-js` bundle is a ~11 MB Emscripten
 * UMD. Loading it via dynamic import through Vite either pre-bundles (OOMs
 * the 512 MB sandbox) or serves the raw UMD (times out before ESM wrapping
 * completes). Loading it via `<script>` injection works, but parsing 11 MB
 * of asm.js blocks the main thread for 15+ seconds on the sandbox — long
 * enough that Chrome shows "Страница не отвечает".
 *
 * Every path we have tried either (a) fails to load OpenCV or (b) freezes
 * the tab during load. Shipping this code live means the best user
 * experience is a **fast-failing** `loadOpenCV` that lets
 * `runAutoPerspective` fall through to the mask-bbox trapezoid heuristic
 * immediately, instead of burning the 15 s auto-perspective budget on a
 * load that will ultimately freeze the tab.
 *
 * The Phase-3.1c pipeline (HoughLinesP + vanishing-point) is preserved
 * below so that turning this back on requires only replacing `loadOpenCV`
 * with a Web-Worker-backed implementation — no changes to the call site
 * in `runAutoPerspective` or `vanishingPointDetector`. The planned
 * migration is:
 *   - `public/workers/opencv-worker.js` — classic Web Worker that
 *     `importScripts('/opencv.js')` (this unblocks main-thread parsing).
 *   - `cvWorkerHost` switches from an in-process queue to a real
 *     `new Worker(...)` host that posts `{imageData, params}` to the
 *     worker and receives `{lines}` back.
 *   - `loadOpenCV` below becomes a thin wrapper that lazily spins the
 *     worker up and caches the handle.
 *
 * The `createOpencvLsdProvider` factory below is preserved verbatim
 * (HoughLinesP pipeline, Mat memory discipline, downscaling) so the
 * Worker migration is a one-function swap rather than a full rewrite.
 */

import type { Line, LineProvider } from './vanishingPointDetector';
import type { CvWorkerHost } from './cvWorkerHost';
import type { Point, WallMask } from '../model/types';

export class OpencvNotInstalledError extends Error {
  readonly code = 'opencv-not-installed' as const;
  constructor(cause?: unknown) {
    super(
      'OpenCV.js failed to load. Auto-perspective falls back to the backend' +
        ' depth endpoint (if available) or manual corners.',
    );
    this.name = 'OpencvNotInstalledError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export interface OpencvLsdOptions {
  /**
   * Worker host — currently unused at this layer; reserved for the day we
   * move the Hough pipeline into a dedicated Web Worker (opencv.js itself
   * runs fine on the main thread for single-photo inference, so the cost
   * of cross-worker ArrayBuffer transfer isn't justified yet).
   */
  workerHost?: CvWorkerHost;
  /**
   * Max line count returned. HoughLinesP may emit hundreds on detailed
   * scenes; the VP detector only cares about the longest few dozen, so
   * we truncate to avoid spending time on noise.
   */
  maxLines?: number;
  /**
   * Downscale target for the long edge (in pixels). Lower = faster + less
   * accurate. 640 is a common CV default and gives ~50 ms per photo on a
   * mid-range laptop.
   */
  maxDim?: number;
}

// ─── OpenCV runtime bootstrap ───────────────────────────────────────

// A minimal surface of the types we use from opencv.js. Typing the full
// namespace from `@techstark/opencv-js` drags a large import chain into the
// bundle at type-check time; a local shape keeps the dev loop fast and is
// safe because we only touch these members.
interface CvNamespace {
  onRuntimeInitialized?: () => void;
  matFromImageData(imageData: ImageData): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  Canny(src: CvMat, dst: CvMat, lo: number, hi: number): void;
  HoughLinesP(
    edges: CvMat,
    lines: CvMat,
    rho: number,
    theta: number,
    threshold: number,
    minLineLength?: number,
    maxLineGap?: number,
  ): void;
  Mat: new () => CvMat;
  COLOR_RGBA2GRAY: number;
  getBuildInformation?: () => string;
}

interface CvMat {
  rows: number;
  cols: number;
  data32S: Int32Array;
  delete(): void;
}

async function loadOpenCV(): Promise<CvNamespace> {
  // Disabled pending Web-Worker migration (see file-level doc comment).
  // Returning a rejection immediately means `runAutoPerspective`'s Stage 2
  // catch block fires within microseconds — the mask-bbox trapezoid
  // heuristic takes over and the user sees panels with visible perspective
  // instead of a frozen tab or a 15 s no-op.
  throw new OpencvNotInstalledError(
    'Stage-2 OpenCV loader disabled until Web-Worker migration — ' +
      'see docs/design-docs/AUTO-PERSPECTIVE-FALLBACK-STRATEGY.md',
  );
}

/**
 * No-op in the disabled state — exported to keep the call site in
 * `PhotoEditorPage` stable. When OpenCV is re-enabled (via Web Worker),
 * this will warm up the worker in parallel with segmentation so the
 * first auto-perspective run does not pay the cold-start cost serially.
 */
export function prefetchOpenCV(): void {
  // intentional no-op
}

// ─── Image decoding ─────────────────────────────────────────────────

async function loadImageBitmap(imageUrl: string): Promise<ImageBitmap> {
  // data: URL branch — synchronous-ish via Blob; handles the photo uploads
  // the app produces (see PhotoEditorPage.tsx reader.readAsDataURL).
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`Failed to fetch image: ${resp.status}`);
  }
  const blob = await resp.blob();
  return createImageBitmap(blob);
}

// ─── Provider factory ───────────────────────────────────────────────

export function createOpencvLsdProvider(
  options: OpencvLsdOptions = {},
): LineProvider {
  const maxLines = options.maxLines ?? 400;
  const maxDim = options.maxDim ?? 640;

  return async (input: {
    imageUrl: string;
    mask: WallMask;
    photoSize: { width: number; height: number };
  }): Promise<Line[]> => {
    let cv: CvNamespace;
    try {
      cv = await loadOpenCV();
    } catch (err) {
      // Already mapped to OpencvNotInstalledError by loadOpenCV on import
      // failure; anything else we also wrap so the store's catch block has
      // a single typed error to pattern-match on.
      if (err instanceof OpencvNotInstalledError) throw err;
      throw new OpencvNotInstalledError(err);
    }

    const bitmap = await loadImageBitmap(input.imageUrl);
    // Downscale so Canny + Hough stay under ~50 ms on mid-range CPUs. We
    // scale line coords back up at the end so callers always get photo-space
    // coordinates (matches the `Line` contract used by vanishingPointDetector
    // and by the backend auto-perspective response).
    const photoW = input.photoSize.width;
    const photoH = input.photoSize.height;
    const longEdge = Math.max(photoW, photoH);
    const scale = longEdge > maxDim ? maxDim / longEdge : 1;
    const workW = Math.max(1, Math.round(photoW * scale));
    const workH = Math.max(1, Math.round(photoH * scale));

    // OffscreenCanvas is supported in all modern browsers we target; fall
    // back to a regular canvas if it is missing (older Safari) so we don't
    // throw a different "not available" in the catch block above.
    const canvas: OffscreenCanvas | HTMLCanvasElement =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(workW, workH)
        : Object.assign(document.createElement('canvas'), {
            width: workW,
            height: workH,
          });
    const ctx = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) {
      bitmap.close?.();
      throw new OpencvNotInstalledError('2D context unavailable');
    }
    ctx.drawImage(bitmap, 0, 0, workW, workH);
    bitmap.close?.();
    const imgData = ctx.getImageData(0, 0, workW, workH);

    // Mats that need releasing regardless of path.
    const src = cv.matFromImageData(imgData);
    const gray = new cv.Mat();
    const edges = new cv.Mat();
    const houghLines = new cv.Mat();
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      // Canny thresholds 50/150 are the stock OpenCV tutorial values; the
      // image is already downsampled so we don't need a dynamic threshold.
      cv.Canny(gray, edges, 50, 150);
      // threshold=50 → a bin needs 50 accumulator votes.
      // minLineLength=30 and maxLineGap=10 px are at the work-canvas scale.
      cv.HoughLinesP(
        edges,
        houghLines,
        1,
        Math.PI / 180,
        50,
        30,
        10,
      );

      const out: Line[] = [];
      const n = Math.min(houghLines.rows, maxLines);
      const invScale = scale === 0 ? 1 : 1 / scale;
      const data = houghLines.data32S;
      for (let i = 0; i < n; i++) {
        const base = i * 4;
        const p1: Point = {
          x: data[base] * invScale,
          y: data[base + 1] * invScale,
        };
        const p2: Point = {
          x: data[base + 2] * invScale,
          y: data[base + 3] * invScale,
        };
        out.push({ p1, p2 });
      }
      return out;
    } finally {
      // Emscripten heap is NOT GC'd — explicit free on every path.
      src.delete();
      gray.delete();
      edges.delete();
      houghLines.delete();
    }
  };
}
