import { useMemo, useState } from "react";
import {
	Button,
	Empty,
	Image,
	Input,
	Modal,
	Popconfirm,
	Segmented,
	Select,
	Space,
	Table,
	Tag,
	Typography,
	message,
} from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";

import { imageSrc } from "../../../shared/lib/imageSrc";
import { AdminFileUpload } from "../../../shared/ui/AdminFileUpload";
import { usePanelsAdminList } from "../api/panelsAdminApi";
import { useAdminTextures } from "../api/texturesAdminApi";
import { usePanelVariants } from "../../catalog/api/catalogApi";
import {
	SPACE_CARD_CATEGORIES,
	type ApiTextureCombinationImage,
	type SpaceCardCategory,
	useCreateTextureCombinationImage,
	useDeleteTextureCombinationImage,
	useTextureCombinationImagesAdmin,
	useUpdateTextureCombinationImage,
} from "../api/textureCombinationsAdminApi";

const { Text } = Typography;
type ImageMode = "mono" | "combined";

function withCardUnit(value: string, unit: "₽" | "м²"): string {
	const text = value.trim();
	if (!text) return "";
	const withoutUnit =
		unit === "₽"
			? text.replace(/(?:\s*₽)+$/u, "").trim()
			: text.replace(/(?:\s*м(?:²|2|\^2))+$/iu, "").trim();
	return withoutUnit ? `${withoutUnit} ${unit}` : "";
}

const EMPTY_CARD: {
	title: string;
	subtitle: string;
	price: string;
	area: string;
	category: SpaceCardCategory;
	project_id?: string;
	project_address?: string;
	execution_variant_id?: string;
} = {
	title: "",
	subtitle: "",
	price: "",
	area: "",
	category: "home",
};

type CardDraft = {
	title: string;
	subtitle: string;
	price: string;
	area: string;
	category: SpaceCardCategory;
	project_id?: string;
	project_address?: string;
	execution_variant_id?: string;
};

function normalizeCardCategory(value: unknown): SpaceCardCategory {
	return value === "business" || value === "social" ? value : "home";
}

function RowCardEditor({
	row,
	onSave,
	isSaving,
}: {
	row: ApiTextureCombinationImage;
	onSave: (row: ApiTextureCombinationImage, draft: CardDraft) => void;
	isSaving: boolean;
}) {
	const initial: CardDraft = {
		title: row.card?.title ?? "",
		subtitle: row.card?.subtitle ?? "",
		price: row.card?.price ?? "",
		area: row.card?.area ?? "",
		category: normalizeCardCategory(row.card?.category),
	};
	// Ключ по id строки + её сохранённым текстам: после refetch с новыми
	// данными редактор пересоздаётся и показывает актуальные значения,
	// а несохранённые правки пользователя не затираются промежуточными
	// ре-рендерами таблицы.
	const [draft, setDraft] = useState<CardDraft>(initial);
	const [baseline, setBaseline] = useState<CardDraft>(initial);
	if (
		initial.title !== baseline.title ||
		initial.subtitle !== baseline.subtitle ||
		initial.price !== baseline.price ||
		initial.area !== baseline.area ||
		initial.category !== baseline.category
	) {
		setBaseline(initial);
		setDraft(initial);
	}
	const dirty =
		draft.title !== baseline.title ||
		draft.subtitle !== baseline.subtitle ||
		draft.price !== baseline.price ||
		draft.area !== baseline.area ||
		draft.category !== baseline.category;
	const published = baseline.title.trim().length > 0;
	return (
		<Space direction="vertical" size={6} style={{ width: "100%" }}>
			{published ? (
				<Tag color="green">На странице «Пространства»</Tag>
			) : (
				<Tag>Черновик — заполните название, чтобы показать на странице</Tag>
			)}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(2, minmax(200px, 1fr))",
					gap: "6px 12px",
					width: "100%",
				}}
			>
				<label style={{ display: "block", width: "100%" }}>
					<span style={{ fontSize: 12, color: "#6b7280" }}>Название</span>
					<Input
						aria-label={`Название карточки — ${row.id}`}
						placeholder="Например: Современная гостиная"
						value={draft.title}
						onChange={(event) =>
							setDraft((prev) => ({ ...prev, title: event.target.value }))
						}
					/>
				</label>
				<label style={{ display: "block", width: "100%" }}>
					<span style={{ fontSize: 12, color: "#6b7280" }}>Детали</span>
					<Input
						aria-label={`Детали карточки — ${row.id}`}
						placeholder="Например: Современный · Текстиль · моно"
						value={draft.subtitle}
						onChange={(event) =>
							setDraft((prev) => ({ ...prev, subtitle: event.target.value }))
						}
					/>
				</label>
				<label style={{ display: "block", width: "100%" }}>
					<span style={{ fontSize: 12, color: "#6b7280" }}>Цена</span>
					<Input
						aria-label={`Цена карточки — ${row.id}`}
						placeholder="Например: от 196 460 ₽"
						value={draft.price}
						onBlur={() =>
							setDraft((card) => ({
								...card,
								price: withCardUnit(card.price, "₽"),
							}))
						}
						onChange={(event) =>
							setDraft((prev) => ({ ...prev, price: event.target.value }))
						}
					/>
				</label>
				<label style={{ display: "block", width: "100%" }}>
					<span style={{ fontSize: 12, color: "#6b7280" }}>Площадь</span>
					<Input
						aria-label={`Площадь карточки — ${row.id}`}
						placeholder="Например: Стена 8.4 м²"
						value={draft.area}
						onBlur={() =>
							setDraft((card) => ({
								...card,
								area: withCardUnit(card.area, "м²"),
							}))
						}
						onChange={(event) =>
							setDraft((prev) => ({ ...prev, area: event.target.value }))
						}
					/>
				</label>
				<label
					style={{ display: "block", width: "100%", gridColumn: "1 / -1" }}
				>
					<span style={{ fontSize: 12, color: "#6b7280" }}>Назначение</span>
					<Select
						aria-label={`Назначение карточки — ${row.id}`}
						value={draft.category}
						onChange={(value) =>
							setDraft((prev) => ({
								...prev,
								category: normalizeCardCategory(value),
							}))
						}
						options={SPACE_CARD_CATEGORIES}
						style={{ width: "100%" }}
					/>
				</label>
			</div>
			{dirty && (
				<Button
					type="primary"
					size="small"
					loading={isSaving}
					aria-label={`Сохранить тексты карточки — ${row.id}`}
					onClick={() => onSave(row, draft)}
				>
					Сохранить тексты
				</Button>
			)}
		</Space>
	);
}

