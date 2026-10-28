import React, { useState, useRef } from "react";
import {
	AppstoreOutlined,
	SettingOutlined,
	LockOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { Button, InputNumber } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { usePanelVariants, usePanels } from "../../catalog/api/catalogApi";
import { groupVariantsToPanels } from "../../catalog/ui/panelHelpers";
import { HomeConfiguratorUpload } from "./HomeConfiguratorUpload";
import { ProjectSpacesSlider } from "./ProjectSpacesSlider";
import "./projectDetails.css";
import { imageSrc } from "../../../shared/lib/imageSrc";

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
	hidden: { opacity: 0, y: 32 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.8, ease: APPLE_EASE, delay: i * 0.12 },
	}),
};
const containerVariants = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.12 } },
};
const SECTION_PADDING: React.CSSProperties = { padding: "100px 24px" };
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1200, margin: "0 auto" };
const ACCENT = "#4CAF50";
const ACCENT_DARK = "#2E7D32";
const DARK = "#1D1D1F";
const GRAY_TEXT = "#6E6E73";
const LIGHT_BG = "#F5F5F7";
const SUBTLE_BORDER = "rgba(0,0,0,0.06)";
const CARD_RADIUS = 20;
const PILL_RADIUS = 10;

// Two video variants are loaded for the hero: a small LQ (≈230 KB at 1280×720)
// that starts immediately, and the original HQ (≈1.7 MB at 1920×1072) that
// downloads in the background. When HQ is ready, a crossfade swaps it in —
// the user never sees a black background.
const HERO_VIDEO_PAIRS: Array<{ lq: string; hq: string }> = [
	{
		lq: "/herovideo/hero1-720.mp4",
		hq: "/herovideo/IMG_6429.MP4",
	},
	{
		lq: "/herovideo/hero2-720.mp4",
		hq: "/herovideo/IMG_6431.MP4",
	},
];
declare let window: Window & { __heroIdx?: number };

// Public-domain poster used while the hero video is still buffering. The
// `preload="auto"` hint + the inline preload links below let the browser
// start fetching both candidates in parallel with the HTML payload, so the
// hero starts almost immediately on cold loads and re-visits.
const HERO_POSTER = "/herovideo/hero-poster.jpg";

export function HeroPreloadLinks() {
	return (
		<Helmet>
			<link
				rel="preload"
				as="video"
				href="/herovideo/hero1-720.mp4"
				type="video/mp4"
				fetchPriority="high"
			/>
			<link
				rel="preload"
				as="video"
				href="/herovideo/hero2-720.mp4"
				type="video/mp4"
				fetchPriority="high"
			/>
			<link
				rel="preload"
				as="video"
				href="/herovideo/IMG_6429.MP4"
				type="video/mp4"
				fetchPriority="auto"
			/>
			<link
				rel="preload"
				as="video"
				href="/herovideo/IMG_6431.MP4"
				type="video/mp4"
				fetchPriority="auto"
			/>
			<link rel="preload" as="image" href={HERO_POSTER} fetchPriority="high" />
			<link rel="preconnect" href="/herovideo" crossOrigin="" />
		</Helmet>
	);
}

