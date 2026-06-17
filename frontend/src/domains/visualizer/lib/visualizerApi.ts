/**
 * Phase 5C — REST client for the visualizer bounded context.
 *
 * Why a hand-rolled module rather than `useMutation` hooks (the pattern used
 * for `auth`/`catalog`):
 *  - The autosave path is *imperative*, fired from inside zustand actions
 *    (`setPerspectiveCorners`, `setCalibration`) on a debounce timer. Hooks
 *    only fit React component lifecycles.
 *  - Each PATCH is in-flight cancellable via `AbortController` (D6 in plan):
 *    when the user keeps dragging a corner, the previous PATCH must be
 *    aborted to avoid out-of-order writes and a 409 storm.
 *  - The frontend distinguishes two error variants by `code`:
 *      `degenerate_corners` → silent retry-skip (intermediate drag state)
 *      `stale_version`      → trigger a "data changed elsewhere" toast and
 *                              force a re-load
 *    The shared `ApiError.body.code` carries this discriminant.
 *
 * The wire format is *snake_case* (matches backend DTOs); this module is the
 * single conversion point — callers in the store pass camelCase domain types
 * and get camelCase responses back.
 */

import { api, ApiError } from "../../../shared/api/client";
import type { PerspectiveCorners, ScaleCalibration } from "../model/types";

// ─── Wire types (snake_case, matching backend) ────────────────────────

interface WireCalibration {
	method: "reference" | "manual" | "auto";
	pixels_per_cm: number;
	wall_width_cm?: number | null;
	wall_height_cm?: number | null;
}

interface WirePoint {
	x: number;
	y: number;
}

interface WireProjectResponse {
	id: string;
	name: string;
	photo_url: string;
	photo_width: number;
	photo_height: number;
	wall_mask_base64: string;
	calibration_pixels_per_cm: number;
	panels: unknown[];
	perspective_corners: WirePoint[] | null;
	placement_mode: string;
	created_at: string;
	updated_at: string;
	calibration: WireCalibration | null;
	perspective_auto_detected: boolean;
	calibration_auto_detected: boolean;
	version: number;
}

// ─── Camel-case façade returned to callers ────────────────────────────

export interface VisualizationProjectDTO {
	id: string;
	name: string;
	photoUrl: string;
	photoWidth: number;
	photoHeight: number;
	wallMaskBase64: string;
	calibrationPixelsPerCm: number;
	perspectiveCorners: PerspectiveCorners | null;
	placementMode: string;
	createdAt: string;
	updatedAt: string;
	calibration: ScaleCalibration | null;
	perspectiveAutoDetected: boolean;
	calibrationAutoDetected: boolean;
	version: number;
	/** Panel payload — opaque on this seam; the store re-hydrates it. */
	panels: unknown[];
}

// ─── Discriminated error variants ─────────────────────────────────────

/**
 * Distinct from `ApiError` so callers can `catch (e) { if (e instanceof
 * StaleVersionError) … }`. Both wrap the same `ApiError` for stack-trace
 * fidelity.
 */
export class StaleVersionError extends Error {
	readonly serverVersion: number | undefined;
	constructor(detail: string, serverVersion?: number) {
		super(detail);
		this.name = "StaleVersionError";
		this.serverVersion = serverVersion;
	}
}

export class DegenerateCornersError extends Error {
	constructor(detail: string) {
		super(detail);
		this.name = "DegenerateCornersError";
	}
}

/**
 * Map a raw API error (ApiError or anything else) to a domain-level
 * visualizer error, or pass through unchanged. Callers `throw` the result.
 *
 * X15 closure — previous revision was `rethrowVisualizerError(err): never`
 * with a tail `throw err`. The `never` return required TS control-flow to
 * propagate termination at every call site, and the tail `throw` duplicated
 * the caller's intent. Returning the mapped value keeps the call site
 * explicit (`throw mapVisualizerError(err)`) and preserves the original
 * thrown-value identity for non-ApiError cases.
 */
