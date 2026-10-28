import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";

interface CompanionProduct {
	id: string;
	name: string;
	image: string;
	price: number;
	categoryLabel: string;
}

interface CompanionsCarouselProps {
	products: CompanionProduct[];
	title?: string;
	/** URL-шаблон с `{id}` для перехода по клику. По умолчанию — канонический `/catalog/{id}`. */
	linkTemplate?: string;
}

/**
 * Горизонтальная карусель компаньонов (похожих панелей того же размерного ряда)
 * PRD-020, PRD-021, PRD-022
 */
export function CompanionsCarousel({
	products,
	title = "Компаньоны",
	linkTemplate = "/catalog/{id}",
}: CompanionsCarouselProps) {
	const navigate = useNavigate();
	const scrollRef = useRef<HTMLDivElement>(null);

	if (products.length === 0) return null;

	const scroll = (direction: "left" | "right") => {
		if (scrollRef.current) {
			const firstCard = scrollRef.current
				.firstElementChild as HTMLElement | null;
			const gap = Number.parseFloat(
				window.getComputedStyle(scrollRef.current).columnGap || "0",
			);
			const scrollAmount =
				(firstCard?.getBoundingClientRect().width ?? 300) + gap;
			scrollRef.current.scrollBy({
				left: direction === "left" ? -scrollAmount : scrollAmount,
				behavior: "smooth",
			});
		}
	};

	return (
		<section
			className="panel-companions-section"
			style={{
				padding: "48px max(24px, calc((100% - 1200px) / 2))",
				background: "#fff",
			}}
		>
			<motion.div
				className="panel-companions-inner"
				variants={{
					hidden: { opacity: 0, y: 16 },
					show: { opacity: 1, y: 0 },
				}}
				initial="hidden"
				whileInView="show"
				viewport={{ once: true, amount: 0.2 }}
				transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1.0] }}
				style={{
					maxWidth: 1200,
					margin: "0 auto",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 16,
					}}
				>
					<div>
						<div
							style={{
								fontSize: 11,
								fontWeight: 700,
								color: "#bf4800",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
								marginBottom: 4,
							}}
						>
							Сочетается с
						</div>
						<h2
							style={{
								fontSize: "clamp(20px, 2.2vw, 26px)",
								fontWeight: 700,
								color: "#2D2D2D",
								letterSpacing: "-0.02em",
								lineHeight: 1.15,
								margin: 0,
							}}
						>
							{title}
						</h2>
					</div>

					{/* Стрелки — только если ≥ 3 карточки */}
					{products.length >= 3 && (
						<div style={{ display: "flex", gap: 8 }}>
							<button
								onClick={() => scroll("left")}
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									background: "#F5F5F5",
									border: "none",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									transition: "background 0.2s",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background = "#E5E5E5")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background = "#F5F5F5")
								}
							>
								<LeftOutlined style={{ fontSize: 14, color: "#2D2D2D" }} />
							</button>
							<button
								onClick={() => scroll("right")}
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									background: "#F5F5F5",
									border: "none",
									cursor: "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									transition: "background 0.2s",
								}}
								onMouseEnter={(e) =>
									(e.currentTarget.style.background = "#E5E5E5")
								}
								onMouseLeave={(e) =>
									(e.currentTarget.style.background = "#F5F5F5")
								}
							>
								<RightOutlined style={{ fontSize: 14, color: "#2D2D2D" }} />
							</button>
						</div>
					)}
				</div>

				{/* Карусель */}
				<div
					ref={scrollRef}
					className="panel-companions-track"
					style={{
						display: "flex",
						gap: 14,
						overflowX: "auto",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
						msOverflowStyle: "none",
						paddingBottom: 8,
						marginBottom: -8,
					}}
				>
					{products.map((product, index) => (
						<motion.div
							key={product.id}
							className="panel-companion-card"
							initial={{ opacity: 0, y: 16 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{
								duration: 0.5,
								ease: [0.25, 0.1, 0.25, 1.0],
								delay: index * 0.07,
							}}
							onClick={() => navigate(linkTemplate.replace("{id}", product.id))}
							style={{
								flexShrink: 0,
								width: 200,
								scrollSnapAlign: "start",
								cursor: "pointer",
							}}
						>
							<motion.div
								whileHover={{
									y: -5,
									boxShadow: "0 16px 32px rgba(0,0,0,0.1)",
								}}
								transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1.0] }}
								style={{
									borderRadius: 16,
									overflow: "hidden",
									background: "#F5F5F5",
									boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
								}}
							>
								<div style={{ position: "relative", paddingTop: "100%" }}>
									<img
										src={product.image}
										alt={product.name}
										loading="lazy"
										decoding="async"
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											height: "100%",
											objectFit: "cover",
										}}
									/>
								</div>
								<div style={{ padding: "12px 14px 14px" }}>
									<div
										style={{
											fontSize: 10,
											fontWeight: 600,
											color: "#6B7280",
											textTransform: "uppercase",
											letterSpacing: "0.07em",
											marginBottom: 4,
										}}
									>
										{product.categoryLabel}
									</div>
									<div
										style={{
											fontSize: 14,
											fontWeight: 600,
											color: "#2D2D2D",
											marginBottom: 4,
											lineHeight: 1.3,
										}}
									>
										{product.name}
									</div>
									<div
										style={{ display: "flex", alignItems: "baseline", gap: 4 }}
									>
										<span
											style={{
												fontSize: 14,
												fontWeight: 700,
												color: "#2D2D2D",
											}}
										>
											{product.price.toLocaleString("ru-RU")} ₽
										</span>
									</div>
								</div>
							</motion.div>
						</motion.div>
					))}
				</div>
			</motion.div>
		</section>
	);
}