export function HeroSection({ onCatalog }: { onCatalog: () => void }) {
	const heroIdx = window.__heroIdx ?? 0;
	const videos = HERO_VIDEO_PAIRS[heroIdx] ?? HERO_VIDEO_PAIRS[0];
	const [hqReady, setHqReady] = useState(false);

	const handleHqReady = React.useCallback(
		(e: React.SyntheticEvent<HTMLVideoElement>) => {
			const v = e.currentTarget;
			// Mute + autoplay is required for Safari/iOS to start playback.
			v.muted = true;
			const playPromise = v.play();
			if (playPromise && typeof playPromise.then === "function") {
				playPromise.then(() => setHqReady(true)).catch(() => setHqReady(true));
			} else {
				setHqReady(true);
			}
		},
		[],
	);

	return (
		<section
			style={{
				minHeight: "100vh",
				background: "#000",
				display: "flex",
				alignItems: "center",
				...SECTION_PADDING,
				position: "relative",
				overflow: "hidden",
			}}
		>
			{videos && (
				<>
					{/* LQ — plays immediately, fades out when HQ is ready */}
					<video
						autoPlay
						muted
						loop
						playsInline
						preload="auto"
						poster={HERO_POSTER}
						{...({ fetchPriority: "high" } as { fetchPriority: "high" })}
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
							zIndex: 0,
							opacity: hqReady ? 0 : 1,
							transition: "opacity 0.6s ease",
							background: `center / cover no-repeat url(${HERO_POSTER}), #000`,
						}}
					>
						<source src={videos.lq} type="video/mp4" />
					</video>

					{/* HQ — downloads in the background, fades in when ready */}
					<video
						loop
						muted
						playsInline
						preload="auto"
						poster={HERO_POSTER}
						onCanPlay={handleHqReady}
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
							zIndex: 1,
							opacity: hqReady ? 1 : 0,
							transition: "opacity 0.6s ease",
							background: `center / cover no-repeat url(${HERO_POSTER}), #000`,
						}}
					>
						<source src={videos.hq} type="video/mp4" />
					</video>

					<div
						style={{
							position: "absolute",
							inset: 0,
							background:
								"linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.18) 55%, rgba(0,0,0,0.45) 100%)",
							zIndex: 2,
							pointerEvents: "none",
						}}
					/>
				</>
			)}
			<div
				style={{
					...MAX_WIDTH,
					width: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					textAlign: "center",
					position: "relative",
					zIndex: 2,
					gap: 32,
				}}
			>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					animate="visible"
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 28,
					}}
				>
					<motion.div variants={fadeUpVariants} custom={0}>
						<span
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: 13,
								fontWeight: 600,
								color: "#fff",
								textTransform: "uppercase",
								letterSpacing: "3px",
							}}
						>
							ПЛАТФОРМА ТРАНСФОРМАЦИИ ПРОСТРАНСТВА
						</span>
					</motion.div>
					<motion.h1
						variants={fadeUpVariants}
						custom={1}
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: "clamp(40px, 6vw, 72px)",
							fontWeight: 700,
							color: "#fff",
							margin: 0,
							lineHeight: 1.1,
							letterSpacing: "-0.03em",
							maxWidth: 800,
						}}
					>
						Ремонт окончен.{" "}
						<span style={{ color: ACCENT_DARK }}>Начинается свобода.</span>
					</motion.h1>
					<motion.p
						variants={fadeUpVariants}
						custom={2}
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: "clamp(17px, 2vw, 20px)",
							fontWeight: 600,
							color: "rgba(255,255,255,0.85)",
							margin: 0,
							lineHeight: 1.65,
							maxWidth: 560,
						}}
					>
						Новый интерьер – в один клик.
						<br />
						WONDER WOW WALL – первая платформа
						<br />
						трансформации стен.
					</motion.p>
					<motion.div
						variants={fadeUpVariants}
						custom={3}
						style={{ display: "flex", justifyContent: "center" }}
					>
						<Button
							onClick={onCatalog}
							size="large"
							style={{
								background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
								color: "#fff",
								border: "none",
								borderRadius: PILL_RADIUS,
								height: 56,
								padding: "0 44px",
								fontFamily: "'SF Pro Display', sans-serif",
								fontWeight: 600,
								fontSize: 17,
								boxShadow: "none",
								letterSpacing: "-0.01em",
							}}
						>
							выбрать свой WOW!
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

const steps = [
	{
		num: "1",
		title: "Выбираете\nновый стиль стен.",
		desc: "Найдите текстуру, которая отражает Вас сегодня.",
		video: "Выбираете.MP4",
	},
	{
		num: "2",
		title: "Примеряете\nбудущее на экране смартфона.",
		desc: "Загрузите фото и приложение мгновенно впишет новый интерьер в Ваше пространство.",
		video: "Примеряете.MP4",
	},
	{
		num: "3",
		title: "Обновляете\nстены без пыли\nи ремонтного хаоса.",
		desc: "Мы превратили обновление интерьера\nв вопрос нескольких часов.",
		video: "Обновляете.MP4",
	},
	{
		num: "4",
		title: "Меняете\nоблик пространства когда угодно.",
		desc: "Одна бесплатная замена в год.\nУже включена в подписку.",
		video: "Меняете.MP4",
	},
];

