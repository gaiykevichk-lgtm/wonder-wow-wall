import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlusOutlined, MinusOutlined } from "@ant-design/icons";

import "./TechLuxuryBlock.css";

interface AccordionItem {
	id: string;
	title: string;
	/** Основной текст — виден всегда, до раскрытия (PC-TL-004). */
	summary?: string;
	/** Дополнительный текст — раскрывается по клику на «+». */
	content: string;
	icon?: string;
}

interface AccordionBlockProps {
	items: AccordionItem[];
	defaultExpanded?: string[];
	/**
	 * Компактный режим: меньше отступы и шрифты, чтобы блок поместился в
	 * узкую колонку карточки товара.
	 */
	compact?: boolean;
}

export function AccordionBlock({
	items,
	defaultExpanded = [],
	compact = false,
}: AccordionBlockProps) {
	const [expandedIds, setExpandedIds] = useState<Set<string>>(
		new Set(defaultExpanded),
	);

	const toggle = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: compact ? 8 : 12,
			}}
		>
			{items.map((item) => {
				const isOpen = expandedIds.has(item.id);
				return (
					<div
						key={item.id}
						style={{
							borderRadius: compact ? 12 : 16,
							border: "1px solid rgba(0,0,0,0.08)",
							overflow: "hidden",
							background: "#fff",
						}}
					>
						<button
							onClick={() => toggle(item.id)}
							aria-expanded={isOpen}
							style={{
								width: "100%",
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
								gap: 16,
								padding: compact ? "16px 18px" : "24px 28px",
								background: "none",
								border: "none",
								cursor: "pointer",
								textAlign: "left",
							}}
						>
							<div
								style={{
									display: "flex",
									gap: compact ? 10 : 16,
									alignItems: "flex-start",
								}}
							>
								{item.icon && (
									<span
										style={{
											fontSize: compact ? 20 : 24,
											lineHeight: 1,
										}}
									>
										{item.icon}
									</span>
								)}
								<span style={{ display: "block" }}>
									<span
										style={{
											display: "block",
											fontSize: compact ? 15 : 18,
											fontWeight: 600,
											color: "#2D2D2D",
											lineHeight: 1.4,
											letterSpacing: "-0.01em",
										}}
									>
										{item.title}
									</span>
									{item.summary && (
										<span
											style={{
												display: "block",
												marginTop: 4,
												fontSize: compact ? 13 : 15,
												fontWeight: 400,
												color: "#6B7280",
												lineHeight: 1.5,
											}}
										>
											{item.summary}
										</span>
									)}
								</span>
							</div>
							<motion.div
								animate={{ rotate: isOpen ? 45 : 0 }}
								transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
								style={{
									width: compact ? 24 : 28,
									height: compact ? 24 : 28,
									borderRadius: "50%",
									background: isOpen ? "#4CAF50" : "#F5F5F5",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
									marginTop: 2,
								}}
							>
								{isOpen ? (
									<MinusOutlined style={{ fontSize: 12, color: "#fff" }} />
								) : (
									<PlusOutlined style={{ fontSize: 12, color: "#2D2D2D" }} />
								)}
							</motion.div>
						</button>

						<AnimatePresence initial={false}>
							{isOpen && (
								<motion.div
									initial={{ height: 0, opacity: 0 }}
									animate={{ height: "auto", opacity: 1 }}
									exit={{ height: 0, opacity: 0 }}
									transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
									style={{ overflow: "hidden" }}
								>
									<div
										style={{
											padding: compact ? "0 18px 16px" : "0 28px 24px",
											paddingLeft: compact
												? item.icon
													? 48
													: 18
												: item.icon
													? 68
													: 28,
										}}
									>
										<div
											style={{
												fontSize: compact ? 13 : 15,
												color: "#6B7280",
												lineHeight: 1.6,
											}}
										>
											{item.content}
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				);
			})}
		</div>
	);
}

/**
 * Блок «Технологическая мощь» / «Просто.» — ТЗ-блок 3 для карточки товара.
 * Поддерживает два варианта рендера:
 *   - `variant="full"` (по умолчанию) — центрированный полноширинный блок,
 *     как в эталонном ТЗ-дизайне для `/product/:id`.
 *   - `variant="compact"` — вертикально-компактный вариант для узкой колонки
 *     карточки `/catalog/:panelId` (левая колонка 480px). Не центрирует
 *     заголовок, аккордеоны без внешних отступов.
 */
type TechLuxuryVariant = "full" | "compact";

const TECH_LUXURY_ITEMS: AccordionItem[] = [
	{
		id: "perfect-joint",
		icon: "✦",
		title: "Идеальный стык.",
		summary:
			"Каждая панель точно встаёт на своё место, формируя цельную поверхность без заметных переходов.",
		content:
			"Основа из композита высокой плотности сохраняет геометрию и обеспечивает стабильность конструкции на долгие годы.",
	},
	{
		id: "quick-replace",
		icon: "⚡",
		title: "Быстрая замена.",
		summary:
			"Меняйте облик пространства без демонтажа основания и сложных работ.",
		content:
			"Запатентованная система креплений рассчитана на многократную замену декоративных элементов с сохранением точности фиксации и надёжности соединения.",
	},
	{
		id: "built-for-life",
		icon: "🏠",
		title: "Созданы для жизни.",
		summary:
			"Панели сохраняют безупречный внешний вид даже при ежедневной эксплуатации.",
		content:
			"Технология финишной отделки обеспечивает высокую стойкость декоративной поверхности и упрощает повседневный уход.",
	},
];

export function TechLuxuryBlock({ variant = "full" }: { variant?: TechLuxuryVariant }) {
 const [expanded, setExpanded] = useState<string[]>([]);
 const prefix = useId();
 const colors = ["#8866ff", "#f56300", "#00a2b5"];
 return (
  <section className="tech-luxury-block" data-variant={variant}>
   <header className="tech-luxury-heading">
    <h2><span style={{display:"block"}}>Технологическая мощь</span><span style={{display:"block"}}>Просто.</span></h2>
    <p>Мы превратили сложную инженерную задачу в простой пользовательский опыт. Именно поэтому обновление пространства занимает часы, а не недели.</p>
   </header>
   <div className="tech-luxury-grid">
    {TECH_LUXURY_ITEMS.map((item, index) => {
     const open = expanded.includes(item.id);
     const contentId = `${prefix}-${item.id}`;
     return (
      <article key={item.id} className="tech-luxury-card" style={{ "--tech-accent": colors[index] } as React.CSSProperties}>
       <button type="button" className="tech-luxury-trigger" aria-expanded={open} aria-controls={contentId}
        onClick={() => setExpanded((current) => open ? current.filter((id) => id !== item.id) : [...current, item.id])}>
        <svg className="tech-luxury-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
         {index === 0 ? <><path d="M8 14h16v16H8zM24 14h16v16H24M16 8v6m16 16v8" /><path d="m20 34 4 4 4-4" /></> : index === 1 ? <path d="M29 3 10 27h14l-5 18 19-25H24z" /> : <><path d="m24 4 18 10v21L24 45 6 35V14zM6 14l18 11 18-11M24 25v20M15 9l18 11" /></>}
        </svg>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <span className="tech-luxury-toggle" aria-hidden="true">{open ? "−" : "+"}</span>
       </button>
       {open && <div className="tech-luxury-details" id={contentId}>{item.content}</div>}
      </article>
     );
    })}
   </div>
  </section>
 );
}
