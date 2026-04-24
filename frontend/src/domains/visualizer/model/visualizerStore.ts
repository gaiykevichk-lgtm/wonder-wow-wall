/**
 * Zustand store for the Visualizer domain.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Point,
  Scene,
  PanelLayout,
  PlacedPanel,
  PanelSizeKey,
  PlacementMode,
  WallMask,
  AccentZone,
  MaskTool,
  CostBreakdown,
  ScaleCalibration,
  EditorMode,
  CalibrationPoints,
  PerspectiveCorners,
} from './types';
import { message } from 'antd';
import { calculateCost } from '../lib/costCalculator';
import { autoFillWall, AutoFillBlockedError } from '../lib/layoutEngine';
import { createEmptyMask } from '../lib/maskUtils';
import { createPerspective } from '../lib/perspectiveEngine';
import { uint8ArrayToBase64, base64ToUint8Array } from '../lib/maskSerialization';
import { detectFromLines, type LineProvider } from '../lib/vanishingPointDetector';
import {
  estimateScaleFromReference,
  type ReferenceCandidate,
} from '../lib/scaleEstimator';
import type { ReferenceDetector } from '../lib/referenceDetector';
import {
  apiAutoDetectPerspective,
  apiAutoDetectPerspectiveInline,
  DegenerateCornersError,
  StaleVersionError,
  updateCalibration as apiUpdateCalibration,
  updatePerspective as apiUpdatePerspective,
  type AutoPerspectiveResult,
  type VisualizationProjectDTO,
} from '../lib/visualizerApi';

interface VisualizerState {
  // Scene
  scene: Scene | null;
  segmentationProgress: number;
  setScene: (scene: Scene) => void;
  updateWallMask: (mask: WallMask) => void;
  setSegmentationStatus: (status: Scene['segmentationStatus'], error?: string) => void;
  setSegmentationProgress: (percent: number) => void;
  setCalibration: (calibration: ScaleCalibration) => void;

  // Panel selection
  selectedDesignId: string;
  selectedDesignName: string;
  selectedDesignImage: string;
  selectedSizeKey: PanelSizeKey;
  selectedColor: string;
  selectedColorName: string;
  setSelectedDesign: (id: string, name: string, image: string) => void;
  setSelectedSize: (key: PanelSizeKey) => void;
  setSelectedColor: (hex: string, name: string) => void;

  // Layout
  layout: PanelLayout;
  addPanel: (panel: PlacedPanel) => void;
  removePanel: (id: string) => void;
  movePanel: (id: string, x: number, y: number) => void;
  clearPanels: () => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setAccentZone: (zone: AccentZone | null) => void;
  autoFill: () => void;
  updateAllDesigns: (designId: string, designName: string, designImage: string) => void;

  // Editor mode (calibration / perspective)
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  calibrationPoints: CalibrationPoints;
  setCalibrationPoint: (which: 'start' | 'end', point: Point) => void;
  setCalibrationReference: (cm: number) => void;
  applyCalibration: () => boolean;
  resetCalibration: () => void;
  perspectiveCorners: PerspectiveCorners | null;
  setPerspectiveCorners: (corners: PerspectiveCorners | null) => void;
  /**
   * Run vanishing-point auto-detection. Sets segmentationStatus to
   * `'detecting-perspective'` while running, transitions back to `'ready'`
   * unconditionally on completion. On success, populates
   * `perspectiveCorners` and `scene.perspectiveAutoDetected`. Failures
   * (low confidence, multi-plane, OpenCV adapter unavailable) are silent —
   * the user can still set corners manually.
   *
   * Phase 6 — `options.backendProjectId` enables the depth-based backend
   * fallback: if the primary (client-side) provider throws or returns a
   * low-confidence result, the store calls
   * `POST /api/visualizer/projects/{id}/auto-perspective`. The backend
   * requires the project to already be persisted with a photo + wall mask,
   * so callers should pass the id only AFTER the first save round-trip.
   * Omit the option to skip the fallback (e.g., tests, offline mode).
   */
  runAutoPerspective: (
    provider: LineProvider,
    options?: { backendProjectId?: string },
  ) => Promise<void>;
  /**
   * Run reference-object detection (Phase 4). Stores the result in
   * `scene.referenceCandidates`. Failures (model unavailable, network) are
   * silent — manual two-point calibration is always available. Race-protected
   * against photo swap (snapshots `photo.url` at start, bails on mismatch).
   */
  runAutoReferenceDetection: (detector: ReferenceDetector) => Promise<void>;
  /**
   * Apply one of the detected reference candidates as the active calibration.
   * Writes `scene.calibration = { method: 'auto', pixelsPerCm }` and sets
   * `scene.calibrationAutoDetected = true`. Returns `false` if the candidate
   * cannot be converted (zero bbox / unknown type).
   *
   * If `perspectiveCorners` are set, the bbox is back-projected into the wall
   * plane before measurement — without that, an outlet near a foreshortened
   * edge would yield a wildly off-scale result.
   */
  applyReferenceCandidate: (candidate: ReferenceCandidate) => boolean;
  wallBrightness: number;
  setWallBrightness: (brightness: number) => void;

  // Mask editing
  maskTool: MaskTool;
  brushSize: number;
  maskOpacity: number;
  maskVisible: boolean;
  setMaskTool: (tool: MaskTool) => void;
  setBrushSize: (size: number) => void;
  setMaskOpacity: (opacity: number) => void;
  toggleMaskVisible: () => void;

  // Undo
  undoStack: WallMask[];
  pushUndo: (mask: WallMask) => void;
  undo: () => void;

  // Cost
  cost: CostBreakdown;
  recalculateCost: (hasSubscription: boolean) => void;

  // Persistence (API — explicit user action)
  getProjectPayload: () => Record<string, unknown> | null;

  // ─── Phase 5C — backend autosave wiring ─────────────────────────
  /**
   * Server-assigned ID. `null` until the user explicitly saves the project
   * via the create endpoint. Autosave is a no-op while `projectId` is null —
   * the typical UX is "edit locally, then save", and we don't want to fire
   * partial PATCHes against a row that doesn't exist yet.
   */
  projectId: string | null;
  /**
   * Server's `version` field for the loaded project. This is the value we
   * echo back on PATCH for optimistic-lock; the API responds with `version+1`
   * which we then store here.
   *
   * R7 strategy: backend always wins on load. We never persist this in
   * localStorage to avoid stale PATCHes after a long offline session — on
   * cold start, a fresh `loadProject` call re-populates it.
   */
  serverVersion: number;
  /**
   * Hydrate the store from a backend `loadProject` response. Replaces
   * `perspectiveCorners`, `scene.calibration`, and the auto-detected flags.
   * Also clears any in-flight sync (otherwise a previously-debounced PATCH
   * could clobber the freshly-loaded version).
   */
  setLoadedProject: (dto: VisualizationProjectDTO) => void;
  /**
   * Public alias of `setPerspectiveCorners` that *also* fires a debounced
   * PATCH against the backend (D6 abort semantics applied). Components that
   * need pure local state (no sync) should keep using `setPerspectiveCorners`.
   */
  setPerspectiveCornersAndSync: (corners: PerspectiveCorners | null) => void;
  /** Same as above for calibration. */
  setCalibrationAndSync: (calibration: ScaleCalibration) => void;
  /**
   * Cancel any in-flight perspective/calibration PATCH and clear the debounce
   * timers. Called on `reset` and when loading a different project.
   */
  cancelPendingSync: () => void;

  // Reset
  reset: () => void;
}

