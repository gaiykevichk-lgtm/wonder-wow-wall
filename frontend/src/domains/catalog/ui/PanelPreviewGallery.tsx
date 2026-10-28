import { useId, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import "./PanelPreviewGallery.css";

export interface PanelPreviewSlide {
	id: string;
	url: string;
	title: string;
}

function GalleryChevron({
	direction,
	gradientId,
}: {
	direction: "left" | "right";
	gradientId: string;
}) {
	return (
		<svg
			className="panel-slide-arrow-icon"
			viewBox="0 0 32 32"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<linearGradient id={gradientId} x1="4" y1="4" x2="28" y2="28">
					<stop offset="0" stopColor="#7ed957" />
					<stop offset="0.52" stopColor="#4caf50" />
					<stop offset="1" stopColor="#238b45" />
				</linearGradient>
			</defs>
			<path
				d={direction === "left" ? "M20.5 6.5 11 16l9.5 9.5" : "M11.5 6.5 21 16l-9.5 9.5"}
				fill="none"
				stroke={`url(#${gradientId})`}
				strokeWidth="3.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** Squeeze-полосы по референсу: подсказка не переключает выбранный кадр. */
export function PanelPreviewGallery({
	slides,
	initialId,
	hoverId,
}: {
	slides: PanelPreviewSlide[];
	initialId?: string;
	hoverId?: string;
}) {
	const gradientSeed = useId().replace(/:/g, "");
	const [activeId, setActiveId] = useState(initialId ?? slides[0]?.id);
	const [selection, setSelection] = useState(initialId);
	if (selection !== initialId) {
		setSelection(initialId);
		setActiveId(initialId ?? slides[0]?.id);
	}
	const [interacted, setInteracted] = useState(false);
	const touchX = useRef<number | null>(null);
	const reducedMotion = useReducedMotion();
	const index = Math.max(0, slides.findIndex((slide) => slide.id === activeId));
	const active = slides[index];
	const hoverSlide = hoverId ? slides.find((slide) => slide.id === hoverId) : undefined;
	const displayed = hoverSlide ?? active;
	if (!active || !displayed) return null;
	const select = (id: string) => { setInteracted(true); setActiveId(id); };
	const move = (delta: number) => select(slides[(index + delta + slides.length) % slides.length].id);
	const neighbors = slides.filter(slide => slide.id !== active.id).slice(0, 3);
	const peek = slides.length > 1 && !reducedMotion && !interacted;
	return (
		<section className="panel-slide-gallery" aria-label="Фотографии панели" aria-roledescription="карусель"
			tabIndex={0} onKeyDown={(event) => {
				if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
					event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
				}
			}}
			onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
			onTouchEnd={(event) => {
				if (touchX.current !== null) {
					const delta = event.changedTouches[0].clientX - touchX.current;
					if (Math.abs(delta) > 45) move(delta < 0 ? 1 : -1);
				}
				touchX.current = null;
			}}>
			<div key={`${initialId}:${slides.map(slide => slide.id).join(":")}`} className={`panel-squeeze-strip${peek ? " is-peeking" : ""}`}>
				<div className="panel-squeeze-main" data-active-slide={active.id} data-displayed-slide={displayed.id}>
					<img className="panel-slide-image" src={displayed.url} alt={displayed.title} draggable={false} />
				</div>
				{neighbors.length > 0 && <div className="panel-squeeze-tail">
					{neighbors.map(slide => <button type="button" key={slide.id} onClick={() => select(slide.id)} aria-label={`Показать: ${slide.title}`}>
						<img src={slide.url} alt="" draggable={false} />
					</button>)}
				</div>}
			</div>
			{slides.length > 1 && <>
				<button type="button" className="panel-slide-arrow panel-slide-prev" aria-label="Предыдущий слайд" onClick={() => move(-1)}>
					<GalleryChevron direction="left" gradientId={`${gradientSeed}-previous`} />
				</button>
				<button type="button" className="panel-slide-arrow panel-slide-next" aria-label="Следующий слайд" onClick={() => move(1)}>
					<GalleryChevron direction="right" gradientId={`${gradientSeed}-next`} />
				</button>
				<div className="panel-slide-controls">
					<span role="status">{index + 1} / {slides.length}</span>
					<div className="panel-slide-dots">{slides.map((slide, i) => (
						<button key={slide.id} type="button" aria-label={`Слайд ${i + 1}: ${slide.title}`} aria-current={index === i ? "true" : undefined}
							onClick={() => select(slide.id)}><span /></button>
					))}</div>
				</div>
			</>}
		</section>
	);
}
