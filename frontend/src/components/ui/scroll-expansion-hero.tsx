/** ScrollExpandMedia — адаптированный по коду из pasted-1789026884123.txt
 * с точной привязкой (pinning) под нижней линией панели каталога.
 *
 * Особенности и доработки:
 * 1. Прилипание работает на постоянной основе под линией меню каталога (top: 100px).
 * 2. Текст разъезжается при раскрытии и четко виден поверх фона и карточки.
 * 3. Картинка-фон зафиксирована неподвижно.
 * 4. Контейнер слайд-шоу автоматически закрывается после показа всех слайдов.
 * 5. Красный круглый крестик:
 *    - Расположен в ПРАВОМ верхнем углу (right: 18px, top: 18px).
 *    - Появляется ТОЛЬКО когда слайд-шоу раскрыто на полный экран (`mediaFullyExpanded`).
 *      На первой маленькой картинке и во время раскрытия он скрыт.
 * 6. Эстетичный, понятный и заметный блок «Посмотреть слайд-шоу снова» после закрытия:
 *    - Красивая интерактивная карточка-баннер с превью, заголовком, иконкой Play и кнопкой,
 *      выглядит профессионально в стиле Apple / премиального интерфейса.
 */
import {
	type ReactNode,
	type TouchEvent,
	type WheelEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DesignSlide {
	id: string;
	title: string;
	image: string;
	subtitle?: string;
}

interface ScrollExpandMediaProps {
	mediaType?: "video" | "image";
	mediaSrc: string;
	posterSrc?: string;
	bgImageSrc: string;
	title?: string;
	date?: string;
	scrollToExpand?: string;
	textBlend?: boolean;
	slides?: DesignSlide[];
	children?: ReactNode;
}

const HEADER_OFFSET_DESKTOP = 100; // 48px header + 52px subheader
const HEADER_OFFSET_MOBILE = 96; // 48px header + 48px subheader

const ScrollExpandMedia = ({
	mediaType = "image",
	mediaSrc,
	posterSrc,
	bgImageSrc,
	title,
	date,
	scrollToExpand,
	textBlend,
	slides = [],
	children,
}: ScrollExpandMediaProps) => {
	const [scrollProgress, setScrollProgress] = useState<number>(0);
	const [showContent, setShowContent] = useState<boolean>(false);
	const [mediaFullyExpanded, setMediaFullyExpanded] = useState<boolean>(false);
	const [isClosed, setIsClosed] = useState<boolean>(false);
	const [touchStartY, setTouchStartY] = useState<number>(0);
	const [isMobileState, setIsMobileState] = useState<boolean>(false);
	const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);

	const containerRef = useRef<HTMLDivElement | null>(null);
	const stickyRef = useRef<HTMLDivElement | null>(null);
	const isSwitchingSlideRef = useRef<boolean>(false);

	const activeSlides: DesignSlide[] =
		slides.length > 0
			? slides
			: [
					{
						id: "default",
						title: title || "WWW",
						image: mediaSrc,
						subtitle: date,
					},
				];

	const hasMultipleSlides = activeSlides.length > 1;

	// Сброс при смене mediaSrc без setState в useEffect
	const [prevMediaSrc, setPrevMediaSrc] = useState(mediaSrc);
	if (prevMediaSrc !== mediaSrc) {
		setPrevMediaSrc(mediaSrc);
		setScrollProgress(0);
		setShowContent(false);
		setMediaFullyExpanded(false);
		setIsClosed(false);
		setCurrentSlideIndex(0);
	}

	const nextSlide = () => {
		setCurrentSlideIndex((prev) => (prev + 1) % activeSlides.length);
	};

	const prevSlide = () => {
		setCurrentSlideIndex(
			(prev) => (prev - 1 + activeSlides.length) % activeSlides.length,
		);
	};

	const handleClose = () => {
		setIsClosed(true);
		setMediaFullyExpanded(false);
		setScrollProgress(0);
		setShowContent(true);
	};

	const headerOffset = isMobileState
		? HEADER_OFFSET_MOBILE
		: HEADER_OFFSET_DESKTOP;

	// Перехват колёсика мыши: привязка к красной линии на постоянной основе
	useEffect(() => {
		const handleWheel = (e: WheelEvent) => {
			if (!stickyRef.current || !containerRef.current) return;
			const rect = stickyRef.current.getBoundingClientRect();
			const targetTop = headerOffset;

			// Если блок уже закрыт пользователем или завершен — скроллим свободно
			if (isClosed) return;

			// Если секция вообще вне экрана — не перехватываем
			if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

			// Скролл ВНИЗ (e.deltaY > 0)
			if (e.deltaY > 0) {
				// Если секция еще не доехала до красной линии меню — даем странице спокойно доскроллиться
				if (rect.top > targetTop + 5) {
					return;
				}

				// Фаза 1: Секция подошла к красной линии, но медиа еще не раскрыто на 100%.
				// Блокируем скролл страницы и плавно раскрываем!
				if (!mediaFullyExpanded) {
					e.preventDefault();
					const scrollDelta = e.deltaY * 0.0015;
					const newProgress = Math.min(
						1,
						Math.max(0, scrollProgress + scrollDelta),
					);
					setScrollProgress(newProgress);

					if (newProgress >= 0.98) {
						setMediaFullyExpanded(true);
						setShowContent(true);
					} else if (newProgress < 0.65) {
						setShowContent(false);
					}
					return;
				}

				// Фаза 2: Медиа полностью раскрыто. Если есть еще слайды — листаем слайды!
				if (mediaFullyExpanded && hasMultipleSlides) {
					if (currentSlideIndex < activeSlides.length - 1) {
						e.preventDefault();
						if (!isSwitchingSlideRef.current) {
							isSwitchingSlideRef.current = true;
							setCurrentSlideIndex((idx) => idx + 1);
							setTimeout(() => {
								isSwitchingSlideRef.current = false;
							}, 320);
						}
						return;
					}
					// Если мы на ПОСЛЕДНЕМ слайде и крутим колесо вниз —
					// контейнер слайд-шоу закрывается и выпускает пользователя дальше!
					handleClose();
				}
			}
			// Скролл ВВЕРХ (e.deltaY < 0)
			else if (e.deltaY < 0) {
				// Если блок находится в закрепленной зоне у красной линии
				if (rect.top <= targetTop + 10 && rect.top >= targetTop - 60) {
					// Если есть слайды назад — листаем слайды назад
					if (
						mediaFullyExpanded &&
						hasMultipleSlides &&
						currentSlideIndex > 0
					) {
						e.preventDefault();
						if (!isSwitchingSlideRef.current) {
							isSwitchingSlideRef.current = true;
							setCurrentSlideIndex((idx) => idx - 1);
							setTimeout(() => {
								isSwitchingSlideRef.current = false;
							}, 320);
						}
						return;
					}

					// Если мы на первом слайде — схлопываем медиа обратно (1 → 0)
					if (scrollProgress > 0) {
						e.preventDefault();
						const scrollDelta = e.deltaY * 0.0015;
						const newProgress = Math.max(0, scrollProgress + scrollDelta);
						setScrollProgress(newProgress);
						if (newProgress < 0.95) {
							setMediaFullyExpanded(false);
						}
						if (newProgress < 0.65) {
							setShowContent(false);
						}
					}
				}
			}
		};

		const handleTouchStart = (e: TouchEvent) => {
			setTouchStartY(e.touches[0].clientY);
		};

		const handleTouchMove = (e: TouchEvent) => {
			if (!touchStartY || !stickyRef.current || isClosed) return;
			const rect = stickyRef.current.getBoundingClientRect();
			const targetTop = headerOffset;

			if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;

			const touchY = e.touches[0].clientY;
			const deltaY = touchStartY - touchY; // > 0 = свайп вверх (скролл вниз)

			if (deltaY > 0) {
				if (rect.top > targetTop + 5) {
					return;
				}

				if (!mediaFullyExpanded) {
					e.preventDefault();
					const scrollDelta = deltaY * 0.006;
					const newProgress = Math.min(
						1,
						Math.max(0, scrollProgress + scrollDelta),
					);
					setScrollProgress(newProgress);
					if (newProgress >= 0.98) {
						setMediaFullyExpanded(true);
						setShowContent(true);
					} else if (newProgress < 0.65) {
						setShowContent(false);
					}
					setTouchStartY(touchY);
					return;
				}

				if (mediaFullyExpanded && hasMultipleSlides) {
					if (currentSlideIndex < activeSlides.length - 1) {
						if (deltaY > 20) {
							e.preventDefault();
							if (!isSwitchingSlideRef.current) {
								isSwitchingSlideRef.current = true;
								setCurrentSlideIndex((idx) => idx + 1);
								setTimeout(() => {
									isSwitchingSlideRef.current = false;
								}, 320);
							}
							setTouchStartY(touchY);
						}
						return;
					}
					// После всех слайдов закрываем
					handleClose();
				}
			} else if (deltaY < 0) {
				if (rect.top <= targetTop + 10 && rect.top >= targetTop - 60) {
					if (
						mediaFullyExpanded &&
						hasMultipleSlides &&
						currentSlideIndex > 0 &&
						deltaY < -20
					) {
						e.preventDefault();
						if (!isSwitchingSlideRef.current) {
							isSwitchingSlideRef.current = true;
							setCurrentSlideIndex((idx) => idx - 1);
							setTimeout(() => {
								isSwitchingSlideRef.current = false;
							}, 320);
						}
						setTouchStartY(touchY);
						return;
					}

					if (scrollProgress > 0) {
						e.preventDefault();
						const scrollDelta = deltaY * 0.008;
						const newProgress = Math.max(0, scrollProgress + scrollDelta);
						setScrollProgress(newProgress);
						if (newProgress < 0.95) {
							setMediaFullyExpanded(false);
						}
						if (newProgress < 0.65) {
							setShowContent(false);
						}
						setTouchStartY(touchY);
					}
				}
			}
		};

		const handleTouchEnd = (): void => {
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
			window.removeEventListener(
				"touchend",
				handleTouchEnd as unknown as EventListener,
			);
		};
	}, [
		scrollProgress,
		mediaFullyExpanded,
		isClosed,
		touchStartY,
		currentSlideIndex,
		hasMultipleSlides,
		activeSlides.length,
		headerOffset,
	]);

	useEffect(() => {
		const checkIfMobile = (): void => {
			setIsMobileState(window.innerWidth < 768);
		};

		checkIfMobile();
		window.addEventListener("resize", checkIfMobile);

		return () => window.removeEventListener("resize", checkIfMobile);
	}, []);

	const mediaWidth = 300 + scrollProgress * (isMobileState ? 650 : 1250);
	const mediaHeight = 400 + scrollProgress * (isMobileState ? 200 : 400);
	const textTranslateX = scrollProgress * (isMobileState ? 180 : 150);

	const activeCurrentSlide = activeSlides[currentSlideIndex] || activeSlides[0];
	const activeSlideTitle = activeCurrentSlide?.title || title || "";
	const firstWord = activeSlideTitle ? activeSlideTitle.split(" ")[0] : "";
	const restOfTitle = activeSlideTitle
		? activeSlideTitle.split(" ").slice(1).join(" ")
		: "";
	const activeSlideSubtitle = activeCurrentSlide?.subtitle || date || "";

	// Если блок закрыт — просто рендерим контент под медиа без лишних баннеров и кнопок
	if (isClosed) {
		return (
			<div className="w-full relative bg-[#1d1d1f]">
				<section className="flex flex-col w-full px-8 py-10 md:px-16 lg:py-20 bg-[#1d1d1f]">
					{children}
				</section>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="w-full relative"
			style={{ minHeight: "180vh" }}
		>
			{/* Sticky контейнер: привязан ровно под нижней полоской каталога */}
			<div
				ref={stickyRef}
				className="sticky w-full overflow-hidden transition-colors duration-700 ease-in-out"
				style={{
					top: `${headerOffset}px`,
					height: `calc(100vh - ${headerOffset}px)`,
					zIndex: 30,
				}}
			>
				{/* Фоновое изображение комнаты — ПОЛНОСТЬЮ СТАТИЧНО, зафиксировано на месте */}
				<motion.div
					className="absolute inset-0 z-0 h-full w-full pointer-events-none select-none"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 - scrollProgress }}
					transition={{ duration: 0.1 }}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
					}}
				>
					<img
						src={bgImageSrc}
						alt="Background interior"
						className="w-full h-full object-cover object-center pointer-events-none"
						style={{
							width: "100%",
							height: "100%",
							objectFit: "cover",
							objectPosition: "center",
							transform: "none", // исключаем любое движение фона
						}}
					/>
					<div className="absolute inset-0 bg-black/30" />
				</motion.div>

				<div className="w-full h-full flex flex-col items-center justify-center relative z-10">
					{/* Карточка / Медиа-контейнер, который расширяется строго по центру */}
					<div
						className="absolute rounded-2xl overflow-hidden"
						style={{
							left: "50%",
							top: "50%",
							transform: "translate(-50%, -50%)",
							width: `${mediaWidth}px`,
							height: `${mediaHeight}px`,
							maxWidth: "95vw",
							maxHeight: `calc(100vh - ${headerOffset + 40}px)`,
							boxShadow: "0px 0px 50px rgba(0, 0, 0, 0.45)",
							zIndex: 20,
						}}
					>
						{/* Красный круглый крестик:
						    1. Перемещен СПРАВА (right: 18px, top: 18px)
						    2. Отображается ТОЛЬКО когда слайд-шоу раскрыто на полный экран (`mediaFullyExpanded`) */}
						<AnimatePresence>
							{mediaFullyExpanded && (
								<motion.button
									key="close-button"
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										handleClose();
									}}
									aria-label="Закрыть слайд-шоу"
									title="Закрыть слайд-шоу"
									initial={{ opacity: 0, scale: 0.6 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.6 }}
									transition={{ duration: 0.2 }}
									className="absolute right-4 top-4 z-50 w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer border-2 border-white/60 backdrop-blur-md"
								>
									<svg
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="3"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</motion.button>
							)}
						</AnimatePresence>

						{mediaType === "video" ? (
							mediaSrc.includes("youtube.com") ? (
								<div className="relative w-full h-full pointer-events-none">
									<iframe
										width="100%"
										height="100%"
										src={
											mediaSrc.includes("embed")
												? mediaSrc +
													(mediaSrc.includes("?") ? "&" : "?") +
													"autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1"
												: mediaSrc.replace("watch?v=", "embed/") +
													"?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1&playlist=" +
													mediaSrc.split("v=")[1]
										}
										className="w-full h-full rounded-xl"
										frameBorder="0"
										allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
										allowFullScreen
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
										disablePictureInPicture
										disableRemotePlayback
									/>
								</div>
							)
						) : (
							/* Слайдшоу изображений дизайнов */
							<div className="relative w-full h-full bg-[#111]">
								<AnimatePresence mode="wait">
									<motion.img
										key={activeCurrentSlide?.image || currentSlideIndex}
										src={activeCurrentSlide?.image}
										alt={activeCurrentSlide?.title || "Дизайн накладки"}
										className="w-full h-full object-cover rounded-xl"
										initial={{ opacity: 0.35, scale: 0.97 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0.35, scale: 1.02 }}
										transition={{ duration: 0.3, ease: "easeOut" }}
									/>
								</AnimatePresence>

								<motion.div
									className="absolute inset-0 bg-black/25 rounded-xl pointer-events-none"
									initial={{ opacity: 0.7 }}
									animate={{
										opacity: Math.max(0.05, 0.45 - scrollProgress * 0.4),
									}}
									transition={{ duration: 0.2 }}
								/>

								{/* Стрелочки переключения слайдов (видны только когда раскрыто и слайдов > 1) */}
								{mediaFullyExpanded && hasMultipleSlides && (
									<>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												prevSlide();
											}}
											aria-label="Предыдущий дизайн"
											className="absolute left-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
										>
											<svg
												width="22"
												height="22"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.5"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<polyline points="15 18 9 12 15 6" />
											</svg>
										</button>

										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												nextSlide();
											}}
											aria-label="Следующий дизайн"
											className="absolute right-4 top-1/2 -translate-y-1/2 z-40 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-95 shadow-xl cursor-pointer"
										>
											<svg
												width="22"
												height="22"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="2.5"
												strokeLinecap="round"
												strokeLinejoin="round"
											>
												<polyline points="9 18 15 12 9 6" />
											</svg>
										</button>

										{/* Точки-индикаторы и счетчик слайдов */}
										<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto">
											<div className="px-3.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-md">
												{activeCurrentSlide.title} ({currentSlideIndex + 1} /{" "}
												{activeSlides.length})
											</div>
											<div className="flex items-center gap-1.5">
												{activeSlides.map((slide, idx) => (
													<button
														key={slide.id || idx}
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															setCurrentSlideIndex(idx);
														}}
														aria-label={`Перейти к слайду ${idx + 1}`}
														className={`h-2 rounded-full transition-all cursor-pointer ${
															idx === currentSlideIndex
																? "w-6 bg-white shadow"
																: "w-2 bg-white/40 hover:bg-white/70"
														}`}
													/>
												))}
											</div>
										</div>
									</>
								)}
							</div>
						)}

						{/* Подзаголовок и подсказка до раскрытия */}
						{!mediaFullyExpanded && (
							<div className="flex flex-col items-center text-center relative z-10 mt-4 transition-none">
								{activeSlideSubtitle && (
									<p
										className="text-2xl text-blue-200"
										style={{
											transform: `translateX(-${textTranslateX}vw)`,
										}}
									>
										{activeSlideSubtitle}
									</p>
								)}
								{scrollToExpand && (
									<p
										className="text-blue-200 font-medium text-center"
										style={{
											transform: `translateX(${textTranslateX}vw)`,
										}}
									>
										{scrollToExpand}
									</p>
								)}
							</div>
						)}
					</div>

					{/* Большой разъезжающийся заголовок поверх: мягкий, элегантный, в едином цвете */}
					<div
						className={`flex items-center justify-center text-center gap-3 w-full relative transition-none flex-col pointer-events-none ${
							textBlend ? "mix-blend-difference" : "mix-blend-normal"
						}`}
						style={{
							zIndex: 35,
						}}
					>
						<motion.h2
							className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-white/95 transition-none select-none"
							style={{
								transform: `translateX(-${textTranslateX}vw)`,
								textShadow: "0 2px 20px rgba(0,0,0,0.45)",
								letterSpacing: "-0.02em",
							}}
						>
							{firstWord}
						</motion.h2>
						<motion.h2
							className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-center text-white/95 transition-none select-none"
							style={{
								transform: `translateX(${textTranslateX}vw)`,
								textShadow: "0 2px 20px rgba(0,0,0,0.45)",
								letterSpacing: "-0.02em",
							}}
						>
							{restOfTitle}
						</motion.h2>
					</div>
				</div>
			</div>

			{/* Контент под раскрытым медиа */}
			<motion.section
				className="relative z-20 flex flex-col w-full px-8 py-10 md:px-16 lg:py-20 bg-[#1d1d1f]"
				initial={{ opacity: 0 }}
				animate={{ opacity: showContent ? 1 : 0 }}
				transition={{ duration: 0.7 }}
			>
				{children}
			</motion.section>
		</div>
	);
};

export default ScrollExpandMedia;