function normalizePanelFamily(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

/** Семейство базовой формы: slug панели без суффикса размера. */
function panelFamilyFromSlug(slug: string): string {
	const value = (slug ?? "").trim();
	for (const suffix of ["-300x300", "-300x600", "-600x600"]) {
		if (value.endsWith(suffix)) return value.slice(0, -suffix.length);
	}
	return value;
}

/** Моно — одно семейство в обоих полях, комбо — два разных; сортировка для стабильности. */
function normalizePanelPair(
	first: string | undefined,
	second: string | undefined,
	panelMode: ImageMode,
): [string, string] {
	const a = normalizePanelFamily(first);
	const b = normalizePanelFamily(second);
	if (panelMode === "mono") return [a, a];
	if (!a || !b || a === b) return [a, b];
	return a < b ? [a, b] : [b, a];
}

export default function AdminTextureCombinationsTab() {
	const [mode, setMode] = useState<ImageMode>("mono");
	const [panelFilter, setPanelFilter] = useState<string>();
	const [firstTextureId, setFirstTextureId] = useState<string>();
	const [secondTextureId, setSecondTextureId] = useState<string>();
	const [firstPanelFamily, setFirstPanelFamily] = useState<string>();
	const [secondPanelFamily, setSecondPanelFamily] = useState<string>();
	const [cardTitle, setCardTitle] = useState("");
	const [projectId, setProjectId] = useState("");
	const [projectAddress, setProjectAddress] = useState("");
	const [executionVariantId, setExecutionVariantId] = useState("");
	const [cardSubtitle, setCardSubtitle] = useState("");
	const [cardPrice, setCardPrice] = useState("");
	const [cardArea, setCardArea] = useState("");
	const [cardCategory, setCardCategory] = useState<SpaceCardCategory>("home");
	const [editing, setEditing] = useState<ApiTextureCombinationImage | null>(
		null,
	);
	const [editTextureId1, setEditTextureId1] = useState<string>();
	const [editTextureId2, setEditTextureId2] = useState<string>();
	const [editPanelFamily1, setEditPanelFamily1] = useState<string>();
	const [editPanelFamily2, setEditPanelFamily2] = useState<string>();
	const [editGallery, setEditGallery] = useState<string[]>([]);
	const [editImageChanged, setEditImageChanged] = useState(false);
	const [editCard, setEditCard] = useState({ ...EMPTY_CARD });
	// Фото новой карточки: можно загрузить несколько файлов — все попадут
	// в галерею ОДНОЙ карточки (первое фото — обложка). Если карточка для
	// выбранной текстуры/пары уже есть, кнопка допишет фото в её галерею.
	const [newImagePaths, setNewImagePaths] = useState<string[]>([]);
	const texturesQuery = useAdminTextures();
	const textures = useMemo(
		() => texturesQuery.data ?? [],
		[texturesQuery.data],
	);
	const variantsQuery = usePanelVariants();
	const executionOptions = useMemo(
		() =>
			(variantsQuery.data ?? [])
				.filter((item) => item.is_active && item.image_paths?.length)
				.map((item) => ({
					value: item.id,
					label: item.name || `${item.texture_name} · ${item.panel_name}`,
					image: item.image_paths[0],
				})),
		[variantsQuery.data],
	);
	const panelsQuery = usePanelsAdminList(
		{ page: 1, size: 100, search: null, isActive: true },
		{ allPages: true },
	);
	const panelFamilies = useMemo(() => {
		const families = new Map<string, string>();
		for (const panel of panelsQuery.data?.items ?? []) {
			const family = panelFamilyFromSlug(panel.slug);
			if (!family || families.has(family)) continue;
			families.set(family, panel.name);
		}
		return Array.from(families.entries())
			.map(([value, name]) => ({ value, label: name }))
			.sort((a, b) => a.label.localeCompare(b.label, "ru"));
	}, [panelsQuery.data]);
	const panelFamilyMap = useMemo(
		() => new Map(panelFamilies.map((item) => [item.value, item.label])),
		[panelFamilies],
	);
	const images = useTextureCombinationImagesAdmin();
	const createImage = useCreateTextureCombinationImage();
	const updateImage = useUpdateTextureCombinationImage();
	const deleteImage = useDeleteTextureCombinationImage();
	const textureMap = useMemo(
		() => new Map(textures.map((texture) => [texture.id, texture.name])),
		[textures],
	);
	const options = textures.map((texture) => ({
		value: texture.id,
		label: texture.name,
	}));
	const visibleImages = useMemo(
		() =>
			(images.data ?? []).filter((item) => {
				const matchesMode =
					mode === "mono"
						? item.texture_id_1 === item.texture_id_2
						: item.texture_id_1 !== item.texture_id_2;
				const matchesPanel =
					!panelFilter ||
					(item.panel_family_1 ?? "") === panelFilter ||
					(mode === "combined" && (item.panel_family_2 ?? "") === panelFilter);
				return matchesMode && matchesPanel;
			}),
		[images.data, mode, panelFilter],
	);

	function changeMode(nextMode: ImageMode): void {
		setMode(nextMode);
		setFirstTextureId(undefined);
		setSecondTextureId(undefined);
		setFirstPanelFamily(undefined);
		setSecondPanelFamily(undefined);
	}

	function resetCardDraft(): void {
		setCardTitle("");
		setProjectId("");
		setProjectAddress("");
		setExecutionVariantId("");
		setCardSubtitle("");
		setCardPrice("");
		setCardArea("");
		setCardCategory("home");
		setFirstPanelFamily(undefined);
		setSecondPanelFamily(undefined);
		setNewImagePaths([]);
	}

	function removeNewImagePath(path: string): void {
		setNewImagePaths((prev) => prev.filter((item) => item !== path));
	}

	function createCard(): void {
		if (!firstTextureId) {
			message.warning("Сначала выберите текстуру");
			return;
		}
		const textureId2 = mode === "mono" ? firstTextureId : secondTextureId;
		if (!textureId2) {
			message.warning("Сначала выберите обе текстуры");
			return;
		}
		const [panelFamily1, panelFamily2] = normalizePanelPair(
			firstPanelFamily,
			secondPanelFamily,
			mode,
		);
		if (!panelFamily1) {
			message.warning("Сначала выберите базовую панель");
			return;
		}
		if (mode === "combined" && !panelFamily2) {
			message.warning("Сначала выберите обе базовые панели");
			return;
		}
		if (newImagePaths.length === 0) {
			message.warning("Сначала загрузите хотя бы одно фото");
			return;
		}
		if (!cardTitle.trim()) {
			message.warning(
				"Заполните название — иначе карточка не попадёт на страницу «Пространства»",
			);
			return;
		}
		if (!executionVariantId) {
			message.warning("Выберите исполнение для новой карточки пространства");
			return;
		}
		const card = {
			title: cardTitle.trim(),
			project_id: projectId.trim() || crypto.randomUUID(),
			project_address: projectAddress.trim(),
			execution_variant_id: executionVariantId,
			subtitle: cardSubtitle.trim(),
			price: withCardUnit(cardPrice, "₽"),
			area: withCardUnit(cardArea, "м²"),
			category: cardCategory,
		};
		const textureId1 = firstTextureId;
		const secondId = textureId2;
		const paths = [...newImagePaths];
		// Одно заполнение + несколько фото — ОДНА карточка: все фото уходят
		// одним запросом в её галерею. Если карточка для выбранных
		// текстур и панелей уже есть, сервер допишет фото в неё же.
		createImage.mutate(
			{
				texture_id_1: textureId1,
				texture_id_2: secondId,
				panel_family_1: panelFamily1,
				panel_family_2: panelFamily2,
				image_path: paths[0] as string,
				image_paths: paths,
				card: { ...card },
			},
			{
				onSuccess: () => {
					message.success(
						paths.length === 1
							? "Карточка сохранена"
							: `Карточка сохранена: фото в галерее — ${paths.length}`,
					);
					resetCardDraft();
				},
				onError: (error) =>
					message.error(
						error instanceof Error
							? error.message
							: "Не удалось сохранить карточку",
					),
			},
		);
	}

	function openEditor(row: ApiTextureCombinationImage): void {
		setEditing(row);
		setEditTextureId1(row.texture_id_1);
		setEditTextureId2(row.texture_id_2);
		setEditPanelFamily1(normalizePanelFamily(row.panel_family_1) || undefined);
		setEditPanelFamily2(normalizePanelFamily(row.panel_family_2) || undefined);
		setEditGallery(
			row.image_paths?.length ? [...row.image_paths] : [row.image_path],
		);
		setEditImageChanged(false);
		setEditCard({ ...EMPTY_CARD, ...(row.card ?? {}) });
		setProjectId(row.card?.project_id || "");
		setProjectAddress(row.card?.project_address || "");
		setExecutionVariantId(row.card?.execution_variant_id || "");
	}

	function closeEditor(): void {
		setEditing(null);
		setEditTextureId1(undefined);
		setEditTextureId2(undefined);
		setEditPanelFamily1(undefined);
		setEditPanelFamily2(undefined);
		setEditGallery([]);
		setEditImageChanged(false);
		setEditCard({ ...EMPTY_CARD });
		setProjectId("");
		setProjectAddress("");
		setExecutionVariantId("");
	}

	function saveEditor(): void {
		if (!editing || !editTextureId1 || editGallery.length === 0) return;
		if (!executionVariantId) {
			message.warning("Выберите исполнение для этой карточки пространства");
			return;
		}
		const secondId =
			editing.texture_id_1 === editing.texture_id_2
				? editTextureId1
				: editTextureId2;
		if (
			!secondId ||
			(editing.texture_id_1 !== editing.texture_id_2 &&
				secondId === editTextureId1)
		)
			return;
		const isMonoRow = editing.texture_id_1 === editing.texture_id_2;
		const [panelFamily1, panelFamily2] = normalizePanelPair(
			editPanelFamily1,
			editPanelFamily2,
			isMonoRow ? "mono" : "combined",
		);
		updateImage.mutate(
			{
				id: editing.id,
				body: {
					texture_id_1: editTextureId1,
					texture_id_2: secondId,
					panel_family_1: panelFamily1,
					panel_family_2: panelFamily2,
					image_path: editGallery[0] as string,
					image_paths: [...editGallery],
					card: {
						title: editCard.title.trim(),
						project_id:
							projectId.trim() || editing.card?.project_id || editing.id,
						project_address: projectAddress.trim(),
						execution_variant_id: executionVariantId,
						subtitle: editCard.subtitle.trim(),
						price: withCardUnit(editCard.price, "₽"),
						area: withCardUnit(editCard.area, "м²"),
						category: editCard.category,
					},
				},
			},
			{
				onSuccess: () => {
					message.success(
						editImageChanged
							? "Фотографии карточки обновлены"
							: "Карточка обновлена",
					);
					closeEditor();
				},
				onError: (error) =>
					message.error(
						error instanceof Error
							? error.message
							: "Не удалось обновить карточку",
					),
			},
		);
	}

	function removeEditGalleryPhoto(path: string): void {
		setEditGallery((prev) => prev.filter((item) => item !== path));
		setEditImageChanged(true);
	}

	function makeEditGalleryCover(path: string): void {
		setEditGallery((prev) => [path, ...prev.filter((item) => item !== path)]);
		setEditImageChanged(true);
	}

	function saveRowCard(
		row: ApiTextureCombinationImage,
		draft: CardDraft,
	): void {
		updateImage.mutate(
			{
				id: row.id,
				body: {
					texture_id_1: row.texture_id_1,
					texture_id_2: row.texture_id_2,
					panel_family_1: normalizePanelFamily(row.panel_family_1),
					panel_family_2: normalizePanelFamily(row.panel_family_2),
					image_path: row.image_path,
					card: {
						title: draft.title.trim(),
						project_id: row.card?.project_id || row.id,
						project_address: row.card?.project_address || "",
						execution_variant_id: row.card?.execution_variant_id || "",
						subtitle: draft.subtitle.trim(),
						price: withCardUnit(draft.price, "₽"),
						area: withCardUnit(draft.area, "м²"),
						category: draft.category,
					},
				},
			},
			{
				onSuccess: () => message.success("Тексты карточки сохранены"),
				onError: (error) =>
					message.error(
						error instanceof Error
							? error.message
							: "Не удалось сохранить тексты карточки",
					),
			},
		);
	}

	const columns = [
		{
			title: "Фотография",
			dataIndex: "image_path",
			key: "photo",
			width: 210,
			render: (_: unknown, row: ApiTextureCombinationImage) => {
				const gallery = row.image_paths?.length
					? row.image_paths
					: [row.image_path];
				const cover = gallery[0];
				const rest = gallery.slice(1, 3);
				return (
					<Space direction="vertical" size={6} style={{ width: 186 }}>
						<Image
							src={imageSrc(cover)}
							alt={`Фотография — ${textureMap.get(row.texture_id_1) ?? row.texture_id_1}`}
							width={186}
							style={{ objectFit: "cover" }}
							preview={{ mask: "Увеличить" }}
						/>
						{rest.length > 0 && (
							<Space size={4} wrap>
								{rest.map((path) => (
									<Image
										key={path}
										src={imageSrc(path)}
										alt={`Фото галереи — ${textureMap.get(row.texture_id_1) ?? row.texture_id_1}`}
										width={58}
										style={{ objectFit: "cover" }}
										preview={{ mask: "Увеличить" }}
									/>
								))}
								{gallery.length > 3 && (
									<span style={{ fontSize: 12, color: "#6b7280" }}>
										+{gallery.length - 3}
									</span>
								)}
							</Space>
						)}
					</Space>
				);
			},
		},
		{
			title: mode === "mono" ? "Текстура" : "Текстура 1",
			dataIndex: "texture_id_1",
			key: "texture_id_1",
			render: (id: string) => textureMap.get(id) ?? id,
		},
		...(mode === "combined"
			? [
					{
						title: "Текстура 2",
						dataIndex: "texture_id_2",
						key: "texture_id_2",
						render: (id: string) => textureMap.get(id) ?? id,
					},
				]
			: []),
		{
			title: mode === "mono" ? "Панель" : "Панель 1",
			dataIndex: "panel_family_1",
			key: "panel_family_1",
			render: (_: unknown, row: ApiTextureCombinationImage) => {
				const family = normalizePanelFamily(row.panel_family_1);
				return family ? (
					(panelFamilyMap.get(family) ?? family)
				) : (
					<Text type="secondary">—</Text>
				);
			},
		},
		...(mode === "combined"
			? [
					{
						title: "Панель 2",
						dataIndex: "panel_family_2",
						key: "panel_family_2",
						render: (_: unknown, row: ApiTextureCombinationImage) => {
							const family = normalizePanelFamily(row.panel_family_2);
							return family ? (
								(panelFamilyMap.get(family) ?? family)
							) : (
								<Text type="secondary">—</Text>
							);
						},
					},
				]
			: []),
		{
			title: "Карточка страницы",
			dataIndex: "card",
			key: "card",
			render: (_: unknown, row: ApiTextureCombinationImage) => (
				<RowCardEditor
					key={row.id}
					row={row}
					onSave={saveRowCard}
					isSaving={updateImage.isPending}
				/>
			),
		},
		{
			title: "Действия",
			key: "actions",
			width: 110,
			render: (_: unknown, row: ApiTextureCombinationImage) => (
				<Space size={4}>
					<Button
						type="text"
						icon={<EditOutlined />}
						aria-label="Редактировать изображение"
						onClick={() => openEditor(row)}
					/>
					<Popconfirm
						title="Удалить изображение?"
						okText="Удалить"
						okButtonProps={{ danger: true }}
						cancelText="Отмена"
						onConfirm={() => deleteImage.mutate(row.id)}
					>
						<Button
							type="text"
							danger
							icon={<DeleteOutlined />}
							aria-label="Удалить изображение"
						/>
					</Popconfirm>
				</Space>
			),
		},
	];

	const ready =
		!!firstTextureId &&
		(mode === "mono" ||
			(!!secondTextureId && firstTextureId !== secondTextureId)) &&
		!!firstPanelFamily &&
		(mode === "mono" ||
			(!!secondPanelFamily && firstPanelFamily !== secondPanelFamily));

	return (
		<div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>
			<Space direction="vertical" size={16} style={{ width: "100%" }}>
				<Segmented<ImageMode>
					value={mode}
					onChange={changeMode}
					options={[
						{ label: "Моно", value: "mono" },
						{ label: "Комбинации", value: "combined" },
					]}
				/>

				<Text type="secondary">
					{mode === "mono"
						? "Добавляйте несколько интерьерных фотографий для одной текстуры и одной базовой панели."
						: "Добавляйте несколько интерьерных фотографий для одной пары текстур и одной пары базовых панелей."}
				</Text>

				<Space wrap>
					<Select
						placeholder={mode === "mono" ? "Текстура" : "Первая текстура"}
						style={{ minWidth: 240 }}
						value={firstTextureId}
						onChange={(value) => {
							setFirstTextureId(value);
							if (value === secondTextureId) setSecondTextureId(undefined);
						}}
						options={options}
						showSearch
						optionFilterProp="label"
					/>
					{mode === "combined" && (
						<Select
							placeholder="Вторая текстура"
							style={{ minWidth: 240 }}
							value={secondTextureId}
							onChange={setSecondTextureId}
							options={options.filter(
								(option) => option.value !== firstTextureId,
							)}
							showSearch
							optionFilterProp="label"
						/>
					)}
					<Select
						aria-label={
							mode === "mono" ? "Базовая панель" : "Первая базовая панель"
						}
						placeholder={
							mode === "mono" ? "Базовая панель" : "Первая базовая панель"
						}
						style={{ minWidth: 240 }}
						value={firstPanelFamily}
						onChange={(value) => {
							setFirstPanelFamily(value);
							if (value === secondPanelFamily) setSecondPanelFamily(undefined);
						}}
						options={panelFamilies}
						showSearch
						optionFilterProp="label"
						loading={panelsQuery.isFetching}
					/>
					{mode === "combined" && (
						<Select
							aria-label="Вторая базовая панель"
							placeholder="Вторая базовая панель"
							style={{ minWidth: 240 }}
							value={secondPanelFamily}
							onChange={setSecondPanelFamily}
							options={panelFamilies.filter(
								(option) => option.value !== firstPanelFamily,
							)}
							showSearch
							optionFilterProp="label"
							loading={panelsQuery.isFetching}
						/>
					)}
				</Space>

				<div
					style={{
						border: "1px solid #e5e7eb",
						borderRadius: 12,
						padding: "12px 16px",
						background: "#fafafa",
						width: "100%",
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: 8 }}>
						Новая карточка для «Пространств»
					</div>
					<div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
						Выберите текстуры и базовые панели, заполните поля и загрузите фото
						— карточка с названием сразу появится на странице «Пространства».
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(2, minmax(200px, 1fr))",
							gap: "8px 12px",
							marginBottom: 8,
						}}
					>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Название</span>
							<Input
								aria-label="Название карточки"
								placeholder="Например: Современная гостиная"
								value={cardTitle}
								onChange={(event) => setCardTitle(event.target.value)}
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>
								Адрес объекта (необязательно)
							</span>
							<Input
								aria-label="Адрес объекта"
								placeholder="Улица, дом или название объекта"
								value={projectAddress}
								onChange={(event) => setProjectAddress(event.target.value)}
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Исполнение</span>
							<Select
								aria-label="Вариант исполнения пространства"
								value={executionVariantId || undefined}
								onChange={setExecutionVariantId}
								options={executionOptions}
								optionRender={(option) => (
									<span
										style={{ display: "flex", alignItems: "center", gap: 8 }}
									>
										{option.data.image ? (
											<img
												src={imageSrc(option.data.image)}
												alt=""
												style={{
													width: 32,
													height: 32,
													objectFit: "cover",
													borderRadius: 4,
												}}
											/>
										) : null}
										<span>{option.data.label}</span>
									</span>
								)}
								placeholder="Выберите исполнение"
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Детали</span>
							<Input
								aria-label="Детали карточки"
								placeholder="Например: Современный · Текстиль · моно"
								value={cardSubtitle}
								onChange={(event) => setCardSubtitle(event.target.value)}
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Назначение</span>
							<Select
								aria-label="Назначение карточки"
								value={cardCategory}
								onChange={(value) =>
									setCardCategory(normalizeCardCategory(value))
								}
								options={SPACE_CARD_CATEGORIES}
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Цена</span>
							<Input
								aria-label="Цена карточки"
								placeholder="Например: от 196 460 ₽"
								value={cardPrice}
								onBlur={() => setCardPrice((value) => withCardUnit(value, "₽"))}
								onChange={(event) => setCardPrice(event.target.value)}
								style={{ width: "100%" }}
							/>
						</label>
						<label>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Площадь</span>
							<Input
								aria-label="Площадь карточки"
								placeholder="Например: Стена 8.4 м²"
								value={cardArea}
								onBlur={() => setCardArea((value) => withCardUnit(value, "м²"))}
								onChange={(event) => setCardArea(event.target.value)}
								style={{ width: "100%" }}
							/>
						</label>
					</div>
					<Space wrap>
						{ready ? (
							<AdminFileUpload
								purpose="MISC"
								multiple
								hint={
									mode === "mono"
										? "Загрузите одно или несколько фото для выбранной текстуры и базовой панели — все попадут в галерею одной карточки"
										: "Загрузите одно или несколько фото для выбранной пары текстур и пары базовых панелей — все попадут в галерею одной карточки"
								}
								disabled={createImage.isPending}
								onUploaded={(asset) =>
									setNewImagePaths((prev) =>
										prev.includes(asset.path) ? prev : [...prev, asset.path],
									)
								}
							/>
						) : (
							<Text type="secondary">
								Загрузка фото станет доступна после выбора текстуры и базовой
								панели выше.
							</Text>
						)}
						{newImagePaths.length > 0 && (
							<Space wrap size={8}>
								{newImagePaths.map((path) => (
									<div key={path} style={{ position: "relative" }}>
										<Image
											src={imageSrc(path)}
											alt="Фото новой карточки"
											width={120}
											style={{ objectFit: "cover" }}
											preview={{ mask: "Увеличить" }}
										/>
										<Button
											type="text"
											size="small"
											danger
											aria-label={`Убрать фото ${path}`}
											onClick={() => removeNewImagePath(path)}
											style={{
												position: "absolute",
												top: 0,
												right: 0,
												background: "rgba(255,255,255,0.9)",
											}}
										>
											×
										</Button>
									</div>
								))}
							</Space>
						)}
						<Button
							type="primary"
							aria-label={
								newImagePaths.length > 1
									? `Создать карточку (фото: ${newImagePaths.length})`
									: "Создать карточку"
							}
							loading={createImage.isPending}
							disabled={
								!ready ||
								newImagePaths.length === 0 ||
								!cardTitle.trim() ||
								!executionVariantId
							}
							onClick={createCard}
						>
							{newImagePaths.length > 1
								? `Создать карточку (фото: ${newImagePaths.length})`
								: "Создать карточку"}
						</Button>
					</Space>
				</div>

				<Space wrap aria-label="Фильтр по панелям">
					<Button
						type={!panelFilter ? "primary" : "default"}
						onClick={() => setPanelFilter(undefined)}
					>
						Все панели
					</Button>
					{panelFamilies.map((panel) => (
						<Button
							key={panel.value}
							type={panelFilter === panel.value ? "primary" : "default"}
							onClick={() =>
								setPanelFilter(
									panelFilter === panel.value ? undefined : panel.value,
								)
							}
						>
							{panel.label}
						</Button>
					))}
				</Space>

				{visibleImages.length === 0 && !images.isFetching ? (
					<Empty
						description={
							mode === "mono"
								? "Нет моно изображений"
								: "Нет изображений для комбинаций текстур"
						}
					/>
				) : (
					<Table<ApiTextureCombinationImage>
						rowKey="id"
						dataSource={visibleImages}
						columns={columns}
						loading={images.isFetching}
						pagination={false}
					/>
				)}
			</Space>

			<Modal
				open={!!editing}
				title={
					editing?.texture_id_1 === editing?.texture_id_2
						? "Редактировать моно изображение"
						: "Редактировать комбинацию"
				}
				onCancel={closeEditor}
				onOk={saveEditor}
				okText="Сохранить"
				cancelText="Отмена"
				confirmLoading={updateImage.isPending}
				okButtonProps={{
					disabled:
						!editTextureId1 ||
						!executionVariantId ||
						editGallery.length === 0 ||
						(editing?.texture_id_1 !== editing?.texture_id_2 &&
							(!editTextureId2 || editTextureId1 === editTextureId2)),
				}}
				destroyOnHidden
			>
				<Space direction="vertical" size={16} style={{ width: "100%" }}>
					<Select
						aria-label={
							editing?.texture_id_1 === editing?.texture_id_2
								? "Текстура изображения"
								: "Первая текстура изображения"
						}
						value={editTextureId1}
						onChange={(value) => {
							setEditTextureId1(value);
							if (value === editTextureId2) setEditTextureId2(undefined);
						}}
						options={options}
						showSearch
						optionFilterProp="label"
						style={{ width: "100%" }}
					/>
					{editing?.texture_id_1 !== editing?.texture_id_2 && (
						<Select
							aria-label="Вторая текстура изображения"
							value={editTextureId2}
							onChange={setEditTextureId2}
							options={options.filter(
								(option) => option.value !== editTextureId1,
							)}
							showSearch
							optionFilterProp="label"
							style={{ width: "100%" }}
						/>
					)}
					<Select
						aria-label={
							editing?.texture_id_1 === editing?.texture_id_2
								? "Базовая панель изображения"
								: "Первая базовая панель изображения"
						}
						value={editPanelFamily1}
						onChange={(value) => {
							setEditPanelFamily1(value);
							if (value === editPanelFamily2) setEditPanelFamily2(undefined);
						}}
						options={panelFamilies}
						showSearch
						optionFilterProp="label"
						style={{ width: "100%" }}
					/>
					{editing?.texture_id_1 !== editing?.texture_id_2 && (
						<Select
							aria-label="Вторая базовая панель изображения"
							value={editPanelFamily2}
							onChange={setEditPanelFamily2}
							options={panelFamilies.filter(
								(option) => option.value !== editPanelFamily1,
							)}
							showSearch
							optionFilterProp="label"
							style={{ width: "100%" }}
						/>
					)}
					{editGallery.length > 0 && (
						<div>
							<Text strong>
								Фотографии карточки ({editGallery.length}) — первая станет
								обложкой на «Пространствах»
							</Text>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
									gap: 8,
									marginTop: 8,
								}}
							>
								{editGallery.map((path, index) => (
									<div key={path} style={{ position: "relative" }}>
										<Image
											src={imageSrc(path)}
											alt={
												index === 0
													? "Обложка карточки"
													: `Фото ${index + 1} карточки`
											}
											width="100%"
											style={{ objectFit: "cover", aspectRatio: "4 / 3" }}
										/>
										{index === 0 && (
											<Tag
												color="green"
												style={{
													position: "absolute",
													top: 4,
													left: 4,
												}}
											>
												Обложка
											</Tag>
										)}
										<Space
											size={4}
											style={{
												position: "absolute",
												bottom: 4,
												right: 4,
											}}
										>
											{index !== 0 && (
												<Button
													size="small"
													aria-label={`Сделать обложкой — фото ${index + 1}`}
													onClick={() => makeEditGalleryCover(path)}
													style={{ background: "rgba(255,255,255,0.9)" }}
												>
													Обложка
												</Button>
											)}
											<Button
												size="small"
												danger
												aria-label={`Убрать фото ${index + 1} из карточки`}
												onClick={() => removeEditGalleryPhoto(path)}
												disabled={editGallery.length <= 1}
												style={{ background: "rgba(255,255,255,0.9)" }}
											>
												×
											</Button>
										</Space>
									</div>
								))}
							</div>
						</div>
					)}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: "8px 12px",
						}}
					>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Название</span>
							<Input
								aria-label="Название карточки"
								placeholder="Например: Современная гостиная"
								value={editCard.title}
								onChange={(event) =>
									setEditCard((card) => ({
										...card,
										title: event.target.value,
									}))
								}
							/>
						</label>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Детали</span>
							<Input
								aria-label="Детали карточки"
								placeholder="Например: Современный · Текстиль · моно"
								value={editCard.subtitle}
								onChange={(event) =>
									setEditCard((card) => ({
										...card,
										subtitle: event.target.value,
									}))
								}
							/>
						</label>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Исполнение</span>
							<Select
								aria-label="Вариант исполнения пространства"
								value={executionVariantId || undefined}
								onChange={setExecutionVariantId}
								options={executionOptions}
								optionRender={(option) => (
									<span
										style={{ display: "flex", alignItems: "center", gap: 8 }}
									>
										{option.data.image ? (
											<img
												src={imageSrc(option.data.image)}
												alt=""
												style={{
													width: 32,
													height: 32,
													objectFit: "cover",
													borderRadius: 4,
												}}
											/>
										) : null}
										<span>{option.data.label}</span>
									</span>
								)}
								placeholder="Выберите исполнение"
								style={{ width: "100%" }}
							/>
						</label>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Назначение</span>
							<Select
								aria-label="Назначение карточки"
								value={editCard.category}
								onChange={(value) =>
									setEditCard((card) => ({
										...card,
										category: normalizeCardCategory(value),
									}))
								}
								options={SPACE_CARD_CATEGORIES}
								style={{ width: "100%" }}
							/>
						</label>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Цена</span>
							<Input
								aria-label="Цена карточки"
								placeholder="Например: от 196 460 ₽"
								value={editCard.price}
								onBlur={() =>
									setEditCard((card) => ({
										...card,
										price: withCardUnit(card.price, "₽"),
									}))
								}
								onChange={(event) =>
									setEditCard((card) => ({
										...card,
										price: event.target.value,
									}))
								}
							/>
						</label>
						<label style={{ display: "block", width: "100%" }}>
							<span style={{ fontSize: 12, color: "#6b7280" }}>Площадь</span>
							<Input
								aria-label="Площадь карточки"
								placeholder="Например: Стена 8.4 м²"
								value={editCard.area}
								onBlur={() =>
									setEditCard((card) => ({
										...card,
										area: withCardUnit(card.area, "м²"),
									}))
								}
								onChange={(event) =>
									setEditCard((card) => ({
										...card,
										area: event.target.value,
									}))
								}
							/>
						</label>
					</div>
					<div>
						<Text strong>Добавить фотографии в карточку</Text>
						<div style={{ marginTop: 8 }}>
							<AdminFileUpload
								purpose="MISC"
								multiple
								hint="Выберите одно или несколько фото — они добавятся в галерею этой карточки"
								disabled={updateImage.isPending}
								onUploaded={(asset) => {
									setEditGallery((prev) =>
										prev.includes(asset.path) ? prev : [...prev, asset.path],
									);
									setEditImageChanged(true);
								}}
							/>
						</div>
					</div>
				</Space>
			</Modal>
		</div>
	);
}
