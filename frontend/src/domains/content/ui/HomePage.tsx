import React, { useState, useRef } from "react";
import {
	AppstoreOutlined,
	SettingOutlined,
	LockOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { Button, InputNumber } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { useNavigate } from "react-router-dom";
import { products } from "../../catalog/model/data";

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

const CLOUD_HERO_VIDEOS = [
	"/herovideo/IMG_6429.MP4",
	"/herovideo/IMG_6431.MP4",
];
declare let window: Window & { __heroIdx?: number };

export function HeroSection({ onCatalog }: { onCatalog: () => void }) {
	const videoSrc =
		window.__heroIdx !== undefined
			? CLOUD_HERO_VIDEOS[window.__heroIdx as number]
			: CLOUD_HERO_VIDEOS[0];
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
			{videoSrc && (
				<>
					<video
						autoPlay
						muted
						loop
						playsInline
						style={{
							position: "absolute",
							inset: 0,
							width: "100%",
							height: "100%",
							objectFit: "cover",
							zIndex: 0,
						}}
					>
						<source src={videoSrc} type="video/mp4" />
					</video>
					<div
						style={{
							position: "absolute",
							inset: 0,
							background: "rgba(0,0,0,0.55)",
							zIndex: 1,
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
						трансформации пространства.
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
		title: "Выбираете\nновый стиль пространства",
		desc: "Найдите текстуру, которая отражает Вас сегодня",
		video: "Выбираете.MP4",
	},
	{
		num: "2",
		title: "Примеряете\nбудущее на экране смартфона",
		desc: "Загрузите фото и приложение мгновенно впишет новый интерьер в Ваше пространство",
		video: "Примеряете.MP4",
	},
	{
		num: "3",
		title: "Обновляете\nбез пыли и ремонтного хаоса",
		desc: "Мы превратили обновление интерьера в вопрос нескольких часов",
		video: "Обновляете.MP4",
	},
	{
		num: "4",
		title: "Меняете\nоблик пространства когда годно",
		desc: "Одна бесплатная замена уже включена в подписку",
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
						Просто. Быстро. WOW
					</h2>
				</motion.div>
			</div>
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "32px 24px 0",
				}}
			>
				<span
					style={{
						fontFamily: "'SF Pro Display', sans-serif",
						fontSize: 13,
						color: "rgba(0,0,0,0.35)",
						letterSpacing: "0.02em",
					}}
				>
					{activeIndex + 1} / {steps.length} — свайпните влево
				</span>
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
							minWidth: "100vw",
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
								gap: 20,
							}}
						>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									fontWeight: 600,
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
									color: GRAY_TEXT,
									lineHeight: 1.65,
									margin: 0,
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

export function ServiceBannerSection() {
	return (
		<section
			style={{ background: "#fff", padding: "100px 24px", overflow: "hidden" }}
		>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
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
								fontWeight: 600,
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
						variants={fadeUpVariants}
						custom={3}
						style={{
							fontFamily: "'SF Pro Display', sans-serif",
							fontSize: 18,
							color: GRAY_TEXT,
							margin: 0,
							lineHeight: 1.65,
							maxWidth: 520,
							whiteSpace: "pre-line",
						}}
					>
						Мы создали будущее, в котором интерьер меняется без традиционного
						ремонта
					</motion.p>

					{/* Apple-style feature cards */}
					<motion.div
						variants={fadeUpVariants}
						custom={3.5}
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(2, 1fr)",
							gap: 20,
							width: "100%",
							maxWidth: 1000,
							margin: "24px 0 0",
						}}
					>
						<div
							style={{
								background: "#f5f5f7",
								borderRadius: 24,
								padding: "48px 40px",
								textAlign: "center",
							}}
						>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 15,
									fontWeight: 500,
									color: ACCENT,
									textTransform: "uppercase",
									letterSpacing: "3px",
									marginBottom: 24,
								}}
							>
								Цифровой интеллект
							</div>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 32,
									fontWeight: 700,
									color: DARK,
									lineHeight: 1.2,
									marginBottom: 12,
									letterSpacing: "-0.02em",
								}}
							>
								Ваш смартфон
								<br />
								Ваш дизайнер
							</div>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 19,
									color: GRAY_TEXT,
									lineHeight: 1.5,
								}}
							>
								мгновенная визуализация решений
							</div>
						</div>
						<div
							style={{
								background: "#f5f5f7",
								borderRadius: 24,
								padding: "48px 40px",
								textAlign: "center",
							}}
						>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 15,
									fontWeight: 500,
									color: ACCENT,
									textTransform: "uppercase",
									letterSpacing: "3px",
									marginBottom: 24,
								}}
							>
								Экосистема полного цикла
							</div>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 32,
									fontWeight: 700,
									color: DARK,
									lineHeight: 1.2,
									marginBottom: 12,
									letterSpacing: "-0.02em",
								}}
							>
								Единый механизм трансформации
							</div>
							<div
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 19,
									color: GRAY_TEXT,
									lineHeight: 1.5,
								}}
							>
								безупречная реализация обновлений
							</div>
						</div>
					</motion.div>

					<motion.div
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
								color: GRAY_TEXT,
							}}
						>
							новый стандарт трансформации пространства
						</span>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