function mapVisualizerError(err: unknown): unknown {
	if (err instanceof ApiError) {
		const code = err.body?.code as string | undefined;
		if (err.status === 409 && code === "stale_version") {
			const serverVersion =
				(err.body?.server_version as number | undefined) ?? undefined;
			return new StaleVersionError(err.detail, serverVersion);
		}
		if (err.status === 422 && code === "degenerate_corners") {
			return new DegenerateCornersError(err.detail);
		}
	}
	return err;
}

// ─── Wire ↔ DTO mappers ───────────────────────────────────────────────

function calibrationFromWire(
	w: WireCalibration | null,
): ScaleCalibration | null {
	if (!w) return null;
	return {
		method: w.method,
		pixelsPerCm: w.pixels_per_cm,
		wallWidthCm: w.wall_width_cm ?? undefined,
		wallHeightCm: w.wall_height_cm ?? undefined,
	};
}

function calibrationToWire(c: ScaleCalibration): WireCalibration {
	return {
		method: c.method,
		pixels_per_cm: c.pixelsPerCm,
		wall_width_cm: c.wallWidthCm ?? null,
		wall_height_cm: c.wallHeightCm ?? null,
	};
}

function cornersFromWire(w: WirePoint[] | null): PerspectiveCorners | null {
	if (!w || w.length !== 4) return null;
	return [
		{ x: w[0]!.x, y: w[0]!.y },
		{ x: w[1]!.x, y: w[1]!.y },
		{ x: w[2]!.x, y: w[2]!.y },
		{ x: w[3]!.x, y: w[3]!.y },
	];
}

function projectFromWire(w: WireProjectResponse): VisualizationProjectDTO {
	return {
		id: w.id,
		name: w.name,
		photoUrl: w.photo_url,
		photoWidth: w.photo_width,
		photoHeight: w.photo_height,
		wallMaskBase64: w.wall_mask_base64,
		calibrationPixelsPerCm: w.calibration_pixels_per_cm,
		perspectiveCorners: cornersFromWire(w.perspective_corners),
		placementMode: w.placement_mode,
		createdAt: w.created_at,
		updatedAt: w.updated_at,
		calibration: calibrationFromWire(w.calibration),
		perspectiveAutoDetected: w.perspective_auto_detected,
		calibrationAutoDetected: w.calibration_auto_detected,
		version: w.version,
		panels: w.panels,
	};
}

// ─── Save / Load (full-scene) ────────────────────────────────────────

/**
 * Body shape for POST/PUT — wire-format snake_case. The store builds this
 * directly via `getProjectPayload()` to avoid a double conversion (camel →
 * snake here is a no-op when the source is already snake).
 */
export type SaveProjectBody = Record<string, unknown>;

export async function saveProject(
	body: SaveProjectBody,
): Promise<VisualizationProjectDTO> {
	const wire = await api.post<WireProjectResponse>(
		"/visualizer/projects",
		body,
	);
	return projectFromWire(wire);
}

export async function loadProject(
	projectId: string,
): Promise<VisualizationProjectDTO> {
	const wire = await api.get<WireProjectResponse>(
		`/visualizer/projects/${projectId}`,
	);
	return projectFromWire(wire);
}

// ─── Partial PATCH endpoints ─────────────────────────────────────────

export interface UpdatePerspectiveOptions {
	signal?: AbortSignal;
}

/**
 * PATCH the four perspective corners. `corners=null` clears them on the server.
 *
 * Throws:
 *  - `DegenerateCornersError` on 422 — caller should *swallow* this. It means
 *    a debounced PATCH carried an intermediate drag state that flattened the
 *    quad. The next debounce will resend the user's final position.
 *  - `StaleVersionError` on 409 — caller should refetch and merge.
 *  - `ApiError` (or rejection) on transport errors / 4xx/5xx without a code.
 */