export function HowItWorksSection() {
	const carouselRef = useRef<HTMLDivElement>(null);
	const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	React.useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const vid = entry.target as HTMLVideoElement;

					if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
						vid.play().catch(() => {});
					} else {
						vid.pause();
					}
				});
			},
			{ threshold: 0.5 },
		);
		videoRefs.current.forEach((v) => {
			if (v) observer.observe(v);
		});
		return () => observer.disconnect();
	}, []);
	React.useEffect(() => {
		const el = carouselRef.current;
		if (!el) return;
		const onScroll = () => {
			setActiveIndex(Math.round(el.scrollLeft / el.offsetWidth));
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	// Touch/swipe handlers for mobile
	const touchStartX = useRef(0);
	const touchStartY = useRef(0);
	const activeIndexRef = useRef(activeIndex);
	React.useEffect(() => {
		activeIndexRef.current = activeIndex;
	}, [activeIndex]);

	const handleTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX;
		touchStartY.current = e.touches[0].clientY;
	};
	const handleTouchEnd = (e: React.TouchEvent) => {
		e.preventDefault();
		const deltaX = e.changedTouches[0].clientX - touchStartX.current;
		const deltaY = e.changedTouches[0].clientY - touchStartY.current;
		if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
			const currentIndex = activeIndexRef.current;
			if (deltaX < 0 && currentIndex < steps.length - 1) {
				goToSlide(currentIndex + 1);
			} else if (deltaX > 0 && currentIndex > 0) {
				goToSlide(currentIndex - 1);
			}
		}
	};
	const handleTouchMove = (e: React.TouchEvent) => {
		const deltaX = e.touches[0].clientX - touchStartX.current;
		const deltaY = e.touches[0].clientY - touchStartY.current;
		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			e.preventDefault();
		}
	};

	// Desktop mouse drag handlers
	const isDragging = useRef(false);
	const dragStartX = useRef(0);
	const handleMouseDown = (e: React.MouseEvent) => {
		isDragging.current = true;
		dragStartX.current = e.clientX;
		if (carouselRef.current) carouselRef.current.style.cursor = "grabbing";
	};
	const handleMouseMove = (e: React.MouseEvent) => {
		if (!isDragging.current) return;
		const deltaX = e.clientX - dragStartX.current;
		if (Math.abs(deltaX) > 50) {
			if (deltaX < 0 && activeIndexRef.current < steps.length - 1) {
				goToSlide(activeIndexRef.current + 1);
			} else if (deltaX > 0 && activeIndexRef.current > 0) {
				goToSlide(activeIndexRef.current - 1);
			}
			isDragging.current = false;
		}
	};
	const handleMouseUp = () => {
		isDragging.current = false;
		if (carouselRef.current) carouselRef.current.style.cursor = "grab";
	};

	const goToSlide = (i: number) => {
		const el = carouselRef.current;
		if (!el) return;
		setActiveIndex(i);
		el.scrollTo({ left: i * el.offsetWidth, behavior: "smooth" });
	};

	// Arrow styles
	const arrowStyle: React.CSSProperties = {
		fontSize: 28,
		color: "rgba(0,0,0,0.25)",
		cursor: "pointer",
		userSelect: "none",
		transition: "color 0.2s ease",
	};

	return (
		<section style={{ background: "#fff", overflow: "hidden" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.25 }}
					variants={fadeUpVariants}
					custom={0}
					style={{ textAlign: "center", paddingTop: 100 }}
				>
					<h2
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: "clamp(40px, 6vw, 80px)",
							fontWeight: 700,
							color: DARK,
							margin: 0,
							letterSpacing: "-0.03em",
							lineHeight: 1.15,
						}}
					>
						Просто. Быстро. WOW.
					</h2>
				</motion.div>
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "32px 24px 0",
					alignItems: "center",
					gap: 16,
				}}
			>
				{activeIndex > 0 && (
					<span
						style={arrowStyle}
						onClick={() => goToSlide(activeIndex - 1)}
						role="button"
						aria-label="Предыдущий слайд"
					>
						←
					</span>
				)}
				<span
					style={{
						fontFamily: "'SF Pro Display', sans-serif",
						fontSize: 13,
						color: "rgba(0,0,0,0.35)",
						letterSpacing: "0.02em",
						fontWeight: 400,
					}}
				>
					{activeIndex + 1} / {steps.length} — свайпните вбок
				</span>
				{activeIndex < steps.length - 1 && (
					<span
						style={arrowStyle}
						onClick={() => goToSlide(activeIndex + 1)}
						role="button"
						aria-label="Следующий слайд"
					>
						→
					</span>
				)}
			</div>
			<div
				ref={carouselRef}
				className="carousel"
				onTouchStart={handleTouchStart}
				onTouchEnd={handleTouchEnd}
				onTouchMove={handleTouchMove}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				style={{
					overflowX: "scroll",
					overflowY: "hidden",
					scrollSnapType: "x mandatory",
					scrollBehavior: "smooth",
					display: "flex",
					width: "100%",
					cursor: "grab",
					userSelect: "none",
					msOverflowStyle: "none",
					scrollbarWidth: "none",
					WebkitOverflowScrolling: "touch",
				}}
			>
				{steps.map((step, i) => (
					<div
						key={step.num}
						style={{
							scrollSnapAlign: "start",
							flex: "0 0 100%",
							minWidth: 0,
							display: "flex",
							alignItems: "center",
							padding: "clamp(32px, 8vw, 80px) clamp(24px, 8vw, 160px)",
							boxSizing: "border-box",
							gap: "clamp(32px, 6vw, 100px)",
						}}
					>
						<div
							style={{
								flex: "0 0 auto",
								width: "clamp(200px, 30vw, 400px)",
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-start",
								textAlign: "left",
								gap: 20,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 500,
									color: ACCENT,
									textTransform: "uppercase",
									letterSpacing: "2px",
								}}
							>
								Шаг {step.num}
							</span>
							<h3
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: "clamp(28px, 3.5vw, 42px)",
									fontWeight: 700,
									color: DARK,
									margin: 0,
									lineHeight: 1.1,
									letterSpacing: "-0.025em",
									whiteSpace: "pre-line",
								}}
							>
								{step.title}
							</h3>
							<p
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: "clamp(15px, 1.5vw, 17px)",
									fontWeight: 400,
									color: GRAY_TEXT,
									lineHeight: 1.65,
									margin: 0,
									whiteSpace: "pre-line",
								}}
							>
								{step.desc}
							</p>
						</div>
						<div
							style={{
								flex: "1 1 auto",
								maxWidth: "clamp(260px, 55vw, 900px)",
								borderRadius: 20,
								overflow: "hidden",
								boxShadow: "0 24px 80px rgba(0,0,0,0.14)",
								background: LIGHT_BG,
								aspectRatio: "16 / 9",
								position: "relative",
							}}
						>
							<video
								ref={(el) => {
									videoRefs.current[i] = el;
								}}
								src={`/videos/${step.video}`}
								muted
								loop
								playsInline
								preload="auto"
								style={{
									width: "100%",
									height: "100%",
									objectFit: "cover",
									display: "block",
								}}
							/>
						</div>
					</div>
				))}
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 12,
					paddingBottom: 80,
				}}
			>
				<div
					style={{
						width: "100%",
						maxWidth: 1200,
						margin: "0 auto",
						padding: "0 24px",
						boxSizing: "border-box",
					}}
				>
					<div
						style={{
							height: 3,
							background: "rgba(0,0,0,0.08)",
							borderRadius: 2,
							overflow: "hidden",
						}}
					>
						<div
							style={{
								height: "100%",
								width: `${((activeIndex + 1) / steps.length) * 100}%`,
								background: DARK,
								borderRadius: 2,
								transition: "width 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)",
							}}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

