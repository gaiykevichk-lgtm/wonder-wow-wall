import React from "react";
import { Button } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircleFilled, ArrowRightOutlined } from "@ant-design/icons";

const ACCENT = "#4CAF50";
const DARK = "#1D1D1F";
const GRAY = "#6E6E73";
const LIGHT_BG = "#F5F5F7";

const FONT = "'SF Pro Display', sans-serif";
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1200, margin: "0 auto" };
const HERO_VIDEOS = ["/herovideo/IMG_6429.MP4", "/herovideo/IMG_6431.MP4"];

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUp = {
	hidden: { opacity: 0, y: 32 },
	visible: (i = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.7, ease: EASE, delay: i * 0.12 },
	}),
};
const stagger = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection() {
	const navigate = useNavigate();
	const videoIndex = (window as Window & { __heroIdx?: number }).__heroIdx ?? 0;
	const videoSrc = HERO_VIDEOS[videoIndex] ?? HERO_VIDEOS[0];
	return (
		<section
			style={{
				background: DARK,
				padding: "100px 24px 80px",
				position: "relative",
				overflow: "hidden",
			}}
		>
			<video
				autoPlay muted loop playsInline preload="auto" aria-hidden="true"
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
			>
				<source src={videoSrc} type="video/mp4" />
			</video>
			<div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0.62) 100%)", pointerEvents: "none" }} />
			<div style={{ ...MAX_WIDTH, position: "relative", zIndex: 1 }}>
				<motion.div
					variants={stagger}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						gap: 28,
					}}
				>
					<motion.h1
						variants={fadeUp}
						custom={0}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(36px, 5vw, 60px)",
							fontWeight: 700,
							color: "#fff",
							margin: 0,
							lineHeight: 1.1,
							letterSpacing: "-0.03em",
							maxWidth: 900,
						}}
					>
						Обновление пространства больше не похоже на ремонт.
					</motion.h1>
					<motion.p
						variants={fadeUp}
						custom={1}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(16px, 1.8vw, 20px)",
							fontWeight: 500,
							color: "rgba(255,255,255,0.8)",
							margin: 0,
							lineHeight: 1.7,
							maxWidth: 680,
						}}
					>
						Мы убрали всё лишнее: сложные расчёты, поиск подрядчиков,
						строительный мусор и недели ожидания.
						<br />
						Вы выбираете дизайн. Всё остальное уже предусмотрено WONDER WOW WALL
					</motion.p>
					<motion.div variants={fadeUp} custom={2} style={{ marginTop: 8 }}>
						<Button
							size="large"
							onClick={() => navigate("/catalog")}
							style={{
								background: ACCENT,
								color: "#fff",
								border: "none",
								borderRadius: 12,
								height: 52,
								padding: "0 36px",
								fontFamily: FONT,
								fontWeight: 600,
								fontSize: 16,
							}}
						>
							Выбрать решение
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Steps ────────────────────────────────────────────────────────────────────
const steps = [
	{
		num: "01",
		title: "Выбираете решение",
		bold: "Каталог, готовые пространства или Конструктор",
		text: "Найдите стиль, который подходит именно Вам",
	},
	{
		num: "02",
		title: "Подтверждаете проект",
		bold: "Автоматический расчёт параметров",
		text: "Укажите размеры стены, а система автоматически рассчитает необходимое количество материалов и итоговую стоимость",
	},
	{
		num: "03",
		title: "Получаете готовое пространство",
		bold: "Монтаж универсальной платформы",
		text: "Мы доставляем комплект и организуем монтаж платформы. Она фиксируется на стене один раз и становится постоянным фундаментом для будущих обновлений",
	},
	{
		num: "04",
		title: "Меняете, когда захотите",
		bold: "Трансформация пространства",
		text: "Новые панели устанавливаются на существующую платформу за считанные часы — без демонтажа, пыли и традиционного ремонта",
	},
];

