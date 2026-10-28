import React from "react";
import { Card, Button, Tag } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import {
	CheckOutlined,
	ArrowRightOutlined,
	CrownOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useSubscriptionPlansList } from "../../../shared/api/shopApi";
import { useSubscriptionStore } from "../model/subscriptionStore";
import type { SubscriptionPlan } from "../model/types";

const ACCENT = "#4CAF50";
const DARK = "#1D1D1F";
const GRAY_TEXT = "#6E6E73";
const LIGHT_BG = "#F5F5F7";
const FONT = "'SF Pro Display', sans-serif";
const MAX_WIDTH: React.CSSProperties = { maxWidth: 1200, margin: "0 auto" };
const HERO_VIDEOS = ["/herovideo/IMG_6429.MP4", "/herovideo/IMG_6431.MP4"];

const EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUp = {
	hidden: { opacity: 0, y: 28 },
	visible: (i = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: EASE, delay: i * 0.1 },
	}),
};
const stagger = {
	hidden: {},
	visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Hero Section ─────────────────────────────────────────────────────────────
function SubscriptionHero() {
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
				autoPlay
				muted
				loop
				playsInline
				preload="auto"
				aria-hidden="true"
				style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
			>
				<source src={videoSrc} type="video/mp4" />
			</video>
			<div
				aria-hidden="true"
				style={{
					position: "absolute",
					inset: 0,
					background: "linear-gradient(180deg, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0.62) 100%)",
					pointerEvents: "none",
				}}
			/>
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
						gap: 24,
					}}
				>
					<motion.span
						variants={fadeUp}
						custom={0}
						style={{
							fontFamily: FONT,
							fontSize: 12,
							fontWeight: 600,
							color: ACCENT,
							textTransform: "uppercase",
							letterSpacing: "3px",
						}}
					>
						Подписка
					</motion.span>
					<motion.h1
						variants={fadeUp}
						custom={1}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(32px, 5vw, 56px)",
							fontWeight: 700,
							color: "#fff",
							margin: 0,
							lineHeight: 1.1,
							letterSpacing: "-0.03em",
							maxWidth: 800,
						}}
					>
						Свобода обновления. Стены как сервис.
					</motion.h1>
					<motion.p
						variants={fadeUp}
						custom={2}
						style={{
							fontFamily: FONT,
							fontSize: "clamp(16px, 1.8vw, 19px)",
							fontWeight: 500,
							color: "rgba(255,255,255,0.8)",
							margin: 0,
							lineHeight: 1.7,
							maxWidth: 640,
						}}
					>
						WONDER WOW WALL меняет философию владения интерьером.
						<br />
						Мы не продаём панели. Мы предоставляем доступ к интерьеру,
						<br />
						который может меняться вместе с Вами.
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Benefits ─────────────────────────────────────────────────────────────────
const benefits = [
	{
		title: ["Свобода действий.", "Начните сейчас."],
		text: ["Традиционный ремонт требует крупных единовременных вложений.", "Мы превращаем их в комфортные регулярные платежи.", "Интерьер становится доступен сразу, без необходимости откладывать реализацию проекта на годы вперёд."],
	},
	{
		title: ["Свобода решений.", "Право передумать."],
		text: ["Интерьер больше не обязан оставаться неизменным только потому, что когда-то был выбран.", "Если дизайн перестал вдохновлять или изменились задачи пространства, его можно обновить без нового ремонта.", "Одно комплексное обновление интерьера ежегодно уже включено в программу обслуживания."],
	},
	{
		title: ["Свобода владения.", "Пространство на ваших условиях."],
		text: ["Подписка не создаёт кредитной нагрузки и не требует долгосрочных финансовых решений.", "Вы пользуетесь сервисом ровно столько, сколько он нужен именно Вам."],
	},
];

function BenefitsSection() {
	return (
		<section style={{ background: LIGHT_BG, padding: "80px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
						gap: 24,
					}}
					className="benefits-grid"
				>
					{benefits.map((b, i) => (
						<motion.div
							key={b.title[0]}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, amount: 0.3 }}
							variants={fadeUp}
							custom={i}
						>
							<Card
								style={{
									borderRadius: 20,
									border: "none",
									height: "100%",
									boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
								}}
								styles={{ body: { padding: "28px 26px" } }}
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
										marginBottom: 16,
									}}
								>
									<CheckOutlined style={{ fontSize: 22, color: ACCENT }} />
								</div>
								<h3
									style={{
										fontFamily: FONT,
										fontSize: b.title[0] === "Свобода владения." ? "clamp(14px, 1.35vw, 18px)" : 18,
										fontWeight: 700,
										color: DARK,
										margin: "0 0 12px",
										lineHeight: 1.3,
									}}
								>
									{b.title.map((line) => <span key={line} style={{ display: "block" }}>{line}</span>)}
								</h3>
								<p
									style={{
										fontFamily: FONT,
										fontSize: 14,
										fontWeight: 500,
										color: GRAY_TEXT,
										margin: 0,
										lineHeight: 1.55,
									}}
								>
									{b.text.map((sentence) => <span key={sentence} style={{ display: "block" }}>{sentence}</span>)}
								</p>
							</Card>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}

