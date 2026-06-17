import { useState, useCallback } from "react";
import { Typography, message, Spin, Card } from "antd";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { useSubscriptionStore } from "../../subscription/model/subscriptionStore";
import { useCartStore } from "../../order/model/cartStore";
import { useAuthStore } from "../../auth/model/authStore";
import { apiGenerateAiPreview } from "../lib/visualizerApi";
import { processUploadedImage } from "../lib/imageProcessing";
import { PanelPicker } from "./PanelPicker";
import { PhotoUploader } from "./PhotoUploader";

const { Title, Text } = Typography;

export default function SimplePhotoPage() {
	const hasSubscription = useSubscriptionStore((s) => s.hasSubscription);
	const addCartItem = useCartStore((s) => s.addItem);
	const setCartOpen = useCartStore((s) => s.setOpen);
	const isAuth = useAuthStore((s) => s.isAuth);

	const [photoUrl, setPhotoUrl] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [selectedDesignId, setSelectedDesignId] = useState<string>("");
	const [selectedSizeKey, setSelectedSizeKey] = useState<"30x30" | "30x60" | "60x60">("30x30");
	const [selectedColor, setSelectedColor] = useState<string>("#FFFFFF");
	const [selectedDesignName, setSelectedDesignName] = useState<string>("");
	const [selectedDesignImage, setSelectedDesignImage] = useState<string>("");
	const [aiPreviewUrl, setAiPreviewUrl] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [showAiPreview, setShowAiPreview] = useState(false);

	const handleUpload = useCallback(async (file: File) => {
		setUploading(true);
		try {
			const result = await processUploadedImage(file);
			setPhotoUrl(result.dataUrl);
			setAiPreviewUrl(null);
			setShowAiPreview(false);
		} catch (err) {
			console.error("Upload failed:", err);
			message.error("Не удалось загрузить фото");
		} finally {
			setUploading(false);
		}
	}, []);

	const handleDesignSelect = useCallback(
		(id: string, name: string, image: string) => {
			setSelectedDesignId(id);
			setSelectedDesignName(name);
			setSelectedDesignImage(image);
		},
		[],
	);

	const handleColorSelect = useCallback((color: string) => {
		setSelectedColor(color);
	}, []);

	const handleSizeSelect = useCallback((key: "30x30" | "30x60" | "60x60") => {
		setSelectedSizeKey(key);
	}, []);

	const handleGenerateAiPreview = useCallback(async () => {
		if (!photoUrl) {
			message.warning("Загрузите фото стены");
			return;
		}
		if (!selectedDesignId) {
			message.warning("Выберите дизайн панели");
			return;
		}

		setIsGenerating(true);
		try {
			const result = await apiGenerateAiPreview({
				photoUrl,
				designName: selectedDesignName || selectedDesignId,
				designColor: selectedColor,
			});
			setAiPreviewUrl(result.previewUrl);
			setShowAiPreview(true);
			message.success("AI превью готово!");
		} catch (err) {
			console.error("AI preview failed:", err);
			message.error("Не удалось сгенерировать превью. Попробуйте позже.");
		} finally {
			setIsGenerating(false);
		}
	}, [photoUrl, selectedDesignId, selectedDesignName, selectedColor]);

	const handleAddToCart = useCallback(() => {
		if (!selectedDesignId) {
			message.warning("Выберите дизайн панели");
			return;
		}

		addCartItem({
			id: crypto.randomUUID(),
			productId: selectedDesignId,
			name: selectedDesignName || selectedDesignId,
			image: selectedDesignImage,
			price: 1200,
			area: 0.09,
			color: selectedColor,
			colorName: "",
			size: selectedSizeKey,
		});
		setCartOpen(true);
		message.success("Добавлено в корзину!");
	}, [selectedDesignId, selectedDesignName, selectedDesignImage, selectedColor, selectedSizeKey, addCartItem, setCartOpen]);

	// Calculate cost
	const overlayPrice = 1200;
	const panelPrices = {
		"30x30": 900,
		"30x60": 1500,
		"60x60": 2500,
	};
	const basePrice = panelPrices[selectedSizeKey];
	const totalPrice = hasSubscription() ? overlayPrice : overlayPrice + basePrice;
	const discount = hasSubscription() ? basePrice : 0;

	return (
		<div
			style={{
				minHeight: "100vh",
				background: "#F7F8FA",
				padding: "24px",
			}}
		>
			<PageMeta title="Визуализатор" description="Визуализируйте 3D панели на фото вашей стены" />

			<div style={{ maxWidth: 1200, margin: "0 auto" }}>
				<Title level={2} style={{ marginBottom: 24, textAlign: "center" }}>
					Визуализатор панелей
				</Title>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: photoUrl ? "1fr 380px" : "1fr",
						gap: 24,
					}}
				>
					{/* Left: Preview Area */}
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						{/* Photo Upload or Preview */}
						<Card title={photoUrl ? "Фото стены" : "Загрузите фото"}>
							{!photoUrl ? (
								<PhotoUploader onUpload={handleUpload} loading={uploading} />
							) : (
								<div style={{ position: "relative" }}>
									<img
										src={showAiPreview && aiPreviewUrl ? aiPreviewUrl : photoUrl}
										alt={showAiPreview ? "AI Preview" : "Original"}
										style={{
											width: "100%",
											borderRadius: 8,
											display: "block",
										}}
									/>
									{isGenerating && (
										<div
											style={{
												position: "absolute",
												inset: 0,
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												background: "rgba(255,255,255,0.9)",
												borderRadius: 8,
											}}
										>
											<div style={{ textAlign: "center" }}>
												<Spin size="large" />
												<div style={{ marginTop: 16, color: "#666" }}>
													Генерация AI превью...
												</div>
											</div>
										</div>
									)}
									{aiPreviewUrl && (
										<button
											onClick={() => setShowAiPreview(!showAiPreview)}
											style={{
												position: "absolute",
												top: 16,
												right: 16,
												padding: "8px 16px",
												background: showAiPreview ? "#4CAF50" : "#fff",
												color: showAiPreview ? "#fff" : "#333",
												border: "none",
												borderRadius: 8,
												cursor: "pointer",
												fontSize: 13,
												boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
											}}
										>
											{showAiPreview ? "Показать оригинал" : "AI Превью"}
										</button>
									)}
								</div>
							)}
						</Card>

						{/* Generate AI Button */}
						{photoUrl && selectedDesignId && !showAiPreview && (
							<Card>
								<button
									onClick={handleGenerateAiPreview}
									disabled={isGenerating}
									style={{
										width: "100%",
										padding: "16px 24px",
										fontSize: 16,
										fontWeight: 600,
										background: isGenerating
											? "#ccc"
											: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
										color: "#fff",
										border: "none",
										borderRadius: 10,
										cursor: isGenerating ? "not-allowed" : "pointer",
									}}
								>
									✨ Сгенерировать AI превью
								</button>
								{!isAuth && (
									<div style={{ marginTop: 8, textAlign: "center", color: "#999", fontSize: 12 }}>
										Войдите, чтобы сохранить проект
									</div>
								)}
							</Card>
						)}
					</div>

					{/* Right: Controls */}
					<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
						{/* Design Selection */}
						<Card title="Дизайн и размер">
							<PanelPicker
								selectedDesignId={selectedDesignId}
								selectedSizeKey={selectedSizeKey}
								selectedColor={selectedColor}
								onDesignSelect={handleDesignSelect}
								onSizeSelect={handleSizeSelect}
								onColorSelect={handleColorSelect}
							/>
						</Card>

						{/* Cost & Add to Cart */}
						<Card title="Стоимость">
							<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<Text>Накладка с дизайном</Text>
									<Text strong>{overlayPrice} ₽</Text>
								</div>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<Text>Базовая панель ({selectedSizeKey})</Text>
									<Text strong>{basePrice} ₽</Text>
								</div>
								{hasSubscription() && (
									<div style={{ color: "#4CAF50" }}>
										<div style={{ display: "flex", justifyContent: "space-between" }}>
											<Text>Скидка по подписке</Text>
											<Text strong>-{discount} ₽</Text>
										</div>
									</div>
								)}
								<div
									style={{
										borderTop: "1px solid #eee",
										paddingTop: 10,
										display: "flex",
										justifyContent: "space-between",
									}}
								>
									<Text strong style={{ fontSize: 16 }}>Итого</Text>
									<Text strong style={{ fontSize: 16, color: "#4CAF50" }}>
										{totalPrice} ₽
									</Text>
								</div>
								<button
									onClick={handleAddToCart}
									disabled={!selectedDesignId}
									style={{
										width: "100%",
										padding: "14px 24px",
										fontSize: 15,
										fontWeight: 600,
										background: selectedDesignId ? "#4CAF50" : "#ccc",
										color: "#fff",
										border: "none",
										borderRadius: 8,
										cursor: selectedDesignId ? "pointer" : "not-allowed",
										marginTop: 8,
									}}
								>
									Добавить в корзину
								</button>
							</div>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
