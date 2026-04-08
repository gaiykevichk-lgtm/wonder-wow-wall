/**
 * ML Segmentation Service — browser-based wall detection.
 *
 * Uses @huggingface/transformers with SegFormer-B0 (ADE20K, 150 classes).
 * Model runs entirely in-browser via WASM/WebGPU — no server, no API keys.
 * Model file (~15 MB) is cached in IndexedDB after first download.
 */

import type { WallMask, Obstacle, ObstacleType, BoundingBox } from '../model/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SegmentationResult {
  wallMask: WallMask;
  obstacles: Obstacle[];
  classes: string[];
}

export type SegmentationProgressCallback = (progress: {
  status: 'loading-model' | 'segmenting';
  percent: number;
}) => void;

// ─── ADE20K class mappings ──────────────────────────────────────────────────

/** ADE20K class index → label (only the ones we care about) */
const ADE20K_WALL_CLASS = 0; // "wall"

/** ADE20K text label → class index (fallback for models that return text labels) */
const ADE20K_LABEL_TO_INDEX: Record<string, number> = {
  wall: 0,
  floor: 3,
  ceiling: 5,
  cabinet: 6,
  table: 7,
  window: 8,
  bed: 10,
  door: 14,
  person: 15,
  sofa: 17,
  lamp: 18,
  chair: 19,
  painting: 22,
  'chest of drawers': 32,
  counter: 33,
  mirror: 34,
  shelf: 36,
};

const ADE20K_OBSTACLE_MAP: Record<number, { type: ObstacleType; label: string }> = {
  14: { type: 'door', label: 'Дверь' },
  8:  { type: 'window', label: 'Окно' },
  7:  { type: 'furniture', label: 'Мебель' },    // table
  19: { type: 'furniture', label: 'Стул' },       // chair
  17: { type: 'furniture', label: 'Диван' },      // sofa
  6:  { type: 'furniture', label: 'Шкаф' },       // cabinet (floor)
  10: { type: 'furniture', label: 'Кровать' },    // bed
  32: { type: 'furniture', label: 'Комод' },      // chest of drawers
  33: { type: 'furniture', label: 'Тумба' },      // counter
  36: { type: 'furniture', label: 'Полка' },      // shelf
  18: { type: 'other', label: 'Лампа' },          // lamp
  22: { type: 'decor', label: 'Картина' },        // painting/poster
  34: { type: 'decor', label: 'Зеркало' },        // mirror
  15: { type: 'person', label: 'Человек' },       // person
};

// ─── Singleton pipeline ─────────────────────────────────────────────────────

let segmenterPromise: Promise<unknown> | null = null;

/**
 * Lazy-load the segmentation pipeline. Subsequent calls return the cached instance.
 */
async function initSegmenter(onProgress?: SegmentationProgressCallback) {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers');

    onProgress?.({ status: 'loading-model', percent: 10 });

    const segmenter = await pipeline(
      'image-segmentation',
      'Xenova/segformer-b0-finetuned-ade-512-512',
      {
        progress_callback: (info: { status?: string; progress?: number; name?: string; file?: string }) => {
          if (info.progress != null) {
            onProgress?.({ status: 'loading-model', percent: Math.round(info.progress) });
          }
        },
      },
    );

    onProgress?.({ status: 'loading-model', percent: 100 });
    return segmenter;
  })();

  return segmenterPromise;
}

// ─── Mask resizing ──────────────────────────────────────────────────────────

/**
 * Resize a binary mask (Uint8Array, 0/255) from srcW×srcH to dstW×dstH.
 * Uses nearest-neighbor interpolation (appropriate for binary masks).
 */
function resizeMask(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  if (srcW === dstW && srcH === dstH) return src;

  const dst = new Uint8Array(dstW * dstH);
  const xRatio = srcW / dstW;
  const yRatio = srcH / dstH;

  for (let y = 0; y < dstH; y++) {
    const srcY = Math.min(Math.floor(y * yRatio), srcH - 1);
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.floor(x * xRatio), srcW - 1);
      dst[y * dstW + x] = src[srcY * srcW + srcX]!;
    }
  }

  return dst;
}

// ─── Bounding box extraction ────────────────────────────────────────────────

/**
 * Extract bounding box from a binary label map for a given class.
 */
