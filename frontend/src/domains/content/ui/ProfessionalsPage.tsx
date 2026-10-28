import React, { useState } from "react";
import { Button, Card } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
	FolderOutlined,
	ThunderboltOutlined,
	SafetyCertificateOutlined,
	TeamOutlined,
	ToolOutlined,
	TrophyOutlined,
} from "@ant-design/icons";

const ACCENT = "#4CAF50";
const DARK = "#1D1D1F";
const GRAY = "#6E6E73";
const LIGHT_BG = "#F5F5F7";

const FONT = "'SF Pro Display', sans-serif";
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1200, margin: "0 auto" };

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

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection() {
	const navigate = useNavigate();
	const [hqReady, setHqReady] = useState(false);
	return (
		<section
			style={{
				background: DARK,
				padding: "120px 24px 100px",
				minHeight: "min(800px, 100vh)",
				display: "flex",
				alignItems: "center",
				position: "relative",
				overflow: "hidden",
			}}
		>
			<video autoPlay muted loop playsInline preload="auto" poster="/herovideo/hero-poster.jpg" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hqReady ? 0 : 1, transition: "opacity .6s ease" }}>
				<source src="/herovideo/hero1-720.mp4" type="video/mp4" />
			</video>
			<video muted loop playsInline preload="auto" poster="/herovideo/hero-poster.jpg" aria-hidden="true" onCanPlay={(event) => {
				const video = event.currentTarget;
				video.muted = true;
				void video.play().then(() => setHqReady(true)).catch(() => {});
			}} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: hqReady ? 1 : 0, transition: "opacity .6s ease" }}>
				<source src="/herovideo/IMG_6429.MP4" type="video/mp4" />
			</video>
			<div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.45), rgba(0,0,0,.32) 55%, rgba(0,0,0,.60))" }} />
			<div style={{ ...MAX_WIDTH, position: "relative", zIndex: 1, width: "100%" }}>
				<motion.div
					variants={stagger}
					initial={false}
					animate="visible"
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						gap: 28,
					}}
				>
					<motion.span
						variants={fadeUp}
						custom={0}
						style={{
							fontFamily: FONT,
							fontSize: 12,
							fontWeight: 600,
							color: "#fff",
							textTransform: "uppercase",
							letterSpacing: "3px",
						}}
					>
						B2B-сегмент
					</motion.span>
					<motion.h1
						variants={fadeUp}
						custom={1}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(36px, 5vw, 64px)",
							fontWeight: 700,
							color: "#fff",
							margin: 0,
							lineHeight: 1.1,
							letterSpacing: "-0.03em",
							maxWidth: 900,
						}}
					>
						Создавайте пространства, которые могут меняться вместе с клиентом.
					</motion.h1>
					<motion.p
						variants={fadeUp}
						custom={2}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(16px, 1.8vw, 20px)",
							fontWeight: 500,
							color: "rgba(255,255,255,0.75)",
							margin: 0,
							lineHeight: 1.65,
							maxWidth: 700,
						}}
					>
						WONDER WOW WALL открывает новый подход к работе с интерьером.
						<br />
						Вместо разового ремонта – обновляемая система.
					</motion.p>
					<motion.div
						variants={fadeUp}
						custom={3}
						style={{ display: "flex", gap: 12, marginTop: 8 }}
					>
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
							Открыть каталог
						</Button>
						<Button
							size="large"
							onClick={() => navigate("/contacts")}
							style={{
								background: "transparent",
								color: "#fff",
								border: "1.5px solid rgba(255,255,255,0.3)",
								borderRadius: 12,
								height: 52,
								padding: "0 36px",
								fontFamily: FONT,
								fontWeight: 600,
								fontSize: 16,
							}}
						>
							Связаться с нами
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Intro Section ─────────────────────────────────────────────────────────────
const introStyles = `
.pro-intro { background:#f5f5f7; padding:72px 24px; font-family:'SF Pro Display',sans-serif; }
.pro-intro-grid { max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1.12fr 1fr; gap:64px; align-items:center; }
.pro-intro-label { display:flex; align-items:center; gap:10px; font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#2e7d32; margin-bottom:24px; }
.pro-intro-label::before { content:''; width:24px; height:2px; background:#4caf50; }
.pro-intro-title { margin:0 0 22px; font-size:clamp(30px,3.4vw,46px); line-height:1.12; font-weight:650; letter-spacing:-.035em; color:#1d1d1f; }
.pro-intro-lead { margin:0; max-width:480px; font-size:17px; line-height:1.65; color:#6e6e73; }
.pro-intro-cards { display:grid; gap:16px; }
.pro-intro-card { background:#fff; border:1px solid rgba(0,0,0,.045); border-radius:24px; padding:28px 30px; }
.pro-intro-card-top { display:flex; gap:12px; align-items:center; margin-bottom:14px; }
.pro-intro-number { width:34px; height:34px; border-radius:11px; display:grid; place-items:center; background:#edf5ec; color:#2e7d32; font-size:11px; font-weight:700; }
.pro-intro-card h3 { margin:0; font-size:19px; font-weight:600; letter-spacing:-.02em; color:#1d1d1f; }
.pro-intro-card p { margin:0; font-size:15px; line-height:1.65; color:#6e6e73; }
@media(max-width:800px) { .pro-intro-grid { grid-template-columns:1fr; gap:30px; } .pro-intro { padding:48px 20px; } .pro-intro-lead { max-width:620px; } .pro-intro-card { padding:24px; border-radius:20px; } }
`;
export function IntroSection() {
	return (
		<section className="pro-intro" aria-label="Возможности для профессионалов">
			<style>{introStyles}</style>
			<div className="pro-intro-grid">
				<div>
					<div className="pro-intro-label">WONDER WOW WALL · Профессионалам</div>
					<h2 className="pro-intro-title">Архитектурная эстетика,<br />способная меняться</h2>
					<p className="pro-intro-lead">Архитектурная эстетика, способная меняться вместе с пространством, сохраняя высокую скорость реализации и предсказуемость монтажа.</p>
				</div>
				<div className="pro-intro-cards">
					<article className="pro-intro-card">
						<div className="pro-intro-card-top"><span className="pro-intro-number" aria-hidden="true">01</span><h3>Для проектов любого масштаба</h3></div>
						<p>Решения WONDER WOW WALL одинаково эффективно работают на частных, коммерческих и муниципальных объектах.</p>
					</article>
					<article className="pro-intro-card">
						<div className="pro-intro-card-top"><span className="pro-intro-number" aria-hidden="true">02</span><h3>Всё для вашей идеи</h3></div>
						<p>Вы получаете доступ к библиотеке материалов, визуализациям, образцам, профессиональным инструментам проектирования и эксклюзивным фактурам.</p>
					</article>
				</div>
			</div>
		</section>
	);
}

