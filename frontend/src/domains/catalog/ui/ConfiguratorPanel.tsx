import { useState, useEffect, useMemo, useCallback } from "react";
import { message } from "antd";
import {
	ShoppingCartOutlined,
	HeartOutlined,
	CalculatorOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import TextureSelector from "./TextureSelector";
import ColorSelector from "./ColorSelector";
import SizeSelector from "./SizeSelector";
import type { FullConfig, Texture, TextureColor } from "../model/types";
import { useCartStore } from "../../order/model/cartStore";
import {
	PANEL_SIZES,
	BASE_PANEL_PRICES,
	DESIGN_OVERLAY_PRICE,
} from "../../../shared/config/constants";

interface Props {
	config: FullConfig;
	designId: string;
	designImage: string;
	onVariantImageChange: (imagePath: string | null) => void;
	/** PC-CALC-001 — открыть боковую панель «Рассчитать проект». */
	onCalculate?: () => void;
	/** PC-SPEC-010 — поднимает выбор в ProductPage для динамических характеристик. */
	onSelectionChange?: (selection: {
		sizeKey: string;
		textureId: string;
		textureName: string;
		colorId: string;
		colorName: string;
	}) => void;
}

/** Чистая площадь одной панели, м² — для цены за м² (PC-205). */
const PANEL_AREA_M2: Record<string, number> = {
	"300x300": 0.09,
	"300x600": 0.18,
	"600x600": 0.36,
};

function Stepper({
	value,
	onChange,
}: {
	value: number;
	onChange: (v: number) => void;
}) {
	return (
		<div
			role="group"
			aria-label="Количество"
			style={{
				display: "flex",
				alignItems: "center",
				gap: 0,
				background: "#E8E8ED",
				borderRadius: 8,
				padding: 4,
			}}
		>
			<button
				aria-label="Уменьшить количество"
				disabled={value <= 1}
				onClick={() => onChange(Math.max(1, value - 1))}
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "none",
					background: value <= 1 ? "transparent" : "#fff",
					cursor: value <= 1 ? "default" : "pointer",
					fontSize: 18,
					color: "#2D2D2D",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontWeight: 400,
					lineHeight: 1,
					transition: "background 0.2s",
				}}
			>
				−
			</button>
			<span
				aria-live="polite"
				style={{
					width: 40,
					textAlign: "center",
					fontSize: 15,
					fontWeight: 600,
					color: "#2D2D2D",
				}}
			>
				{value}
			</span>
			<button
				aria-label="Увеличить количество"
				disabled={value >= 100}
				onClick={() => onChange(Math.min(100, value + 1))}
				style={{
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "none",
					background: "#fff",
					cursor: "pointer",
					fontSize: 18,
					color: "#2D2D2D",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontWeight: 400,
					lineHeight: 1,
					transition: "background 0.2s",
				}}
			>
				+
			</button>
		</div>
	);
}