const serviceBannerStyles = `
	.home-service-card-kicker {
		font-family: "SF Pro Display", sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: ${ACCENT};
		text-transform: uppercase;
		letter-spacing: 3px;
		margin-bottom: 24px;
	}
	.home-service-card-title {
		font-family: "SF Pro Display", sans-serif;
		font-size: 32px;
		font-weight: 600;
		color: ${DARK};
		line-height: 1.2;
		margin-bottom: 12px;
		letter-spacing: -0.02em;
	}
	.home-service-card-description {
		font-family: "SF Pro Display", sans-serif;
		font-size: 19px;
		font-weight: 400;
		color: ${GRAY_TEXT};
		line-height: 1.5;
	}
	@media (max-width: 768px) {
		.home-service-section {
			padding: 52px 16px 44px !important;
		}
		.home-service-content {
			align-items: stretch !important;
			text-align: left !important;
			gap: 12px !important;
		}
		.home-service-content > div:first-child {
			display: none;
		}
		.home-service-title {
			font-size: clamp(34px, 10.5vw, 46px) !important;
			line-height: 1.02 !important;
			letter-spacing: -0.045em !important;
		}
		.home-service-lead {
			font-size: 16px !important;
			line-height: 1.45 !important;
			font-weight: 500 !important;
			max-width: 32ch !important;
		}
		.home-service-lead br { display: none; }
		.home-service-grid {
			grid-template-columns: minmax(0, 1fr) !important;
			gap: 10px !important;
			margin-top: 14px !important;
			max-width: none !important;
		}
		.home-service-card {
			padding: 20px !important;
			border-radius: 18px !important;
			text-align: left !important;
			min-width: 0;
		}
		.home-service-card-kicker {
			font-size: 11px;
			line-height: 1.25;
			letter-spacing: 1.5px;
			margin-bottom: 9px;
		}
		.home-service-card-title {
			font-size: 24px;
			line-height: 1.08;
			margin-bottom: 7px;
		}
		.home-service-card-description {
			font-size: 15px;
			line-height: 1.35;
			font-weight: 500;
		}
		.home-service-signature { display: none !important; }
	}
`;

