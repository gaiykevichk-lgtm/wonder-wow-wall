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
 * Why `<script>` injection, not dynamic import: the opencv.js bundle is
 * ~11 MB (Emscripten-compiled asm.js, not lazy WASM). Going through Vite's
 * module system for a file this large is unreliable in dev — excluding it
 * from `optimizeDeps` makes the dev server serve the raw UMD, which Vite
 * can't always wrap as an ES module within a usable timeout; including it
 * triggers a very heavy pre-bundle step that has OOM'd the 512 MB sandbox.
 * Shipping the file as a static public asset and letting the browser
 * evaluate it as a classic script (which sets `window.cv`, exactly as
 * opencv.js expects) sidesteps both problems. The file is still lazy — the
 * `<script>` tag is only appended on the first auto-perspective call.
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
// become usable. The asset is ~11 MB so on a cold HTTP cache + slow sandbox
// network + the asm.js runtime's async init it can take a good while.
// Anything beyond this and we surrender to the fallback chain — a stuck
// "detecting…" indicator is worse than a quiet manual mode.
const OPENCV_LOAD_TIMEOUT_MS = 30_000;

// Path under which `opencv.js` is served as a static asset. Copied from
// `node_modules/@techstark/opencv-js/dist/opencv.js` into `public/` at
// repo bootstrap; Vite serves it verbatim from the dev server root and
// the production build emits it to `/dist/opencv.js`.
const OPENCV_SCRIPT_URL = '/opencv.js';

// Tag applied to the injected <script> so concurrent callers can reuse an
// in-flight load, and browsers can dedupe if this file is hot-reloaded.
const SCRIPT_MARKER = 'data-opencv-js';

/** Window shape we touch. Declared locally to avoid polluting global types. */
interface OpenCVWindow {
  cv?: CvNamespace;
  document: Document;
}

function getOpenCVWindow(): OpenCVWindow | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  return window as unknown as OpenCVWindow;
}

async function loadOpenCV(): Promise<CvNamespace> {
  if (cvPromise) return cvPromise;
  const w = getOpenCVWindow();
  if (!w) {
    // SSR / node / non-DOM test runner — nothing we can do.
    return Promise.reject(
      new OpencvNotInstalledError('DOM not available (SSR or test env)'),
    );
  }
  const raw = (async (): Promise<CvNamespace> => {
    // Fast-path: a previous run already installed it on window.
    if (typeof w.cv?.getBuildInformation === 'function') {
      return w.cv;
    }

    // Sanity-check the asset is actually served before we inject. A HEAD
    // request is cheap and fails instantly in jsdom / misconfigured
    // deployments where `/opencv.js` would 404 — that gives tests a fast
    // rejection path instead of hanging on a `<script>` tag whose onload
    // never fires.
    try {
      const probe = await fetch(OPENCV_SCRIPT_URL, { method: 'HEAD' });
      if (!probe.ok) {
        throw new OpencvNotInstalledError(
          `opencv.js asset unavailable (HTTP ${probe.status}). ` +
            `Ensure public/opencv.js is served.`,
        );
      }
    } catch (err) {
      if (err instanceof OpencvNotInstalledError) throw err;
      throw new OpencvNotInstalledError(err);
    }

    // Inject (or reuse) a <script> tag. opencv.js is a UMD that assigns
    // `window.cv` during evaluation and fires `onRuntimeInitialized` once
    // the Emscripten asm.js heap is set up. We wait for that event (or a
    // getBuildInformation poll as belt+braces).
    const doc = w.document;
    let script = doc.querySelector<HTMLScriptElement>(
      `script[${SCRIPT_MARKER}]`,
    );
    if (!script) {
      script = doc.createElement('script');
      script.setAttribute(SCRIPT_MARKER, '1');
      script.async = true;
      script.src = OPENCV_SCRIPT_URL;
      doc.head.appendChild(script);
    }

    // Wait for the script tag to finish evaluating. If it errors we map to
    // OpencvNotInstalledError for the store's fallback chain.
    await new Promise<void>((resolve, reject) => {
      if (script!.dataset.loaded === '1') {
        resolve();
        return;
      }
      script!.addEventListener('load', () => {
        script!.dataset.loaded = '1';
        resolve();
      });
      script!.addEventListener('error', (e) =>
        reject(
          new OpencvNotInstalledError(
            e instanceof Event ? 'script tag load error' : String(e),
          ),
        ),
      );
    });

    const cv = w.cv;
    if (!cv) {
      throw new OpencvNotInstalledError(
        'window.cv missing after opencv.js evaluated',
      );
    }
    if (typeof cv.getBuildInformation === 'function') {
      return cv;
    }

    // Runtime may not be ready yet even though the script evaluated —
    // Emscripten boots the asm.js heap asynchronously and fires
    // `onRuntimeInitialized` exactly once. Hook it and also poll as a
    // belt+braces check (the handler occasionally misses when another
    // consumer has already attached a listener).
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
  // network blip is transient), so clear the cache on failure. We also log
  // the underlying cause in dev so debugging doesn't require a breakpoint.
  return cvPromise.catch((err) => {
    cvPromise = null;
    if (import.meta.env.DEV) {
      const cause = (err as { cause?: unknown }).cause;
      // eslint-disable-next-line no-console
      console.warn('[opencvLsdAdapter] loadOpenCV failed:', err, 'cause:', cause);
    }
    throw err;
  });
}

/**
 * Fire-and-forget warm-up. Triggers `<script>` injection + Emscripten boot so
 * that by the time `runAutoPerspective` actually needs OpenCV, the ~11 MB
 * bundle is already fetched and the runtime is initialised.
 *
 * Safe to call multiple times — `loadOpenCV()` dedupes via `cvPromise`.
 * Errors are swallowed: this is best-effort; the real call path in the store
 * will still produce a typed `OpencvNotInstalledError` if loading ultimately
 * fails, which triggers the proper fallback chain.
 *
 * Callers: `PhotoEditorPage` kicks this off the moment segmentation finishes
 * so the backend (Stage 1) and OpenCV cold-start run in parallel instead of
 * serially eating the overall 25 s detection budget.
 */
export function prefetchOpenCV(): void {
  // Only in DOM environments — SSR / jest-node would hit the SSR reject path
  // and log spurious warnings.
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  loadOpenCV().catch((err) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[opencvLsdAdapter] prefetchOpenCV failed:', err);
    }
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
