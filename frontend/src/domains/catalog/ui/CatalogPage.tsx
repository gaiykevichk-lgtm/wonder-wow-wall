import { useState, useMemo, useEffect } from "react";
import type { ComponentProps } from "react";
import { Input, Skeleton } from "antd";
import { useSearchParams } from "react-router-dom";
import { PageMeta } from "../../../shared/ui/PageMeta";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { usePanelVariants, usePanels } from "../api/catalogApi";
import { groupVariantsToPanels, type PanelCardData } from "./panelHelpers";
import { imageSrc } from "../../../shared/lib/imageSrc";

const appleEase: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];

const fadeUpVariants: ComponentProps<typeof motion.div>["variants"] = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.6, delay: i * 0.06, ease: appleEase },
	}),
};

const SIZE_TABS = [
	{ key: "all", label: "Все размеры" },
	{ key: "30×30 см", label: "30×30 см" },
	{ key: "30×60 см", label: "30×60 см" },
	{ key: "60×60 см", label: "60×60 см" },
] as const;

// ─── Page component ─────────────────────────────────────────────────────────

export default function CatalogPage() {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
	const [sizeTab, setSizeTab] = useState<string>(
		() => searchParams.get("size") ?? "all",
	);
	const [hoveredCard, setHoveredCard] = useState<string | null>(null);

	// CAT-07 — сохраняем фильтры в URL, чтобы возврат браузером их не терял.
	useEffect(() => {
		const next = new URLSearchParams();
		if (search.trim()) next.set("q", search.trim());
		if (sizeTab !== "all") next.set("size", sizeTab);
		setSearchParams(next, { replace: true });
	}, [search, sizeTab, setSearchParams]);

	const { data: variants } = usePanelVariants();
	// `/panels` — единственный источник базовых форм: это та же сущность,
	// которую администратор редактирует во вкладке «Базовые формы».
	const { data: panelData, isLoading } = usePanels();

	// Варианты дополняют формы только списком связанных фактур.
	const panels = useMemo(
		() => groupVariantsToPanels(variants ?? [], panelData?.items ?? []),
		[variants, panelData],
	);

	// Фильтруем по размеру и поиску
	const filtered = useMemo(() => {
		let result = panels;
		if (sizeTab !== "all") {
			result = result.filter((p) => p.panel_size === sizeTab);
		}
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(
				(p) =>
					p.panel_name.toLowerCase().includes(q) ||
					p.description.toLowerCase().includes(q) ||
					p.textures.some((t) => t.texture_name.toLowerCase().includes(q)),
			);
		}
		return result;
	}, [panels, search, sizeTab]);

	return (
		<div style={{ paddingTop: 72, minHeight: "100vh", background: "#FFFFFF" }}>
			<PageMeta
				title="Каталог панелей"
				description="Выберите панель Wonder Wow Wall с текстурой и цветом. Модульные стеновые панели с магнитным креплением."
			/>

			{/* Hero */}
			<div style={{ background: "#F5F5F5", padding: "100px 40px 80px" }}>
				<div style={{ maxWidth: 1080, margin: "0 auto", textAlign: "center" }}>
					<h1
						style={{
							fontSize: 48,
							fontWeight: 600,
							color: "#2D2D2D",
							margin: 0,
							lineHeight: 1.08,
							letterSpacing: "-0.03em",
						}}
					>
						Всё начинается с чистого холста
					</h1>
					<p
						style={{
							margin: "16px 0 0",
							fontSize: 19,
							color: "#6B7280",
							lineHeight: 1.6,
							maxWidth: 520,
							marginLeft: "auto",
							marginRight: "auto",
						}}
					>
						Мы убрали цвет и фактуры, чтобы вы увидели главное — форму. Текстуру
						и характер добавим на следующем шаге.
					</p>
				</div>
			</div>

			<div
				style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 40px 80px" }}
			>
				{/* Search */}
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						marginBottom: 48,
					}}
				>
					<Input
						prefix={<SearchOutlined style={{ color: "#6B7280" }} />}
						placeholder="Поиск по названию, описанию или фактуре..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						allowClear
						style={{
							maxWidth: 400,
							width: "100%",
							borderRadius: 12,
							height: 44,
							border: "1px solid rgba(0,0,0,0.08)",
							fontSize: 15,
						}}
					/>
				</div>

				{/* Size Tabs */}
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						gap: 6,
						marginBottom: 32,
						flexWrap: "wrap",
						width: "100%",
						maxWidth: "100%",
					}}
				>
					{SIZE_TABS.map((tab) => (
						<button
							key={tab.key}
							onClick={() => setSizeTab(tab.key)}
							style={{
								padding: "7px 12px",
								borderRadius: 100,
								border: "none",
								cursor: "pointer",
								fontSize: 12,
								fontWeight: 500,
								letterSpacing: "-0.01em",
								transition: "all 0.3s ease",
								background: sizeTab === tab.key ? "#2D2D2D" : "#F0F0F0",
								color: sizeTab === tab.key ? "#FFFFFF" : "#6B7280",
								whiteSpace: "nowrap",
								flex: "1 1 0",
								minWidth: "fit-content",
								maxWidth: "150px",
								textAlign: "center",
							}}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* Grid */}
				{isLoading ? (
					<div className="catalog-forms-grid">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								style={{
									borderRadius: 20,
									overflow: "hidden",
									background: "#F5F5F5",
								}}
							>
								<Skeleton.Image style={{ width: "100%", height: 280 }} active />
								<div style={{ padding: "20px 16px" }}>
									<Skeleton active paragraph={{ rows: 1 }} />
								</div>
							</div>
						))}
					</div>
				) : filtered.length === 0 ? (
					<div
						style={{
							textAlign: "center",
							padding: "100px 20px",
							color: "#6B7280",
						}}
					>
						<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>
							&#x1F50D;
						</div>
						<h3
							style={{
								fontSize: 22,
								fontWeight: 600,
								color: "#2D2D2D",
								margin: "0 0 8px",
							}}
						>
							Ничего не найдено
						</h3>
						<p style={{ fontSize: 15, margin: 0 }}>
							Попробуйте изменить поисковый запрос
						</p>
					</div>
				) : (
					<div className="catalog-forms-grid">
						{filtered.map((panel, i) => (
							<PanelCard
								key={panel.panel_id}
								panel={panel}
								index={i}
								hovered={hoveredCard === panel.panel_id}
								onHover={setHoveredCard}
								onClick={() => navigate(`/catalog/${panel.panel_id}`)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

/* ─── Panel Card ──────────────────────────────────────────────────────────── */

interface PanelCardProps {
	panel: PanelCardData;
	index: number;
	hovered: boolean;
	onHover: (id: string | null) => void;
	onClick: () => void;
}

function PanelCard({
	panel,
	index,
	hovered,
	onHover,
	onClick,
}: PanelCardProps) {
	// Изображения карточки принадлежат самой базовой форме. Превью фактур
	// ниже остаются только компактными свотчами и не подменяют главное фото.
	const gallery =
		panel.catalog_photos.length > 0
			? panel.catalog_photos
			: panel.form_preview
				? [panel.form_preview]
				: [];
	// Второе фото показываем на hover — если его нет, остаётся первое.
	const shownPath = hovered && gallery.length > 1 ? gallery[1] : gallery[0];
	const mainImageUrl = shownPath ? imageSrc(shownPath) : null;

	return (
		<motion.div
			custom={index}
			initial="hidden"
			animate="visible"
			variants={fadeUpVariants}
			onClick={onClick}
			onMouseEnter={() => onHover(panel.panel_id)}
			onMouseLeave={() => onHover(null)}
			style={{
				cursor: "pointer",
				borderRadius: 20,
				overflow: "hidden",
				background: "transparent",
				boxShadow: hovered ? "0 16px 32px rgba(45,45,45,0.10)" : "none",
				transition: "box-shadow 0.25s ease",
			}}
		>
			{/* Фото остаётся в плоском слое без scale/3D, чтобы браузер не
			    пересэмплировал мелкую фактуру при наведении. */}
			<div
				className="catalog-panel-image"
				style={{
					position: "relative",
					aspectRatio: "1",
					overflow: "hidden",
					background: "transparent",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				{/* Предзагрузка второго фото, чтобы hover не мигал при первом наведении */}
				{gallery.length > 1 && (
					<img
						src={imageSrc(gallery[1])}
						alt=""
						aria-hidden="true"
						loading="lazy"
						style={{
							position: "absolute",
							width: 1,
							height: 1,
							opacity: 0,
							pointerEvents: "none",
						}}
					/>
				)}
				{mainImageUrl ? (
					<img
						src={mainImageUrl}
						alt={panel.panel_name}
						loading="lazy"
						style={{
							width: "100%",
							height: "100%",
							objectFit: "contain",
							display: "block",
						}}
					/>
				) : (
					<div
						style={{
							width: 64,
							height: 64,
							borderRadius: 16,
							background: "#E0E0E0",
							opacity: 0.5,
						}}
					/>
				)}

				{/* Texture swatches strip */}
				{panel.textures.length > 0 && (
					<div
						style={{
							position: "absolute",
							bottom: 12,
							left: 12,
							right: 12,
							display: "flex",
							gap: 6,
							justifyContent: "center",
						}}
					>
							{panel.textures.slice(0, 5).map((texture, ti) => (
								<img
									key={texture.texture_id}
									src={imageSrc(texture.preview_path)}
									alt={texture.texture_name}
									title={`${texture.texture_name}${texture.variant_count > 1 ? ` (${texture.variant_count} цвета)` : ""}`}
									style={{
										width: 28,
										height: 28,
										borderRadius: "50%",
										objectFit: "cover",
										border: "2px solid #FFFFFF",
										boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
										opacity: hovered ? 1 : Math.max(0.6, 1 - ti * 0.08),
										transition: "opacity 0.3s ease",
									}}
								/>
							))}
							{panel.textures.length > 5 && (
								<span
									style={{
										width: 28,
										height: 28,
										borderRadius: "50%",
										background: "#2D2D2D",
										color: "#FFFFFF",
										fontSize: 10,
										fontWeight: 600,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										border: "2px solid #FFFFFF",
									}}
								>
									+{panel.textures.length - 5}
								</span>
							)}
					</div>
				)}
			</div>

			{/* Info */}
			<div style={{ padding: "20px 20px 24px" }}>
				<div
					style={{
						fontSize: 16,
						fontWeight: 600,
						color: "#2D2D2D",
						lineHeight: 1.3,
						letterSpacing: "-0.01em",
						marginBottom: 4,
					}}
				>
					{panel.panel_name}
				</div>
				<div
					style={{
						fontSize: 14,
						color: "#6B7280",
						marginBottom: panel.description ? 8 : 0,
					}}
				>
					{panel.panel_size}
				</div>
				{panel.description && (
					<p
						style={{
							fontSize: 13,
							lineHeight: 1.45,
							color: "#6B7280",
							margin: 0,
						}}
					>
						{panel.description}
					</p>
				)}
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onClick();
					}}
					style={{
						marginTop: 14,
						width: "100%",
						height: 40,
						borderRadius: 10,
						border: "1px solid #d2d2d7",
						background: "#fff",
						color: "#2E7D32",
						fontSize: 14,
						fontWeight: 600,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 6,
						transition: "background 0.15s ease",
					}}
					onMouseEnter={(e) =>
						((e.currentTarget as HTMLButtonElement).style.background =
							"#F5F5F7")
					}
					onMouseLeave={(e) =>
						((e.currentTarget as HTMLButtonElement).style.background = "#fff")
					}
				>
					Рассчитать проект
				</button>
			</div>
		</motion.div>
	);
}