// ─── Quote ───────────────────────────────────────────────────────────────────
function QuoteSection() {
	return (
		<section aria-label="Философия подписки" style={{ background: "#fff", padding: "clamp(56px, 8vw, 96px) 24px" }}>
			<div style={{ ...MAX_WIDTH, maxWidth: 900 }}>
				<motion.blockquote
					initial={{ opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, amount: 0.5 }}
					transition={{ duration: 0.7 }}
					style={{
						textAlign: "center",
						padding: "clamp(32px, 6vw, 64px) clamp(24px, 5vw, 64px)",
						borderRadius: 24,
						border: "1px solid rgba(76,175,80,0.16)",
						background: LIGHT_BG,
						margin: 0,
					}}
				>
					<span aria-hidden="true" style={{ display: "block", width: 48, height: 3, borderRadius: 3, background: ACCENT, margin: "0 auto 24px" }} />
					<p
						style={{
							fontFamily: FONT,
							fontSize: "clamp(24px, 3.2vw, 36px)",
							fontWeight: 600,
							color: DARK,
							margin: 0,
							lineHeight: 1.35,
							letterSpacing: "-0.025em",
						}}
					>
						Вы инвестируете только в свои ощущения от пространства и возможность менять его по первому желанию
					</p>
				</motion.blockquote>
			</div>
		</section>
	);
}

// ─── Pricing Plans ────────────────────────────────────────────────────────────
const PlanCard: React.FC<{
	plan: SubscriptionPlan;
	index: number;
	isActive: boolean;
	onSelect: (id: string) => void;
}> = ({ plan, index, isActive, onSelect }) => (
	<motion.div variants={fadeUp} custom={index} style={{ position: "relative" }}>
		<Card
			style={{
				borderRadius: 20,
				border: plan.popular
					? `2px solid ${DARK}`
					: isActive
						? `2px solid ${ACCENT}`
						: "1px solid rgba(0,0,0,0.06)",
				boxShadow: "none",
				background: plan.popular ? DARK : "#fff",
				height: "100%",
				transform: plan.popular ? "scale(1.03)" : "scale(1)",
				transition: "transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)",
			}}
			styles={{ body: { padding: "36px 28px" } }}
		>
			{plan.popular && (
				<Tag
					style={{
						position: "absolute",
						top: -14,
						left: "50%",
						transform: "translateX(-50%)",
						background: ACCENT,
						color: "#fff",
						border: "none",
						borderRadius: 10,
						fontFamily: FONT,
						fontWeight: 600,
						fontSize: 12,
						padding: "4px 16px",
						whiteSpace: "nowrap",
					}}
				>
					Популярный
				</Tag>
			)}
			{isActive && (
				<Tag
					icon={<CrownOutlined />}
					style={{
						position: "absolute",
						top: -14,
						right: 16,
						background: ACCENT,
						color: "#fff",
						border: "none",
						borderRadius: 10,
						fontFamily: FONT,
						fontWeight: 600,
						fontSize: 12,
						padding: "4px 12px",
					}}
				>
					Ваш план
				</Tag>
			)}
			<div style={{ marginBottom: 24 }}>
				<h3
					style={{
						fontFamily: FONT,
						fontSize: 20,
						fontWeight: 700,
						color: plan.popular ? "#fff" : DARK,
						margin: "0 0 6px",
					}}
				>
					{plan.name}
				</h3>
				<span
					style={{
						fontFamily: FONT,
						fontSize: 13,
						color: plan.popular ? "rgba(255,255,255,0.65)" : GRAY_TEXT,
					}}
				>
					{plan.desc}
				</span>
			</div>
			<div style={{ marginBottom: 28 }}>
				<span
					style={{
						fontFamily: FONT,
						fontSize: 44,
						fontWeight: 700,
						color: plan.popular ? "#fff" : DARK,
						lineHeight: 1,
						letterSpacing: "-0.02em",
					}}
				>
					{plan.price.toLocaleString("ru-RU")} ₽
				</span>
				<span
					style={{
						fontFamily: FONT,
						fontSize: 14,
						color: plan.popular ? "rgba(255,255,255,0.55)" : GRAY_TEXT,
						marginLeft: 4,
					}}
				>
					/ {plan.period}
				</span>
			</div>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 12,
					marginBottom: 32,
				}}
			>
				{plan.features.map((feat) => (
					<div
						key={feat}
						style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
					>
						<CheckOutlined
							style={{
								color: ACCENT,
								fontSize: 13,
								marginTop: 3,
								flexShrink: 0,
							}}
						/>
						<span
							style={{
								fontFamily: FONT,
								fontSize: 14,
								color: plan.popular ? "rgba(255,255,255,0.85)" : DARK,
								lineHeight: 1.5,
							}}
						>
							{feat}
						</span>
					</div>
				))}
			</div>
			<Button
				size="large"
				onClick={() => onSelect(plan.id)}
				disabled={isActive}
				style={{
					background: isActive
						? "rgba(255,255,255,0.15)"
						: plan.popular
							? ACCENT
							: DARK,
					color: isActive ? GRAY_TEXT : "#fff",
					border: "none",
					borderRadius: 10,
					height: 50,
					width: "100%",
					fontFamily: FONT,
					fontWeight: 600,
					fontSize: 15,
				}}
			>
				{isActive ? "Текущий план" : "Выбрать план"}
			</Button>
		</Card>
	</motion.div>
);

