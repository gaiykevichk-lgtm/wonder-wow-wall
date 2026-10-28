import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DownOutlined } from "@ant-design/icons";

interface SpecItem {
	label: string;
	value: string;
}

interface SpecListProps {
	specs: SpecItem[];
	panelSize?: string; // '300x300' | '300x600' | '600x600'
	execution?: string; // 'кожа' | 'ткань' | null
	/** ТЗ 16.09 — толщина панели в мм (динамическая, из данных панели). */
	thickness?: string;
}

/**
 * Обязательные 6 параметров карточки (PC-SPEC-001..006).
 * Порядок и тексты закреплены требованиями.
 */
const REQUIRED_SPECS: SpecItem[] = [
	{ label: "Размер панели", value: "300×300 мм" },
	{ label: "Толщина", value: "3 мм" },
	{ label: "Исполнение", value: "Архитектурное декоративное покрытие" },
	{
		label: "Система монтажа",
		value: "Запатентованная система быстрой замены",
	},
	{ label: "Основа", value: "Ультралёгкий композит высокой плотности" },
	{ label: "Упаковка", value: "12 панелей – 1,08 м²" },
];

/**
 * Раскрывающийся список технических характеристик
 * SPEC-001 - SPEC-006
 */
export function SpecList({
	specs,
	panelSize,
	execution,
	thickness,
}: SpecListProps) {
	const [isOpen, setIsOpen] = useState(false);

	// Динамические значения на основе выбора
	const getDynamicSpecs = (): SpecItem[] => {
		const dynamicSpecs: Record<string, SpecItem> = {
			"300x300": {
				label: "Упаковка",
				value: "12 панелей – 1,08 м²",
			},
			"300x600": {
				label: "Упаковка",
				value: "6 панелей – 1,08 м²",
			},
			"600x600": {
				label: "Упаковка",
				value: "4 панели – 1,44 м²",
			},
		};

		// PC-SPEC-011 — список всегда содержит 6 обязательных параметров;
		// значения из `specs` перекрывают дефолты, остальные ключи товара
		// добавляются в конец, чтобы не терять админские данные.
		const norm = (s: string) => s.trim().toLowerCase();
		const provided = new Map(specs.map((s) => [norm(s.label), s]));
		const result: SpecItem[] = REQUIRED_SPECS.map((req) => {
			const hit = provided.get(norm(req.label));
			if (hit) {
				provided.delete(norm(req.label));
				return { label: req.label, value: hit.value || req.value };
			}
			return { ...req };
		});
		for (const extra of provided.values()) {
			result.push(extra);
		}

		// Обновляем размер панели
		if (panelSize) {
			const sizeIndex = result.findIndex(
				(s) =>
					s.label.toLowerCase().includes("размер") ||
					s.label.toLowerCase().includes("типоразмер"),
			);
			if (sizeIndex !== -1) {
				const formattedSize = panelSize.replace("x", "×");
				result[sizeIndex] = {
					...result[sizeIndex],
					value: `${formattedSize} мм`,
				};
			}
		}

		// Обновляем исполнение для кожи/ткани
		if (execution) {
			const execIndex = result.findIndex(
				(s) =>
					s.label.toLowerCase().includes("исполнение") ||
					s.label.toLowerCase().includes("материал"),
			);
			if (execIndex !== -1) {
				let execValue = result[execIndex].value;
				if (execution === "кожа") {
					execValue = "Интерьерная кожа";
				} else if (execution === "ткань") {
					execValue = "Интерьерная ткань";
				}
				result[execIndex] = { ...result[execIndex], value: execValue };
			}
		}

		// Обновляем упаковку
		if (panelSize && dynamicSpecs[panelSize]) {
			const packIndex = result.findIndex((s) =>
				s.label.toLowerCase().includes("упаковк"),
			);
			if (packIndex !== -1) {
				result[packIndex] = {
					...result[packIndex],
					value: dynamicSpecs[panelSize].value,
				};
			} else {
				result.push(dynamicSpecs[panelSize]);
			}
		}

		// Обновляем толщину
		if (thickness) {
			const thickIndex = result.findIndex((s) =>
				s.label.toLowerCase().includes("толщин"),
			);
			if (thickIndex !== -1) {
				result[thickIndex] = {
					...result[thickIndex],
					value: thickness,
				};
			}
		}

		return result;
	};

	const displaySpecs = getDynamicSpecs();

	return (
		<section
			style={{ maxWidth: 780, margin: "64px auto 0", padding: "0 24px" }}
		>
			<motion.div
				variants={{
					hidden: { opacity: 0, y: 24 },
					show: { opacity: 1, y: 0 },
				}}
				initial="hidden"
				whileInView="show"
				viewport={{ once: true, amount: 0.2 }}
				transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
			>
				<button
					onClick={() => setIsOpen(!isOpen)}
					style={{
						width: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "20px 24px",
						background: "#F5F5F5",
						border: "none",
						borderRadius: 16,
						cursor: "pointer",
					}}
				>
					<span
						style={{
							fontSize: 18,
							fontWeight: 600,
							color: "#2D2D2D",
						}}
					>
						Технические характеристики
					</span>
					<motion.div
						animate={{ rotate: isOpen ? 180 : 0 }}
						transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
					>
						<DownOutlined style={{ fontSize: 14, color: "#6B7280" }} />
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
									marginTop: 12,
									borderRadius: 16,
									overflow: "hidden",
									border: "1px solid rgba(0,0,0,0.06)",
								}}
							>
								{displaySpecs.map((spec, idx, arr) => (
									<div
										key={spec.label}
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											padding: "16px 20px",
											borderBottom:
												idx < arr.length - 1
													? "1px solid rgba(0,0,0,0.06)"
													: "none",
											background: idx % 2 === 0 ? "#fff" : "#FAFAFA",
										}}
									>
										<span
											style={{
												fontSize: 15,
												color: "#6B7280",
												fontWeight: 500,
											}}
										>
											{spec.label}
										</span>
										<span
											style={{
												fontSize: 15,
												color: "#2D2D2D",
												fontWeight: 600,
												textAlign: "right",
												maxWidth: "60%",
											}}
										>
											{spec.value}
										</span>
									</div>
								))}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</motion.div>
		</section>
	);
}

/**
 * Компонент для отображения спецификаций на странице товара
 */
export function ProductSpecs({ specs }: { specs: Record<string, string> }) {
	const specItems: SpecItem[] = Object.entries(specs).map(([key, value]) => ({
		label: key,
		value,
	}));

	return <SpecList specs={specItems} />;
}
