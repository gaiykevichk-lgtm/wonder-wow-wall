import { useState, useEffect, useRef } from "react";

interface GsapTimeline {
	set(target: unknown, vars: Record<string, unknown>): GsapTimeline;
	to(target: unknown, vars: Record<string, unknown>): GsapTimeline;
}

interface GsapInstance {
	registerPlugin(...plugins: unknown[]): void;
	timeline(vars?: Record<string, unknown>): GsapTimeline;
}

interface WindowWithGsap extends Window {
	gsap?: GsapInstance;
	MotionPathPlugin?: unknown;
}

export interface CircularGalleryImage {
	id: string;
	url: string;
	title: string;
}

export interface SwatchCenterPoint {
	// Координаты центра карточки/свотча внутри SVG viewBox превью (width x height)
	cx: number;
	cy: number;
	r: number;
}

interface CircularImagePreviewProps {
	images: CircularGalleryImage[];
	selectedIndex: number;
	onSelectIndex: (index: number) => void;
	className?: string;
	width?: number;
	height?: number;
	/**
	 * Координаты точки старта (центра круглого clip-path) для каждого элемента галереи.
	 * Если передана для выбранного индекса — круг-анимация начинается прямо от
	 * соответствующей карточки фактуры справа и расширяется в большое окно!
	 */
	originPoints?: Record<number, SwatchCenterPoint | undefined>;
}

export function CircularImagePreview({
	images,
	selectedIndex,
	onSelectIndex,
	className,
	width = 600,
	height = 610,
	originPoints,
}: CircularImagePreviewProps) {
	const [inPlace, setInPlace] = useState(selectedIndex);
	const [gsapReady, setGsapReady] = useState(false);

	// Load GSAP & MotionPathPlugin dynamically from CDN if not yet present
	useEffect(() => {
		const win = window as unknown as WindowWithGsap;
		if (win.gsap && win.MotionPathPlugin) {
			win.gsap.registerPlugin(win.MotionPathPlugin);
			// Defer to avoid synchronous cascading renders
			queueMicrotask(() => setGsapReady(true));
			return;
		}

		const gsapScript = document.createElement("script");
		gsapScript.src =
			"https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js";
		gsapScript.onload = () => {
			const motionPathScript = document.createElement("script");
			motionPathScript.src =
				"https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js";
			motionPathScript.onload = () => {
				if (win.gsap && win.MotionPathPlugin) {
					win.gsap.registerPlugin(win.MotionPathPlugin);
					setGsapReady(true);
				}
			};
			document.body.appendChild(motionPathScript);
		};
		document.body.appendChild(gsapScript);
	}, []);

	// Keep inPlace in sync when index changes from outside
	const onInPlace = (id: number) => {
		setInPlace(id);
	};

	if (!images || images.length === 0) {
		return null;
	}

	return (
		<div
			className={className}
			style={{
				position: "relative",
				width: "100%",
				height: "100%",
				overflow: "hidden",
				perspective: "1600px",
				perspectiveOrigin: "center center",
			}}
		>
			<div
				className="circular-gallery-rotator"
				style={{
					position: "absolute",
					inset: 0,
					transformStyle: "preserve-3d",
					transformOrigin: "center center",
					transition: "transform 1.6s cubic-bezier(0.22, 0.61, 0.36, 1)",
					willChange: "transform",
				}}
			>
				{gsapReady &&
					images.map((img, i) => (
						<div
							key={img.id || img.url}
							style={{
								position: "absolute",
								left: 0,
								top: 0,
								width: "100%",
								height: "100%",
								zIndex: inPlace === i ? i : images.length + 1,
							}}
						>
							<GalleryImageItem
								total={images.length}
								id={i}
								url={img.url}
								open={selectedIndex === i}
								inPlace={inPlace === i}
								onInPlace={onInPlace}
								width={width}
								height={height}
								originPoint={originPoints?.[i]}
							/>
						</div>
					))}

				{/* Mini circular tabs at bottom (only shown if not driven by side originPoints) */}
				{!originPoints && (
					<div
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							zIndex: 100,
							width: "100%",
							height: "100%",
							pointerEvents: "none",
						}}
					>
						<CircularTabs
							images={images}
							selectedIndex={selectedIndex}
							onSelect={onSelectIndex}
							width={width}
							height={height}
						/>
					</div>
				)}
			</div>
			<style>{`
				.circular-gallery-rotator{transform:rotateY(0deg)}
				${className ? `.${className}:hover .circular-gallery-rotator,${className}:focus-within .circular-gallery-rotator{transform:rotateY(8deg)}` : ""}
			`}</style>
		</div>
	);
}

interface GalleryImageItemProps {
	url: string;
	open: boolean;
	inPlace: boolean;
	id: number;
	onInPlace: (id: number) => void;
	total: number;
	width: number;
	height: number;
	originPoint?: SwatchCenterPoint;
}