function PlansSection() {
	const navigate = useNavigate();
	const { openModal, activePlanId } = useSubscriptionStore();
	const plans = useSubscriptionPlansList();

	return (
		<section style={{ background: LIGHT_BG, padding: "80px 24px" }}>
			<div style={{ ...MAX_WIDTH }}>
				<motion.div
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.2 }}
					variants={stagger}
					style={{ display: "flex", flexDirection: "column", gap: 48 }}
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
							}}
						>
							Выберите свой план
						</h2>
					</motion.div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
							gap: 24,
							alignItems: "start",
						}}
						className="plans-grid"
					>
						{plans.map((plan, i) => (
							<PlanCard
								key={plan.id}
								plan={plan}
								index={i}
								isActive={activePlanId === plan.id}
								onSelect={openModal}
							/>
						))}
					</div>
					<motion.div
						variants={fadeUp}
						custom={4}
						style={{
							display: "flex",
							gap: 12,
							justifyContent: "center",
							flexWrap: "wrap",
						}}
					>
						<Button
							size="large"
							icon={<ArrowRightOutlined />}
							onClick={() => navigate("/constructor")}
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
							Рассчитать стоимость
						</Button>
						<Button
							size="large"
							onClick={() => navigate("/catalog")}
							style={{
								background: "transparent",
								color: DARK,
								border: "1.5px solid rgba(0,0,0,0.15)",
								borderRadius: 12,
								height: 52,
								padding: "0 32px",
								fontFamily: FONT,
								fontWeight: 600,
								fontSize: 16,
							}}
						>
							Открыть каталог
						</Button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
}

// ─── Active Subscription Banner ──────────────────────────────────────────────
function ActiveSubBanner() {
	const { getActivePlan, cancelSubscription } = useSubscriptionStore();
	const activePlan = getActivePlan();
	if (!activePlan) return null;
	return (
		<section style={{ background: ACCENT, padding: "16px 24px" }}>
			<div
				style={{
					...MAX_WIDTH,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: 12,
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						color: "#fff",
					}}
				>
					<CrownOutlined style={{ fontSize: 18 }} />
					<span style={{ fontWeight: 600, fontSize: 14 }}>
						Активная подписка: {activePlan.name} — накладки включены в план (
						{activePlan.areaLimitM2
							? `${activePlan.areaLimitM2} м²/мес`
							: "безлимит"}
						)
					</span>
				</div>
				<Button
					size="small"
					onClick={cancelSubscription}
					style={{
						background: "rgba(255,255,255,0.2)",
						color: "#fff",
						border: "1px solid rgba(255,255,255,0.4)",
						borderRadius: 8,
						fontWeight: 500,
					}}
				>
					Отменить подписку
				</Button>
			</div>
		</section>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const PricingPage: React.FC = () => {
	return (
		<div style={{ fontFamily: FONT, paddingTop: 48 }}>
			<PageMeta
				title="Подписка — WONDER WOW WALL"
				description="Стены как сервис. Подписка на обновление интерьера без ремонта."
			/>
			<SubscriptionHero />
			<BenefitsSection />
			<QuoteSection />
			<ActiveSubBanner />
			<PlansSection />
			<style>{`
        @media (max-width: 768px) {
          .benefits-grid, .plans-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
		</div>
	);
};

export default PricingPage;
