/**
 * Reference Detector — supplies `scaleEstimator` with bounding boxes of
 * known-size objects (outlet, switch, door, …) detected by an ML model.
 *
 * STATUS — Phase 4.1b STUB. The real implementation will run YOLOv8n COCO
 * (≈ 6 MB ONNX) through `onnxruntime-web` (≈ 3 MB JS + WASM) inside
 * `cvWorkerHost` so it doesn't block the main thread or fight OpenCV for
 * memory on mobile Chrome. Wiring it requires shipping the ORT runtime + the
 * model file, which is intentionally deferred — see Phase 4.1c in the plan.
 *
 * The adapter pattern mirrors `opencvLsdAdapter.ts` from Phase 3: a
 * `ReferenceDetector` is a single function the store invokes with the photo
 * URL. Tests inject a fake; production injects this stub today and the real
 * ORT-backed implementation tomorrow, with no call-site changes.
 */

import type { CvWorkerHost } from './cvWorkerHost';
import type { ReferenceCandidate } from './scaleEstimator';

export class OnnxNotInstalledError extends Error {
  readonly code = 'onnx-not-installed' as const;
  constructor() {
    super(
      'YOLOv8n reference detector is not yet wired up. ' +
        'Auto-scale falls back to manual calibration.',
    );
    this.name = 'OnnxNotInstalledError';
  }
}

/**
 * Pluggable detection function. Receives the photo URL and its dimensions,
 * returns a list of bounding boxes for known reference objects in
 * **photo (screen) coordinates**. Implementations are expected to:
 *
 * - Run inference inside a Web Worker (the supplied `CvWorkerHost`) so the
 *   main thread stays responsive.
 * - Resolve with `[]` rather than throwing when nothing is detected.
 * - Throw `OnnxNotInstalledError` (or any subclass of `Error`) when the model
 *   is unavailable; callers translate that to a silent "manual fallback" UI.
 */
export type ReferenceDetector = (input: {
  imageUrl: string;
  photoSize: { width: number; height: number };
}) => Promise<ReferenceCandidate[]>;

export interface OnnxReferenceDetectorOptions {
  /** Worker host that will eventually run the ONNX runtime. */
  workerHost: CvWorkerHost;
  /**
   * Per-class detection threshold (0..1). Boxes below this score are dropped.
   *
   * TODO(Phase 4.1c): currently unused — declared so call sites can pass it
   * without a future breaking change when the real adapter lands.
   */
  scoreThreshold?: number;
  /**
   * Maximum number of candidates to return. YOLO can emit hundreds of weak
   * detections; the UI overlay only shows the top few.
   *
   * TODO(Phase 4.1c): currently unused — see `scoreThreshold`.
   */
  maxCandidates?: number;
}

/**
 * Build a `ReferenceDetector` backed by ONNX Runtime Web. **Throws
 * `OnnxNotInstalledError` on every call** until Phase 4.1c lands the real
 * binding — see file header.
 */
export function createOnnxReferenceDetector(
  _options: OnnxReferenceDetectorOptions,
): ReferenceDetector {
  return async (_input) => {
    throw new OnnxNotInstalledError();
  };
}