function GalleryImageItem({
	url,
	open,
	inPlace,
	id,
	onInPlace,
	total,
	width,
	height,
	originPoint,
}: GalleryImageItemProps) {
	const firstLoadRef = useRef(true);
	const clip = useRef<SVGCircleElement>(null);

	const gap = 12;
	const circleRadius = 14;
	const defaults = { transformOrigin: "center center" };
	const duration = 0.55;
	const scale = 700;
	const bigSize = circleRadius * scale;
	const overlap = 0;

	// Если передана точка старта (карточка справа) — используем её.
	// Иначе fallback на круглый таб внизу.
	const getPosStartPoint = () => {
		if (originPoint) {
			return {
				cx: originPoint.cx,
				cy: originPoint.cy,
				r: originPoint.r,
			};
		}
		return {
			cx:
				width / 2 -
				(total * (circleRadius * 2 + gap) - gap) / 2 +
				id * (circleRadius * 2 + gap) +
				circleRadius,
			cy: height - 40,
			r: circleRadius,
		};
	};

	// Промежуточная точка раскрытия круга: движется по диагонали из точки клика к центру окна
	const getPosMid = (startPos: { cx: number; cy: number; r: number }) => ({
		cx: (startPos.cx + width / 2) / 2,
		cy: (startPos.cy + height / 2) / 2,
		r: Math.max(startPos.r * 8, 120),
	});

	const getPosEnd = () => ({
		cx: width / 2 - bigSize + overlap,
		cy: height / 2,
		r: bigSize,
	});

	const getPosStart = () => ({
		cx: width / 2 + bigSize - overlap,
		cy: height / 2,
		r: bigSize,
	});

	useEffect(() => {
		const win = window as unknown as WindowWithGsap;
		const gsap = win.gsap;
		if (!gsap || !clip.current) return;

		const isFirstLoad = firstLoadRef.current;
		firstLoadRef.current = false;

		const flipDuration = isFirstLoad ? 0 : duration;
		const upDuration = isFirstLoad ? 0 : 0.28;
		const bounceDuration = isFirstLoad ? 0.01 : 0.9;
		const delay = isFirstLoad ? 0 : flipDuration + upDuration;

		const startPos = getPosStartPoint();

		if (open) {
			// Круг-анимация: рождается в startPos (в карточке справа),
			// увеличивается и несется в центр большого превью, закрывая его целиком!
			gsap
				.timeline()
				.set(clip.current, { ...defaults, ...startPos })
				.to(clip.current, {
					...defaults,
					...getPosMid(startPos),
					duration: upDuration,
					ease: "power2.out",
				})
				.to(clip.current, {
					...defaults,
					...getPosEnd(),
					duration: flipDuration,
					ease: "power4.inOut",
					onComplete: () => onInPlace(id),
				});
		} else {
			// Уходящий слой: если для него задана originPoint (карточка справа) —
			// круг сжимается и улетает обратно вправо в эту карточку!
			// Если originPoint нет — круг уходит в исходную точку.
			const exitTarget = originPoint
				? { cx: originPoint.cx, cy: originPoint.cy, r: 0 }
				: { cx: width + 100, cy: height / 2, r: 0 };
			const exitMid = originPoint
				? {
						cx: (originPoint.cx + width / 2) / 2,
						cy: (originPoint.cy + height / 2) / 2,
						r: Math.max(originPoint.r * 6, 90),
					}
				: {
						cx: (width + width / 2) / 2,
						cy: height / 2,
						r: 90,
					};
			gsap
				.timeline({ overwrite: true })
				.set(clip.current, { ...defaults, ...getPosStart() })
				.to(clip.current, {
					...defaults,
					...exitMid,
					delay: delay,
					duration: flipDuration * 0.7,
					ease: "power3.out",
				})
				.to(clip.current, {
					...defaults,
					...exitTarget,
					duration: bounceDuration * 0.5,
					ease: "power2.in",
				});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, originPoint]);

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid slice"
			style={{ width: "100%", height: "100%", display: "block" }}
		>
			<defs>
				<clipPath id={`panel_clip_${id}_circle`}>
					<circle cx="0" cy="0" r={circleRadius} ref={clip} />
				</clipPath>
				<clipPath id={`panel_clip_${id}_square`}>
					<rect width={width} height={height} />
				</clipPath>
			</defs>
			<g clipPath={`url(#panel_clip_${id}_${inPlace ? "square" : "circle"})`}>
				<image
					width={width}
					height={height}
					href={url}
					preserveAspectRatio="xMidYMid meet"
					style={{ pointerEvents: "none" }}
				/>
			</g>
		</svg>
	);
}

interface CircularTabsProps {
	images: CircularGalleryImage[];
	selectedIndex: number;
	onSelect: (index: number) => void;
	width: number;
	height: number;
}

function CircularTabs({
	images,
	selectedIndex,
	onSelect,
	width,
	height,
}: CircularTabsProps) {
	const gap = 12;
	const circleRadius = 14;

	const getPosX = (i: number) =>
		width / 2 -
		(images.length * (circleRadius * 2 + gap) - gap) / 2 +
		i * (circleRadius * 2 + gap) +
		circleRadius;
	const getPosY = () => height - 40;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="xMidYMid slice"
			style={{ width: "100%", height: "100%", display: "block" }}
		>
			{images.map((image, i) => {
				const isSelected = selectedIndex === i;
				const cx = getPosX(i);
				const cy = getPosY();
				return (
					<g key={image.id || image.url} style={{ pointerEvents: "auto" }}>
						<defs>
							<clipPath id={`tab_swatch_${i}_clip`}>
								<circle cx={cx} cy={cy} r={circleRadius} />
							</clipPath>
						</defs>
						<image
							x={cx - circleRadius}
							y={cy - circleRadius}
							width={circleRadius * 2}
							height={circleRadius * 2}
							href={image.url}
							clipPath={`url(#tab_swatch_${i}_clip)`}
							preserveAspectRatio="xMidYMid slice"
							style={{ pointerEvents: "none" }}
						/>
						<circle
							onClick={() => onSelect(i)}
							style={{
								cursor: "pointer",
								fill: "transparent",
								stroke: isSelected ? "#2E7D32" : "rgba(0,0,0,0.25)",
								strokeWidth: isSelected ? 3 : 1.5,
								transition: "all 0.2s ease",
							}}
							cx={cx}
							cy={cy}
							r={circleRadius + 2}
						/>
					</g>
				);
			})}
		</svg>
	);
}