// ─── Module-level sync state (Phase 5C) ──────────────────────────────
//
// These live outside the store on purpose:
//  - `AbortController` / `setTimeout` handles are not serializable so they
//    must not appear in zustand's persisted partition.
//  - There is exactly one active sync per kind at a time (last-write-wins),
//    so a module-level singleton is a faithful model.
//
// Keeping them per-kind (rather than one shared controller) means a
// perspective drag mid-flight does NOT abort an in-flight calibration save —
// they are independent edits.

const SYNC_DEBOUNCE_MS = 1000;

let _perspectiveSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _perspectiveSyncCtrl: AbortController | null = null;
let _calibrationSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _calibrationSyncCtrl: AbortController | null = null;

/** Test-only hook — Vitest can swap this to a synchronous fake when needed. */
export const __syncInternals = {
  cancelAll(): void {
    if (_perspectiveSyncTimer) clearTimeout(_perspectiveSyncTimer);
    if (_calibrationSyncTimer) clearTimeout(_calibrationSyncTimer);
    _perspectiveSyncCtrl?.abort();
    _calibrationSyncCtrl?.abort();
    _perspectiveSyncTimer = null;
    _calibrationSyncTimer = null;
    _perspectiveSyncCtrl = null;
    _calibrationSyncCtrl = null;
  },
};

/**
 * Debounced PATCH of `scene.calibration` to the backend. Called by every
 * code path that writes `scene.calibration` while a `projectId` is set —
 * `setCalibrationAndSync`, `applyCalibration`, `applyReferenceCandidate`.
 *
 * X1 closure (2026-04-24): before this helper existed, `applyCalibration`
 * and `applyReferenceCandidate` wrote to `scene.calibration` via a direct
 * `set({...})` without triggering any sync. For users with a saved project
 * (`projectId != null`), manual two-point calibration and reference-candidate
 * selection were lost on reload — violating the Phase 5C DoD "calibration
 * restored after reload". Centralising the debounce+PATCH here guarantees
 * every local calibration write reaches the server.
 */
function scheduleCalibrationSync(projectId: string): void {
  if (_calibrationSyncTimer) clearTimeout(_calibrationSyncTimer);
  _calibrationSyncCtrl?.abort();

  _calibrationSyncTimer = setTimeout(async () => {
    _calibrationSyncTimer = null;
    const ctrl = new AbortController();
    _calibrationSyncCtrl = ctrl;
    // Read state *inside* the debounced closure so we sync the latest
    // calibration the user typed, not the one captured at schedule time
    // (mirrors the B49 rationale on `setCalibrationAndSync`).
    const state = useVisualizerStore.getState();
    const latestCalibration = state.scene?.calibration;
    const serverVersion = state.serverVersion;
    if (!latestCalibration) {
      _calibrationSyncCtrl = null;
      return;
    }
    try {
      const updated = await apiUpdateCalibration(
        projectId,
        latestCalibration,
        serverVersion,
        { signal: ctrl.signal },
      );
      if (_calibrationSyncCtrl === ctrl) {
        useVisualizerStore.setState({ serverVersion: updated.version });
        _calibrationSyncCtrl = null;
      }
    } catch (err) {
      if (_calibrationSyncCtrl === ctrl) {
        _calibrationSyncCtrl = null;
      }
      if (err instanceof StaleVersionError) {
        message.warning(
          'Проект изменён в другом окне. Обновите страницу, чтобы увидеть свежие данные.',
        );
        return;
      }
      if ((err as DOMException)?.name === 'AbortError') return;
      if (import.meta.env.DEV) {
        console.warn('[scheduleCalibrationSync] PATCH failed:', err);
      }
    }
  }, SYNC_DEBOUNCE_MS);
}