export function ServiceBannerSection() {
	return (
		<>
			<style>{serviceBannerStyles}</style>
			<section
				className="home-service-section"
				style={{
					background: "#fff",
					padding: "100px 24px",
					overflow: "hidden",
				}}
			>
				<div style={{ ...MAX_WIDTH }}>
					<motion.div
						className="home-service-content"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true, amount: 0.3 }}
						variants={fadeUpVariants}
						custom={0}
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							textAlign: "center",
							gap: 20,
							position: "relative",
						}}
					>
						<motion.div variants={fadeUpVariants} custom={1}>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 12,
									fontWeight: 500,
									color: GRAY_TEXT,
									textTransform: "uppercase",
									letterSpacing: "3px",
									display: "block",
									marginBottom: 12,
								}}
							>
								Впервые в индустрии
							</span>
						</motion.div>
						<motion.h2
							className="home-service-title"
							variants={fadeUpVariants}
							custom={2}
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: "clamp(40px, 6vw, 80px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								lineHeight: 1.1,
								letterSpacing: "-0.03em",
							}}
						>
							Стены как сервис.
						</motion.h2>
						<motion.p
							className="home-service-lead"
							variants={fadeUpVariants}
							custom={3}
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: 18,
								fontWeight: 400,
								color: GRAY_TEXT,
								margin: 0,
								lineHeight: 1.65,
								maxWidth: 520,
								whiteSpace: "pre-line",
							}}
						>
							Мы создали будущее, в котором интерьер <br />
							меняется без традиционного ремонта.
						</motion.p>

						{/* Apple-style feature cards */}
						<motion.div
							className="home-service-grid"
							variants={fadeUpVariants}
							custom={3.5}
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								gap: 20,
								width: "100%",
								maxWidth: 1000,
								margin: "24px 0 0",
							}}
						>
							<div
								className="home-service-card"
								style={{
									background: "#f5f5f7",
									borderRadius: 24,
									padding: "48px 40px",
									textAlign: "center",
								}}
							>
								<div className="home-service-card-kicker">
									Цифровой интеллект
								</div>
								<div className="home-service-card-title">
									Ваш смартфон <br />
									Ваш дизайнер
								</div>
								<div className="home-service-card-description">
									мгновенная визуализация решений
								</div>
							</div>
							<div
								className="home-service-card"
								style={{
									background: "#f5f5f7",
									borderRadius: 24,
									padding: "48px 40px",
									textAlign: "center",
								}}
							>
								<div className="home-service-card-kicker">
									Экосистема полного цикла
								</div>
								<div className="home-service-card-title">
									Единый механизм трансформации
								</div>
								<div className="home-service-card-description">
									безупречная реализация обновлений
								</div>
							</div>
						</motion.div>

						<motion.div
							className="home-service-signature"
							variants={fadeUpVariants}
							custom={4}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								marginTop: 32,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
									color: DARK,
									textTransform: "uppercase",
									letterSpacing: "2px",
								}}
							>
								WONDER WOW WALL
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									color: GRAY_TEXT,
								}}
							>
								—
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
									color: GRAY_TEXT,
								}}
							>
								новый стандарт трансформации пространства
							</span>
						</motion.div>
					</motion.div>
				</div>
			</section>
		</>
	);
}

const techPoints = [
	{
		icon: <SettingOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Универсальная платформа монтажа.",
		desc: "Адаптирована для большинства\nсовременных поверхностей.",
	},
	{
		icon: <LockOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Запатентованная система креплений.",
		desc: "Обеспечивает быструю замену панелей.",
	},
	{
		icon: <AppstoreOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Безграничность фактур.",
		desc: "Дерево. Металл. Текстиль. Кожа. Камень.\nПространство приобретает характер.",
	},
];

export function TechSection() {
	return (
		<section style={{ background: LIGHT_BG, padding: "64px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 32,
					}}
				>
					<motion.div
						variants={fadeUpVariants}
						custom={0}
						style={{ textAlign: "center" }}
					>
						<h2
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: "clamp(40px, 6vw, 80px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								letterSpacing: "-0.03em",
								lineHeight: 1.15,
							}}
						>
							Технологии вашей свободы.
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: 32,
							width: "100%",
						}}
						className="tech-grid"
					>
						{techPoints.map((point, i) => (
							<motion.div
								key={point.title}
								variants={fadeUpVariants}
								custom={i + 1}
								style={{
									background: "#fff",
									borderRadius: CARD_RADIUS,
									padding: "40px 32px",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									textAlign: "center",
									gap: 16,
									boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
									border: `1px solid ${SUBTLE_BORDER}`,
								}}
							>
								<div
									style={{
										width: 64,
										height: 64,
										borderRadius: 20,
										background: LIGHT_BG,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									{point.icon}
								</div>
								<span
									style={{
										fontFamily: "'SF Pro Display', sans-serif",
										fontWeight: 700,
										fontSize: 18,
										color: DARK,
										lineHeight: 1.3,
									}}
								>
									{point.title}
								</span>
								<span
									style={{
										fontFamily: "'SF Pro Display', sans-serif",
										fontSize: 14,
										fontWeight: 600,
										color: GRAY_TEXT,
										lineHeight: 1.6,
										whiteSpace: point.desc.includes("\n")
											? "pre-line"
											: "normal",
									}}
								>
									{point.desc}
								</span>
							</motion.div>
						))}
					</div>
					<motion.p
						variants={fadeUpVariants}
						custom={4}
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: 18,
							fontWeight: 600,
							color: DARK,
							margin: 0,
							textAlign: "center",
							maxWidth: 480,
						}}
					>
						Пространство приобретает характер.
					</motion.p>
					<motion.p
						variants={fadeUpVariants}
						custom={5}
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: 16,
							fontWeight: 600,
							color: GRAY_TEXT,
							margin: "-24px 0 0",
							textAlign: "center",
							maxWidth: 480,
						}}
					>
						Вы сами решаете, о чём сегодня говорят Ваши стены
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
}