function StepsSection() {
	return (
		<section style={{ background: LIGHT_BG, padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={stagger}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					style={{ display: "flex", flexDirection: "column", gap: 64 }}
				>
					<motion.div
						variants={fadeUp}
						custom={0}
						style={{ textAlign: "center" }}
					>
						<h2
							style={{
								fontFamily: FONT,
								fontSize: "clamp(32px, 4vw, 52px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								letterSpacing: "-0.03em",
								lineHeight: 1.15,
							}}
						>
							Как это происходит
						</h2>
					</motion.div>
					<div
						style={{ display: "flex", flexDirection: "column", gap: 0 }}
						className="steps-list"
					>
						{steps.map((step, i) => (
							<motion.div
								key={step.num}
								variants={fadeUp}
								custom={i + 1}
								style={{
									display: "grid",
									gridTemplateColumns: "80px 1fr",
									gap: 32,
									alignItems: "start",
									paddingBottom: 64,
									borderBottom:
										i < steps.length - 1
											? "1px solid rgba(0,0,0,0.06)"
											: "none",
								}}
								className="step-item"
							>
								<span
									style={{
										fontFamily: FONT,
										fontSize: 48,
										fontWeight: 800,
										color: ACCENT,
										lineHeight: 1,
										letterSpacing: "-0.04em",
									}}
								>
									{step.num}
								</span>
								<div style={{ paddingTop: 4 }}>
									<h3
										style={{
											fontFamily: FONT,
											fontSize: "clamp(22px, 2.5vw, 32px)",
											fontWeight: 700,
											color: DARK,
											margin: "0 0 12px",
											lineHeight: 1.2,
										}}
									>
										{step.title}
									</h3>
									<p
										style={{
											fontFamily: FONT,
											fontSize: 16,
											fontWeight: 600,
											color: ACCENT,
											margin: "0 0 10px",
										}}
									>
										{step.bold}
									</p>
									<p
										style={{
											fontFamily: FONT,
											fontSize: 15,
											fontWeight: 500,
											color: GRAY,
											margin: 0,
											lineHeight: 1.7,
											maxWidth: 600,
										}}
									>
										{step.text}
									</p>
								</div>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── We Take Care ─────────────────────────────────────────────────────────────
const cares = [
	{
		title: "Доставка",
		text: "Комплект поставляется полностью готовым к монтажу. Никаких поездок за комплектующими и поиска совместимых элементов.",
	},
	{
		title: "Монтаж",
		text: "Установку выполняют сертифицированные партнёры. Вам не нужно искать подрядчиков и контролировать технические детали процесса.",
	},
	{
		title: "Гарантия",
		text: "Мы отвечаем за качество материалов и работоспособность платформы в соответствии с условиями гарантии.",
	},
	{
		title: "Подписка",
		text: "После установки пространство может продолжать меняться без повторного ремонта. Программа обслуживания открывает доступ к регулярным обновлениям интерьера. Один монтаж. Множество интерьеров.",
	},
];

function WeTakeCareSection() {
	return (
		<section style={{ background: "#fff", padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={stagger}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					style={{ display: "flex", flexDirection: "column", gap: 56 }}
				>
					<motion.div
						variants={fadeUp}
						custom={0}
						style={{ textAlign: "center" }}
					>
						<h2
							style={{
								fontFamily: FONT,
								fontSize: "clamp(32px, 4vw, 52px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								letterSpacing: "-0.03em",
								lineHeight: 1.15,
							}}
						>
							Мы берём это на себя
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
							gap: 24,
						}}
						className="cares-grid"
					>
						{cares.map((care, i) => (
							<motion.div key={care.title} variants={fadeUp} custom={i + 1}>
								<div
									style={{
										padding: "32px 28px",
										borderRadius: 20,
										border: "1px solid rgba(0,0,0,0.06)",
										height: "100%",
									}}
								>
									<div
										style={{
											width: 48,
											height: 48,
											borderRadius: 14,
											background: "rgba(76,175,80,0.1)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											marginBottom: 20,
										}}
									>
										<CheckCircleFilled
											style={{ fontSize: 24, color: ACCENT }}
										/>
									</div>
									<h3
										style={{
											fontFamily: FONT,
											fontSize: 18,
											fontWeight: 700,
											color: DARK,
											margin: "0 0 12px",
										}}
									>
										{care.title}
									</h3>
									<p
										style={{
											fontFamily: FONT,
											fontSize: 14,
											fontWeight: 500,
											color: GRAY,
											margin: 0,
											lineHeight: 1.7,
										}}
									>
										{care.text}
									</p>
								</div>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Video replacing the former text/diagram block ────────────────────────────
function SandwichSection() {
	return (
		<section style={{ background: LIGHT_BG, padding: "clamp(32px, 5vw, 64px) 20px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<video
					autoPlay
					muted
					loop
					playsInline
					preload="metadata"
					aria-label="Видео о системе стеновых панелей WONDER WOW WALL"
					style={{
						display: "block",
						width: "100%",
						maxWidth: 1080,
						aspectRatio: "956 / 720",
						objectFit: "contain",
						margin: "0 auto",
						borderRadius: 20,
						background: "#e8e8e8",
						boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
					}}
				>
					<source src="/videos/simple-panel-IMG_7377-cropped.mp4" type="video/mp4" />
				</video>
			</div>
		</section>
	);
}

// ─── FAQ / Questions ──────────────────────────────────────────────────────────
function QuestionsSection() {
	const navigate = useNavigate();
	return (
		<section style={{ background: "#fff", padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH, maxWidth: 720 }}>
				<motion.div
					variants={stagger}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.3 }}
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 40,
					}}
				>
					<motion.div
						variants={fadeUp}
						custom={0}
						style={{ textAlign: "center" }}
					>
						<h2
							style={{
								fontFamily: FONT,
								fontSize: "clamp(28px, 3.5vw, 44px)",
								fontWeight: 700,
								color: DARK,
								margin: 0,
								letterSpacing: "-0.02em",
								lineHeight: 1.2,
							}}
						>
							Остались вопросы?
						</h2>
					</motion.div>
					<motion.div
						variants={fadeUp}
						custom={1}
						style={{ textAlign: "center" }}
					>
						<p
							style={{
								fontFamily: FONT,
								fontSize: 16,
								fontWeight: 500,
								color: GRAY,
								margin: 0,
								lineHeight: 1.7,
							}}
						>
							Если Вы хотите уточнить особенности Вашего типа стен, обсудить
							индивидуальный проект или получить консультацию по выбору решения
							– наша команда готова помочь.
						</p>
					</motion.div>
					<motion.div variants={fadeUp} custom={2}>
						<Button
							size="large"
							icon={<ArrowRightOutlined />}
							onClick={() => navigate("/contacts")}
							style={{
								background: ACCENT,
								color: "#fff",
								border: "none",
								borderRadius: 12,
								height: 52,
								padding: "0 32px",
								fontFamily: FONT,
								fontWeight: 600,
								fontSize: 16,
							}}
						>
							Написать в поддержку
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SimplePage() {
	return (
		<div style={{ fontFamily: FONT, paddingTop: 48 }}>
			<PageMeta
				title="Просто — WONDER WOW WALL"
				description="Обновление пространства без ремонта. Простой процесс: выбираете, подтверждаете, получаете готовое."
			/>
			<HeroSection />
			<StepsSection />
			<WeTakeCareSection />
			<SandwichSection />
			<QuestionsSection />
			<style>{`
        @media (max-width: 768px) {
          .steps-list { gap: 0 !important; }
          .step-item { grid-template-columns: 60px 1fr !important; gap: 20px !important; padding-bottom: 40px !important; }
          .cares-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
		</div>
	);
}