export default function ConfiguratorPanel({
	config,
	designId,
	designImage,
	onVariantImageChange,
	onCalculate,
	onSelectionChange,
}: Props) {
	const { addItemWithQuantity, setOpen: setCartOpen } = useCartStore();

	const [textureId, setTextureId] = useState("");
	const [colorId, setColorId] = useState("");
	const [sizeKey, setSizeKey] = useState("300x300");
	const [quantity, setQuantity] = useState(1);
	const [liked, setLiked] = useState(false);

	const hasTextures = config.textures.length > 0;

	const activeTexture: Texture | undefined = useMemo(
		() => config.textures.find((t) => t.id === textureId),
		[config.textures, textureId],
	);

	const activeColor: TextureColor | undefined = useMemo(
		() => activeTexture?.colors.find((c) => c.id === colorId),
		[activeTexture, colorId],
	);

	// Нормализация выбора во время рендера, а не в effect — иначе каждая
	// смена текстуры даёт лишний каскадный ре-рендер с пустым вариантом.
	if (hasTextures && !activeTexture) {
		setTextureId(config.textures[0].id);
	}
	if (activeTexture && activeTexture.colors.length > 0 && !activeColor) {
		setColorId(activeTexture.colors[0].id);
	}

	const variantImageMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const vi of config.variantImages) {
			map.set(`${vi.textureId}:${vi.colorId}`, vi.imagePath);
		}
		return map;
	}, [config.variantImages]);

	useEffect(() => {
		if (!textureId || !colorId) {
			onVariantImageChange(null);
			return;
		}
		const path = variantImageMap.get(`${textureId}:${colorId}`) ?? null;
		onVariantImageChange(path);
	}, [textureId, colorId, variantImageMap, onVariantImageChange]);

	const unitPrice = useMemo(() => {
		return (
			(BASE_PANEL_PRICES[sizeKey] ?? 0) + (config.price || DESIGN_OVERLAY_PRICE)
		);
	}, [sizeKey, config.price]);

	const totalPrice = unitPrice * quantity;

	// PC-205 — «Стоимость решения: от XX ₽/м²».
	const pricePerM2 = useMemo(() => {
		const area = PANEL_AREA_M2[sizeKey] ?? 0;
		return area > 0 ? Math.round(unitPrice / area) : 0;
	}, [sizeKey, unitPrice]);

	// PC-108 — до выбора текстуры/исполнения конкретная цена не показывается.
	const solutionChosen = !hasTextures || (!!activeTexture && !!activeColor);

	const sizeLabel = useMemo(() => {
		const s = PANEL_SIZES.find((ps) => `${ps.width}x${ps.height}` === sizeKey);
		return s?.label ?? sizeKey;
	}, [sizeKey]);

	// PC-SPEC-010 / PC-CALC-004 — поднимаем текущий выбор в ProductPage.
	const textureName = activeTexture?.name ?? "";
	const colorName = activeColor?.name ?? "";
	useEffect(() => {
		onSelectionChange?.({
			sizeKey,
			textureId,
			textureName,
			colorId,
			colorName,
		});
	}, [sizeKey, textureId, textureName, colorId, colorName, onSelectionChange]);

	const prefetchImagesForTexture = useCallback(
		(tid: string) => {
			const texture = config.textures.find((t) => t.id === tid);
			if (!texture) return;
			for (const c of texture.colors) {
				const path = variantImageMap.get(`${tid}:${c.id}`);
				if (path) {
					const img = new Image();
					img.src = path;
				}
			}
		},
		[config.textures, variantImageMap],
	);

	const handleTextureChange = useCallback((id: string) => {
		setTextureId(id);
	}, []);

	const handleTextureHover = useCallback(
		(id: string) => {
			prefetchImagesForTexture(id);
		},
		[prefetchImagesForTexture],
	);

	const handleColorChange = useCallback((id: string) => {
		setColorId(id);
	}, []);

	const handleAddToCart = useCallback(() => {
		addItemWithQuantity(
			{
				id: `${designId}-${textureId || "default"}-${colorId || "default"}-${sizeKey}`,
				productId: designId,
				name: config.designName,
				image: designImage,
				price: unitPrice,
				area: quantity,
				color: activeColor?.hex ?? "",
				colorName: activeColor?.name ?? "",
				colorId: colorId,
				textureName: activeTexture?.name ?? "",
				textureId: textureId,
				sizeKey: sizeKey,
				size: sizeLabel,
			},
			quantity,
		);
		message.success("Товар добавлен в корзину");
		setCartOpen(true);
	}, [
		designId,
		config.designName,
		designImage,
		textureId,
		colorId,
		sizeKey,
		unitPrice,
		quantity,
		activeColor,
		activeTexture,
		sizeLabel,
		addItemWithQuantity,
		setCartOpen,
	]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
			{hasTextures && (
				<>
					<TextureSelector
						textures={config.textures}
						activeId={textureId}
						onChange={handleTextureChange}
						onHover={handleTextureHover}
						pricePerM2={pricePerM2}
					/>
					{activeTexture && activeTexture.colors.length > 0 && (
						<ColorSelector
							colors={activeTexture.colors}
							activeId={colorId}
							onChange={handleColorChange}
						/>
					)}
				</>
			)}

			<SizeSelector
				activeSizeKey={sizeKey}
				onChange={setSizeKey}
				designPrice={config.price || DESIGN_OVERLAY_PRICE}
			/>

			{/* Quantity + Price */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					background: "#F5F5F5",
					borderRadius: 16,
					padding: "20px 24px",
					gap: 16,
				}}
			>
				<div>
					<div
						style={{
							fontSize: 12,
							color: "#6B7280",
							fontWeight: 500,
							marginBottom: 8,
						}}
					>
						Количество
					</div>
					<Stepper value={quantity} onChange={setQuantity} />
				</div>
				<div style={{ textAlign: "right" }}>
					{solutionChosen ? (
						<>
							<div
								style={{
									fontSize: 12,
									color: "#6B7280",
									fontWeight: 500,
									marginBottom: 4,
								}}
							>
								Итого
							</div>
							<div
								style={{
									fontSize: 28,
									fontWeight: 700,
									color: "#2D2D2D",
									letterSpacing: "-0.02em",
								}}
							>
								{totalPrice.toLocaleString("ru-RU")} ₽
							</div>
							{pricePerM2 > 0 && (
								<div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
									Стоимость решения: от {pricePerM2.toLocaleString("ru-RU")}{" "}
									₽/м²
								</div>
							)}
						</>
					) : (
						<div
							style={{
								fontSize: 15,
								color: "#6B7280",
								lineHeight: 1.5,
								maxWidth: 200,
							}}
						>
							Стоимость зависит от выбранного решения
						</div>
					)}
				</div>
			</div>

			{/* CTA — три кнопки в одном ряду */}
			<div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
				<motion.button
					onClick={handleAddToCart}
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
					style={{
						flex: 1,
						boxSizing: "border-box",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 8,
						background: "#4CAF50",
						color: "#fff",
						border: "none",
						height: 54,
						borderRadius: 12,
						fontWeight: 600,
						fontSize: 16,
						cursor: "pointer",
					}}
				>
					<ShoppingCartOutlined style={{ fontSize: 18, flexShrink: 0 }} />
					<span style={{ flexShrink: 0 }}>В корзину</span>
				</motion.button>
				<motion.button
					onClick={() => setLiked((v) => !v)}
					whileHover={{ scale: 1.08 }}
					whileTap={{ scale: 0.95 }}
					style={{
						width: 54,
						flexShrink: 0,
						boxSizing: "border-box",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						background: "#fff",
						color: liked ? "#FF3B30" : "#2D2D2D",
						border: "1.5px solid #E8E8ED",
						borderRadius: 12,
						fontSize: 18,
						cursor: "pointer",
					}}
				>
					{liked ? "♥" : <HeartOutlined />}
				</motion.button>
			</div>

			{/* PC-CALC-001 — вторичный CTA: боковая панель расчёта проекта */}
			{onCalculate && (
				<motion.button
					onClick={onCalculate}
					whileHover={{ scale: 1.01 }}
					whileTap={{ scale: 0.99 }}
					style={{
						marginTop: 12, // был -20 — залезала наверх
						boxSizing: "border-box",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 10,
						background: "#fff",
						color: "#2D2D2D",
						border: "1.5px solid #E5E7EB",
						height: 54,
						borderRadius: 12,
						fontWeight: 600,
						fontSize: 16,
						cursor: "pointer",
						width: "100%",
					}}
				>
					<CalculatorOutlined style={{ fontSize: 18 }} /> Рассчитать проект
				</motion.button>
			)}
		</div>
	);
}