export function PanelGridSection({ onCatalog }: { onCatalog: () => void }) {
	const navigate = useNavigate();
	const { data: panelData, isLoading, isError } = usePanels();
	const { data: variants } = usePanelVariants();
	// Та же группировка и порядок, что в основном каталоге. Без отдельного
	// жёстко заданного списка и без подмены снимков панели фото исполнения.
	const panels = groupVariantsToPanels(variants ?? [], panelData?.items ?? []);
	return (
		<section
			id="choose-panels"
			style={{ background: "#fff", ...SECTION_PADDING }}
		>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={containerVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.15 }}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 48,
					}}
				>
					<motion.div
						variants={fadeUpVariants}
						custom={0}
						style={{ textAlign: "center" }}
					>
						<h2
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: "clamp(40px, 6vw, 80px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								letterSpacing: "-0.03em",
								lineHeight: 1.15,
							}}
						>
							Время выбирать.
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${Math.min(Math.max(panels.length, 1), 5)}, minmax(0, 1fr))`,
							gap: 12,
							width: "100%",
							justifyContent: "center",
						}}
						className="panel-grid"
					>
						{panels.map((panel, i) => (
							<motion.div
								key={panel.panel_id}
								variants={fadeUpVariants}
								custom={i + 1}
								style={{
									borderRadius: CARD_RADIUS,
									overflow: "hidden",
									aspectRatio: "1",
									position: "relative",
									background: LIGHT_BG,
									boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
									cursor: "pointer",
								}}
								role="link"
								tabIndex={0}
								onClick={() => navigate(`/catalog/${panel.panel_id}`)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										navigate(`/catalog/${panel.panel_id}`);
									}
								}}
							>
								{panel.catalog_photos[0] || panel.form_preview ? (
									<img
										src={imageSrc(
											panel.catalog_photos[0] || panel.form_preview,
										)}
										alt={panel.panel_name}
										loading="lazy"
										style={{
											width: "100%",
											height: "100%",
											objectFit: "contain",
											display: "block",
										}}
									/>
								) : (
									<span
										aria-hidden="true"
										style={{
											display: "block",
											width: "100%",
											height: "100%",
											background: "linear-gradient(135deg, #e9eceb, #cfd7d1)",
										}}
									/>
								)}
								<div
									style={{
										position: "absolute",
										inset: 0,
										background:
											"linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)",
									}}
								/>
								<div
									style={{
										position: "absolute",
										bottom: 0,
										left: 0,
										right: 0,
										padding: "20px 16px",
									}}
								>
									<span
										style={{
											fontFamily: "'SF Pro Display', sans-serif",
											fontWeight: 700,
											fontSize: 16,
											color: "#fff",
											display: "block",
										}}
									>
										{panel.panel_name}
									</span>
								</div>
							</motion.div>
						))}
					</div>
					{isLoading && panels.length === 0 && (
						<p role="status" style={{ color: GRAY_TEXT, textAlign: "center" }}>
							Загружаем панели…
						</p>
					)}
					{!isLoading && panels.length === 0 && (
						<p
							role={isError ? "alert" : "status"}
							style={{ color: GRAY_TEXT, textAlign: "center" }}
						>
							{isError
								? "Не удалось загрузить каталог панелей."
								: "Панели скоро появятся в каталоге."}
						</p>
					)}
					<motion.div variants={fadeUpVariants} custom={5}>
						<Button
							onClick={onCatalog}
							size="large"
							style={{
								background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
								color: "#fff",
								border: "none",
								borderRadius: PILL_RADIUS,
								height: 56,
								padding: "0 40px",
								fontFamily: "'SF Pro Display', sans-serif",
								fontWeight: 600,
								fontSize: 16,
								boxShadow: "none",
								letterSpacing: "-0.01em",
							}}
						>
							выбрать свой WOW!
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

export function ProjectDetailsSection() {
	const [dimensionsEdited, setDimensionsEdited] = useState(false);
	const [height, setHeight] = useState<number | null>(null);
	const [length, setLength] = useState<number | null>(null);
	const [calcResult, setCalcResult] = useState<{
		area: number;
		panels: number;
		price: number;
	} | null>(null);
	const displayedResult =
		calcResult ??
		(!dimensionsEdited ? { area: 12, panels: 134, price: 119260 } : null);
	const handleCalculate = async () => {
		if (!height || !length) return;
		try {
			const res = await fetch("/api/quick-calculate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ height_m: height, length_m: length }),
			});
			if (!res.ok) throw new Error("Calculation failed");
			const data = await res.json();
			setCalcResult({
				area: data.wall_area,
				panels: data.panels_estimate,
				price: data.price_from,
			});
		} catch (err) {
			console.error("quick-calculate error:", err);
		}
	};
	return (
		<section
			id="project-details"
			className="project-details"
			style={{ background: LIGHT_BG, ...SECTION_PADDING, paddingBottom: 32 }}
		>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					variants={fadeUpVariants}
					custom={0}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 48,
					}}
				>
					<h2
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: "clamp(40px, 6vw, 80px)",
							fontWeight: 700,
							color: DARK,
							margin: 0,
							letterSpacing: "-0.03em",
							textAlign: "center",
						}}
					>
						Ваш проект. В деталях.
					</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1.35fr 1fr",
							gap: 20,
							width: "100%",
						}}
						className="project-grid"
					>
						<motion.div
							className="project-detail-card"
							variants={fadeUpVariants}
							custom={1}
							style={{
								background: "#fff",
								borderRadius: CARD_RADIUS,
								padding: "32px",
								display: "flex",
								flexDirection: "column",
								gap: 20,
								boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
								border: `1px solid ${SUBTLE_BORDER}`,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontWeight: 700,
									fontSize: 18,
									color: DARK,
								}}
							>
								Точный расчёт
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
									color: GRAY_TEXT,
									lineHeight: 1.6,
								}}
							>
								Введите параметры Вашей стены и система определит необходимое
								количество панелей
							</span>
							<div
								style={{ display: "flex", flexDirection: "column", gap: 12 }}
							>
								<div>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 12,
											fontWeight: 600,
											color: GRAY_TEXT,
											display: "block",
											marginBottom: 4,
										}}
									>
										Высота (м)
									</span>
									<InputNumber
										value={height}
										onChange={(v) => {
											setHeight(v as number | null);
											setDimensionsEdited(true);
											setCalcResult(null);
										}}
										min={0.1}
										max={10}
										step={0.1}
										style={{ width: "100%", borderRadius: 10 }}
										placeholder="3.0"
									/>
								</div>
								<div>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 12,
											fontWeight: 600,
											color: GRAY_TEXT,
											display: "block",
											marginBottom: 4,
										}}
									>
										Длина (м)
									</span>
									<InputNumber
										value={length}
										onChange={(v) => {
											setLength(v as number | null);
											setDimensionsEdited(true);
											setCalcResult(null);
										}}
										min={0.1}
										max={50}
										step={0.1}
										style={{ width: "100%", borderRadius: 10 }}
										placeholder="4.0"
									/>
								</div>
								<Button
									onClick={handleCalculate}
									style={{
										background:
											"linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
										color: "#fff",
										border: "none",
										borderRadius: PILL_RADIUS,
										height: 44,
										fontFamily: "'SF Pro Display', sans-serif",
										fontWeight: 600,
										boxShadow: "none",
									}}
								>
									Рассчитать
								</Button>
							</div>
							{displayedResult && (
								<div
									role="status"
									aria-label={calcResult ? "Результат расчёта" : "Демо-расчёт"}
									style={{
										background: LIGHT_BG,
										borderRadius: 12,
										padding: "16px",
										marginTop: "auto",
										display: "flex",
										flexDirection: "column",
										gap: 8,
									}}
								>
									{!calcResult && (
										<div
											style={{
												fontSize: 12,
												color: GRAY_TEXT,
												marginBottom: 4,
											}}
										>
											<strong>Демо-расчёт</strong>
											<br />
											Пример стены 3 × 4 м
										</div>
									)}

									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											fontWeight: 600,
											color: GRAY_TEXT,
										}}
									>
										Площадь:{" "}
										<strong style={{ color: DARK }}>
											{displayedResult.area} м²
										</strong>
									</span>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											fontWeight: 600,
											color: GRAY_TEXT,
										}}
									>
										Панелей:{" "}
										<strong style={{ color: DARK }}>
											{displayedResult.panels} шт
										</strong>
									</span>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											fontWeight: 600,
											color: GRAY_TEXT,
										}}
									>
										Цена от:{" "}
										<strong style={{ color: ACCENT }}>
											{displayedResult.price.toLocaleString("ru-RU")} руб.
										</strong>
									</span>
								</div>
							)}
						</motion.div>
						<motion.div
							className="project-detail-card"
							variants={fadeUpVariants}
							custom={2}
							style={{
								background: "#fff",
								borderRadius: CARD_RADIUS,
								padding: "32px",
								display: "flex",
								flexDirection: "column",
								gap: 20,
								boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
								border: `1px solid ${SUBTLE_BORDER}`,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontWeight: 700,
									fontSize: 18,
									color: DARK,
								}}
							>
								Вдохновение для Вашей стены
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
									color: GRAY_TEXT,
									lineHeight: 1.6,
								}}
							>
								Меняйте фактуру — меняйте восприятие. Реальные решения из наших
								пространств.
							</span>
							<ProjectSpacesSlider />
						</motion.div>
						<motion.div
							className="project-detail-card"
							variants={fadeUpVariants}
							custom={3}
							style={{
								background: "#fff",
								borderRadius: CARD_RADIUS,
								padding: "32px",
								display: "flex",
								flexDirection: "column",
								gap: 20,
								boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
								border: `1px solid ${SUBTLE_BORDER}`,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontWeight: 700,
									fontSize: 18,
									color: DARK,
								}}
							>
								Виртуальная примерка
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
									color: GRAY_TEXT,
									lineHeight: 1.6,
								}}
							>
								Готовы увидеть это на своей стене? Загрузите фото и посмотрите
								как изменится Ваш интерьер
							</span>
							<HomeConfiguratorUpload />
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

const ctaBannerStyles = `
	.home-cta-title br {
		display: none;
	}
	@media (max-width: 768px) {
		.home-cta-section { padding: 24px 16px 56px !important; }
		.home-cta-card {
			padding: 40px 20px !important;
			border-radius: 20px !important;
			gap: 22px !important;
		}
		.home-cta-title {
			white-space: normal !important;
			font-size: clamp(30px, 9vw, 40px) !important;
			line-height: 1.12 !important;
			letter-spacing: -0.035em !important;
		}
		.home-cta-title br {
			display: block;
		}
		.home-cta-lead {
			font-size: 15px !important;
			line-height: 1.5 !important;
		}
		.home-cta-button {
			font-size: 15px !important;
			padding: 0 28px !important;
		}
	}