const EMPTY_LAYOUT: PanelLayout = {
  panels: [],
  placementMode: 'manual',
  accentZone: null,
};

const EMPTY_COST: CostBreakdown = {
  panelsBySize: { '30x30': 0, '30x60': 0, '60x60': 0 },
  totalPanels: 0,
  coveredAreaM2: 0,
  basePanelsCost: 0,
  overlaysCost: 0,
  overlayDiscount: 0,
  totalCost: 0,
};

export const useVisualizerStore = create<VisualizerState>()(
  persist(
  (set, get) => ({
  // Scene
  scene: null,
  segmentationProgress: 0,
  setScene: (scene) => set({ scene }),
  updateWallMask: (mask) => {
    const scene = get().scene;
    if (scene) {
      set({ scene: { ...scene, wallMask: mask } });
    }
  },
  setSegmentationStatus: (status, error) => {
    const scene = get().scene;
    if (scene) {
      set({
        scene: { ...scene, segmentationStatus: status, segmentationError: error },
      });
    }
  },
  setSegmentationProgress: (percent) => set({ segmentationProgress: percent }),
  setCalibration: (calibration) => {
    const scene = get().scene;
    if (scene) {
      // Direct calibration writes are always treated as manual — clear the
      // auto-detected flag so the UI status chip reflects user intent.
      set({ scene: { ...scene, calibration, calibrationAutoDetected: false } });
    }
  },

  // Panel selection
  selectedDesignId: '',
  selectedDesignName: '',
  selectedDesignImage: '',
  selectedSizeKey: '30x30',
  selectedColor: '',
  selectedColorName: '',
  setSelectedDesign: (id, name, image) =>
    set({ selectedDesignId: id, selectedDesignName: name, selectedDesignImage: image }),
  setSelectedSize: (key) => set({ selectedSizeKey: key }),
  setSelectedColor: (hex, name) => set({ selectedColor: hex, selectedColorName: name }),

  // Layout
  layout: { ...EMPTY_LAYOUT },
  addPanel: (panel) =>
    set((state) => ({
      layout: { ...state.layout, panels: [...state.layout.panels, panel] },
    })),
  removePanel: (id) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.filter((p) => p.id !== id),
      },
    })),
  movePanel: (id, x, y) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.map((p) =>
          p.id === id ? { ...p, x, y } : p,
        ),
      },
    })),
  clearPanels: () =>
    set((state) => ({ layout: { ...state.layout, panels: [] } })),
  setPlacementMode: (mode) =>
    set((state) => ({ layout: { ...state.layout, placementMode: mode } })),
  setAccentZone: (zone) =>
    set((state) => ({ layout: { ...state.layout, accentZone: zone } })),

  autoFill: () => {
    const state = get();
    const { scene, selectedSizeKey, selectedDesignId, selectedDesignName, selectedDesignImage, selectedColor, selectedColorName, layout, perspectiveCorners } = state;

    if (!scene?.wallMask) {
      message.warning('Сначала загрузите фото и дождитесь распознавания стены');
      return;
    }
    if (!selectedDesignId) {
      message.warning('Сначала выберите дизайн панели');
      return;
    }
    // Detection-in-flight hint. We don't block: the user still gets tiles
    // immediately in flat mode, and `runAutoPerspective` will re-fill them
    // with the correct perspective + bbox-derived scale once detection
    // resolves (see the commit block of `runAutoPerspective`).
    if (scene.segmentationStatus === 'detecting-perspective') {
      message.info(
        'Определяем геометрию стены — плитки перестроятся автоматически, когда детекция завершится.',
      );
    }

    // Derive perspective transform from corners + photo bounds (wall-space
    // is sized to the photo for now; v2 will introduce a separate wallSpace).
    const perspective = perspectiveCorners
      ? createPerspective(perspectiveCorners, {
          w: scene.photo.width,
          h: scene.photo.height,
        })
      : null;

    try {
      const panels = autoFillWall({
        mask: scene.wallMask,
        sizeKey: selectedSizeKey,
        calibration: scene.calibration,
        designId: selectedDesignId,
        designName: selectedDesignName,
        designImage: selectedDesignImage,
        color: selectedColor,
        colorName: selectedColorName,
        accentZone: layout.accentZone,
        obstacles: scene.objectMask?.obstacles,
        perspective,
      });

      if (panels.length === 0) {
        // Don't wipe existing panels just because auto-fill found no new
        // spots (e.g. all cells covered by obstacles or below the coverage
        // threshold). The user explicitly clears via Clear All.
        message.info('Не удалось разместить панели — недостаточно места на стене');
        return;
      }

      set({ layout: { ...layout, panels } });
    } catch (err) {
      if (err instanceof AutoFillBlockedError) {
        message.warning(
          'Откалибруйте масштаб (две точки на известной длине) перед автозаполнением в режиме перспективы.',
        );
        return;
      }
      if (import.meta.env.DEV) {
        console.error('autoFill error:', err);
      }
      message.error('Ошибка при автозаполнении');
    }
  },

  updateAllDesigns: (designId, designName, designImage) =>
    set((state) => ({
      layout: {
        ...state.layout,
        panels: state.layout.panels.map((p) => ({
          ...p,
          designId,
          designName,
          designImage,
        })),
      },
    })),

  // Editor mode (calibration / perspective)
  editorMode: 'default',
  setEditorMode: (mode) => set({ editorMode: mode }),
  calibrationPoints: { start: null, end: null, referenceCm: 200 },
  setCalibrationPoint: (which, point) =>
    set((s) => ({
      calibrationPoints: { ...s.calibrationPoints, [which]: point },
    })),
  setCalibrationReference: (cm) =>
    set((s) => ({
      calibrationPoints: { ...s.calibrationPoints, referenceCm: cm },
    })),
  applyCalibration: () => {
    const { calibrationPoints, scene, projectId } = get();
    const { start, end, referenceCm } = calibrationPoints;
    if (!start || !end || !scene || referenceCm <= 0) return false;
    const distPx = Math.hypot(end.x - start.x, end.y - start.y);
    if (distPx < 5) return false;
    const pixelsPerCm = distPx / referenceCm;
    set({
      scene: {
        ...scene,
        calibration: { method: 'reference', pixelsPerCm },
        // Manual two-point calibration overrides any prior auto-detection.
        calibrationAutoDetected: false,
      },
      editorMode: 'default',
    });
    // X1 closure — persist the manual calibration. Without this PATCH,
    // users lost their two-point calibration on reload.
    if (projectId) scheduleCalibrationSync(projectId);
    return true;
  },
  resetCalibration: () =>
    set({ calibrationPoints: { start: null, end: null, referenceCm: 200 } }),
  perspectiveCorners: null,
  setPerspectiveCorners: (corners) => {
    // Any external corner change (drag, manual override, reset) means the
    // current corners are no longer "auto-detected" from the user's POV.
    const scene = get().scene;
    if (!scene) {
      set({ perspectiveCorners: corners });
      return;
    }
    // Seed a bbox-derived calibration from the user's quad when the only
    // active calibration is the upload-heuristic (method:'auto' with no
    // wallWidthCm). Presence of a user-drawn quad is an implicit statement
    // that the wall is ~3 m wide (an assumption still, but a far better one
    // than photoWidth/400). This keeps perspective auto-fill from blocking
    // with `AutoFillBlockedError` after a manual calibration, while
    // preserving real 'reference'/'manual' calibrations the user may have
    // already set.
    const shouldSeed =
      !!corners &&
      (!scene.calibration ||
        (scene.calibration.method === 'auto' &&
          scene.calibration.wallWidthCm === undefined));
    let seededCalibration: ScaleCalibration | null = null;
    if (shouldSeed && corners) {
      let minX = Infinity,
        maxX = -Infinity;
      for (const p of corners) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
      }
      const bboxWidth = maxX - minX;
      if (bboxWidth > 0) {
        seededCalibration = {
          method: 'auto',
          pixelsPerCm: bboxWidth / 300,
          wallWidthCm: 300,
        };
      }
    }
    set({
      perspectiveCorners: corners,
      scene: {
        ...scene,
        perspectiveAutoDetected: false,
        calibration: seededCalibration ?? scene.calibration,
        calibrationAutoDetected: seededCalibration
          ? true
          : scene.calibrationAutoDetected,
      },
    });
  },
  runAutoPerspective: async (provider, options) => {
    const scene = get().scene;
    if (!scene?.wallMask) return;
    // Snapshot identity of the scene we kicked off detection for. After every
    // `await` we re-read the store and bail if the user has swapped photos,
    // reset, or otherwise moved on — otherwise a slow detection on photo A
    // would clobber state belonging to photo B (B1 in audit). URL is a
    // sufficient discriminant because `setScene` always mints a new PhotoAsset.
    const startedFor = scene.photo.url;
    const photoSize = { width: scene.photo.width, height: scene.photo.height };
    // Capture wallMask in a local const so the closure keeps the non-null
    // narrowing across the `await` boundaries below (TS widens property
    // access after await even when the holder is const).
    const wallMask = scene.wallMask;
    const stillCurrent = (): Scene | null => {
      const s = get().scene;
      return s && s.photo.url === startedFor ? s : null;
    };
    set({
      scene: { ...scene, segmentationStatus: 'detecting-perspective' },
    });

    // Two-stage detection. Backend depth+RANSAC is the primary path — it is
    // a) more robust on textureless walls (where HoughLinesP finds nothing),
    // b) runs server-side so the client never pays the 11 MB opencv.js
    //    download, and c) returns a wall bbox in photo pixels that lets us
    //    auto-seed the calibration (otherwise the panel auto-fill step
    //    produces garbage-sized tiles).
    // OpenCV LSD remains as an offline/cache fallback when the backend is
    // unreachable. Track result out-of-band so both stages share the same
    // commit block; avoids duplicating `stillCurrent()` checks.
    let resolvedResult: AutoPerspectiveResult | null = null;
    let resolvedCorners: PerspectiveCorners | null = null;

    // Hard overall ceiling on how long we let auto-perspective run. The
    // backend has its own transport timeout inside `api`; this cap protects
    // the UI from pathological hangs (offline mode, a stuck opencv.js load,
    // a never-settling promise). Without it, the "Определяем углы стены…"
    // spinner could stay on screen indefinitely — which was the bug users
    // reported. 15 s is long enough for a cold backend cold-start on
    // mid-tier hardware + one MiDaS inference but short enough that manual
    // corners become available quickly on a bad connection.
    const OVERALL_TIMEOUT_MS = 15_000;

    // Serialise the mask once — reused in both stages and in the optional
    // backend-inline call. Serialising inside `runStages` would duplicate it
    // and require a ~200 ms alloc for every retry.
    const wallMaskBase64 = uint8ArrayToBase64(wallMask.data);

    const runStages = async (): Promise<void> => {
      // ─── Stage 1: backend depth + RANSAC ───
      // Prefer the inline variant so it works *before* the project has been
      // persisted (the common case right after upload). If the caller passes
      // a `backendProjectId`, the legacy project-bound endpoint is used
      // instead — mainly for server-side scripts that already have a saved
      // project; both return the same shape.
      if (stillCurrent()) {
        try {
          const result = options?.backendProjectId
            ? await apiAutoDetectPerspective(options.backendProjectId)
            : await apiAutoDetectPerspectiveInline({
                photoUrl: scene.photo.url,
                photoWidth: scene.photo.width,
                photoHeight: scene.photo.height,
                wallMaskBase64,
              });
          if (!stillCurrent()) return;
          resolvedResult = result;
          resolvedCorners = result.corners;
          return; // backend won — skip OpenCV.
        } catch (err) {
          if (import.meta.env.DEV) {
            console.warn('[runAutoPerspective] backend depth failed:', err);
          }
        }
      }

      // ─── Stage 2: client-side (OpenCV LSD → vanishing-point) fallback ───
      // Reached when the backend is unreachable or returned plane_fit_failed
      // (empty mask, degenerate geometry). OpenCV still needs to load; this
      // is the slow path and the one most likely to hit the OVERALL_TIMEOUT.
      try {
        const lines = await provider({
          imageUrl: scene.photo.url,
          mask: wallMask,
          photoSize,
        });
        if (!stillCurrent()) return;
        const vpResult = detectFromLines({ lines, mask: wallMask, photoSize });
        if (vpResult.ok) {
          resolvedCorners = vpResult.corners;
          // No bbox hint from VP detector — skip the auto-calibration step
          // in the commit block by leaving `resolvedResult` null.
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[runAutoPerspective] LSD provider failed:', err);
        }
      }
    };

    try {
      await Promise.race([
        runStages(),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            if (import.meta.env.DEV) {
              console.warn(
                '[runAutoPerspective] timed out after',
                OVERALL_TIMEOUT_MS,
                'ms — falling back to manual corners',
              );
            }
            resolve();
          }, OVERALL_TIMEOUT_MS),
        ),
      ]);
    } finally {
      // ─── Commit ───
      // Always runs — guarantees the 'detecting-perspective' spinner never
      // survives the function returning, regardless of timeout / thrown
      // error / early return from a stillCurrent() check. We only write
      // when the scene is still ours AND still in the detecting state, so
      // a concurrent photo swap (which resets status via setScene) is not
      // clobbered.
      const current = stillCurrent();
      // Reject degenerate results where the detector returned corners that
      // essentially match the photo rectangle (identity homography). This
      // is the StubDepthEstimator's failure mode in dev — it returns a
      // plane that fits the whole photo, which the plane fitter then
      // projects back to photo edges. Applying an identity transform
      // visually looks flat but falsely triggers perspective-mode code
      // paths (tile warping, calibration seeding). Treating the result
      // as "no corners" lets the UI fall back to OpenCV LSD (Stage 2) or
      // stay in flat mode until the user draws corners manually.
      if (resolvedCorners) {
        const { width: pw, height: ph } = photoSize;
        const tolX = pw * 0.03;
        const tolY = ph * 0.03;
        const nearPhotoRect =
          Math.abs(resolvedCorners[0].x) < tolX &&
          Math.abs(resolvedCorners[0].y) < tolY &&
          Math.abs(resolvedCorners[1].x - pw) < tolX &&
          Math.abs(resolvedCorners[1].y) < tolY &&
          Math.abs(resolvedCorners[2].x - pw) < tolX &&
          Math.abs(resolvedCorners[2].y - ph) < tolY &&
          Math.abs(resolvedCorners[3].x) < tolX &&
          Math.abs(resolvedCorners[3].y - ph) < tolY;
        if (nearPhotoRect) {
          if (import.meta.env.DEV) {
            console.warn(
              '[runAutoPerspective] backend returned identity-like corners (photo rect); treating as no-result',
            );
          }
          resolvedCorners = null;
          resolvedResult = null;
        }
      }
      if (current && current.segmentationStatus === 'detecting-perspective') {
        if (resolvedCorners !== null) {
          // Seed a bbox-derived calibration whenever detection returns a
          // wall extent. This OVERRIDES the upload-time `{method:'auto',
          // pixelsPerCm: photoWidth/400}` placeholder because the bbox
          // estimate is grounded in the *actual detected wall* (divide by
          // an assumed 3 m wall width) rather than the whole photo.
          //
          // The seed carries `wallWidthCm = 300` as a marker —
          // `layoutEngine.isTrustedCalibration` treats that metadata as
          // the discriminator between "low-trust upload heuristic" and
          // "medium-trust bbox derivation", which unblocks perspective
          // auto-fill. User-entered 'reference' / 'manual' calibrations
          // are preserved (we never clobber real ones).
          // Bbox for calibration seed: prefer the backend's bboxPixels when
          // available (Stage 1 depth path), otherwise derive it from the
          // detected corners (Stage 2 OpenCV LSD path). Both sources describe
          // the same thing — extent of the wall in photo pixels — and we
          // want the seed to fire regardless of which stage produced corners.
          let bbox = resolvedResult?.bboxPixels ?? null;
          if (!bbox && resolvedCorners) {
            let minX = Infinity, maxX = -Infinity;
            for (const p of resolvedCorners) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
            }
            const width = maxX - minX;
            if (width > 0) bbox = { width, height: 0 };
          }
          const hasBbox = !!bbox && bbox.width > 0;
          const shouldSeed =
            hasBbox &&
            (!current.calibration || current.calibration.method === 'auto');
          const seedCalibration = shouldSeed
            ? {
                method: 'auto' as const,
                pixelsPerCm: bbox.width / 300,
                wallWidthCm: 300,
              }
            : null;
          set({
            perspectiveCorners: resolvedCorners,
            scene: {
              ...current,
              segmentationStatus: 'ready',
              perspectiveAutoDetected: true,
              calibration: seedCalibration ?? current.calibration,
              calibrationAutoDetected: shouldSeed
                ? true
                : current.calibrationAutoDetected,
            },
          });

          // If the user already clicked "Заполнить стену" before detection
          // finished, their tiles were laid in flat mode (no warp, no
          // bbox-derived scale). Re-run auto-fill so the panels adopt the
          // freshly-detected wall geometry.
          //
          // Conservative trigger: only when every existing panel shares
          // the same designId + color — the signature of a prior auto-fill
          // call. Mixed-design layouts indicate manual placement and are
          // left untouched to preserve the user's work.
          if (shouldSeed) {
            const latest = get();
            const panels = latest.layout.panels;
            if (panels.length > 0) {
              const sigs = new Set(
                panels.map((p) => `${p.designId}::${p.color ?? ''}`),
              );
              if (sigs.size === 1) {
                latest.autoFill();
              }
            }
          }
        } else {
          set({ scene: { ...current, segmentationStatus: 'ready' } });
        }
      }
    }
  },
  runAutoReferenceDetection: async (detector) => {
    const scene = get().scene;
    if (!scene) return;
    // Same race-protection pattern as runAutoPerspective: snapshot the photo
    // identity, bail post-await if the user swapped photos. Detection is
    // photo-specific, mis-applying it to a newer scene would be confusing.
    const startedFor = scene.photo.url;
    try {
      const candidates = await detector({
        imageUrl: scene.photo.url,
        photoSize: { width: scene.photo.width, height: scene.photo.height },
      });
      const current = get().scene;
      if (!current || current.photo.url !== startedFor) return;
      set({
        scene: { ...current, referenceCandidates: candidates },
      });
    } catch (err) {
      // Adapter unavailable / ONNX runtime missing / inference error.
      // Fail silently — manual calibration is always available.
      if (import.meta.env.DEV) {
        console.warn('[runAutoReferenceDetection] detector failed:', err);
      }
    }
  },
  applyReferenceCandidate: (candidate) => {
    const state = get();
    const scene = state.scene;
    if (!scene) return false;
    // Cache perspectiveCorners once (B14): the previous code re-read
    // `get().perspectiveCorners` three times — collapse to a single read.
    const corners = state.perspectiveCorners;
    const perspective = corners
      ? createPerspective(corners, {
          w: scene.photo.width,
          h: scene.photo.height,
        })
      : undefined;
    const estimated = estimateScaleFromReference(candidate, perspective);
    if (!estimated) return false;
    // Only close the calibration overlay if the user invoked this *from* it
    // (B16). Future call sites (e.g. Konva bbox-overlay in 4.2a) must not
    // silently flip the editor mode from under the user.
    const closeOverlay = state.editorMode === 'calibrating';
    set({
      scene: {
        ...scene,
        calibration: estimated.calibration,
        calibrationAutoDetected: true,
      },
      ...(closeOverlay ? { editorMode: 'default' as const } : {}),
    });
    // X1 closure — persist the chosen auto-candidate. Without this PATCH,
    // the selected reference calibration was lost on reload.
    if (state.projectId) scheduleCalibrationSync(state.projectId);
    return true;
  },
  wallBrightness: 128,
  setWallBrightness: (brightness) => set({ wallBrightness: brightness }),

  // Mask editing
  maskTool: 'brush',
  brushSize: 20,
  maskOpacity: 0.3,
  maskVisible: true,
  setMaskTool: (tool) => set({ maskTool: tool }),
  setBrushSize: (size) => set({ brushSize: size }),
  setMaskOpacity: (opacity) => set({ maskOpacity: opacity }),
  toggleMaskVisible: () => set((s) => ({ maskVisible: !s.maskVisible })),

  // Undo
  undoStack: [],
  pushUndo: (mask) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-19), mask],
    })),
  undo: () => {
    const { undoStack, scene } = get();
    if (undoStack.length === 0 || !scene) return;
    const prevMask = undoStack[undoStack.length - 1]!;
    set({
      scene: { ...scene, wallMask: prevMask },
      undoStack: undoStack.slice(0, -1),
    });
  },

  // Cost
  cost: { ...EMPTY_COST },
  recalculateCost: (hasSubscription) => {
    const panels = get().layout.panels;
    set({ cost: calculateCost(panels, hasSubscription) });
  },

  // ─── Phase 5C — backend autosave wiring ───────────────────────────
  projectId: null,
  serverVersion: 1,

  setLoadedProject: (dto) => {
    // Cancel anything in flight before clobbering local state — otherwise
    // the freshly-loaded `serverVersion` could be overwritten by a stale
    // PATCH response that completes after this call.
    __syncInternals.cancelAll();
    const scene = get().scene;
    // B47 closure — when no scene exists yet (load-before-photo flow, e.g.
    // deep-linking to a saved project before the photo asset has been
    // hydrated), build a minimal placeholder scene from the DTO so the
    // backend-supplied calibration / auto-detected flags are not silently
    // dropped on the floor. Photo URL/dimensions are filled in when the
    // user uploads or the photo asset is restored from localStorage.
    const nextScene: Scene = scene
      ? {
          ...scene,
          calibration: dto.calibration,
          perspectiveAutoDetected: dto.perspectiveAutoDetected,
          calibrationAutoDetected: dto.calibrationAutoDetected,
        }
      : {
          photo: { url: '', width: 0, height: 0 },
          wallMask: null,
          objectMask: null,
          calibration: dto.calibration,
          segmentationStatus: 'idle',
          perspectiveAutoDetected: dto.perspectiveAutoDetected,
          calibrationAutoDetected: dto.calibrationAutoDetected,
        };
    set({
      projectId: dto.id,
      serverVersion: dto.version,
      perspectiveCorners: dto.perspectiveCorners,
      // R7: backend wins on load. Replace any local calibration that was
      // sitting in the store from prior session work.
      scene: nextScene,
    });
  },

  setPerspectiveCornersAndSync: (corners) => {
    // Update local state first so the UI is responsive — never block on the
    // network for visual feedback during a corner drag.
    get().setPerspectiveCorners(corners);
    const { projectId } = get();
    if (!projectId) return; // unsaved scene — local-only edit

    // Coalesce rapid drags into a single PATCH at the trailing edge of the
    // debounce window (D6). Aborting the previous in-flight request is
    // belt-and-braces: the server will still process it and bump version,
    // which the next PATCH will reconcile via 409 → reload.
    if (_perspectiveSyncTimer) clearTimeout(_perspectiveSyncTimer);
    _perspectiveSyncCtrl?.abort();

    _perspectiveSyncTimer = setTimeout(async () => {
      _perspectiveSyncTimer = null;
      const ctrl = new AbortController();
      _perspectiveSyncCtrl = ctrl;
      const { serverVersion } = get();
      try {
        const updated = await apiUpdatePerspective(
          projectId,
          get().perspectiveCorners,
          serverVersion,
          { signal: ctrl.signal },
        );
        // Only commit the new version if this controller is still the active
        // one — otherwise a newer drag has superseded us, do not race.
        if (_perspectiveSyncCtrl === ctrl) {
          set({ serverVersion: updated.version });
          _perspectiveSyncCtrl = null;
        }
      } catch (err) {
        if (_perspectiveSyncCtrl === ctrl) {
          _perspectiveSyncCtrl = null;
        }
        if (err instanceof DegenerateCornersError) {
          // Intermediate drag flattened the quad. Silent: the next debounce
          // will resend the user's final position.
          return;
        }
        if (err instanceof StaleVersionError) {
          // Another tab moved the version forward. Toast the user — they
          // need to refetch. Don't auto-refetch here, that's the caller's
          // job (they may have unsaved local work to merge).
          message.warning(
            'Проект изменён в другом окне. Обновите страницу, чтобы увидеть свежие данные.',
          );
          return;
        }
        if ((err as DOMException)?.name === 'AbortError') return;
        if (import.meta.env.DEV) {
          console.warn('[setPerspectiveCornersAndSync] PATCH failed:', err);
        }
      }
    }, SYNC_DEBOUNCE_MS);
  },

  setCalibrationAndSync: (calibration) => {
    get().setCalibration(calibration);
    const { projectId } = get();
    if (!projectId) return;
    // Debounce + PATCH logic lives in `scheduleCalibrationSync` (X1 closure)
    // so every calibration write path — slider edits, manual two-point,
    // reference-candidate selection — follows the same contract.
    scheduleCalibrationSync(projectId);
  },

  cancelPendingSync: () => {
    __syncInternals.cancelAll();
  },

  // Persistence (API payload builder — explicit user action)
  getProjectPayload: () => {
    const state = get();
    if (!state.scene) return null;
    // B46 closure — Phase 5C added typed `calibration`, auto-detected flags
    // and `version` to the wire DTO. Without them the first POST/PUT silently
    // drops those fields and the backend reverts the project to legacy
    // calibration-pixels-per-cm only. Mirrors `VisualizationProjectUpdate`
    // server schema (snake_case at the wire seam).
    const cal = state.scene.calibration;
    return {
      name: 'Мой проект',
      photo_url: state.scene.photo.url,
      photo_width: state.scene.photo.width,
      photo_height: state.scene.photo.height,
      wall_mask_base64: state.scene.wallMask
        ? uint8ArrayToBase64(state.scene.wallMask.data)
        : '',
      calibration_pixels_per_cm: cal?.pixelsPerCm ?? 5,
      panels: state.layout.panels.map((p) => ({
        design_id: p.designId,
        design_name: p.designName,
        design_image: p.designImage,
        size_key: p.sizeKey,
        color: p.color,
        color_name: p.colorName,
        x: p.x,
        y: p.y,
        render_width: p.renderWidth,
        render_height: p.renderHeight,
      })),
      perspective_corners: state.perspectiveCorners
        ? state.perspectiveCorners.map((c) => ({ x: c.x, y: c.y }))
        : null,
      placement_mode: state.layout.placementMode,
      // ─── Phase 5C additions ───
      calibration: cal
        ? {
            method: cal.method,
            pixels_per_cm: cal.pixelsPerCm,
            wall_width_cm: cal.wallWidthCm ?? null,
            wall_height_cm: cal.wallHeightCm ?? null,
          }
        : null,
      perspective_auto_detected: state.scene.perspectiveAutoDetected ?? false,
      calibration_auto_detected: state.scene.calibrationAutoDetected ?? false,
      version: state.serverVersion,
    };
  },

  // Reset
  reset: () => {
    // Drop any pending PATCH so a stale debounce doesn't fire after the
    // user has wiped the project (would target a now-cleared projectId
    // and the response would be ignored anyway).
    __syncInternals.cancelAll();
    try {
      localStorage.removeItem('wow-wall-visualizer');
    } catch {
      // ignore
    }
    set({
      scene: null,
      segmentationProgress: 0,
      layout: { ...EMPTY_LAYOUT },
      cost: { ...EMPTY_COST },
      undoStack: [],
      selectedDesignId: '',
      selectedDesignName: '',
      selectedDesignImage: '',
      selectedSizeKey: '30x30',
      selectedColor: '',
      selectedColorName: '',
      editorMode: 'default',
      calibrationPoints: { start: null, end: null, referenceCm: 200 },
      perspectiveCorners: null,
      wallBrightness: 128,
      projectId: null,
      serverVersion: 1,
    });
  },
}),
  {
    name: 'wow-wall-visualizer',
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      scene: state.scene
        ? {
            photo: state.scene.photo,
            wallMask: state.scene.wallMask
              ? {
                  _base64: uint8ArrayToBase64(state.scene.wallMask.data),
                  width: state.scene.wallMask.width,
                  height: state.scene.wallMask.height,
                }
              : null,
            objectMask: state.scene.objectMask,
            calibration: state.scene.calibration,
            segmentationStatus: state.scene.segmentationStatus,
            perspectiveAutoDetected: state.scene.perspectiveAutoDetected,
            // calibrationAutoDetected: persisted because it reflects which
            // mode produced the active calibration (user-chosen state).
            // referenceCandidates is intentionally NOT persisted — it's a
            // runtime ML output, regenerated on next photo open (D2 in plan).
            calibrationAutoDetected: state.scene.calibrationAutoDetected,
          }
        : null,
      layout: {
        panels: state.layout.panels,
        placementMode: state.layout.placementMode,
        accentZone: state.layout.accentZone,
      },
      selectedDesignId: state.selectedDesignId,
      selectedDesignName: state.selectedDesignName,
      selectedDesignImage: state.selectedDesignImage,
      selectedSizeKey: state.selectedSizeKey,
      selectedColor: state.selectedColor,
      selectedColorName: state.selectedColorName,
      perspectiveCorners: state.perspectiveCorners,
    }),
    // The persisted shape diverges from runtime `VisualizerState` only at
    // `scene.wallMask`, where `Uint8Array` is serialised as `{_base64, w, h}`.
    // Typing the callback with a narrow interface replaces the former `any`
    // (X14 closure) without dragging the full persisted shape into scope.
    onRehydrateStorage: () => (
      state: (VisualizerState & {
        scene: (Scene & {
          wallMask: (WallMask & { _base64?: string }) | null;
        }) | null;
      }) | undefined,
    ) => {
      if (!state?.scene?.wallMask) return;
      // Restore Uint8Array from base64
      const wm = state.scene.wallMask;
      if (wm._base64) {
        state.scene.wallMask = {
          data: base64ToUint8Array(wm._base64),
          width: wm.width,
          height: wm.height,
        };
      }
    },
  },
));
