/** Scroll-Expansion Hero — адаптированный компонент «WWW в дизайне».
 *
 * Встраивается в CatalogPanelPage на место блока «Продуманная система».
 * Реагирует на изменение textureId и подтягивает визуализацию для фактуры.
 *
 * React 19: избегаем setState в useEffect, используя key для принудительного
 * remount при смене textureId — это сбрасывает все состояния естественным путём.
 */
import {
	type ReactNode,
	type TouchEvent,
	type WheelEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { motion } from "framer-motion";

interface WwwInDesignProps {
	textureId: string;
	mediaType?: "video" | "image";
	mediaSrc: string;
	posterSrc?: string;
	bgImageSrc: string;
	title?: string;
	subtitle?: string;
	scrollHint?: string;
	textBlend?: boolean;
	children?: ReactNode;
}

/** Внутренний компонент — монтируется заново при каждой смене textureId
 * через механизм key, что естественно сбрасывает все состояния. */
function WwwInDesignInner({
	mediaType = "image",
	mediaSrc,
	posterSrc,
	bgImageSrc,
	title,
	subtitle,
	scrollHint = "Листайте вверх",
	textBlend = false,
	children,
}: WwwInDesignProps) {
	const [scrollProgress, setScrollProgress] = useState<number>(0);
	const [showContent, setShowContent] = useState<boolean>(false);
	const [mediaFullyExpanded, setMediaFullyExpanded] = useState<boolean>(false);
	const [touchStartY, setTouchStartY] = useState<number>(0);
	const [isMobile, setIsMobile] = useState<boolean>(false);

	const sectionRef = useRef<HTMLDivElement | null>(null);
	const scrollProgressRef = useRef<number>(0);

	// Mobile detection
	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Wheel / scroll handler — управляет scrollProgress через ref для
	// синхронного доступа внутри callback-ов.
	// Срабатывает только когда курсор/касание находится внутри самого блока,
	// чтобы не ломать прокрутку остальной страницы (шапка, конфигуратор панели).
	useEffect(() => {
		const sectionEl = sectionRef.current;
		if (!sectionEl) return;

		const applyProgress = (newProgress: number) => {
			scrollProgressRef.current = newProgress;
			setScrollProgress(newProgress);

			if (newProgress >= 1) {
				setMediaFullyExpanded(true);
				setShowContent(true);
			} else if (newProgress < 0.75) {
				setShowContent(false);
			}
		};

		const handleWheel = (e: WheelEvent) => {
			// Проверяем, находится ли блок в зоне видимости экрана
			const rect = sectionEl.getBoundingClientRect();
			const isInView = rect.top <= 100 && rect.bottom >= window.innerHeight * 0.5;
			if (!isInView) return;

			if (mediaFullyExpanded && e.deltaY < 0 && window.scrollY <= 5) {
				setMediaFullyExpanded(false);
				e.preventDefault();
			} else if (!mediaFullyExpanded) {
				// Если листаем вниз внутри блока — плавно расширяем медиа
				if (e.deltaY > 0 && scrollProgressRef.current < 1) {
					e.preventDefault();
					const scrollDelta = e.deltaY * 0.0012;
					const newProgress = Math.min(
						Math.max(scrollProgressRef.current + scrollDelta, 0),
						1,
					);
					applyProgress(newProgress);
				} else if (e.deltaY < 0 && scrollProgressRef.current > 0) {
					e.preventDefault();
					const scrollDelta = e.deltaY * 0.0012;
					const newProgress = Math.min(
						Math.max(scrollProgressRef.current + scrollDelta, 0),
						1,
					);
					applyProgress(newProgress);
				}
			}
		};

		const handleTouchStart = (e: TouchEvent) => {
			setTouchStartY(e.touches[0].clientY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!touchStartY) return;

			const rect = sectionEl.getBoundingClientRect();
			const isInView = rect.top <= 100 && rect.bottom >= window.innerHeight * 0.5;
			if (!isInView) return;

			const touchY = e.touches[0].clientY;
			const deltaY = touchStartY - touchY;

			if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
				setMediaFullyExpanded(false);
				e.preventDefault();
			} else if (!mediaFullyExpanded) {
				const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
				const scrollDelta = deltaY * scrollFactor;
				const newProgress = Math.min(
					Math.max(scrollProgressRef.current + scrollDelta, 0),
					1,
				);

				if ((deltaY > 0 && scrollProgressRef.current < 1) || (deltaY < 0 && scrollProgressRef.current > 0)) {
					e.preventDefault();
					applyProgress(newProgress);
				}

				setTouchStartY(touchY);
			}
		};

		const handleTouchEnd = () => {
			setTouchStartY(0);
		};

		window.addEventListener("wheel", handleWheel as unknown as EventListener, {
			passive: false,
		});
		window.addEventListener(
			"touchstart",
			handleTouchStart as unknown as EventListener,
			{ passive: false },
		);
		window.addEventListener(
			"touchmove",
			handleTouchMove as unknown as EventListener,
			{ passive: false },
		);
		window.addEventListener("touchend", handleTouchEnd as EventListener);

		return () => {
			window.removeEventListener(
				"wheel",
				handleWheel as unknown as EventListener,
			);
			window.removeEventListener(
				"touchstart",
				handleTouchStart as unknown as EventListener,
			);
			window.removeEventListener(
				"touchmove",
				handleTouchMove as unknown as EventListener,
			);
			window.removeEventListener("touchend", handleTouchEnd as EventListener);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mediaFullyExpanded]);

	const mediaWidth = 300 + scrollProgress * (isMobile ? 650 : 1250);
	const mediaHeight = 400 + scrollProgress * (isMobile ? 200 : 400);
	const textTranslateX = scrollProgress * (isMobile ? 180 : 150);

	const firstWord = title ? title.split(" ")[0] : "";
	const restOfTitle = title ? title.split(" ").slice(1).join(" ") : "";

	return (
		<div
			ref={sectionRef}
			className="transition-colors duration-700 ease-in-out overflow-x-hidden"
		>
			<section className="relative flex flex-col items-center justify-start min-h-[100dvh]">
				<div className="relative w-full flex flex-col items-center min-h-[100dvh]">
					{/* Background */}
					<motion.div
						className="absolute inset-0 z-0 h-full"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 - scrollProgress }}
						transition={{ duration: 0.1 }}
					>
						<img
							src={bgImageSrc}
							alt="Background"
							className="w-screen h-screen"
							style={{
								objectFit: "cover",
								objectPosition: "center",
							}}
						/>
						<div className="absolute inset-0 bg-black/10" />
					</motion.div>

					{/* Main content */}
					<div className="container mx-auto flex flex-col items-center justify-start relative z-10">
						<div className="flex flex-col items-center justify-center w-full h-[100dvh] relative">
							{/* Media */}
							<div
								className="absolute z-0 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 transition-none rounded-2xl overflow-hidden"
								style={{
									width: `${mediaWidth}px`,
									height: `${mediaHeight}px`,
									maxWidth: "95vw",
									maxHeight: "85vh",
									boxShadow: "0px 0px 50px rgba(0, 0, 0, 0.3)",
								}}
							>
								{mediaType === "video" ? (
									mediaSrc.includes("youtube.com") ||
									mediaSrc.includes("youtu.be") ? (
										<div className="relative w-full h-full pointer-events-none">
											<iframe
												width="100%"
												height="100%"
												src={
													mediaSrc.includes("embed")
														? mediaSrc +
															(mediaSrc.includes("?") ? "&" : "?") +
															"autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1"
														: mediaSrc
																.replace("watch?v=", "embed/")
																.replace(
																	"youtu.be/",
																	"www.youtube.com/embed/",
																) +
															"?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1"
												}
												className="w-full h-full rounded-xl"
												frameBorder="0"
												allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
												allowFullScreen
											/>
											<motion.div
												className="absolute inset-0 bg-black/30 rounded-xl"
												initial={{ opacity: 0.7 }}
												animate={{
													opacity: 0.5 - scrollProgress * 0.3,
												}}
												transition={{ duration: 0.2 }}
											/>
										</div>
									) : (
										<div className="relative w-full h-full pointer-events-none">
											<video
												src={mediaSrc}
												poster={posterSrc}
												autoPlay
												muted
												loop
												playsInline
												preload="auto"
												className="w-full h-full object-cover rounded-xl"
												controls={false}
											/>
											<motion.div
												className="absolute inset-0 bg-black/30 rounded-xl"
												initial={{ opacity: 0.7 }}
												animate={{
													opacity: 0.5 - scrollProgress * 0.3,
												}}
												transition={{ duration: 0.2 }}
											/>
										</div>
									)
								) : (
									<div className="relative w-full h-full">
										<img
											src={mediaSrc}
											alt={title || "Media content"}
											className="w-full h-full object-cover rounded-xl"
										/>
										<motion.div
											className="absolute inset-0 bg-black/50 rounded-xl"
											initial={{ opacity: 0.7 }}
											animate={{
												opacity: 0.7 - scrollProgress * 0.3,
											}}
											transition={{ duration: 0.2 }}
										/>
									</div>
								)}

								{(subtitle || scrollHint) && (
									<div className="flex flex-col items-center text-center relative z-10 mt-4 transition-none">
										{subtitle && (
											<p
												className="text-2xl text-blue-200"
												style={{
													transform: `translateX(-${textTranslateX}vw)`,
												}}
											>
												{subtitle}
											</p>
										)}
										{scrollHint && (
											<p
												className="text-blue-200 font-medium text-center"
												style={{
													transform: `translateX(${textTranslateX}vw)`,
												}}
											>
												{scrollHint}
											</p>
										)}
									</div>
								)}
							</div>

							{/* Title */}
							<div
								className={`flex items-center justify-center text-center gap-4 w-full relative z-10 transition-none flex-col ${
									textBlend ? "mix-blend-difference" : "mix-blend-normal"
								}`}
							>
								{firstWord && (
									<motion.h2
										className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-200 transition-none"
										style={{
											transform: `translateX(-${textTranslateX}vw)`,
										}}
									>
										{firstWord}
									</motion.h2>
								)}
								{restOfTitle && (
									<motion.h2
										className="text-4xl md:text-5xl lg:text-6xl font-bold text-center text-blue-200 transition-none"
										style={{
											transform: `translateX(${textTranslateX}vw)`,
										}}
									>
										{restOfTitle}
									</motion.h2>
								)}
							</div>
						</div>

						{/* Expandable content section */}
						<motion.section
							className="flex flex-col w-full px-8 py-10 md:px-16 lg:py-20"
							initial={{ opacity: 0 }}
							animate={{ opacity: showContent ? 1 : 0 }}
							transition={{ duration: 0.7 }}
						>
							{children}
						</motion.section>
					</div>
				</div>
			</section>
		</div>
	);
}

/** Публичный компонент — оборачивает WwwInDesignInner и при смене textureId
 * меняет key, вызывая естественный remount и сброс состояний. */
export default function WwwInDesignHero(props: WwwInDesignProps) {
	const { textureId, ...rest } = props;
	return <WwwInDesignInner key={textureId} textureId={textureId} {...rest} />;
}
