import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Typography, message, Progress, Card, Modal, Spin } from "antd";
import {
	SwapOutlined,
	FullscreenOutlined,
	FullscreenExitOutlined,
} from "@ant-design/icons";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { motion, AnimatePresence } from "framer-motion";
import { useVisualizerStore } from "../model/visualizerStore";
import { useSubscriptionStore } from "../../subscription/model/subscriptionStore";
import { useCartStore } from "../../order/model/cartStore";
import { useAuthStore } from "../../auth/model/authStore";
import {
	loadProject,
	saveProject,
	StaleVersionError,
	apiGenerateAiPreview,
} from "../lib/visualizerApi";
import { ApiError } from "../../../shared/api/client";
import { placedPanelsToCartItems } from "../model/adapters";
import { processUploadedImage } from "../lib/imageProcessing";
import { applyStrokeToMask, createEmptyMask } from "../lib/maskUtils";
import { placeSinglePanel } from "../lib/layoutEngine";
import {
	segmentScene,
	isSegmentationSupported,
} from "../lib/segmentationService";
import {
	createOpencvLsdProvider,
	prefetchOpenCV,
} from "../lib/opencvLsdAdapter";
import { createOnnxReferenceDetector } from "../lib/referenceDetector";
import { defaultCvWorkerHost } from "../lib/cvWorkerHost";
import { BASE_PANEL_PRICES } from "../../../shared/config/constants";
import { useShopSettings } from "../../../shared/hooks/useShopSettings";
import { products } from "../../catalog/model/data";
import { PhotoUploader } from "./PhotoUploader";
import { WallCanvas } from "./WallCanvas";
import { KonvaCanvas } from "./KonvaCanvas";
import { MaskToolbar } from "./MaskToolbar";
import { PanelPicker } from "./PanelPicker";

import { CostSummary } from "./CostSummary";
import { CalibrationOverlay } from "./CalibrationOverlay";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { OnboardingTooltips } from "./OnboardingTooltips";
import { useSearchParams } from "react-router-dom";
import {
	computeWallBrightness,
	createPerspective,
} from "../lib/perspectiveEngine";
import type { Point, AccentZone, PerspectiveCorners } from "../model/types";

const { Title, Text } = Typography;