export async function updatePerspective(
	projectId: string,
	corners: PerspectiveCorners | null,
	version: number,
	options: UpdatePerspectiveOptions = {},
): Promise<VisualizationProjectDTO> {
	const body = {
		corners: corners ? corners.map((c) => ({ x: c.x, y: c.y })) : null,
		version,
	};
	try {
		const wire = await api.patch<WireProjectResponse>(
			`/visualizer/projects/${projectId}/perspective`,
			body,
			{ signal: options.signal },
		);
		return projectFromWire(wire);
	} catch (err) {
		throw mapVisualizerError(err);
	}
}

export interface UpdateCalibrationOptions {
	signal?: AbortSignal;
}

export async function updateCalibration(
	projectId: string,
	calibration: ScaleCalibration,
	version: number,
	options: UpdateCalibrationOptions = {},
): Promise<VisualizationProjectDTO> {
	const body = {
		calibration: calibrationToWire(calibration),
		version,
	};
	try {
		const wire = await api.patch<WireProjectResponse>(
			`/visualizer/projects/${projectId}/calibration`,
			body,
			{ signal: options.signal },
		);
		return projectFromWire(wire);
	} catch (err) {
		throw mapVisualizerError(err);
	}
}

// ─── Phase 6 — depth-based auto-perspective fallback ────────────────

/**
 * Returned by `apiAutoDetectPerspective` on success. `corners` are in
 * photo-pixel coords (server-side rescaled from the depth-map grid), so
 * they can be handed straight to `updatePerspective`/`setPerspectiveCorners`
 * with no further transformation.
 */
export interface AutoPerspectiveResult {
	corners: PerspectiveCorners;
	confidence: number;
	/**
	 * Detected wall bounding-box width/height in *photo pixels*. The store uses
	 * this to seed `ScaleCalibration.pixelsPerCm` when the user hasn't
	 * calibrated yet, so auto-fill panels land at a plausible scale instead of
	 * at whatever default `pixels_per_cm` the empty project was created with.
	 *
	 * Defaults to `{ width: 0, height: 0 }` so the optional shape can be safely
	 * consumed without a null-check — callers ignore a zero dimension.
	 */
	bboxPixels: { width: number; height: number };
}

/**
 * Thrown when the backend reports a well-formed request but the depth-based
 * fitter couldn't produce a plane. Caller should fall back to manual mode
 * (same UX as when OpenCV LSD returns low confidence).
 *
 * Kept distinct from `DegenerateCornersError` because that class carries a
 * different domain meaning (the user's *own* 4-corner input was flat) and
 * UI should message differently — "We couldn't detect your wall" vs "Those
 * four points form a flat quadrilateral."
 */
export class AutoPerspectiveFailedError extends Error {
	readonly kind: "plane_fit_failed" | "depth_unavailable" | "unknown";
	constructor(detail: string, kind: AutoPerspectiveFailedError["kind"]) {
		super(detail);
		this.name = "AutoPerspectiveFailedError";
		this.kind = kind;
	}
}

export interface AutoDetectPerspectiveOptions {
	signal?: AbortSignal;
}

/**
 * Ask the backend to run depth → RANSAC plane fit on the stored photo/mask
 * and return perspective corners. Thin wrapper around the HTTP contract —
 * the server owns the algorithm choice (stub, MiDaS, future providers).
 *
 * The call requires the project to already exist server-side *with* a saved
 * photo + wall mask; the store is responsible for persisting those (via the
 * normal save path) before invoking this.
 *
 * Error mapping:
 *   - 422 + `plane_fit_failed` → `AutoPerspectiveFailedError('…', 'plane_fit_failed')`
 *   - 503 + `depth_unavailable` → `AutoPerspectiveFailedError('…', 'depth_unavailable')`
 *   - anything else → passes the original `ApiError` through so higher-level
 *     code can retry transport errors independently.
 */