const techPoints = [
	{
		icon: <SettingOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Универсальная платформа монтажа",
		desc: "адаптирована для большинства современных поверхностей",
	},
	{
		icon: <LockOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Запатентованная система креплений",
		desc: "обеспечивает быструю замену панелей",
	},
	{
		icon: <AppstoreOutlined style={{ fontSize: 28, color: DARK }} />,
		title: "Безграничность фактур",
		desc: "Дерево. Металл. Текстиль. Кожа. Камень.\nПространство приобретает характер",
	},
];

export function TechSection() {
	return (
		<section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
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
						gap: 56,
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
							Технологии вашей свободы
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
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
							fontSize: 16,
							color: GRAY_TEXT,
							margin: 0,
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
	const first4 = products.slice(0, 4);
	return (
		<section style={{ background: "#fff", ...SECTION_PADDING }}>
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
							Время выбирать
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${Math.min(first4.length, 4)}, minmax(200px, 280px))`,
							gap: 20,
							width: "100%",
							justifyContent: "center",
						}}
						className="panel-grid"
					>
						{first4.map((product, i) => (
							<motion.div
								key={product.id}
								variants={fadeUpVariants}
								custom={i + 1}
								style={{
									borderRadius: CARD_RADIUS,
									overflow: "hidden",
									aspectRatio: "3 / 4",
									position: "relative",
									boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
								}}
							>
								<img
									src={product.image}
									alt={product.name}
									style={{
										width: "100%",
										height: "100%",
										objectFit: "cover",
										display: "block",
									}}
								/>
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
										{product.name}
									</span>
								</div>
							</motion.div>
						))}
					</div>
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

const lifeScenarios = [
	{
		image: "/scenarios/гостинная.jpg",
		label: "Гостиная",
	},
	{
		image: "/scenarios/спальня.jpg",
		label: "Спальня",
	},
	{
		image: "/scenarios/зона_тв.jpg",
		label: "Зона ТВ",
	},
	{
		image: "/scenarios/детская.jpg",
		label: "Детская",
	},
	{
		image: "/scenarios/кухня.jpg",
		label: "Кухня",
	},
	{
		image: "/scenarios/санузел.jpg",
		label: "Санузел",
	},
];

export function ProjectDetailsSection() {
	const navigate = useNavigate();
	const [height, setHeight] = useState<number | null>(null);
	const [length, setLength] = useState<number | null>(null);
	const [calcResult, setCalcResult] = useState<{
		area: number;
		panels: number;
		price: number;
	} | null>(null);
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
		<section style={{ background: LIGHT_BG, ...SECTION_PADDING }}>
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
						Ваш проект. В деталях
					</h2>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
							gap: 32,
							width: "100%",
						}}
						className="project-grid"
					>
						<motion.div
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
											color: GRAY_TEXT,
											display: "block",
											marginBottom: 4,
										}}
									>
										Высота (м)
									</span>
									<InputNumber
										value={height}
										onChange={(v) => setHeight(v as number | null)}
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
											color: GRAY_TEXT,
											display: "block",
											marginBottom: 4,
										}}
									>
										Длина (м)
									</span>
									<InputNumber
										value={length}
										onChange={(v) => setLength(v as number | null)}
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
							{calcResult && (
								<div
									style={{
										background: LIGHT_BG,
										borderRadius: 12,
										padding: "16px",
										display: "flex",
										flexDirection: "column",
										gap: 8,
									}}
								>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											color: GRAY_TEXT,
										}}
									>
										Площадь:{" "}
										<strong style={{ color: DARK }}>
											{calcResult.area} м2
										</strong>
									</span>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											color: GRAY_TEXT,
										}}
									>
										Панелей:{" "}
										<strong style={{ color: DARK }}>
											{calcResult.panels} шт
										</strong>
									</span>
									<span
										style={{
											fontFamily: "'SF Pro Display'",
											fontSize: 13,
											color: GRAY_TEXT,
										}}
									>
										Цена от:{" "}
										<strong style={{ color: ACCENT }}>
											{calcResult.price.toLocaleString("ru-RU")} руб.
										</strong>
									</span>
								</div>
							)}
						</motion.div>
						<motion.div
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
								Сценарии жизни
							</span>
							<span
								style={{
									fontFamily: "'SF Pro Display', sans-serif",
									fontSize: 13,
									color: GRAY_TEXT,
									lineHeight: 1.6,
								}}
							>
								Сотни визуализаций — для разного света и объёма
							</span>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(2, 1fr)",
									gap: 12,
								}}
							>
								{lifeScenarios.map((s) => (
									<div
										key={s.label}
										style={{
											display: "flex",
											flexDirection: "column",
											gap: 0,
											borderRadius: 12,
											overflow: "hidden",
											background: "#F5F5F5",
										}}
									>
										<img
											src={s.image}
											alt={s.label}
											style={{
												width: "100%",
												height: 80,
												objectFit: "cover",
												display: "block",
											}}
										/>
										<span
											style={{
												fontFamily: "'SF Pro Display', sans-serif",
												fontSize: 11,
												color: DARK,
												fontWeight: 600,
												textAlign: "center",
											}}
										>
											{s.label}
										</span>
									</div>
								))}
							</div>
						</motion.div>
						<motion.div
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
									color: GRAY_TEXT,
									lineHeight: 1.6,
								}}
							>
								Готовы увидеть это на своей стене? Загрузите фото и посмотрите
								как изменится Ваш интерьер
							</span>
							<div
								style={{
									flex: 1,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<Button
									onClick={() => navigate("/visualizer")}
									size="large"
									style={{
										background:
											"linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)",
										color: "#fff",
										border: "none",
										borderRadius: PILL_RADIUS,
										height: 56,
										padding: "0 40px",
										fontFamily: "'SF Pro Display', sans-serif",
										fontWeight: 600,
										fontSize: 17,
										boxShadow: "none",
										letterSpacing: "-0.01em",
									}}
								>
									WOW!
								</Button>
							</div>
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

export function CTABannerSection({ onCatalog }: { onCatalog: () => void }) {
	return (
		<section style={{ background: LIGHT_BG, padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
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
							Начните обновление
						</h2>
						<p
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: 18,
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
						<p
							style={{
								fontFamily: "'SF Pro Display', sans-serif",
								fontSize: 16,
								color: GRAY_TEXT,
								margin: "8px auto 0",
								textAlign: "center",
								lineHeight: 1.6,
							}}
						>
							Ремонт перестал быть событием
							<br />
							Вам нужно только выбрать настроение.
						</p>
					</div>
					<Button
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
			<HeroSection onCatalog={handleCatalog} />
			<HowItWorksSection />
			<ServiceBannerSection />
			<TechSection />
			<PanelGridSection onCatalog={handleCatalog} />
			<ProjectDetailsSection />
			<CTABannerSection onCatalog={handleCatalog} />
			<style>{`@media (max-width: 768px) { .tech-grid { grid-template-columns: 1fr !important; } .panel-grid { grid-template-columns: repeat(2, 1fr) !important; } .project-grid { grid-template-columns: 1fr !important; } }`}</style>
		</div>
	);
}
