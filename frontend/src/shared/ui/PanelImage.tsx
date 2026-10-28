import { useEffect, useState, memo, useRef } from "react";

interface Props {
	src: string;
	alt: string;
	threshold?: number;
}

/**
 * PanelImage — загружает PNG/JPG, удаляет белый/светлый фон на canvas
 * и рендерит результат в виде data-URI (прозрачный PNG).
 *
 * Используется для превью панели с 3D-поворотом: без белой «коробки»
 * вокруг панели визуально крутится только сама модульная плитка,
 * а не прямоугольник с белым полем.
 */
function PanelImageInner({ src, alt, threshold = 235 }: Props) {
	const [processedSrc, setProcessedSrc] = useState<string>("");
	const [error, setError] = useState<string>("");
	// Запоминаем последний обработанный src, чтобы избежать лишних setState.
	const lastSrcRef = useRef<string>("");

	useEffect(() => {
		if (!src) return;
		if (lastSrcRef.current === src && processedSrc) return;
		lastSrcRef.current = src;
		setError("");

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => {
			try {
				const canvas = document.createElement("canvas");
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					setError("canvas-2d-unavailable");
					return;
				}
				ctx.drawImage(img, 0, 0);
				const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
				const data = imageData.data;
				// Удаляем белый фон: пиксели ярче threshold становятся прозрачными.
				for (let i = 0; i < data.length; i += 4) {
					const r = data[i];
					const g = data[i + 1];
					const b = data[i + 2];
					const max = Math.max(r, g, b);
					if (max >= threshold) {
						const t = (max - threshold) / (255 - threshold);
						data[i + 3] = Math.round(255 * (1 - t));
					}
				}
				ctx.putImageData(imageData, 0, 0);
				setProcessedSrc(canvas.toDataURL("image/png"));
			} catch (e) {
				setError(String(e));
			}
		};
		img.onerror = () => setError("load-failed");
		img.src = src;
		// processedSrc intentionally omitted — it would re-run on every successful process
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [src, threshold]);

	if (error || !processedSrc) {
		return <img src={src} alt={alt} loading="lazy" />;
	}
	return <img src={processedSrc} alt={alt} loading="lazy" />;
}

export const PanelImage = memo(PanelImageInner);
