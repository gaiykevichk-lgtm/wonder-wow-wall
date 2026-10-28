import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckOutlined, SwapOutlined } from "@ant-design/icons";
import { Button, InputNumber, Select, Spin } from "antd";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { imageSrc } from "../../../shared/lib/imageSrc";

/**
 * Боковая панель «Рассчитать проект».
 * Спецификация: docs/product-specs/PRODUCT-CARD.md §4 (PC-CALC-001..309).
 */

function calculatorOptionLabel(name: string, image?: string) {
	const src = image
		? /^(https?:\/\/|data:|\/)/.test(image)
			? image
			: `/uploads/${image}`
		: undefined;
	return (
		<span
			style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
		>
			<span
				style={{
					width: 32,
					height: 32,
					flexShrink: 0,
					borderRadius: 6,
					background: "#F5F5F7",
					overflow: "hidden",
					display: "grid",
					placeItems: "center",
				}}
			>
				{src ? (
					<img
						src={src}
						alt=""
						loading="lazy"
						style={{ width: "100%", height: "100%", objectFit: "contain" }}
						onError={(event) => {
							event.currentTarget.style.visibility = "hidden";
						}}
					/>
				) : (
					<span aria-hidden="true">▧</span>
				)}
			</span>
			<span
				style={{
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{name}
			</span>
		</span>
	);
}

const PANEL_SIZES = [
	{
		key: "300x300",
		label: "300×300",
		description: "12 шт. в коробке",
		icon: "▣",
		panelsPerBox: 12,
	},
	{
		key: "300x600",
		label: "300×600",
		description: "6 шт. в коробке",
		icon: "▬",
		panelsPerBox: 6,
	},
	{
		key: "600x600",
		label: "600×600",
		description: "4 шт. в коробке",
		icon: "◼",
		panelsPerBox: 4,
	},
];

interface BreakdownItem {
	panel_size: string;
	label: string;
	share: number;
	wall_area: number;
	boxes_count: number;
	actual_area: number;
	panels_count: number;
	price_per_panel: number;
	purchase_price: number;
}

/**
 * Позиция комбинированного дизайна: два типоразмера с полем «коробок».
 * Продажа строго коробками — поштучного добавления нет, итог считается
 * повальным суммированием коробок обеих текстур.
 */
export interface ComboPosition {
	key: "first" | "second";
	panelId?: string;
	panelName?: string;
	sizeKey: string;
	textureId?: string;
	textureName?: string;
	colorId?: string;
	colorName?: string;
	boxes: number;
}

export interface CalculationResult {
	wall_area: number;
	boxes_count: number;
	actual_area: number;
	panels_count: number;
	price_per_m2: number;
	price_per_panel?: number;
	subscription_price: number;
	subscription_plan_id?: string;
	subscription_plan_name?: string;
	purchase_price: number;
	design_type?: string;
	panel_specs: {
		label: string;
		panels_per_box: number;
		panel_area_m2: number;
		box_area_m2: number;
	};
	breakdown?: BreakdownItem[];
}

export interface CalculatorContext {
	secondPanelId?: string;
	panelId?: string;
	panels?: Array<{
		id: string;
		name: string;
		image?: string;
		textures: NonNullable<CalculatorContext["textures"]>;
	}>;
	/** Название выбранной панели/дизайна. */
	productName?: string;
	/** Миниатюра выбранного варианта (текстура + исполнение). */
	productImage?: string;
	/** ID дизайна — уходит в расчёт, чтобы цена соответствовала товару. */
	designId?: string;
	/** Выбранная текстура. Также используется как первая позиция комбо. */
	textureName?: string;
	textureId?: string;
	/** Выбранное исполнение (цвет/вариант текстуры). Также первая позиция комбо. */
	colorName?: string;
	colorId?: string;
	/** Изображение исполнения, соответствующее активному слайду. */
	executionImage?: string;
	/** Вариант выбранной текстуры для основного калькулятора. */
	textureChoices?: Array<{
		id: string;
		name: string;
		image?: string;
		swatchImage?: string;
		colors: Array<{
			id: string;
			name: string;
			image?: string;
			swatchImage?: string;
		}>;
	}>;
	/** Колбэк изменения текстуры из калькулятора. */
	onSelectTexture?: (selection: {
		textureId: string;
		textureName: string;
		colorId: string;
		colorName: string;
		image?: string;
	}) => void;
	/** Вторая текстура для комбо — выбор на шаге 2. */
	secondTextureName?: string;
	secondTextureId?: string;
	/** Второе исполнение для комбо — выбор на шаге 2. */
	secondColorName?: string;
	secondColorId?: string;
	/** Типоразмер, выбранный в карточке — предзаполняет шаг 2. */
	sizeKey?: string;
	/**
	 * Справочник текстур и исполнений для выбора второй позиции комбо.
	 * Карточка товара передаёт сюда свой каталог; если его нет —
	 * вторая позиция выбирается только по типоразмеру.
	 */
	textures?: Array<{
		id: string;
		name: string;
		image?: string;
		colors: Array<{ id: string; name: string; image?: string }>;
	}>;
}

/**
 * Адаптивный выбор типоразмера: на широком экране — 3 карточки в ряд,
 * на узком (<560px) — вертикальный список во всю ширину. Тексты не
 * обрезаются (nowrap убран), тапы удобны для пальца (min-height 56px).
 */
function SizeCards({
	value,
	onChange,
	namePrefix,
}: {
	value: string;
	onChange: (key: string) => void;
	namePrefix: string;
}) {
	const narrow = useIsMobile(560);
	return (
		<div
			role="radiogroup"
			aria-label="Типоразмер"
			style={{
				display: "grid",
				gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)",
				gap: 10,
			}}
		>
			{PANEL_SIZES.map((size) => {
				const active = value === size.key;
				return (
					<button
						key={size.key}
						type="button"
						role="radio"
						aria-checked={active}
						aria-label={`${namePrefix}: ${size.label} мм`}
						onClick={() => onChange(size.key)}
						style={{
							minWidth: 0,
							minHeight: 88,
							padding: "8px 6px",
							borderRadius: 10,
							border: active ? "1px solid #2D2D2D" : "1px solid #E5E7EB",
							background: active ? "#F5F5F5" : "#fff",
							cursor: "pointer",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							gap: 3,
							textAlign: "center",
						}}
					>
						<span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
							{size.icon}
						</span>
						<span style={{ minWidth: 0, flex: narrow ? 1 : undefined }}>
							<span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>
								{size.label} мм
							</span>
							<span
								style={{ display: "block", fontSize: 12, color: "#6B7280" }}
							>
								{size.description}
							</span>
						</span>
						{active && (
							<CheckOutlined
								style={{ color: "#2D2D2D", fontSize: 16, flexShrink: 0 }}
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}

interface ComboPositionCardProps {
	number: 1 | 2;
	sizeKey: string;
	onSizeChange: (key: string) => void;
	boxes: number;
	onBoxesChange: (boxes: number) => void;
	textureLabel?: string;
	textureSelect?: React.ReactNode;
}

/**
 * Карточка одной позиции комбо: типоразмер (3 в ряд), текстура/исполнение
 * и поле «коробок». Поштучного ввода нет — только целые коробки.
 */
function ComboPositionCard({
	number,
	sizeKey,
	onSizeChange,
	boxes,
	onBoxesChange,
	textureLabel,
	textureSelect,
}: ComboPositionCardProps) {
	const panelsPerBox =
		PANEL_SIZES.find((s) => s.key === sizeKey)?.panelsPerBox ?? 0;
	return (
		<div
			style={{
				border: "1px solid #E5E7EB",
				borderRadius: 12,
				padding: 16,
				background: "#fff",
			}}
		>
			<div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
				Позиция {number}
				{textureLabel ? (
					<span style={{ fontWeight: 400, color: "#6B7280" }}>
						{" "}
						· {textureLabel}
					</span>
				) : null}
			</div>
			<div style={{ fontSize: 13, fontWeight: 500, margin: "10px 0 8px" }}>
				Типоразмер
			</div>
			<SizeCards
				value={sizeKey}
				onChange={onSizeChange}
				namePrefix={`Позиция ${number}`}
			/>
			{textureSelect ? (
				<div style={{ marginTop: 12 }}>{textureSelect}</div>
			) : null}
			<div style={{ marginTop: 12 }}>
				<label
					htmlFor={`calc-boxes-${number}`}
					style={{
						display: "block",
						marginBottom: 6,
						fontSize: 13,
						fontWeight: 500,
					}}
				>
					Количество, коробок
				</label>
				<InputNumber
					id={`calc-boxes-${number}`}
					value={boxes}
					onChange={(v) => onBoxesChange(Math.max(1, Math.round(v || 1)))}
					min={1}
					max={1000}
					addonAfter="кор."
					style={{ width: "100%" }}
					size="large"
				/>
				{panelsPerBox > 0 && (
					<div style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
						= {(boxes || 0) * panelsPerBox} панелей · продажа только коробками
					</div>
				)}
			</div>
		</div>
	);
}

interface CalculatorSidebarProps {
	embedded?: boolean;
	initialDesignType?: "mono" | "combined";
	isOpen: boolean;
	onClose: () => void;
	onAddToCart: (
		result: CalculationResult,
		sizeKey: string,
		positions?: ComboPosition[],
	) => void;
	onSubscribe?: (result: CalculationResult, sizeKey: string) => void;
	onSelectPanel?: (
		panel: NonNullable<CalculatorContext["panels"]>[number],
	) => void;
	context?: CalculatorContext;
}

export function CalculatorSidebar({
	isOpen,
	onClose,
	onAddToCart,
	onSubscribe,
	onSelectPanel,
	context,
	embedded = false,
	initialDesignType = "mono",
}: CalculatorSidebarProps) {
	const narrow = useIsMobile(560);
	const [height, setHeight] = useState<number>(250);
	const [width, setWidth] = useState<number>(400);
	const [panelSize, setPanelSize] = useState<string>(
		context?.sizeKey || "300x300",
	);
	const [designType, setDesignType] = useState<"mono" | "combined">(
		initialDesignType,
	);
	// Комбо: две позиции — первая из карточки товара, вторая выбирается
	// на шаге 2. У каждой свой типоразмер, текстура, исполнение и поле
	// «коробок». Продажа строго коробками — итог повально суммируется.
	const [firstSize, setFirstSize] = useState<string>(
		context?.sizeKey || "300x300",
	);
	const [secondSize, setSecondSize] = useState<string>("600x600");
	const [firstBoxes, setFirstBoxes] = useState<number>(1);
	const [secondBoxes, setSecondBoxes] = useState<number>(1);
	const [secondTextureId, setSecondTextureId] = useState<string>(
		context?.secondTextureId || "",
	);
	const [secondColorId, setSecondColorId] = useState<string>(
		context?.secondColorId || "",
	);
	const [result, setResult] = useState<CalculationResult | null>(null);
	const [loading, setLoading] = useState(false);
	const [panelPickerOpen, setPanelPickerOpen] = useState(false);

	const designId = context?.designId ?? null;
	const contextSizeKey = context?.sizeKey;
	const contextSecondTextureId = context?.secondTextureId;
	const contextSecondColorId = context?.secondColorId;

	// PC-CALC-204 — типоразмер по умолчанию берётся из карточки товара.
	// Синхронизация во время рендера (а не в effect), чтобы не плодить
	// каскадные ре-рендеры: https://react.dev/learn/you-might-not-need-an-effect
	const [syncedSizeKey, setSyncedSizeKey] = useState(contextSizeKey);
	if (contextSizeKey && contextSizeKey !== syncedSizeKey) {
		setSyncedSizeKey(contextSizeKey);
		setPanelSize(contextSizeKey);
		setFirstSize(contextSizeKey);
	}
	const [syncedSecondTexture, setSyncedSecondTexture] = useState(
		contextSecondTextureId,
	);
	if (
		contextSecondTextureId !== undefined &&
		contextSecondTextureId !== syncedSecondTexture
	) {
		setSyncedSecondTexture(contextSecondTextureId);
		setSecondTextureId(contextSecondTextureId);
	}
	const [syncedSecondColor, setSyncedSecondColor] =
		useState(contextSecondColorId);
	if (
		contextSecondColorId !== undefined &&
		contextSecondColorId !== syncedSecondColor
	) {
		setSyncedSecondColor(contextSecondColorId);
		setSecondColorId(contextSecondColorId);
	}

	// PC-CALC-003 — закрытие по Esc, страница остаётся видимой.
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	const [secondPanelId, setSecondPanelId] = useState(
		context?.secondPanelId || context?.panelId || "",
	);
	const selectedSecondPanel = context?.panels?.find(
		(p) => p.id === secondPanelId,
	);
	const texturesList = useMemo(
		() =>
			context?.panels
				? (selectedSecondPanel?.textures ?? [])
				: (context?.textures ?? []),
		[context, selectedSecondPanel],
	);
	const handleSecondPanelChange = (id: string) => {
		setSecondPanelId(id);
		setSecondTextureId("");
		setSecondColorId("");
	};
	const secondTexture = useMemo(
		() => texturesList.find((t) => t.id === secondTextureId),
		[texturesList, secondTextureId],
	);
	const secondTextureName = secondTexture?.name ?? "";
	const secondTextureColors = useMemo(
		() => secondTexture?.colors ?? [],
		[secondTexture],
	);
	const secondColorName = useMemo(
		() => secondTextureColors.find((c) => c.id === secondColorId)?.name ?? "",
		[secondTextureColors, secondColorId],
	);
	// При смене второй текстуры сбрасываем исполнение, если выбранный
	// вариант не принадлежит новой текстуре.
	const handleSecondTextureChange = useCallback(
		(textureId: string) => {
			setSecondTextureId(textureId);
			const colors = texturesList.find((t) => t.id === textureId)?.colors ?? [];
			const stillValid =
				colors.length === 0 || colors.some((c) => c.id === secondColorId);
			if (!stillValid) setSecondColorId(colors[0]?.id ?? "");
		},
		[texturesList, secondColorId],
	);
	const comboPositions = useMemo<ComboPosition[]>(() => {
		if (designType !== "combined") return [];
		const first: ComboPosition = {
			key: "first",
			panelId: context?.panelId,
			panelName: context?.productName,
			sizeKey: firstSize,
			textureId: context?.textureId,
			textureName: context?.textureName,
			colorId: context?.colorId,
			colorName: context?.colorName,
			boxes: Math.max(1, firstBoxes || 1),
		};
		const second: ComboPosition = {
			key: "second",
			panelId: secondPanelId || undefined,
			panelName: selectedSecondPanel?.name,
			sizeKey: secondSize,
			textureId: secondTextureId || undefined,
			textureName: secondTextureName,
			colorId: secondColorId || undefined,
			colorName: secondColorName,
			boxes: Math.max(1, secondBoxes || 1),
		};
		return [first, second];
	}, [
		designType,
		secondPanelId,
		selectedSecondPanel,
		firstSize,
		secondSize,
		firstBoxes,
		secondBoxes,
		secondTextureId,
		secondColorId,
		secondTextureName,
		secondColorName,
		context,
	]);

	const calculatePrice = useCallback(async () => {
		if (!height || !width) return;
		setLoading(true);
		try {
			const isCombined = designType === "combined";
			const response = await fetch("/api/calculate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					height,
					width,
					panel_size: isCombined
						? comboPositions[0]?.sizeKey || panelSize
						: panelSize,
					design_type: isCombined ? "combined" : "mono",
					design_id: designId,
					items: isCombined
						? comboPositions.map((pos) => ({
								panel_size: pos.sizeKey,
								boxes: Math.max(1, pos.boxes || 1),
							}))
						: null,
				}),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = await response.json();
			setResult(data);
		} catch (error) {
			console.error("Failed to calculate:", error);
			setResult(null);
		} finally {
			setLoading(false);
		}
	}, [height, width, panelSize, designType, comboPositions, designId]);

	useEffect(() => {
		if (!isOpen) return;
		const timeoutId = setTimeout(() => {
			calculatePrice();
		}, 300);
		return () => clearTimeout(timeoutId);
	}, [isOpen, calculatePrice]);

	const stepTitleStyle = {
		fontSize: 12,
		fontWeight: 600,
		color: "#6B7280",
		textTransform: "uppercase" as const,
		letterSpacing: "0.08em",
		marginBottom: 10,
	};

	const rowStyle = {
		display: "flex",
		alignItems: "baseline",
		justifyContent: "space-between",
		gap: narrow ? 8 : 12,
		padding: narrow ? "10px 0" : "12px 0",
		borderBottom: "1px solid rgba(0,0,0,0.06)",
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Overlay — лёгкий, чтобы выбранная панель и её текстура
					    оставались видимыми (PC-CALC-003) */}
					{!embedded && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={onClose}
							style={{
								position: "fixed",
								inset: 0,
								background: "rgba(0,0,0,0.15)",
								zIndex: 999,
							}}
						/>
					)}

					{/* Sidebar */}
					<motion.div
						role={embedded ? "region" : "dialog"}
						aria-label="Рассчитать проект"
						initial={{ x: embedded ? 0 : "100%" }}
						animate={{ x: 0 }}
						exit={{ x: embedded ? 0 : "100%" }}
						transition={{ type: "spring", damping: 30, stiffness: 300 }}
						style={{
							position: embedded ? "relative" : "fixed",
							top: 0,
							right: 0,
							bottom: 0,
							width: embedded ? "100%" : 420,
							height: embedded ? "100%" : undefined,
							maxWidth: "100vw",
							background: "#fff",
							zIndex: 1000,
							display: "flex",
							flexDirection: "column",
							boxShadow: embedded ? "none" : "-4px 0 24px rgba(0,0,0,0.1)",
						}}
					>
						{/* Header — PC-CALC-005 */}
						<div
							style={{
								padding: narrow ? "18px 16px 14px" : "24px 28px 20px",
								borderBottom: "1px solid #F0F0F0",
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
								gap: 12,
							}}
						>
							<div>
								<h2
									style={{
										margin: 0,
										fontSize: 20,
										fontWeight: 700,
										color: "#2D2D2D",
										letterSpacing: "-0.02em",
									}}
								>
									Рассчитать проект
								</h2>
								<p
									style={{
										margin: "6px 0 0",
										fontSize: 14,
										color: "#6B7280",
										lineHeight: 1.5,
									}}
								>
									Укажите размеры поверхности для точного расчёта стоимости
								</p>
							</div>
							<button
								onClick={onClose}
								aria-label="Закрыть"
								style={{
									width: 36,
									height: 36,
									borderRadius: "50%",
									border: "1px solid #E5E7EB",
									background: "#fff",
									cursor: "pointer",
									fontSize: 18,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									flexShrink: 0,
								}}
							>
								✕
							</button>
						</div>

						{/* Content — единый скролл, все три шага сразу (PC-CALC-006) */}
						<div
							style={{
								flex: 1,
								overflow: "auto",
								padding: narrow ? "16px 16px 24px" : "20px 28px 28px",
							}}
						>
							{/* Выбранная панель — PC-CALC-007 */}
							{context?.productName && (
								<label style={{ display: "block", marginBottom: 8 }}>
									<span
										style={{
											display: "block",
											marginBottom: 4,
											fontSize: 11,
											color: "#6B7280",
										}}
									>
										Панель
									</span>
									<Select
										aria-label={`Выбрать панель. Сейчас: ${context.productName}`}
										value={context.panelId || undefined}
										optionLabelProp="label"
										style={{ width: "100%" }}
										options={(context.panels ?? []).map((panel) => ({
											value: panel.id,
											label: calculatorOptionLabel(panel.name, panel.image),
											searchText: panel.name,
										}))}
										onChange={(panelId: string) => {
											const panel = context.panels?.find(
												(item) => item.id === panelId,
											);
											if (panel) onSelectPanel?.(panel);
										}}
									/>
								</label>
							)}

							{context?.textureChoices && context.textureChoices.length > 0 && (
								<div
									style={{
										display: "grid",
										gap: 14,
										marginTop: 8,
										marginBottom: 20,
									}}
								>
									<label style={{ display: "block" }}>
										<span
											style={{
												display: "block",
												marginBottom: 4,
												fontSize: 11,
												color: "#6B7280",
											}}
										>
											Текстура
										</span>
										<Select
											aria-label="Выбрать текстуру"
											value={context.textureId || undefined}
											placeholder="Выберите текстуру"
											optionLabelProp="label"
											style={{ width: "100%" }}
											options={context.textureChoices.map((texture) => ({
												value: texture.id,
												label: calculatorOptionLabel(
													texture.name,
													texture.image || texture.swatchImage,
												),
												searchText: texture.name,
											}))}
											onChange={(textureId: string) => {
												const texture = context.textureChoices?.find(
													(item) => item.id === textureId,
												);
												if (!texture) return;
												const color = texture.colors[0];
												context.onSelectTexture?.({
													textureId: texture.id,
													textureName: texture.name,
													colorId: color?.id ?? "",
													colorName: color?.name ?? "",
													image:
														color?.image ??
														color?.swatchImage ??
														texture.image ??
														texture.swatchImage ??
														context.productImage,
												});
											}}
										/>
									</label>
									<label style={{ display: "block" }}>
										<span
											style={{
												display: "block",
												marginBottom: 4,
												fontSize: 11,
												color: "#6B7280",
											}}
										>
											Вариант исполнения
										</span>
										<Select
											aria-label="Выбрать вариант исполнения"
											value={context.colorId || undefined}
											placeholder="Выберите исполнение"
											optionLabelProp="label"
											style={{ width: "100%" }}
											options={
												context.textureChoices
													.find((texture) => texture.id === context.textureId)
													?.colors.map((color) => ({
														value: color.id,
														label: calculatorOptionLabel(
															color.name,
															color.image || color.swatchImage,
														),
														searchText: color.name,
													})) ?? []
											}
											optionRender={(option) => {
												const texture = context.textureChoices?.find(
													(item) => item.id === context.textureId,
												);
												const color = texture?.colors.find(
													(item) => item.id === option.value,
												);
												return calculatorOptionLabel(
													color?.name || String(option.label || ""),
													color?.image || color?.swatchImage,
												);
											}}
											labelRender={(props) => (
												<span
													style={{
														display: "flex",
														alignItems: "center",
														gap: 10,
														minWidth: 0,
													}}
												>
													<span
														style={{
															width: 32,
															height: 32,
															flexShrink: 0,
															borderRadius: 6,
															background: "#F5F5F7",
															overflow: "hidden",
															display: "grid",
															placeItems: "center",
														}}
													>
														<img
															src={imageSrc(context.executionImage || "")}
															alt=""
															style={{
																width: "100%",
																height: "100%",
																objectFit: "contain",
															}}
														/>
													</span>
													<span>
														{context.textureChoices
															?.find(
																(texture) => texture.id === context.textureId,
															)
															?.colors.find(
																(color) => color.id === context.colorId,
															)?.name || String(props.label || "")}
													</span>
												</span>
											)}
											onChange={(colorId: string) => {
												const texture = context.textureChoices?.find(
													(item) => item.id === context.textureId,
												);
												const color = texture?.colors.find(
													(item) => item.id === colorId,
												);
												if (!texture || !color) return;
												context.onSelectTexture?.({
													textureId: texture.id,
													textureName: texture.name,
													colorId: color.id,
													colorName: color.name,
													image:
														color.image ??
														color.swatchImage ??
														texture.image ??
														texture.swatchImage ??
														context.productImage,
												});
											}}
										/>
									</label>
								</div>
							)}

							{panelPickerOpen && context?.panels && (
								<div
									role="dialog"
									aria-modal="true"
									aria-label="Выбор панели"
									style={{
										position: "fixed",
										inset: 0,
										zIndex: 1200,
										display: "grid",
										placeItems: "center",
										padding: 16,
										background: "rgba(17,24,39,.45)",
									}}
									onMouseDown={(event) => {
										if (event.target === event.currentTarget)
											setPanelPickerOpen(false);
									}}
								>
									<div
										style={{
											width: "min(100%, 420px)",
											maxHeight: "min(80vh, 560px)",
											overflow: "auto",
											padding: 20,
											background: "#fff",
											borderRadius: 16,
											boxShadow: "0 20px 50px rgba(0,0,0,.2)",
										}}
									>
										<div
											style={{
												marginBottom: 14,
												fontSize: 16,
												fontWeight: 650,
											}}
										>
											Выберите панель
										</div>
										<div style={{ display: "grid", gap: 8 }}>
											{context.panels.map((panel) => (
												<button
													key={panel.id}
													type="button"
													aria-pressed={panel.id === context.panelId}
													onClick={() => {
														onSelectPanel?.(panel);
														setPanelPickerOpen(false);
													}}
													style={{
														display: "flex",
														alignItems: "center",
														gap: 12,
														width: "100%",
														padding: 10,
														border:
															panel.id === context.panelId
																? "1px solid #2D2D2D"
																: "1px solid #E5E7EB",
														borderRadius: 10,
														background: "#fff",
														cursor: "pointer",
														textAlign: "left",
													}}
												>
													{panel.image ? (
														<img
															src={
																panel.image.startsWith("/") ||
																panel.image.startsWith("http")
																	? panel.image
																	: `/uploads/${panel.image}`
															}
															alt=""
															style={{
																width: 46,
																height: 46,
																objectFit: "cover",
																borderRadius: 7,
																flexShrink: 0,
															}}
														/>
													) : (
														<span
															aria-hidden="true"
															style={{
																width: 46,
																height: 46,
																display: "grid",
																placeItems: "center",
																background: "#F3F4F6",
																borderRadius: 7,
																flexShrink: 0,
															}}
														>
															▧
														</span>
													)}
													<span
														style={{
															fontSize: 14,
															fontWeight: 600,
															color: "#2D2D2D",
														}}
													>
														{panel.name}
													</span>
												</button>
											))}
										</div>
									</div>
								</div>
							)}

							{/* ── Шаг 1: Размеры ── */}
							<div style={{ marginBottom: 28 }}>
								<div style={stepTitleStyle}>Шаг 1 · Размеры поверхности</div>

								<div
									style={{
										display: "flex",
										flexDirection: narrow ? "column" : "row",
										gap: narrow ? 12 : 16,
										marginBottom: 16,
									}}
								>
									<div style={{ flex: 1 }}>
										<label
											htmlFor="calc-height"
											style={{
												display: "block",
												marginBottom: 8,
												fontSize: 14,
												fontWeight: 500,
											}}
										>
											Высота
										</label>
										<InputNumber
											id="calc-height"
											value={height}
											onChange={(v) => setHeight(v || 0)}
											min={50}
											max={1000}
											addonAfter="см"
											style={{ width: "100%" }}
											size="large"
										/>
									</div>
									<div style={{ flex: 1 }}>
										<label
											htmlFor="calc-width"
											style={{
												display: "block",
												marginBottom: 8,
												fontSize: 14,
												fontWeight: 500,
											}}
										>
											Ширина
										</label>
										<InputNumber
											id="calc-width"
											value={width}
											onChange={(v) => setWidth(v || 0)}
											min={50}
											max={2000}
											addonAfter="см"
											style={{ width: "100%" }}
											size="large"
										/>
									</div>
								</div>

								<div
									style={{
										background: "#F9FAFB",
										borderRadius: 12,
										padding: 16,
										display: "flex",
										alignItems: "center",
										gap: 12,
									}}
								>
									<SwapOutlined style={{ fontSize: 20, color: "#6B7280" }} />
									<div>
										<div style={{ fontSize: 14, color: "#6B7280" }}>
											Площадь стены
										</div>
										<div
											style={{
												fontSize: 20,
												fontWeight: 700,
												color: "#2D2D2D",
											}}
										>
											{((height * width) / 10000).toFixed(2)} м²
										</div>
									</div>
								</div>
							</div>

							{/* ── Шаг 2: Тип дизайна (PC-CALC-201..205) ── */}
							<div style={{ marginBottom: 28 }}>
								<div style={stepTitleStyle}>Шаг 2 · Тип дизайна</div>

								<div
									role="radiogroup"
									aria-label="Тип дизайна"
									style={{
										display: "flex",
										flexDirection: narrow ? "column" : "row",
										gap: 10,
										width: "100%",
										marginBottom: 16,
									}}
								>
									{(
										[
											{
												value: "mono",
												title: "Моно-дизайн",
												ariaLabel: "Моно-дизайн",
												description: "Вся стена из 1 типа панелей",
											},
											{
												value: "combined",
												title: "Комбо-дизайн",
												ariaLabel: "Комбо-дизайн",
												description: "Несколько панелей на одной стене",
											},
										] as const
									).map((option) => {
										const selected = designType === option.value;
										return (
											<button
												key={option.value}
												type="button"
												role="radio"
												aria-checked={selected}
												aria-label={option.ariaLabel}
												tabIndex={selected ? 0 : -1}
												onClick={() => setDesignType(option.value)}
												style={{
													flex: "1 1 0",
													minWidth: 0,
													minHeight: 62,
													padding: "10px 14px",
													border: selected
														? "1px solid #2D2D2D"
														: "1px solid #E5E5E7",
													borderRadius: 12,
													background: selected ? "#2D2D2D" : "#F5F5F6",
													color: selected ? "#FFFFFF" : "#2D2D2D",
													textAlign: "left",
													cursor: "pointer",
													transition:
														"background 160ms ease, color 160ms ease, border-color 160ms ease",
												}}
											>
												<span
													style={{
														display: "block",
														fontSize: 14,
														lineHeight: 1.3,
														whiteSpace: "nowrap",
														fontWeight: 650,
													}}
												>
													{option.title}
												</span>
												<span
													style={{
														display: "block",
														marginTop: 4,
														minHeight: "2.4em",
														fontSize: 8,
														lineHeight: 1.2,
														whiteSpace: "nowrap",
														color: selected
															? "rgba(255,255,255,.76)"
															: "#6B7280",
													}}
												>
													{option.description}
												</span>
											</button>
										);
									})}
								</div>

								{designType === "mono" ? (
									<SizeCards
										value={panelSize}
										onChange={setPanelSize}
										namePrefix="Типоразмер"
									/>
								) : (
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: 16,
										}}
									>
										<div style={{ fontSize: 13, color: "#6B7280" }}>
											Две текстуры на одну стену. У каждой — свой типоразмер,
											исполнение и количество коробок. Продажа только коробками,
											итог суммируется.
										</div>
										<ComboPositionCard
											number={1}
											sizeKey={firstSize}
											onSizeChange={setFirstSize}
											boxes={firstBoxes}
											onBoxesChange={setFirstBoxes}
											textureLabel={
												[context?.textureName, context?.colorName]
													.filter(Boolean)
													.join(" · ") || "Текстура из карточки"
											}
										/>
										<ComboPositionCard
											number={2}
											sizeKey={secondSize}
											onSizeChange={setSecondSize}
											boxes={secondBoxes}
											onBoxesChange={setSecondBoxes}
											textureLabel={
												[secondTextureName, secondColorName]
													.filter(Boolean)
													.join(" · ") || undefined
											}
											textureSelect={
												context?.panels || texturesList.length > 0 ? (
													<>
														{context?.panels && (
															<div style={{ marginBottom: 10 }}>
																<label htmlFor="calc-second-panel">
																	Базовая панель
																</label>
																<Select
																	id="calc-second-panel"
																	aria-label="Базовая панель"
																	placeholder="Выберите базовую панель"
																	value={secondPanelId || undefined}
																	onChange={handleSecondPanelChange}
																	style={{ width: "100%" }}
																	options={context.panels.map((p) => ({
																		value: p.id,
																		label: calculatorOptionLabel(
																			p.name,
																			p.image,
																		),
																		searchText: p.name,
																	}))}
																/>
															</div>
														)}
														<div>
															<label
																htmlFor="calc-second-texture"
																style={{
																	display: "block",
																	marginBottom: 6,
																	fontSize: 13,
																	fontWeight: 500,
																}}
															>
																{context?.panels
																	? "Текстура"
																	: "Вторая текстура"}
															</label>
															<Select
																id="calc-second-texture"
																disabled={Boolean(
																	context?.panels && !selectedSecondPanel,
																)}
																placeholder="Выберите текстуру"
																value={secondTextureId || undefined}
																onChange={handleSecondTextureChange}
																style={{ width: "100%" }}
																options={texturesList.map((t) => ({
																	value: t.id,
																	label: calculatorOptionLabel(t.name, t.image),
																	searchText: t.name,
																}))}
															/>
														</div>
														{(context?.panels ||
															secondTextureColors.length > 0) && (
															<div style={{ marginTop: 10 }}>
																<label
																	htmlFor="calc-second-color"
																	style={{
																		display: "block",
																		marginBottom: 6,
																		fontSize: 13,
																		fontWeight: 500,
																	}}
																>
																	Вариант исполнения
																</label>
																<Select
																	id="calc-second-color"
																	disabled={!secondTextureId}
																	placeholder="Выберите исполнение"
																	value={secondColorId || undefined}
																	onChange={setSecondColorId}
																	style={{ width: "100%" }}
																	options={secondTextureColors.map((c) => ({
																		value: c.id,
																		label: calculatorOptionLabel(
																			c.name,
																			c.image,
																		),
																		searchText: c.name,
																	}))}
																/>
															</div>
														)}
													</>
												) : undefined
											}
										/>
									</div>
								)}
							</div>

							{/* ── Шаг 3: Ваш проект (PC-CALC-301..305) ── */}
							<div>
								<div style={stepTitleStyle}>Шаг 3 · Ваш проект</div>

								{loading && !result ? (
									<div style={{ textAlign: "center", padding: 40 }}>
										<Spin size="large" />
									</div>
								) : result ? (
									<>
										<div
											style={{
												background: "#F9FAFB",
												borderRadius: 16,
												padding: "8px 20px 16px",
												marginBottom: 20,
											}}
										>
											<div style={rowStyle}>
												<span style={{ fontSize: 14, color: "#6B7280" }}>
													Площадь стены
												</span>
												<span style={{ fontSize: 16, fontWeight: 700 }}>
													{result.wall_area.toFixed(2)} м²
												</span>
											</div>
											<div style={rowStyle}>
												<span style={{ fontSize: 14, color: "#6B7280" }}>
													Количество коробок к покупке
												</span>
												<span style={{ fontSize: 16, fontWeight: 700 }}>
													{result.boxes_count} шт.
												</span>
											</div>
											<div style={{ ...rowStyle, borderBottom: "none" }}>
												<span style={{ fontSize: 14, color: "#6B7280" }}>
													Фактический метраж
												</span>
												<span style={{ fontSize: 16, fontWeight: 700 }}>
													{result.actual_area.toFixed(2)} м²
												</span>
											</div>
											{/* PC-CALC-303 */}
											<div
												style={{
													fontSize: 12,
													color: "#6B7280",
													marginTop: -6,
													marginBottom: 10,
												}}
											>
												Мы учли технологический запас
											</div>
											<div
												style={{
													...rowStyle,
													borderBottom: "none",
													borderTop: "1px solid rgba(0,0,0,0.06)",
												}}
											>
												<span style={{ fontSize: 14, color: "#6B7280" }}>
													Панелей, шт.
												</span>
												<span style={{ fontSize: 16, fontWeight: 700 }}>
													{result.panels_count} шт.
												</span>
											</div>

											{result.breakdown && result.breakdown.length > 1 && (
												<div style={{ marginTop: 8 }}>
													{result.breakdown.map((b, i) => {
														const pos = comboPositions[i];
														const posLabel = pos
															? [pos.textureName, pos.colorName]
																	.filter(Boolean)
																	.join(" · ")
															: "";
														return (
															<div
																key={`${b.panel_size}-${i}`}
																style={{
																	display: "flex",
																	justifyContent: "space-between",
																	fontSize: 12,
																	color: "#6B7280",
																	padding: "4px 0",
																}}
															>
																<span>
																	Позиция {i + 1} · {b.label}
																	{posLabel ? ` · ${posLabel}` : ""}
																</span>
																<span>
																	{b.boxes_count} кор. · {b.panels_count} шт.
																</span>
															</div>
														);
													})}
												</div>
											)}
										</div>

										{/* Предложение 1 — ПОДПИСКА (PC-CALC-306) */}
										{result.subscription_price > 0 && (
											<div
												style={{
													background: "#F5F5F5",
													borderRadius: 16,
													padding: 20,
													marginBottom: 12,
												}}
											>
												<div
													style={{
														fontSize: 12,
														fontWeight: 600,
														color: "#6B7280",
														textTransform: "uppercase",
														letterSpacing: "0.08em",
														marginBottom: 8,
													}}
												>
													Подписка
												</div>
												<div
													style={{
														fontSize: 26,
														fontWeight: 700,
														color: "#2D2D2D",
														letterSpacing: "-0.02em",
													}}
												>
													{result.subscription_price.toLocaleString("ru-RU")} ₽
													<span
														style={{
															fontSize: 15,
															fontWeight: 500,
															color: "#6B7280",
														}}
													>
														{" "}
														/ месяц
													</span>
												</div>
												<div
													style={{
														fontSize: 13,
														color: "#6B7280",
														margin: "6px 0 16px",
													}}
												>
													Одна бесплатная замена в год включена
													{result.subscription_plan_name
														? ` · тариф «${result.subscription_plan_name}»`
														: ""}
												</div>
												<Button
													size="large"
													onClick={() =>
														onSubscribe?.(
															result,
															designType === "combined"
																? comboPositions[0]?.sizeKey || panelSize
																: panelSize,
														)
													}
													style={{
														width: "100%",
														height: 48,
														borderRadius: 10,
														fontWeight: 600,
													}}
												>
													Оформить подписку
												</Button>
											</div>
										)}

										{/* Предложение 2 — ПОКУПКА (PC-CALC-307) */}
										<div
											style={{
												background: "#2D2D2D",
												borderRadius: 16,
												padding: 20,
												color: "#fff",
											}}
										>
											<div
												style={{
													fontSize: 12,
													fontWeight: 600,
													opacity: 0.6,
													textTransform: "uppercase",
													letterSpacing: "0.08em",
													marginBottom: 8,
												}}
											>
												Покупка
											</div>
											<div
												style={{
													fontSize: 30,
													fontWeight: 700,
													letterSpacing: "-0.02em",
												}}
											>
												{result.purchase_price.toLocaleString("ru-RU")} ₽
											</div>
											<div
												style={{
													fontSize: 13,
													opacity: 0.6,
													margin: "6px 0 16px",
												}}
											>
												Разово, за {result.panels_count} панелей ·{" "}
												{result.price_per_m2.toLocaleString("ru-RU")} ₽/м²
											</div>
											<Button
												type="primary"
												size="large"
												loading={loading}
												onClick={() =>
													designType === "combined"
														? onAddToCart(
																result,
																comboPositions[0]?.sizeKey || panelSize,
																comboPositions,
															)
														: onAddToCart(result, panelSize)
												}
												style={{
													width: "100%",
													height: 48,
													borderRadius: 10,
													fontWeight: 600,
												}}
											>
												Купить
											</Button>
										</div>
									</>
								) : (
									<div
										style={{
											fontSize: 14,
											color: "#6B7280",
											padding: "16px 0",
										}}
									>
										Не удалось рассчитать проект. Проверьте размеры и попробуйте
										снова.
									</div>
								)}
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
