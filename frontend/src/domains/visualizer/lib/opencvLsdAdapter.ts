/**
 * Adapter that supplies `vanishingPointDetector` with line segments extracted
 * by OpenCV.js.
 *
 * STATUS — Phase 3.1c. Real implementation using `@techstark/opencv-js`.
 *
 * Pipeline:
 *   ImageBitmap ← imageUrl
 *     → downscale to ≤`maxDim` px on the long edge (cost, not accuracy)
 *     → grayscale
 *     → Canny edges
 *     → HoughLinesP (probabilistic Hough)
 *     → scale coords back to photo space
 *   ⇒ Line[]
 *
 * Why HoughLinesP and not LSD: OpenCV removed the real LSD implementation in
 * 4.1 over licensing (BSD-3 → patent concerns). `createLineSegmentDetector`
 * throws in modern opencv.js builds. HoughLinesP returns comparable segment
 * lists for the flat, edge-rich walls we care about (doors, window frames,
 * floor/ceiling lines), which are exactly the cues the VP detector uses.
 *
 * Why dynamic import: the opencv.js bundle is ~11 MB (Emscripten-compiled
 * asm.js, not lazy WASM). Loading it on every page-load would bloat the
 * app's initial paint by an order of magnitude. `import('@techstark/opencv-js')`
 * lets Vite split it into a separate chunk that is fetched only when
 * auto-perspective actually runs — typically once per session, after photo
 * upload. Subsequent calls hit the HTTP cache.
 *
 * Initialization: OpenCV's Emscripten runtime boots asynchronously via
 * `cv.onRuntimeInitialized`. We resolve a module-level promise exactly once
 * so concurrent auto-perspective calls share the 300–500 ms cold start
 * instead of each paying it.
 *
 * Memory: every `cv.Mat` must be `.delete()`d; the Emscripten heap does not
 * garbage-collect. We wrap the inference in a finally-block that releases
 * every Mat regardless of path.
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

let cvPromise: Promise<CvNamespace> | null = null;

// Hard ceiling on how long we wait for the opencv.js Emscripten runtime to
// become usable. The bundle is ~11 MB; on a cold cache + slow network + the
// runtime's async init it can take a while. Anything beyond this and we
// surrender to the fallback chain — a stuck "detecting…" indicator is worse
// than a quiet manual mode.
const OPENCV_LOAD_TIMEOUT_MS = 5_000;

async function loadOpenCV(): Promise<CvNamespace> {
  if (cvPromise) return cvPromise;
  const raw = (async () => {
    let mod: unknown;
    try {
      // UMD module — default export under ESM interop is the `cv` namespace.
      mod = await import('@techstark/opencv-js');
    } catch (err) {
      // Network error, parse error, CSP block — treat as "not installed"
      // so the runAutoPerspective fallback chain moves on to the backend.
      throw new OpencvNotInstalledError(err);
    }
    const cv = (
      (mod as { default?: CvNamespace }).default ?? (mod as CvNamespace)
    );
    // `getBuildInformation` is only defined *after* runtime init. Its
    // presence is the cheapest signal that Emscripten has finished loading.
    if (typeof cv.getBuildInformation === 'function') {
      return cv;
    }
    // Wait for the async asm.js runtime to initialise. Emscripten fires
    // `onRuntimeInitialized` exactly once, but when the UMD is loaded via
    // Vite's ESM interop the handler occasionally never fires (the module
    // runs its init before our handler is attached). Poll as a belt +
    // braces check so we don't hang indefinitely.
    await new Promise<void>((resolve) => {
      if (typeof cv.getBuildInformation === 'function') {
        resolve();
        return;
      }
      const prev = cv.onRuntimeInitialized;
      cv.onRuntimeInitialized = () => {
        try {
          prev?.();
        } finally {
          resolve();
        }
      };
      // Poll fallback: tick every 50 ms and resolve when the runtime looks
      // alive. Paired with the outer `Promise.race` timeout below so a
      // never-initialising module still surrenders in bounded time.
      const pollId = setInterval(() => {
        if (typeof cv.getBuildInformation === 'function') {
          clearInterval(pollId);
          resolve();
        }
      }, 50);
    });
    return cv;
  })();

  cvPromise = Promise.race<CvNamespace>([
    raw,
    new Promise<CvNamespace>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new OpencvNotInstalledError(
              `OpenCV runtime did not initialise within ${OPENCV_LOAD_TIMEOUT_MS} ms`,
            ),
          ),
        OPENCV_LOAD_TIMEOUT_MS,
      );
    }),
  ]);
  // If the first attempt throws we want the next call to *retry* (e.g., the
  // network blip is transient), so clear the cache on failure.
  return cvPromise.catch((err) => {
    cvPromise = null;
    throw err;
  });
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
