import { useMemo, useRef, useState } from "react";
import { Alert, Modal, Spin, message } from "antd";
import type { SpaceCardItem } from "../model/spacesApi";
import { usePanels, usePanelVariants } from "../../catalog/api/catalogApi";
import {
	CalculatorSidebar,
	type CalculationResult,
	type ComboPosition,
} from "../../catalog/ui/CalculatorSidebar";
import { useCartStore } from "../../order/model/cartStore";
import { imageSrc } from "../../../shared/lib/imageSrc";

export function SpaceDetailModal({
	card: project,
	onClose,
	onChoosePanel,
}: {
	card: SpaceCardItem;
	onClose: () => void;
	onChoosePanel: (card: SpaceCardItem) => void;
}) {
	const [photo, setPhoto] = useState(0);
	const thumbnailTrack = useRef<HTMLDivElement>(null);
	const [configurationId, setConfigurationId] = useState(project.id);
	const [execution, setExecution] = useState<string>();
	const panels = usePanels();
	const variants = usePanelVariants();
	const cart = useCartStore();
	const projectRows = project.configurations?.length
		? project.configurations
		: [project];
	const card = projectRows.find((row) => row.id === configurationId) ?? project;
	const activePanelSlug = card.panelFamily1 || card.panelFamily2 || "";
	// Явная привязка отдельного снимка подтверждена владельцем каталога;
	// остальные снимки сохраняют имеющуюся привязку карточки.
	const photoExecutions: Record<string, string> = {
		"MISC/0a6a3680-289c-4b54-b703-088afaf2cadd.png":
			"c632aa99-d63a-4ea0-8263-a6f2839e11d3",
	};
	const slides = useMemo(() => {
		const rows = projectRows.flatMap((row) =>
			(row.images?.length ? row.images : [row.image])
				.filter(Boolean)
				.map((src) => ({
					src,
					row,
					executionVariantId: photoExecutions[src] || row.executionVariantId,
				})),
		);
		const unique = new Map<string, (typeof rows)[number]>();
		for (const slide of rows) {
			if (!unique.has(slide.src)) unique.set(slide.src, slide);
		}
		return [...unique.values()];
	}, [projectRows]);
	const images = slides.map((slide) => slide.src);
	const initialVariant = (variants.data ?? []).find(
		(item) => item.id === card.executionVariantId,
	);
	const variant =
		(variants.data ?? []).find((item) => item.id === execution) ??
		initialVariant;
	const panel = variant
		? panels.data?.items.find((item) => item.id === variant.panel_id)
		: undefined;
	// Фотография исполнения — отдельный пример из каталога, а не снимок
	// этого пространства. Не добавляем изображения других исполнений в галерею.
	const executionExample =
		photo < 0 ? variant?.design_image_paths?.[0] : undefined;
	const catalog = (panels.data?.items ?? []).map((item) => ({
		id: item.id,
		name: item.name,
		image: item.form_preview_path || item.photo_path,
		textures: [
			...new Set(
				(variants.data ?? [])
					.filter((v) => v.panel_id === item.id)
					.map((v) => v.texture_id),
			),
		].map((id) => {
			const group = (variants.data ?? []).filter(
				(v) => v.panel_id === item.id && v.texture_id === id,
			);
			return {
				id,
				name: group[0]?.texture_name || "",
				image: group[0]?.image_paths[0] || "",
				colors: group.map((v, i) => ({
					id: v.id,
					name: v.name || `Исполнение ${i + 1}`,
					image: v.image_paths[0],
				})),
			};
		}),
	}));
	function choosePhoto(index: number) {
		const thumbnail =
			thumbnailTrack.current?.querySelectorAll<HTMLButtonElement>("button")[
				index
			];
		thumbnail?.scrollIntoView?.({
			block: "nearest",
			inline: "nearest",
			behavior: "smooth",
		});
		setPhoto(index);
		const matched = slides[index];
		if (matched) {
			setConfigurationId(matched.row.id);
			setExecution(matched.executionVariantId || undefined);
		} else {
			setExecution(undefined);
		}
	}
	function chooseExecution(id: string) {
		setExecution(id);
		const index = slides.findIndex((slide) => slide.executionVariantId === id);
		if (index >= 0) choosePhoto(index);
		else setPhoto(-1);
	}
	function add(
		result: CalculationResult,
		size: string,
		positions?: ComboPosition[],
	) {
		const lines = positions?.length
			? positions.map((position, i) => ({
					v: (variants.data ?? []).find((item) => item.id === position.colorId),
					size: position.sizeKey,
					count:
						result.breakdown?.[i]?.panels_count ??
						position.boxes *
							(position.sizeKey === "600x600"
								? 4
								: position.sizeKey === "300x600"
									? 6
									: 12),
					price: result.breakdown?.[i]?.price_per_panel ?? 0,
				}))
			: variant
				? [
						{
							v: variant,
							size,
							count: result.panels_count,
							price:
								result.price_per_panel ??
								result.purchase_price / result.panels_count,
						},
					]
				: [];
		if (!lines.length || lines.some((line) => !line.v)) {
			message.warning("Выберите исполнение каждой панели");
			return;
		}
		lines.forEach((line) => {
			const item = line.v!;
			cart.addItemWithQuantity(
				{
					id: `panel-${item.id}-${line.size}-calc`,
					productId: item.panel_id,
					variantId: item.id,
					executionName: item.name || "",
					name: `${item.panel_name} — ${item.texture_name}`,
					image: item.image_paths[0] || card.image,
					price: line.price,
					area: 0,
					color: "",
					colorName: item.name || "",
					textureName: item.texture_name,
					textureId: item.texture_id,
					sizeKey: line.size,
					size: line.size.replace("x", "×") + " мм",
				},
				line.count,
			);
		});
		message.success("Проект добавлен в корзину");
		onClose();
		cart.setOpen(true);
	}
	return (
		<Modal
			open
			onCancel={onClose}
			footer={null}
			title={null}
			width={1200}
			className="space-detail-modal"
			closable={false}
			styles={{ body: { padding: 0 } }}
		>
			<div className="space-detail-grid">
				<section
					className="space-detail-story"
					aria-label="Описание пространства"
				>
					<div className="space-detail-gallery-stage">
						{photo >= 0 || executionExample ? (
							<img
								className="space-detail-hero"
								src={imageSrc(photo >= 0 ? images[photo] : executionExample!)}
								alt={
									photo >= 0
										? `${project.title} — фото ${photo + 1}`
										: `Пример исполнения ${variant?.name || "панели"} из каталога`
								}
							/>
						) : (
							<div className="space-detail-hero" role="status">
								Для выбранного исполнения нет фотографии в этом пространстве
							</div>
						)}
						<div className="space-detail-gallery-cta-layer">
							<button
								type="button"
								className="space-detail-gallery-cta"
								onClick={() =>
									onChoosePanel({
										...card,
										panelFamily1: variant?.panel_id || activePanelSlug,
										executionVariantId: variant?.id || card.executionVariantId,
									})
								}
							>
								Хочу такую панель!
							</button>
						</div>
						{images.length > 1 && (
							<>
								<button
									type="button"
									className="space-detail-gallery-arrow is-prev"
									aria-label="Предыдущее фото"
									onClick={(event) => {
										event.stopPropagation();
										choosePhoto(
											photo < 0
												? images.length - 1
												: (photo - 1 + images.length) % images.length,
										);
									}}
								>
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="m15 18-6-6 6-6" />
									</svg>
								</button>
								<button
									type="button"
									className="space-detail-gallery-arrow is-next"
									aria-label="Следующее фото"
									onClick={(event) => {
										event.stopPropagation();
										choosePhoto((photo + 1) % images.length);
									}}
								>
									<svg viewBox="0 0 24 24" aria-hidden="true">
										<path d="m9 18 6-6-6-6" />
									</svg>
								</button>
							</>
						)}
					</div>
					{images.length > 1 && (
						<div
							ref={thumbnailTrack}
							className="space-detail-thumbnails"
							aria-label="Галерея пространства"
						>
							{images.map((src, index) => (
								<button
									type="button"
									key={`${src}-${index}`}
									aria-label={`Показать фото ${index + 1}`}
									aria-pressed={photo === index}
									onClick={() => choosePhoto(index)}
								>
									<img src={imageSrc(src)} alt="" />
								</button>
							))}
						</div>
					)}
					<h2>{project.title}</h2>
					{project.projectAddress && (
						<p className="space-detail-description">{project.projectAddress}</p>
					)}
					{executionExample && (
						<p className="space-detail-description">
							Пример исполнения из каталога, не фотография этого пространства.
						</p>
					)}
					<p className="space-detail-description">
						{(photo < 0 ||
							(photo >= 0 &&
								slides[photo]?.executionVariantId !==
									card.executionVariantId)) &&
						variant
							? `Панель ${variant.panel_name} — ${variant.texture_name}, исполнение ${variant.name || "без названия"}`
							: card.subtitle}
					</p>
					<div className="space-detail-facts">
						{card.area && <span>Площадь: {card.area}</span>}
						{card.price && <span>Стоимость проекта: {card.price}</span>}
					</div>
				</section>
				<aside className="space-detail-calculation">
					{panels.isLoading || variants.isLoading ? (
						<Spin />
					) : panels.isError || variants.isError ? (
						<Alert
							type="error"
							message="Не удалось загрузить каталог для расчёта"
							action={
								<button
									onClick={() => {
										panels.refetch();
										variants.refetch();
									}}
								>
									Повторить
								</button>
							}
						/>
					) : !variant || !panel ? (
						<Alert
							type="warning"
							message="Для этого варианта исполнения ещё не задано. Добавьте его при заполнении карточки пространства."
						/>
					) : (
						<CalculatorSidebar
							key={`${project.id}`}
							onSelectPanel={(selectedPanel) => {
								const next = (variants.data ?? []).find(
									(item) => item.panel_id === selectedPanel.id,
								);
								if (!next) return;
								chooseExecution(next.id);
							}}
							embedded
							isOpen
							onClose={onClose}
							initialDesignType={card.mode}
							context={{
								panelId: panel.id,
								panels: catalog,
								productName: panel.name,
								productImage: imageSrc(variant.image_paths[0] || card.image),
								textureId: variant.texture_id,
								textureName: variant.texture_name,
								colorId: variant.id,
								colorName: variant.name || "Исполнение",
								executionImage: imageSrc(
									variant.image_paths?.[0] || slides[photo]?.src || card.image,
								),
								textureChoices: catalog
									.find((item) => item.id === panel.id)
									?.textures.map((texture) => ({
										...texture,
										swatchImage: texture.image,
										colors: texture.colors.map((color) => ({
											...color,
											swatchImage: texture.image,
										})),
									})),
								textures: catalog.find((item) => item.id === panel.id)
									?.textures,
								onSelectTexture: ({ textureId, colorId }) => {
									const next = (variants.data ?? []).find(
										(item) =>
											item.panel_id === panel.id &&
											item.texture_id === textureId &&
											item.id === colorId,
									);
									if (next) chooseExecution(next.id);
								},
							}}
							onAddToCart={add}
						/>
					)}
				</aside>
			</div>
		</Modal>
	);
}
