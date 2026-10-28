import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRightOutlined } from "@ant-design/icons";

interface ProductCTAProps {
	productName?: string;
	productId?: string;
	/** PC-CTA-003 — примерка стартует с выбранной комбинацией. */
	textureId?: string;
	colorId?: string;
	sizeKey?: string;
}

/**
 * CTA-блок внизу страницы товара
 * PRD-023: "Ваш интерьер начинается здесь."
 */
export function ProductCTA({
	productName,
	productId,
	textureId,
	colorId,
	sizeKey,
}: ProductCTAProps) {
	const navigate = useNavigate();

	const handleClick = () => {
		if (!productId) {
			navigate("/constructor");
			return;
		}
		const params = new URLSearchParams({ designId: productId });
		if (textureId) params.set("textureId", textureId);
		if (colorId) params.set("colorId", colorId);
		if (sizeKey) params.set("size", sizeKey);
		navigate(`/visualizer?${params.toString()}`);
	};

	return (
		<section
			style={{ maxWidth: 1200, margin: "96px auto 120px", padding: "0 24px" }}
		>
			<motion.div
				variants={{
					hidden: { opacity: 0, y: 24 },
					show: { opacity: 1, y: 0 },
				}}
				initial="hidden"
				whileInView="show"
				viewport={{ once: true, amount: 0.5 }}
				transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1.0] }}
				style={{ textAlign: "center" }}
			>
				<button
					onClick={handleClick}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 12,
						background: "#2D2D2D",
						color: "#fff",
						border: "none",
						height: 60,
						borderRadius: 16,
						fontWeight: 600,
						fontSize: 18,
						padding: "0 36px",
						cursor: "pointer",
						transition: "all 0.3s ease",
						boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.background = "#4CAF50";
						e.currentTarget.style.transform = "translateY(-2px)";
						e.currentTarget.style.boxShadow = "0 12px 40px rgba(76,175,80,0.3)";
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.background = "#2D2D2D";
						e.currentTarget.style.transform = "translateY(0)";
						e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)";
					}}
				>
					Ваш интерьер начинается здесь.
					<ArrowRightOutlined style={{ fontSize: 18 }} />
				</button>

				<p
					style={{
						marginTop: 16,
						fontSize: 15,
						color: "#6B7280",
						maxWidth: 400,
						margin: "16px auto 0",
						lineHeight: 1.5,
					}}
				>
					Сфотографируйте свою стену и примерите
					{productName ? ` ${productName}` : " панель"} прямо сейчас
				</p>
			</motion.div>
		</section>
	);
}