function extractBoundingBox(
  labelMap: Uint8Array | number[],
  width: number,
  height: number,
  classId: number,
): BoundingBox | null {
  let minX = width, minY = height, maxX = -1, maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (labelMap[y * width + x] === classId) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse ADE20K label string → class index.
 * Handles multiple formats: "label_0", "0", "wall", "Wall".
 * Returns null if the label cannot be mapped.
 */
function parseADE20KLabel(label: string): number | null {
  // Format: "label_0" → 0
  if (label.startsWith('label_')) {
    const idx = parseInt(label.slice(6), 10);
    return isNaN(idx) ? null : idx;
  }

  // Format: "0" → 0 (pure numeric string)
  const numeric = parseInt(label, 10);
  if (!isNaN(numeric) && String(numeric) === label) {
    return numeric;
  }

  // Format: "wall", "Wall", "door" → lookup by text name
  const normalized = label.toLowerCase().trim();
  if (normalized in ADE20K_LABEL_TO_INDEX) {
    return ADE20K_LABEL_TO_INDEX[normalized]!;
  }

  return null;
}

/**
 * Check if the current browser supports the ML pipeline (WASM required).
 */
export function isSegmentationSupported(): boolean {
  try {
    return typeof WebAssembly !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Run semantic segmentation on an image and extract wall mask + obstacles.
 *
 * @param imageUrl - data URL or object URL of the photo
 * @param photoWidth - actual photo width (mask will be resized to match)
 * @param photoHeight - actual photo height
 * @param onProgress - optional callback for UI progress updates
 */
export async function segmentScene(
  imageUrl: string,
  photoWidth: number,
  photoHeight: number,
  onProgress?: SegmentationProgressCallback,
): Promise<SegmentationResult> {
  if (!isSegmentationSupported()) {
    throw new Error('WASM not supported');
  }

  // 1. Init model (cached after first load)
  const segmenter = await initSegmenter(onProgress) as (
    img: string,
    options?: Record<string, unknown>,
  ) => Promise<Array<{ label: string; score: number; mask: { data: Uint8Array; width: number; height: number } }>>;

  onProgress?.({ status: 'segmenting', percent: 0 });

  // 2. Run inference
  const results = await segmenter(imageUrl, { threshold: 0.0 });

  onProgress?.({ status: 'segmenting', percent: 70 });

  // 3. Build per-pixel label map from segmentation results
  // SegFormer returns one result per detected class, each with a binary mask
  const modelW = results[0]?.mask?.width ?? 512;
  const modelH = results[0]?.mask?.height ?? 512;
  // Use 255 as "unassigned" sentinel — no ADE20K class has index 255
  const UNASSIGNED = 255;
  const labelMap = new Uint8Array(modelW * modelH);
  labelMap.fill(UNASSIGNED);

  // Parse class indices from labels and assign to label map.
  // Models may return labels in different formats:
  //   "label_0", "0", "wall", "Wall", etc.
  for (const result of results) {
    const classIndex = parseADE20KLabel(result.label);
    if (classIndex === null) continue;

    const maskData = result.mask.data;
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i]! > 0) {
        labelMap[i] = classIndex;
      }
    }
  }

  // 4. Extract wall mask (class 0 = wall in ADE20K)
  const wallMaskRaw = new Uint8Array(modelW * modelH);
  for (let i = 0; i < labelMap.length; i++) {
    wallMaskRaw[i] = labelMap[i] === ADE20K_WALL_CLASS ? 255 : 0;
  }

  // 5. Resize wall mask to photo dimensions
  const wallMaskData = resizeMask(wallMaskRaw, modelW, modelH, photoWidth, photoHeight);

  const wallMask: WallMask = {
    data: wallMaskData,
    width: photoWidth,
    height: photoHeight,
  };

  onProgress?.({ status: 'segmenting', percent: 85 });

  // 6. Extract obstacles
  const obstacles: Obstacle[] = [];
  const detectedClasses: string[] = [];

  for (const [classIdStr, info] of Object.entries(ADE20K_OBSTACLE_MAP)) {
    const classId = Number(classIdStr);
    const bbox = extractBoundingBox(labelMap, modelW, modelH, classId);
    if (!bbox) continue;

    // Estimate confidence based on area coverage.
    // Note: this is NOT the model's classification confidence — SegFormer semantic
    // segmentation assigns one class per pixel without per-class probability.
    // We use area fraction as a proxy: larger detected areas = higher confidence.
    let pixelCount = 0;
    for (let i = 0; i < labelMap.length; i++) {
      if (labelMap[i] === classId) pixelCount++;
    }
    const coverage = pixelCount / labelMap.length;

    // Skip very small detections (< 0.1% of image = likely noise)
    if (coverage < 0.001) continue;

    // Scale bounding box to photo dimensions
    const scaleX = photoWidth / modelW;
    const scaleY = photoHeight / modelH;

    const scaledBbox: BoundingBox = {
      x: Math.round(bbox.x * scaleX),
      y: Math.round(bbox.y * scaleY),
      width: Math.round(bbox.width * scaleX),
      height: Math.round(bbox.height * scaleY),
    };

    obstacles.push({
      type: info.type,
      label: info.label,
      polygon: [
        { x: scaledBbox.x, y: scaledBbox.y },
        { x: scaledBbox.x + scaledBbox.width, y: scaledBbox.y },
        { x: scaledBbox.x + scaledBbox.width, y: scaledBbox.y + scaledBbox.height },
        { x: scaledBbox.x, y: scaledBbox.y + scaledBbox.height },
      ],
      boundingBox: scaledBbox,
      confidence: Math.min(coverage * 10, 1), // area-based proxy, not model confidence
    });

    detectedClasses.push(info.label);
  }

  onProgress?.({ status: 'segmenting', percent: 100 });

  return { wallMask, obstacles, classes: detectedClasses };
}

/**
 * Reset the cached segmenter (for testing or memory cleanup).
 */
export function resetSegmenter(): void {
  segmenterPromise = null;
}