// ─── Target Audiences ──────────────────────────────────────────────────────────
const audiences = [
	{
		icon: <TeamOutlined style={{ fontSize: 32, color: ACCENT }} />,
		title: "Дизайн-студиям и архитекторам",
		text: "Создавайте проекты, которые дольше остаются актуальными: гибкий интерьер, который адаптируется под задачи Вашего заказчика за несколько часов и возможность обновления без повторного ремонта.",
	},
	{
		icon: <ToolOutlined style={{ fontSize: 32, color: ACCENT }} />,
		title: "Генеральным подрядчикам и мастерам",
		text: "Работайте с системой, которая сокращает срок реализации, обеспечивает идеальную геометрию и позволяет отказаться от большинства трудоёмких отделочных процессов.",
	},
	{
		icon: <SafetyCertificateOutlined style={{ fontSize: 32, color: ACCENT }} />,
		title: "Проектировщикам общественных пространств",
		text: "Закладывайте в проектно-сметную документацию износостойкие системные решения, соответствующие жёстким эксплуатационным регламентам для школ, клиник, спортивных, социальных и административных объектов.",
	},
];

function AudiencesSection() {
	return (
		<section style={{ background: "#fff", padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={stagger}
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
							Для кого WONDER WOW WALL
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
							gap: 24,
							width: "100%",
						}}
						className="audience-grid"
					>
						{audiences.map((a, i) => (
							<motion.div key={a.title} variants={fadeUp} custom={i + 1}>
								<Card
									style={{
										borderRadius: 20,
										border: "1px solid rgba(0,0,0,0.06)",
										height: "100%",
										boxShadow: "none",
									}}
									styles={{ body: { padding: "36px 32px" } }}
								>
									<div
										style={{
											width: 72,
											height: 72,
											borderRadius: 20,
											background: "rgba(76,175,80,0.08)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											marginBottom: 24,
										}}
									>
										{a.icon}
									</div>
									<h3
										style={{
											fontFamily: FONT,
											fontSize: 20,
											fontWeight: 700,
											color: DARK,
											margin: "0 0 16px",
											lineHeight: 1.3,
										}}
									>
										{a.title}
									</h3>
									<p
										style={{
											fontFamily: FONT,
											fontSize: 15,
											fontWeight: 500,
											color: GRAY,
											margin: 0,
											lineHeight: 1.7,
										}}
									>
										{a.text}
									</p>
								</Card>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Ecosystem Section ─────────────────────────────────────────────────────────
const ecosystemItems = [
	{
		icon: <FolderOutlined style={{ fontSize: 28, color: "#fff" }} />,
		title: "Цифровые сервисы",
		desc: "BIM-модели, 3D-библиотеки текстур для быстрой визуализации, онлайн-калькуляторы для мгновенного расчёта стоимости и конфигураторы для презентации заказчику.",
	},
	{
		icon: <TrophyOutlined style={{ fontSize: 28, color: "#fff" }} />,
		title: "Обучение и шеф-монтаж",
		desc: "Практические мастер-классы для дизайнеров и технические курсы для строительных бригад. Мы обучаем Ваших специалистов тонкостям работы с платформой на базе нашего производства.",
	},
	{
		icon: <ThunderboltOutlined style={{ fontSize: 28, color: "#fff" }} />,
		title: "Совместный маркетинг",
		desc: "Для крупных партнёров – разработка персональных брендированных каталогов, запуск эксклюзивных лимитированных коллекций и совместное участие в профильных выставках.",
	},
];

function EcosystemSection() {
	return (
		<section style={{ background: LIGHT_BG, padding: "100px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					variants={stagger}
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
						variants={fadeUp}
						custom={0}
						style={{ textAlign: "center", maxWidth: 700 }}
					>
						<span
							style={{
								fontFamily: FONT,
								fontSize: 12,
								fontWeight: 600,
								color: ACCENT,
								textTransform: "uppercase",
								letterSpacing: "3px",
								display: "block",
								marginBottom: 16,
							}}
						>
							Экосистема поддержки
						</span>
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
							Мы не просто отгружаем материалы – мы сопровождаем Вас на каждом
							этапе реализации проекта
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
							gap: 24,
							width: "100%",
						}}
						className="ecosystem-grid"
					>
						{ecosystemItems.map((item, i) => (
							<motion.div key={item.title} variants={fadeUp} custom={i + 1}>
								<Card
									style={{
										borderRadius: 20,
										border: "none",
										height: "100%",
										background: DARK,
									}}
									styles={{ body: { padding: "36px 32px" } }}
								>
									<div
										style={{
											width: 56,
											height: 56,
											borderRadius: 16,
											background: ACCENT,
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											marginBottom: 24,
										}}
									>
										{item.icon}
									</div>
									<h3
										style={{
											fontFamily: FONT,
											fontSize: 20,
											fontWeight: 700,
											color: "#fff",
											margin: "0 0 16px",
											lineHeight: 1.3,
										}}
									>
										{item.title}
									</h3>
									<p
										style={{
											fontFamily: FONT,
											fontSize: 15,
											fontWeight: 500,
											color: "rgba(255,255,255,0.7)",
											margin: 0,
											lineHeight: 1.7,
										}}
									>
										{item.desc}
									</p>
								</Card>
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Professional community: three product-style cards + independent CTA ──
const pillars = [
	{ icon: ThunderboltOutlined, color: "#4CAF50", text: "Мы создаём среду, где технологии снимают рутину с профессионалов." },
	{ icon: TeamOutlined, color: "#0071E3", text: "Мы формируем профессиональное сообщество вокруг новой категории интерьерных решений." },
	{ icon: FolderOutlined, color: "#009CB0", text: "Мы создаём инфраструктуру для специалистов, которые проектируют интерьеры нового поколения." },
];

function CommunityPillarsSection() {
	return (
		<section className="professional-pillars" aria-label="Наш подход к профессиональному сообществу">
			<div style={{ ...MAX_WIDTH }}>
				<div className="professional-pillars-grid">
					{pillars.map(({ icon: Icon, color, text }, index) => (
						<motion.article key={text} variants={fadeUp} custom={index} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="professional-pillar-card" style={{ '--pillar-accent': color } as React.CSSProperties}>
							<Icon aria-hidden="true" className="professional-pillar-icon" />
							<p>{text}</p>
							<span className="professional-pillar-number" aria-hidden="true">0{index + 1}</span>
						</motion.article>
					))}
				</div>
			</div>
		</section>
	);
}

function FinalCTASection() {
	const navigate = useNavigate();
	return (
		<section className="professional-cta" aria-label="Стать частью сообщества">
			<div style={{ ...MAX_WIDTH }}>
				<motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="professional-cta-inner">
					<h2>Станьте частью профессионального сообщества WONDER WOW WALL</h2>
					<div className="professional-cta-actions">
						<Button size="large" onClick={() => navigate("/contacts")} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: 12, height: 52, padding: "0 36px", fontFamily: FONT, fontWeight: 600, fontSize: 16 }}>Стать партнёром</Button>
						<Button size="large" onClick={() => navigate("/catalog")} style={{ background: "transparent", color: DARK, border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 12, height: 52, padding: "0 36px", fontFamily: FONT, fontWeight: 600, fontSize: 16 }}>Изучить решения</Button>
					</div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProfessionalsPage() {
	return (
		<div style={{ fontFamily: FONT, paddingTop: 48 }}>
			<PageMeta
				title="Профессионалам — WONDER WOW WALL"
				description="B2B-решения для дизайн-студий, подрядчиков и проектировщиков. Создавайте обновляемые интерьеры."
			/>
			<HeroSection />
			<IntroSection />
			<AudiencesSection />
			<EcosystemSection />
			<CommunityPillarsSection />
			<FinalCTASection />
			<style>{`
        .professional-pillars { background: #f5f5f7; padding: 88px 24px; }
        .professional-pillars-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
        .professional-pillar-card { position: relative; min-height: 315px; border-radius: 30px; background: #fff; padding: 38px 32px 68px; display: flex; flex-direction: column; align-items: flex-start; box-shadow: 0 4px 18px rgba(0,0,0,.035); }
        .professional-pillar-icon { color: var(--pillar-accent); font-size: 36px; margin-bottom: 40px; }
        .professional-pillar-card p { font: 650 clamp(21px, 2vw, 30px)/1.25 'SF Pro Display', sans-serif; letter-spacing: -.03em; color: #1d1d1f; margin: 0; }
        .professional-pillar-number { position: absolute; bottom: 26px; right: 30px; font-size: 13px; font-weight: 700; color: var(--pillar-accent); }
        .professional-cta { background: #fff; padding: 96px 24px 110px; }
        .professional-cta-inner { text-align: center; max-width: 880px; margin: auto; }
        .professional-cta h2 { font: 700 clamp(30px, 4vw, 50px)/1.12 'SF Pro Display', sans-serif; letter-spacing: -.035em; color: #1d1d1f; margin: 0 0 36px; }
        .professional-cta-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; }
        @media (max-width: 900px) { .professional-pillars-grid { gap: 12px; } .professional-pillar-card { padding: 28px 22px 60px; min-height: 290px; } }
        @media (max-width: 768px) {
          .professional-pillars-grid { grid-template-columns: 1fr; }
          .professional-pillar-card { min-height: 0; padding: 28px 26px 65px; }
          .professional-pillar-icon { margin-bottom: 22px; }
          .professional-pillars { padding: 64px 16px; }
          .professional-cta { padding: 72px 20px 84px; }
          .audience-grid, .ecosystem-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
		</div>
	);
}