interface WireAutoPerspectiveResponse {
	corners: WirePoint[];
	confidence: number;
	bbox_pixels?: { width: number; height: number };
}

function autoPerspectiveFromWire(
	wire: WireAutoPerspectiveResponse,
): AutoPerspectiveResult {
	const corners = cornersFromWire(wire.corners);
	if (!corners) {
		throw new AutoPerspectiveFailedError(
			"Server returned non-4 corner set",
			"unknown",
		);
	}
	return {
		corners,
		confidence: wire.confidence,
		bboxPixels: {
			width: wire.bbox_pixels?.width ?? 0,
			height: wire.bbox_pixels?.height ?? 0,
		},
	};
}

function mapAutoPerspectiveError(err: unknown): unknown {
	if (err instanceof ApiError) {
		const code = err.body?.code as string | undefined;
		if (err.status === 422 && code === "plane_fit_failed") {
			return new AutoPerspectiveFailedError(err.detail, "plane_fit_failed");
		}
		if (err.status === 503 && code === "depth_unavailable") {
			return new AutoPerspectiveFailedError(err.detail, "depth_unavailable");
		}
	}
	return err;
}

export async function apiAutoDetectPerspective(
	projectId: string,
	options: AutoDetectPerspectiveOptions = {},
): Promise<AutoPerspectiveResult> {
	try {
		const wire = await api.post<WireAutoPerspectiveResponse>(
			`/visualizer/projects/${projectId}/auto-perspective`,
			{},
			{ signal: options.signal },
		);
		return autoPerspectiveFromWire(wire);
	} catch (err) {
		throw mapAutoPerspectiveError(err);
	}
}

/**
 * Inline variant — runs the same depth+RANSAC pipeline on a photo/mask
 * supplied directly in the request body. Use this *immediately after upload*,
 * before the project has been persisted. The backend accepts the same shape
 * that would have been saved, minus the project envelope.
 *
 * Why: keeping the project-bound variant required the store to do a round-trip
 * save before auto-detection could run, which (a) adds a second of latency
 * and (b) writes a "draft" project the user may abandon. The inline variant
 * is the default fast path; project-bound is retained for scripts/debug.
 */
export interface InlineAutoPerspectiveInput {
	photoUrl: string;
	photoWidth: number;
	photoHeight: number;
	wallMaskBase64: string;
}

export async function apiAutoDetectPerspectiveInline(
	input: InlineAutoPerspectiveInput,
	options: AutoDetectPerspectiveOptions = {},
): Promise<AutoPerspectiveResult> {
	try {
		const wire = await api.post<WireAutoPerspectiveResponse>(
			"/visualizer/projects/auto-perspective",
			{
				photo_url: input.photoUrl,
				photo_width: input.photoWidth,
				photo_height: input.photoHeight,
				wall_mask_base64: input.wallMaskBase64,
			},
			{ signal: options.signal },
		);
		return autoPerspectiveFromWire(wire);
	} catch (err) {
		throw mapAutoPerspectiveError(err);
	}
}

// ─── AI Preview Generation ───────────────────────────────────────────

export interface AiPreviewRequest {
	photoUrl: string;
	designName: string;
	designColor: string;
	prompt?: string;
}

export interface AiPreviewResponse {
	previewUrl: string;
	revisedPrompt: string | null;
}

/**
 * Generate AI-powered preview of wall with selected panel design.
 * Uses Nano Banana Flash via backend proxy.
 */
export async function apiGenerateAiPreview(
	request: AiPreviewRequest,
): Promise<AiPreviewResponse> {
	const wire = await api.post<{
		preview_url: string;
		revised_prompt: string | null;
	}>("/visualizer/ai-preview", {
		photo_url: request.photoUrl,
		design_name: request.designName,
		design_color: request.designColor,
		prompt: request.prompt,
	});
	return {
		previewUrl: wire.preview_url,
		revisedPrompt: wire.revised_prompt,
	};
}
