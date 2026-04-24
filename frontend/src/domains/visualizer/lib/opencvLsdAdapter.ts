/**
 * Adapter that supplies `vanishingPointDetector` with line segments extracted
 * by OpenCV.js LSD (Line Segment Detector).
 *
 * STATUS — Phase 3.1b STUB. The real OpenCV.js binding is intentionally
 * deferred: the package weighs ~8 MB and must lazy-load inside `cvWorkerHost`
 * to avoid blocking the main thread. Wiring it in this sandbox would require
 * shipping a Web Worker plus a WASM binary that is not yet on the dependency
 * list. Splitting the pure-JS algorithm (`vanishingPointDetector`) from the
 * line provider lets us ship the algorithm now and bolt on the real adapter
 * in a follow-up phase without changing call sites.
 *
 * The exported `createOpencvLsdProvider` therefore returns a `LineProvider`
 * that throws `OpencvNotInstalledError` when invoked. Callers should catch
 * this and fall back to manual perspective entry.
 */

import type { Line, LineProvider } from './vanishingPointDetector';
import type { CvWorkerHost } from './cvWorkerHost';
import type { WallMask } from '../model/types';

export class OpencvNotInstalledError extends Error {
  readonly code = 'opencv-not-installed' as const;
  constructor() {
    super(
      'OpenCV.js LSD adapter is not yet wired up. ' +
        'Auto-perspective detection falls back to manual mode.',
    );
    this.name = 'OpencvNotInstalledError';
  }
}

export interface OpencvLsdOptions {
  /** Worker host that will eventually host the OpenCV WASM module. */
  workerHost: CvWorkerHost;
  /**
   * Maximum number of lines to return. LSD on a 4 MP image can emit thousands;
   * the VP detector is happy with the longest few hundred.
   *
   * TODO(Phase 3.1c): currently unused — declared so call sites can already
   * pass it without a future breaking change when the real adapter lands.
   */
  maxLines?: number;
}

/**
 * Build a `LineProvider` backed by OpenCV.js LSD running on the supplied
 * worker host. **Throws `OpencvNotInstalledError` on every call** until the
 * real binding lands — see file header.
 */
export function createOpencvLsdProvider(_options: OpencvLsdOptions): LineProvider {
  return async (_input: {
    imageUrl: string;
    mask: WallMask;
    photoSize: { width: number; height: number };
  }): Promise<Line[]> => {
    throw new OpencvNotInstalledError();
  };
}