`;

export function CTABannerSection({ onCatalog }: { onCatalog: () => void }) {
	return (
		<>
			<style>{ctaBannerStyles}</style>
			<section
				className="home-cta-section"
				style={{ background: LIGHT_BG, padding: "32px 24px 100px" }}
			>
				<div style={{ ...MAX_WIDTH }}>
					<motion.div
						className="home-cta-card"
						initial="hidden"
						whileInView="visible"
						viewport={{ once: true, amount: 0.3 }}
						variants={fadeUpVariants}
						custom={0}
						style={{
							background: "#fff",
							borderRadius: CARD_RADIUS,
							padding: "80px 56px",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: 28,
							textAlign: "center",
							boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
							border: `1px solid ${SUBTLE_BORDER}`,
							position: "relative",
							overflow: "hidden",
						}}
					>
						<div style={{ textAlign: "center" }}>
							<h2
								className="home-cta-title"
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: "clamp(40px, 6vw, 80px)",
									fontWeight: 700,
									color: DARK,
									margin: 0,
									lineHeight: 1.15,
									letterSpacing: "-0.03em",
									whiteSpace: "nowrap",
								}}
							>
								Начните <br />
								обновление.
							</h2>
							<p
								className="home-cta-lead"
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 18,
									fontWeight: 600,
									color: GRAY_TEXT,
									margin: "12px auto 0",
									textAlign: "center",
									lineHeight: 1.6,
								}}
							>
								Присоединяйтесь к новой культуре
								<br />
								взаимодействия с пространством
							</p>
						</div>
						<Button
							className="home-cta-button"
							onClick={onCatalog}
							size="large"
							style={{
								background: "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
								color: "#fff",
								border: "none",
								borderRadius: PILL_RADIUS,
								height: 56,
								padding: "0 36px",
								fontFamily: "'SF Pro Display', sans-serif",
								fontWeight: 600,
								fontSize: 16,
								boxShadow: "none",
								letterSpacing: "-0.01em",
							}}
						>
							Начать обновление
						</Button>
					</motion.div>
				</div>
			</section>
		</>
	);
}

export default function HomePage() {
	const navigate = useNavigate();
	const handleCatalog = () => navigate("/catalog");
	return (
		<div style={{ fontFamily: "'SF Pro Display', sans-serif" }}>
			<PageMeta
				title="Wonder Wow Wall — 3D-панели для стен"
				description="Купить 3D-панели для стен с доставкой и монтажом. 200+ дизайнов, гарантия 5 лет, рассрочка 0%."
			/>
			<HeroPreloadLinks />
			<HeroSection onCatalog={handleCatalog} />
			<HowItWorksSection />
			<ServiceBannerSection />
			<TechSection />
			<PanelGridSection onCatalog={handleCatalog} />
			<ProjectDetailsSection />
			<CTABannerSection onCatalog={handleCatalog} />
			<style>{`
				@media (max-width: 768px) {
					.tech-grid { grid-template-columns: 1fr !important; }
					.panel-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
					@media (max-width: 480px) { .panel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
					.project-grid { grid-template-columns: 1fr !important; }
				}
			`}</style>
		</div>
	);
}
