import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "antd";

const ease: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

interface Props {
	imagePath: string | null;
	fallbackImage: string;
	altText: string;
	isLoading?: boolean;
	/**
	 * Дополнительные фото дизайна из галереи админки.
	 * Показываются как аккордеон поверх основного изображения.
	 */
	galleryImages?: string[];
}

function getSideImage(src: string): string | null {
	if (src.includes("-front.")) {
		return src.replace("-front.", "-side.");
	}
	return null;
}

export default function ProductPreview({
	imagePath,
	fallbackImage,
	altText,
	isLoading,
	galleryImages,
}: Props) {
	const mainSrc = imagePath || fallbackImage;
	const [activeIdx, setActiveIdx] = useState(0);
	const [lightboxOpen, setLightboxOpen] = useState(false);

	// Синхронизация: смена изображения сбрасывает активный индекс.
	const [syncedSrc, setSyncedSrc] = useState(mainSrc);
	if (mainSrc !== syncedSrc) {
		setSyncedSrc(mainSrc);
		setActiveIdx(0);
	}

	useEffect(() => {
		if (!lightboxOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setLightboxOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [lightboxOpen]);

	// PC-102 — второй ракурс
	const sideSrc = useMemo(() => getSideImage(mainSrc), [mainSrc]);
	const [verifiedSideSrc, setVerifiedSideSrc] = useState<string | null>(null);

	useEffect(() => {
		if (!sideSrc) return;
		let cancelled = false;
		const probe = new Image();
		probe.onload = () => {
			if (!cancelled) setVerifiedSideSrc(sideSrc);
		};
		probe.src = sideSrc;
		return () => {
			cancelled = true;
		};
	}, [sideSrc]);

	const sideAvailable = !!sideSrc && verifiedSideSrc === sideSrc;

	const gallery = useMemo(() => {
		const imgs = [mainSrc];
		if (sideSrc && sideAvailable) imgs.push(sideSrc);
		return imgs;
	}, [mainSrc, sideSrc, sideAvailable]);

	const currentSrc = gallery[activeIdx] || gallery[0];

	// PC-CARD-GALLERY — аккордеон из галереи дизайна.
	// Показывается ВМЕСТО основного изображения когда есть фото в галерее.
	// Первая панель аккордеона — серая базовая форма (fallbackImage).
	const accordionImages = useMemo(() => {
		if (!galleryImages || galleryImages.length === 0) return null;
		return [fallbackImage, ...galleryImages];
	}, [fallbackImage, galleryImages]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			{/* PC-CARD-GALLERY — аккордеон или обычное изображение */}
			<div
				onClick={() => !isLoading && setLightboxOpen(true)}
				style={{
					position: "relative",
					aspectRatio: "4/3",
					borderRadius: 28,
					overflow: "hidden",
					cursor: isLoading ? "default" : "zoom-in",
					background: "#1a1a1a",
				}}
			>
				{isLoading ? (
					<Skeleton.Image
						active
						style={{
							width: "100%",
							height: "100%",
							position: "absolute",
							inset: 0,
						}}
					/>
				) : accordionImages ? (
					<GalleryAccordion
						images={accordionImages}
						altText={altText}
						onSelect={(src) => {
							setSyncedSrc(src);
							setActiveIdx(0);
						}}
					/>
				) : (
					<AnimatePresence mode="wait">
						<motion.img
							key={currentSrc}
							src={currentSrc}
							alt={altText}
							decoding="async"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3, ease }}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "contain",
								display: "block",
								position: "absolute",
								inset: 0,
							}}
						/>
					</AnimatePresence>
				)}

				{/* PC-203 — подсказка когда нет фото для комбинации */}
				{!imagePath && !isLoading && !accordionImages && (
					<div
						style={{
							position: "absolute",
							bottom: 16,
							left: 16,
							background: "rgba(0,0,0,0.5)",
							backdropFilter: "blur(8px)",
							borderRadius: 8,
							padding: "6px 12px",
							fontSize: 12,
							color: "#fff",
							fontWeight: 500,
						}}
					>
						Фото для этой комбинации скоро появится
					</div>
				)}
			</div>

			{/* PC-203 — Lightbox */}
			<AnimatePresence>
				{lightboxOpen && (
					<motion.div
						role="dialog"
						aria-label={altText}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25, ease }}
						onClick={() => setLightboxOpen(false)}
						style={{
							position: "fixed",
							inset: 0,
							background: "rgba(0,0,0,0.85)",
							zIndex: 1100,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							padding: 24,
							cursor: "zoom-out",
						}}
					>
						<motion.img
							src={currentSrc}
							alt={altText}
							initial={{ scale: 0.96 }}
							animate={{ scale: 1 }}
							exit={{ scale: 0.96 }}
							transition={{ duration: 0.25, ease }}
							style={{
								maxWidth: "100%",
								maxHeight: "100%",
								objectFit: "contain",
								borderRadius: 16,
								display: "block",
							}}
						/>
						<button
							onClick={() => setLightboxOpen(false)}
							aria-label="Закрыть"
							style={{
								position: "fixed",
								top: 24,
								right: 24,
								width: 40,
								height: 40,
								borderRadius: "50%",
								border: "none",
								background: "rgba(255,255,255,0.9)",
								color: "#2D2D2D",
								fontSize: 18,
								cursor: "pointer",
							}}
						>
							✕
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Thumbnails — только когда нет аккордеона */}
			{gallery.length > 1 && !isLoading && !accordionImages && (
				<div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
					{gallery.map((src, idx) => (
						<button
							key={src}
							onClick={() => setActiveIdx(idx)}
							aria-label={idx === 0 ? "Вид спереди" : "Вид под углом"}
							style={{
								width: 64,
								height: 48,
								borderRadius: 12,
								overflow: "hidden",
								border:
									idx === activeIdx ? "2px solid #4CAF50" : "2px solid #E5E7EB",
								cursor: "pointer",
								padding: 0,
								background: "#F5F5F5",
								transition: "border-color 0.2s",
							}}
						>
							<img
								src={src}
								alt={idx === 0 ? "Вид спереди" : "Вид под углом"}
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
									display: "block",
								}}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * PC-CARD-GALLERY — горизонтальный аккордеон-слайдер.
 *
 * Структура:
 *   [Базовая форма (серая)] [Фото 1] [Фото 2] ...
 *
 * При наведении плавно расширяется выбранная панель (flex 7 vs flex 1),
 * неактивные панели тускнеют (brightness).
 * Первая панель — серая базовая форма; при клике не меняет main image.
 */
function GalleryAccordion({
	images,
	altText,
	onSelect,
}: {
	images: string[];
	altText: string;
	onSelect: (src: string) => void;
}) {
	const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

	return (
		<div
			role="tablist"
			aria-label={`${altText} — галерея`}
			className="interactive-accordion"
			style={{
				display: "flex",
				width: "100%",
				height: "100%",
				background: "#1a1a1a",
				borderRadius: 28,
				overflow: "hidden",
			}}
		>
			{images.map((src, idx) => {
				const isExpanded =
					expandedIdx === idx || (expandedIdx === null && idx === 0);
				const isBaseForm = idx === 0;

				return (
					<div
						key={src}
						role="tab"
						aria-selected={isExpanded}
						aria-label={isBaseForm ? "Базовая форма" : `Фото ${idx}`}
						onClick={() => {
							if (!isBaseForm) {
								onSelect(src);
							}
							setExpandedIdx(idx);
						}}
						onMouseEnter={() => setExpandedIdx(idx)}
						onMouseLeave={() => setExpandedIdx(null)}
						onFocus={() => setExpandedIdx(idx)}
						onBlur={() => setExpandedIdx(null)}
						style={{
							flex: isExpanded ? "7 1 0%" : "1 1 0%",
							minWidth: 60,
							height: "100%",
							backgroundImage: isBaseForm ? undefined : `url(${src})`,
							backgroundColor: isBaseForm ? "#B0B0B0" : undefined,
							backgroundSize: "cover",
							backgroundPosition: "center",
							borderRight:
								idx < images.length - 1 ? "2px solid #2a2a2a" : "none",
							cursor: isBaseForm ? "default" : "pointer",
							transition:
								"flex 0.7s cubic-bezier(0.25,0.1,0.25,1), background-size 0.7s",
							overflow: "hidden",
							display: "flex",
							flexDirection: "column",
							justifyContent: "flex-end",
							position: "relative",
						}}
					>
						{/* Gradient overlay */}
						<div
							style={{
								position: "absolute",
								inset: 0,
								background: isExpanded
									? "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)"
									: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 40%, transparent 100%)",
								transition: "background 0.7s",
							}}
						/>

						{/* Badge + label */}
						<div
							style={{
								position: "absolute",
								bottom: 12,
								left: isExpanded ? 16 : 8,
								right: 8,
								display: "flex",
								alignItems: "center",
								gap: 8,
								zIndex: 2,
							}}
						>
							<div
								style={{
									width: 32,
									height: 32,
									borderRadius: "50%",
									background: "rgba(255,255,255,0.15)",
									backdropFilter: "blur(8px)",
									border: "1.5px solid rgba(255,255,255,0.3)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 13,
									fontWeight: 700,
									color: "#fff",
									flexShrink: 0,
								}}
							>
								{idx + 1}
							</div>
							{isExpanded && (
								<span
									style={{
										color: "#fff",
										fontSize: 13,
										fontWeight: 500,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{isBaseForm ? "Базовая форма" : `Вариант ${idx}`}
								</span>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