export default function PhotoEditorPage() {
	// TODO(X2): this subscribes the component to every field on the store,
	// so unrelated mutations (undo stack push, cost recompute, sync in-flight
	// status) re-render the whole page. Migrating the 114 `store.X` call sites
	// to individual `useVisualizerStore((s) => s.X)` selectors is tracked as
	// post-5C tech debt; the page's render cost is dominated by the Konva
	// stage today, so the re-render churn is not yet user-visible.
	const store = useVisualizerStore();
	const hasSubscription = useSubscriptionStore((s) => s.hasSubscription);
	// Phase 8D — live overlay price from /api/shop/settings (5-min cache,
	// fallback to legacy DESIGN_OVERLAY_PRICE constant). Drives both the
	// cart-item builder and (via store.recalculateCost) the cost panel.
	const { designOverlayPrice } = useShopSettings();
	const addCartItem = useCartStore((s) => s.addItem);
	const setCartOpen = useCartStore((s) => s.setOpen);
	const [uploading, setUploading] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
	const [editingMask, setEditingMask] = useState(false);
	const [hoverCell, setHoverCell] = useState<Point | null>(null);
	const [beforeAfterOpen, setBeforeAfterOpen] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
	const [generatingPreview, setGeneratingPreview] = useState(false);
	const [showAiPreview, setShowAiPreview] = useState(false);
	const canvasContainerRef = useRef<HTMLDivElement>(null);

	// Handle design selection (stores selection, AI preview is manual via button)
	const handleDesignSelect = useCallback(
		(id: string, name: string, image: string) => {
			store.setSelectedDesign(id, name, image);
			const product = products.find((p) => p.id === id);
			if (product?.colors[0]) {
				store.setSelectedColor(product.colors[0].hex, product.colors[0].name);
			}
		},
		[store, products],
	);

	const [searchParams] = useSearchParams();

	// Stable LineProvider for vanishing-point detection. Built once per mount —
	// the underlying worker host is a module singleton, so re-creating the
	// provider on every render would just churn closures with no benefit.
	const opencvLsdProvider = useMemo(
		() => createOpencvLsdProvider({ workerHost: defaultCvWorkerHost }),
		[],
	);
	// Stable ReferenceDetector for Phase-4 auto-scale. Same rationale as above.
	const referenceDetector = useMemo(
		() => createOnnxReferenceDetector({ workerHost: defaultCvWorkerHost }),
		[],
	);

	// Zustand persist auto-rehydrates from localStorage on mount — no manual load needed

	// Init design from URL param or first product.
	// Depends on store.selectedDesignId to re-run after Zustand persist rehydration
	// (rehydration is async and may overwrite the value set during first run).
	useEffect(() => {
		if (!store.selectedDesignId && products.length > 0) {
			const designIdParam = searchParams.get("designId");
			const target =
				(designIdParam && products.find((p) => p.id === designIdParam)) ||
				products[0]!;
			store.setSelectedDesign(target.id, target.name, target.image);
			if (target.colors.length > 0) {
				store.setSelectedColor(target.colors[0]!.hex, target.colors[0]!.name);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.selectedDesignId]);

	// Recalculate cost on panel changes OR when the admin-edited overlay
	// price arrives (Phase 8D — `designOverlayPrice` is part of the
	// dependency array so a 5-min-stale settings refetch propagates into
	// the cost panel without a manual recalc).
	useEffect(() => {
		store.recalculateCost(hasSubscription(), designOverlayPrice);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.layout.panels, hasSubscription, designOverlayPrice]);

	// Handle photo upload
	const handleUpload = useCallback(
		async (file: File) => {
			setUploading(true);
			store.setSegmentationProgress(0);
			store.setScene({
				photo: { url: "", width: 0, height: 0 },
				wallMask: null,
				objectMask: null,
				calibration: null,
				segmentationStatus: "uploading",
			});

			try {
				const { dataUrl, width, height } = await processUploadedImage(file);
				const photo = { url: dataUrl, width, height, file };
				// 'auto' marks this as a heuristic placeholder — perspective auto-fill
				// refuses it, and the editor surfaces a banner asking the user to
				// calibrate. Replaced by 'reference'/'manual' once they apply real
				// calibration via CalibrationOverlay.
				const calibration = {
					method: "auto" as const,
					pixelsPerCm: width / 400,
				};

				const setReadyScene = (
					wallMask: import("../model/types").WallMask,
					obstacles: import("../model/types").Obstacle[] = [],
				) => {
					store.setScene({
						photo,
						wallMask,
						objectMask: { obstacles },
						calibration,
						segmentationStatus: "ready",
					});
				};

				store.setScene({
					photo,
					wallMask: null,
					objectMask: null,
					calibration,
					segmentationStatus: "loading-model",
				});
				setUploading(false);

				// Try ML segmentation if supported
				if (isSegmentationSupported()) {
					try {
						const result = await segmentScene(dataUrl, width, height, (p) => {
							store.setSegmentationStatus(p.status);
							store.setSegmentationProgress(p.percent);
						});

						setReadyScene(result.wallMask, result.obstacles);

						const obstacleMsg =
							result.obstacles.length > 0
								? ` Обнаружено объектов: ${result.obstacles.length}.`
								: "";
						message.success(
							`Стена распознана!${obstacleMsg} Разместите панели.`,
						);

						// Start warming up OpenCV *before* dispatching runAutoPerspective
						// so the ~11 MB Emscripten runtime downloads in parallel with the
						// backend Stage 1 call. Without this, backend-fail → OpenCV-cold
						// can exceed the 25 s overall detection budget when the dev-server
						// serves the raw UMD at ~1 MB/s.
						prefetchOpenCV();

						// Phase 3: kick off vanishing-point auto-detection in the
						// background. The primary path runs OpenCV.js LSD + vanishing
						// points client-side (Phase 3.1c). If that returns nothing and
						// the project is already persisted, the store falls back to the
						// backend's depth-based endpoint (Phase 6). `backendProjectId`
						// is intentionally left off on unsaved scenes — the fallback is
						// stateful and needs photo + mask on the server already.
						void store.runAutoPerspective(opencvLsdProvider, {
							backendProjectId: store.projectId ?? undefined,
						});

						// Phase 4: kick off reference-object detection in parallel with
						// perspective. ONNX adapter is currently a stub that throws —
						// runAutoReferenceDetection swallows it. When real YOLO lands,
						// candidates will appear in the calibration overlay; nothing here
						// changes.
						void store.runAutoReferenceDetection(referenceDetector);
					} catch {
						// ML failed — fallback to full mask (user corrects with brush)
						setReadyScene(createEmptyMask(width, height, 255));
						message.info(
							"Не удалось распознать стену автоматически. Отметьте стену кистью.",
						);
					}
				} else {
					// WASM not supported — fallback to full mask
					setReadyScene(createEmptyMask(width, height, 255));
					message.info(
						"Автоматическое распознавание не поддерживается в этом браузере. Отметьте стену кистью.",
					);
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : "Ошибка загрузки";
				message.error(errorMsg);
				store.setSegmentationStatus("error", errorMsg);
				setUploading(false);
			}
		},
		[store, opencvLsdProvider, referenceDetector],
	);

	// Handle canvas click → place panel (manual mode)
	const handleCanvasClick = useCallback(
		(x: number, y: number) => {
			const {
				scene,
				layout,
				selectedSizeKey,
				selectedDesignId,
				selectedDesignName,
				selectedDesignImage,
				selectedColor,
				selectedColorName,
				perspectiveCorners,
			} = store;
			if (
				!scene?.wallMask ||
				!selectedDesignId ||
				layout.placementMode !== "manual"
			)
				return;

			const perspective = perspectiveCorners
				? createPerspective(perspectiveCorners, {
						w: scene.photo.width,
						h: scene.photo.height,
					})
				: null;

			const panel = placeSinglePanel(
				scene.wallMask,
				x,
				y,
				selectedSizeKey,
				scene.calibration,
				layout.panels,
				{
					id: selectedDesignId,
					name: selectedDesignName,
					image: selectedDesignImage,
				},
				selectedColor,
				selectedColorName,
				scene.objectMask?.obstacles,
				perspective,
			);

			if (panel) {
				store.addPanel(panel);
			} else {
				message.warning("Нельзя разместить панель здесь");
			}
		},
		[store],
	);

	// Handle mask stroke
	const handleMaskStroke = useCallback(
		(points: Point[]) => {
			const { scene, maskTool, brushSize } = store;
			if (!scene?.wallMask) return;

			store.pushUndo(scene.wallMask);
			const newMask = applyStrokeToMask(
				scene.wallMask,
				points,
				brushSize,
				maskTool,
			);
			store.updateWallMask(newMask);
		},
		[store],
	);

	// Add to cart
	const handleAddToCart = useCallback(() => {
		const items = placedPanelsToCartItems(
			store.layout.panels,
			BASE_PANEL_PRICES,
			designOverlayPrice,
			hasSubscription(),
		);

		for (const item of items) {
			addCartItem(item);
		}

		setCartOpen(true);
		message.success(`Добавлено ${items.length} позиций в корзину`);
	}, [
		store.layout.panels,
		hasSubscription,
		addCartItem,
		setCartOpen,
		designOverlayPrice,
	]);

	// Remove panel
	const handleRemovePanel = useCallback(
		(id: string) => {
			store.removePanel(id);
		},
		[store],
	);

	// Accent zone drawn
	const handleAccentZoneDraw = useCallback(
		(zone: AccentZone) => {
			store.setAccentZone(zone);
		},
		[store],
	);

	// Calibration click — set start then end point
	const handleCalibrationClick = useCallback(
		(point: Point) => {
			if (!store.calibrationPoints.start) {
				store.setCalibrationPoint("start", point);
			} else if (!store.calibrationPoints.end) {
				store.setCalibrationPoint("end", point);
			} else {
				// Reset and start over
				store.resetCalibration();
				store.setCalibrationPoint("start", point);
			}
		},
		[store],
	);

	// Init default perspective corners from photo dimensions
	const handleTogglePerspective = useCallback(() => {
		if (store.editorMode === "perspective") {
			store.setEditorMode("default");
			return;
		}
		if (!store.scene) return;
		// If no corners yet, init to slight inset of photo bounds
		if (!store.perspectiveCorners) {
			const w = store.scene.photo.width;
			const h = store.scene.photo.height;
			const inset = 0.05;
			const corners: PerspectiveCorners = [
				{ x: w * inset, y: h * inset },
				{ x: w * (1 - inset), y: h * inset },
				{ x: w * (1 - inset), y: h * (1 - inset) },
				{ x: w * inset, y: h * (1 - inset) },
			];
			// B43 closure — use AndSync so the inset bootstrap PATCHes the backend
			// when a project is loaded; if `projectId` is null (unsaved scene) the
			// store no-ops the PATCH and keeps purely-local state.
			store.setPerspectiveCornersAndSync(corners);
		}
		store.setEditorMode("perspective");
	}, [store]);

	// Compute wall brightness when scene is ready
	useEffect(() => {
		const s = store.scene;
		if (!s?.wallMask || !s.photo.url || s.segmentationStatus !== "ready")
			return;
		const img = new window.Image();
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = img.width;
			canvas.height = img.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.drawImage(img, 0, 0);
			const imageData = ctx.getImageData(0, 0, img.width, img.height);
			const brightness = computeWallBrightness(imageData, s.wallMask!);
			store.setWallBrightness(brightness);
		};
		img.src = s.photo.url;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [store.scene?.wallMask, store.scene?.photo.url]);

	// Save project — POST when no `projectId` is held yet (first save), otherwise
	// skip: the backend autosync (`*AndSync` actions in the store) keeps the
	// server in step. Falls back to "local only" when the user is unauthenticated.
	const isAuth = useAuthStore((s) => s.isAuth);
	const handleSave = useCallback(async () => {
		const payload = store.getProjectPayload();
		if (!payload) {
			message.warning("Нечего сохранять");
			return;
		}
		if (!isAuth) {
			// Anonymous: zustand persist middleware already mirrored to localStorage.
			message.success("Проект сохранён локально");
			return;
		}
		if (store.projectId) {
			// Already linked to a server row — debounced *AndSync writes keep it
			// current. Re-pinging POST would create a duplicate. Just acknowledge.
			message.success("Проект синхронизирован");
			return;
		}
		try {
			const created = await saveProject(payload);
			store.setLoadedProject(created);
			message.success("Проект сохранён на сервере");
		} catch (err) {
			if (err instanceof StaleVersionError) {
				message.warning(
					"Проект изменён в другом окне. Обновите страницу, чтобы увидеть свежие данные.",
				);
				return;
			}
			const detail =
				err instanceof ApiError ? err.detail : "Не удалось сохранить проект";
			message.error(detail);
		}
	}, [store, isAuth]);

	// B43 closure — deep-link load: `?projectId=…` hydrates the store from the
	// backend on mount. Runs once per id change. Authenticated only — anonymous
	// users have nothing to load. Errors are surfaced as a warning toast; the
	// local persist-middleware state remains intact so the user is never left
	// with a blank canvas.
	const projectIdParam = searchParams.get("projectId");
	useEffect(() => {
		if (!projectIdParam || !isAuth) return;
		let cancelled = false;
		(async () => {
			try {
				const dto = await loadProject(projectIdParam);
				if (cancelled) return;
				store.setLoadedProject(dto);
			} catch (err) {
				if (cancelled) return;
				const detail =
					err instanceof ApiError ? err.detail : "Не удалось загрузить проект";
				message.warning(detail);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [projectIdParam, isAuth]);

	// Export canvas as JPEG
	const handleExport = useCallback(() => {
		const canvas =
			document.querySelector<HTMLCanvasElement>(
				'[data-testid="konva-canvas-container"] canvas',
			) ??
			document.querySelector<HTMLCanvasElement>('[data-testid="wall-canvas"]');
		if (!canvas) return;

		canvas.toBlob(
			(blob) => {
				if (!blob) return;
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `wow-wall-visualizer-${Date.now()}.jpg`;
				a.click();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				message.success("Изображение сохранено");
			},
			"image/jpeg",
			0.92,
		);
	}, []);

	// Before/After modal
	const handleBeforeAfter = useCallback(() => {
		if (!store.scene || store.layout.panels.length === 0) {
			message.warning("Сначала разместите панели на стене");
			return;
		}
		setBeforeAfterOpen(true);
	}, [store]);

	const [afterCanvasEl, setAfterCanvasEl] = useState<HTMLCanvasElement | null>(
		null,
	);
	useEffect(() => {
		if (!beforeAfterOpen) {
			queueMicrotask(() => setAfterCanvasEl(null));
			return;
		}
		const el =
			document.querySelector<HTMLCanvasElement>(
				'[data-testid="konva-canvas-container"] canvas',
			) ??
			document.querySelector<HTMLCanvasElement>('[data-testid="wall-canvas"]');
		queueMicrotask(() => setAfterCanvasEl(el));
	}, [beforeAfterOpen]);

	// Fullscreen toggle — with fallback for sandboxed iframes
	const handleFullscreen = useCallback(() => {
		const container = canvasContainerRef.current;
		if (!container) return;

		// Check if currently in CSS-fallback fullscreen (position:fixed was set by us)
		const inCssFallback = container.style.position === "fixed";

		if (document.fullscreenElement) {
			// Exit native fullscreen
			document.exitFullscreen().then(() => setIsFullscreen(false));
		} else if (inCssFallback) {
			// Exit CSS-fallback fullscreen
			container.style.position = "";
			container.style.inset = "";
			container.style.zIndex = "";
			container.style.background = "";
			setIsFullscreen(false);
		} else {
			// Enter fullscreen
			if (!document.fullscreenEnabled) {
				// API not available — use CSS fallback
				container.style.position = "fixed";
				container.style.inset = "0";
				container.style.zIndex = "9999";
				container.style.background = "#000";
				setIsFullscreen(true);
				return;
			}
			container
				.requestFullscreen()
				.then(() => setIsFullscreen(true))
				.catch(() => {
					// requestFullscreen rejected — fall back to CSS
					container.style.position = "fixed";
					container.style.inset = "0";
					container.style.zIndex = "9999";
					container.style.background = "#000";
					setIsFullscreen(true);
				});
		}
	}, []);

	// Listen for fullscreen change (e.g. Esc key) and Escape for CSS fallback
	useEffect(() => {
		const handler = () => {
			if (!document.fullscreenElement) setIsFullscreen(false);
		};
		const escHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape" && isFullscreen && !document.fullscreenElement) {
				const container = canvasContainerRef.current;
				if (container) {
					container.style.position = "";
					container.style.inset = "";
					container.style.zIndex = "";
					container.style.background = "";
				}
				setIsFullscreen(false);
			}
		};
		document.addEventListener("fullscreenchange", handler);
		document.addEventListener("keydown", escHandler);
		return () => {
			document.removeEventListener("fullscreenchange", handler);
			document.removeEventListener("keydown", escHandler);
		};
	}, [isFullscreen]);

	// Compute cell size in pixels for hover highlight
	const cellSizePx = useMemo(() => {
		if (!store.scene?.calibration) return null;
		const pxPerCm = store.scene.calibration.pixelsPerCm;
		const sizeKey = store.selectedSizeKey; // e.g. '30x30'
		const [wStr, hStr] = sizeKey.split("x");
		const wCm = Number(wStr);
		const hCm = Number(hStr);
		if (!wCm || !hCm) return null;
		return { w: wCm * pxPerCm, h: hCm * pxPerCm };
	}, [store.scene?.calibration, store.selectedSizeKey]);

	const useKonva = searchParams.get("canvas") === "konva";

	const { scene, segmentationProgress } = store;
	// Editor stays interactive during VP auto-detection — the spinner in the
	// header tells the user something is still running, but they can keep
	// placing panels.
	const isReady =
		scene?.segmentationStatus === "ready" ||
		scene?.segmentationStatus === "detecting-perspective";
	const isDetectingPerspective =
		scene?.segmentationStatus === "detecting-perspective";
	const isProcessing =
		scene?.segmentationStatus === "uploading" ||
		scene?.segmentationStatus === "loading-model" ||
		scene?.segmentationStatus === "segmenting" ||
		scene?.segmentationStatus === "processing";

	const segmentationStatusText = (() => {
		switch (scene?.segmentationStatus) {
			case "uploading":
				return "Загружаем фото...";
			case "loading-model":
				return "Загружаем модель распознавания...";
			case "segmenting":
				return "Распознаём стену...";
			case "processing":
				return "Обрабатываем...";
			default:
				return "";
		}
	})();

	return (
		<div
			style={{ padding: "96px 24px 48px", maxWidth: 1440, margin: "0 auto" }}
		>
			<PageMeta title="Фото-редактор" />
			{/* Header */}
			<div style={{ marginBottom: 24 }}>
				<Title level={2} style={{ margin: 0 }}>
					Фото-редактор стен
				</Title>
				<Text type="secondary">
					Загрузите фото стены и разместите панели Wonder Wow Wall
				</Text>
				{isDetectingPerspective && (
					<div
						data-testid="perspective-detect-spinner"
						style={{
							marginTop: 8,
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							padding: "4px 10px",
							borderRadius: 8,
							background: "#F1F8E9",
							color: "#2E7D32",
							font: '400 13px/1.4 "SF Pro Display", sans-serif',
						}}
					>
						<Spin size="small" />
						Определяем углы стены…
					</div>
				)}
			</div>

			{/* Upload state */}
			{!scene && <PhotoUploader onUpload={handleUpload} loading={uploading} />}

			{/* Processing */}
			<AnimatePresence>
				{isProcessing && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ ease: [0.25, 0.1, 0.25, 1.0] }}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 16,
							padding: 64,
						}}
					>
						<Progress
							type="circle"
							percent={
								scene?.segmentationStatus === "uploading"
									? 50
									: segmentationProgress
							}
							strokeColor="#4CAF50"
						/>
						<Text style={{ fontSize: 15, fontWeight: 400, color: "#6B7280" }}>
							{segmentationStatusText}
						</Text>
						{scene?.segmentationStatus === "loading-model" && (
							<Text style={{ fontSize: 13, color: "#9CA3AF" }}>
								Первая загрузка ~15 МБ. При повторных визитах — мгновенно.
							</Text>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Editor */}
			{isReady && scene && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
					className="visualizer-layout"
					style={{
						display: "grid",
						gridTemplateColumns: "240px 1fr 280px",
						gap: 16,
						minHeight: 600,
					}}
				>
					{/* Left: Design picker */}
					<Card
						size="small"
						title="Дизайн"
						style={{ borderRadius: 16, overflow: "auto", maxHeight: 700 }}
					>
						<PanelPicker
							selectedDesignId={store.selectedDesignId}
							selectedSizeKey={store.selectedSizeKey}
							selectedColor={store.selectedColor}
							onDesignSelect={handleDesignSelect}
							onSizeSelect={store.setSelectedSize}
							onColorSelect={store.setSelectedColor}
						/>
					</Card>

					{/* Center: Canvas + Mask toolbar */}
					<div
						ref={canvasContainerRef}
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 8,
							background: isFullscreen ? "#000" : undefined,
						}}
					>
						{/* Auto-perspective notice — shown when Phase-3 VP detection
                produced corners. Cleared automatically the moment the user
                drags a corner (setPerspectiveCorners flips the flag). */}
						{scene.perspectiveAutoDetected && (
							<div
								data-testid="perspective-auto-banner"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 12,
									padding: "10px 14px",
									borderRadius: 12,
									background: "#E8F5E9",
									color: "#2E7D32",
									font: '400 14px/1.4 "SF Pro Display", sans-serif',
								}}
							>
								<span>
									Перспектива определена автоматически. Поправьте углы, если
									нужно.
								</span>
								<button
									type="button"
									onClick={() => store.setEditorMode("perspective")}
									style={{
										background: "transparent",
										border: "none",
										color: "#2E7D32",
										textDecoration: "underline",
										cursor: "pointer",
										font: '500 14px/1.4 "SF Pro Display", sans-serif',
										padding: 0,
									}}
								>
									Открыть редактор перспективы
								</button>
							</div>
						)}
						{/* Auto-calibration notice — Phase-4 reference detection produced
                the active scale. Different from the warning below: this means
                we *do* trust the scale (outlet/door measurement), just want
                the user to know it was inferred. */}
						{scene.calibrationAutoDetected && scene.calibration && (
							<div
								data-testid="calibration-auto-banner"
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 12,
									padding: "10px 14px",
									borderRadius: 12,
									background: "#E8F5E9",
									color: "#2E7D32",
									font: '400 14px/1.4 "SF Pro Display", sans-serif',
								}}
							>
								<span>
									Масштаб определён автоматически по эталонному объекту.
									Проверьте размеры панелей или откалибруйте вручную.
								</span>
								<button
									type="button"
									onClick={() => store.setEditorMode("calibrating")}
									style={{
										background: "transparent",
										border: "none",
										color: "#2E7D32",
										textDecoration: "underline",
										cursor: "pointer",
										font: '500 14px/1.4 "SF Pro Display", sans-serif',
										padding: 0,
									}}
								>
									Откалибровать вручную
								</button>
							</div>
						)}
						{/* Calibration warning banner — shown when scale is unknown or only
                an upload-time heuristic, so the user understands panel sizes
                are approximate and can fix it in one click. The reference-
                derived auto calibration (calibrationAutoDetected === true) is
                considered trustworthy and silenced here. */}
						{!scene.calibrationAutoDetected &&
							(!scene.calibration || scene.calibration.method === "auto") && (
								<div
									data-testid="calibration-banner"
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 12,
										padding: "10px 14px",
										borderRadius: 12,
										background: "#FFF8E1",
										color: "#6B5500",
										font: '400 14px/1.4 "SF Pro Display", sans-serif',
									}}
								>
									<span>
										Размер панелей приблизительный — откалибруйте масштаб для
										точного результата.
									</span>
									<button
										type="button"
										onClick={() => {
											store.setEditorMode("calibrating");
											setEditingMask(false);
										}}
										style={{
											background: "transparent",
											border: "none",
											color: "#6B5500",
											textDecoration: "underline",
											cursor: "pointer",
											font: '500 14px/1.4 "SF Pro Display", sans-serif',
											padding: 0,
										}}
									>
										Откалибровать
									</button>
								</div>
							)}
						{useKonva ? (
							<KonvaCanvas
								scene={scene}
								panels={store.layout.panels}
								maskVisible={store.maskVisible}
								maskOpacity={store.maskOpacity}
								maskTool={editingMask ? store.maskTool : null}
								brushSize={store.brushSize}
								zoom={zoom}
								panOffset={panOffset}
								placementMode={store.layout.placementMode}
								hoverCell={hoverCell}
								cellSizePx={cellSizePx}
								onCanvasClick={handleCanvasClick}
								onMaskStroke={handleMaskStroke}
								onZoomChange={setZoom}
								onPanChange={setPanOffset}
								onRemovePanel={handleRemovePanel}
								onPanelMove={store.movePanel}
								onHoverChange={setHoverCell}
								onAccentZoneDraw={handleAccentZoneDraw}
								editorMode={store.editorMode}
								calibrationPoints={store.calibrationPoints}
								onCalibrationClick={handleCalibrationClick}
								perspectiveCorners={store.perspectiveCorners}
								onPerspectiveCornersChange={store.setPerspectiveCornersAndSync}
								wallBrightness={store.wallBrightness}
								aiPreviewUrl={showAiPreview ? aiPreviewUrl : null}
							/>
						) : (
							<WallCanvas
								scene={scene}
								panels={store.layout.panels}
								maskVisible={store.maskVisible}
								maskOpacity={store.maskOpacity}
								maskTool={editingMask ? store.maskTool : null}
								brushSize={store.brushSize}
								zoom={zoom}
								panOffset={panOffset}
								placementMode={store.layout.placementMode}
								hoverCell={hoverCell}
								cellSizePx={cellSizePx}
								onCanvasClick={handleCanvasClick}
								onMaskStroke={handleMaskStroke}
								onZoomChange={setZoom}
								onPanChange={setPanOffset}
								onRemovePanel={handleRemovePanel}
								onHoverChange={setHoverCell}
								onAccentZoneDraw={handleAccentZoneDraw}
								editorMode={store.editorMode}
								onCalibrationClick={handleCalibrationClick}
							/>
						)}

						{/* Mask toolbar */}
						{editingMask && (
							<MaskToolbar
								activeTool={store.maskTool}
								brushSize={store.brushSize}
								maskVisible={store.maskVisible}
								maskOpacity={store.maskOpacity}
								canUndo={store.undoStack.length > 0}
								onToolChange={store.setMaskTool}
								onBrushSizeChange={store.setBrushSize}
								onToggleMask={store.toggleMaskVisible}
								onOpacityChange={store.setMaskOpacity}
								onUndo={store.undo}
							/>
						)}

						{/* Calibration overlay */}
						{store.editorMode === "calibrating" && (
							<CalibrationOverlay
								points={store.calibrationPoints}
								onReferenceChange={store.setCalibrationReference}
								onApply={() => {
									const ok = store.applyCalibration();
									if (ok) {
										message.success("Масштаб откалиброван");
									} else {
										message.warning(
											"Точки слишком близко — отметьте объект заново",
										);
									}
								}}
								onCancel={() => {
									store.resetCalibration();
									store.setEditorMode("default");
								}}
								candidates={store.scene?.referenceCandidates}
								onApplyCandidate={(candidate) => {
									const ok = store.applyReferenceCandidate(candidate);
									if (ok) {
										message.success("Масштаб определён по эталону");
									} else {
										message.warning(
											"Не удалось рассчитать масштаб по этому эталону — попробуйте вручную",
										);
									}
								}}
							/>
						)}

						{/* Toolbar buttons */}
						<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
							{/* AI Preview button — always visible when design is selected */}
							{store.selectedDesignId ? (
								generatingPreview ? (
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: 8,
											padding: "6px 16px",
											borderRadius: 8,
											background: "#E3F2FD",
											color: "#1976D2",
											fontSize: 13,
										}}
									>
										<Spin size="small" />
										Генерация...
									</div>
								) : (
									<button
										onClick={async () => {
											// Toggle AI preview if already generated
											if (aiPreviewUrl) {
												setShowAiPreview(!showAiPreview);
												return;
											}
											// Need photo to generate
											if (!store.scene?.photo.url) {
												message.warning("Сначала загрузите фото стены");
												return;
											}
											setGeneratingPreview(true);
											try {
												const result = await apiGenerateAiPreview({
													photoUrl: store.scene.photo.url,
													designName:
														store.selectedDesignName || store.selectedDesignId,
													designColor: store.selectedColor,
												});
												setAiPreviewUrl(result.previewUrl);
												setShowAiPreview(true);
												message.success("AI превью готово!");
											} catch (err) {
												console.error("AI preview failed:", err);
												message.error(
													"Не удалось сгенерировать превью. Попробуйте позже.",
												);
											} finally {
												setGeneratingPreview(false);
											}
										}}
										style={{
											padding: "6px 16px",
											borderRadius: 8,
											border: `1px solid ${showAiPreview ? "#4CAF50" : "rgba(0,0,0,0.04)"}`,
											background: showAiPreview
												? "rgba(76,175,80,0.08)"
												: "#FFF",
											color: showAiPreview ? "#4CAF50" : "#6B7280",
											cursor: store.scene?.photo.url
												? "pointer"
												: "not-allowed",
											fontSize: 13,
											fontWeight: 500,
											opacity: store.scene?.photo.url ? 1 : 0.5,
										}}
									>
										{aiPreviewUrl
											? showAiPreview
												? "Показать оригинал"
												: "AI Превью"
											: "✨ AI Превью"}
									</button>
								)
							) : null}
							<button
								data-testid="mask-toolbar-trigger"
								onClick={() => setEditingMask(!editingMask)}
								style={{
									padding: "6px 16px",
									borderRadius: 8,
									border: `1px solid ${editingMask ? "#4CAF50" : "rgba(0,0,0,0.04)"}`,
									background: editingMask ? "rgba(76,175,80,0.08)" : "#FFF",
									color: editingMask ? "#4CAF50" : "#6B7280",
									cursor: "pointer",
									fontSize: 13,
									fontWeight: 500,
								}}
							>
								{editingMask ? "Завершить коррекцию" : "Корректировать маску"}
							</button>
							<button
								onClick={() => {
									if (store.editorMode === "calibrating") {
										store.resetCalibration();
										store.setEditorMode("default");
									} else {
										store.setEditorMode("calibrating");
										setEditingMask(false);
									}
								}}
								style={{
									padding: "6px 16px",
									borderRadius: 8,
									border: `1px solid ${store.editorMode === "calibrating" ? "#4CAF50" : "rgba(0,0,0,0.04)"}`,
									background:
										store.editorMode === "calibrating"
											? "rgba(76,175,80,0.08)"
											: "#FFF",
									color:
										store.editorMode === "calibrating" ? "#4CAF50" : "#6B7280",
									cursor: "pointer",
									fontSize: 13,
									fontWeight: 500,
								}}
							>
								Калибровать
							</button>
							{useKonva && (
								<button
									onClick={() => {
										handleTogglePerspective();
										setEditingMask(false);
									}}
									style={{
										padding: "6px 16px",
										borderRadius: 8,
										border: `1px solid ${store.editorMode === "perspective" ? "#4CAF50" : "rgba(0,0,0,0.04)"}`,
										background:
											store.editorMode === "perspective"
												? "rgba(76,175,80,0.08)"
												: "#FFF",
										color:
											store.editorMode === "perspective"
												? "#4CAF50"
												: "#6B7280",
										cursor: "pointer",
										fontSize: 13,
										fontWeight: 500,
									}}
								>
									Перспектива
								</button>
							)}
							<button
								onClick={handleBeforeAfter}
								style={{
									padding: "6px 16px",
									borderRadius: 8,
									border: "1px solid rgba(0,0,0,0.04)",
									background: "#FFF",
									color: "#6B7280",
									cursor: "pointer",
									fontSize: 13,
									fontWeight: 500,
									display: "flex",
									alignItems: "center",
									gap: 6,
								}}
							>
								<SwapOutlined /> До / После
							</button>
							<button
								onClick={handleFullscreen}
								style={{
									padding: "6px 16px",
									borderRadius: 8,
									border: "1px solid rgba(0,0,0,0.04)",
									background: "#FFF",
									color: "#6B7280",
									cursor: "pointer",
									fontSize: 13,
									fontWeight: 500,
									display: "flex",
									alignItems: "center",
									gap: 6,
								}}
							>
								{isFullscreen ? (
									<FullscreenExitOutlined />
								) : (
									<FullscreenOutlined />
								)}
								{isFullscreen ? "Выйти" : "Полный экран"}
							</button>
							<button
								onClick={() => {
									store.reset();
									setZoom(1);
									setPanOffset({ x: 0, y: 0 });
								}}
								style={{
									padding: "6px 16px",
									borderRadius: 8,
									border: "1px solid rgba(0,0,0,0.04)",
									background: "#FFF",
									color: "#6B7280",
									cursor: "pointer",
									fontSize: 13,
								}}
							>
								Загрузить другое фото
							</button>
						</div>
					</div>

					{/* Right: Controls + Cost */}
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						<CostSummary
							cost={store.cost}
							hasSubscription={hasSubscription()}
							onAddToCart={handleAddToCart}
							onSave={handleSave}
							onExport={handleExport}
						/>
					</div>
				</motion.div>
			)}

			{/* Before/After comparison modal */}
			<Modal
				open={beforeAfterOpen}
				onCancel={() => setBeforeAfterOpen(false)}
				footer={null}
				width={900}
				centered
				destroyOnClose
				style={{ borderRadius: 16, overflow: "hidden" }}
				bodyStyle={{ padding: 0, overflow: "hidden" }}
			>
				{scene && (
					<div style={{ padding: 24 }}>
						<Typography.Title level={4} style={{ margin: "0 0 16px" }}>
							До / После
						</Typography.Title>
						<BeforeAfterSlider
							beforeSrc={scene.photo.url}
							afterCanvas={afterCanvasEl}
							width={850}
							height={
								scene.photo.width > 0
									? Math.round(850 * (scene.photo.height / scene.photo.width))
									: 600
							}
						/>
					</div>
				)}
			</Modal>

			{/* Onboarding tour */}
			<OnboardingTooltips isReady={isReady} />
		</div>
	);
}
