/**
 * Phase 12 — Admin Panels Variants Management Page.
 *
 * Active catalog matrix. Every column stays concise:
 * - ID is the last 4 chars with a clipboard icon.
 * - Панель shows name + form thumbnail; thumbnail opens a preview drawer.
 * - Размер dropdown writes PATCH /api/admin/panels/{id} with width_mm/height_mm/size_label.
 * - Текстура dropdown writes PATCH /api/admin/panel-variants/{id} with texture_id.
 * - Варианты исполнений click opens the editor focused on execution photos.
 * - Фото в дизайне click opens the editor focused on interiors (design_image_paths belong to the chosen execution, not the texture).
 */

import {
	lazy,
	Suspense,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	Typography,
	Card,
	Table,
	Button,
	Space,
	Popconfirm,
	message,
	Select,
	Modal,
	Switch,
	Tooltip,
	Drawer,
} from "antd";
import {
	CopyOutlined,
	ClearOutlined,
	DeleteOutlined,
	EditOutlined,
	EyeOutlined,
	PlusOutlined,
	UploadOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";

import { sortPanels } from "../lib/sortPanels";
import { imageSrc } from "../../../shared/lib/imageSrc";
import {
	usePanelVariantsAdminList,
	useUpdatePanelVariant,
	useDeletePanelVariantGroup,
	useDeletePanelVariantRow,
	useUpdatePanelVariantRowActivity,
	useUpdatePanelVariantRowTexture,
	useReorderPanelVariants,
	type ApiPanelVariant,
} from "../api/panelVariantsAdminApi";
import {
	usePanelsAdminList,
	useUpdatePanel,
	useDeletePanel,
	type ApiPanel,
} from "../api/panelsAdminApi";
import { Select as AntdSelect } from "antd";
import { useAdminTextures, type ApiTexture } from "../api/texturesAdminApi";
import { usePanelTextureAssignments } from "../api/panelTextureAssignmentsAdminApi";
import AdminVariantEditModal, {
	type VariantPhotoDraft,
} from "./AdminVariantEditModal";
import AddExecutionModal from "./AddExecutionModal";
import { uploadFile } from "../lib/uploadFile";
import { PANEL_SIZES } from "../../../shared/config/constants";

const PanelsManager = lazy(() => import("./AdminUploadPage"));
const TexturesManager = lazy(() => import("./AdminTexturesPage"));

const { Text } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
	}),
};

interface AdminPanelsPageProps {
	embedded?: boolean;
	panel?: ApiPanel;
}

const MINI = 40;
const GALLERY_COLUMNS = 4;
const GALLERY_WIDTH = MINI * GALLERY_COLUMNS + 4 * (GALLERY_COLUMNS - 1);

interface GalleryCellProps {
	paths: string[];
	emptyLabel: string;
	onClick?: () => void;
	onItemClick?: (index: number) => void;
	/** Optional "+" badge that opens an "add variant" flow for the row. */
	addLabel?: string;
	onAdd?: () => void;
	/** Optional final tile rendered inside the same thumbnail grid. */
	trailingItem?: ReactNode;
}

function GalleryCell({
	paths,
	emptyLabel,
	onClick,
	onItemClick,
	addLabel,
	onAdd,
	trailingItem,
}: GalleryCellProps) {
	return (
		<div
			style={{
				display: "grid",
				gridTemplateColumns: `repeat(${GALLERY_COLUMNS}, ${MINI}px)`,
				alignContent: "start",
				gap: 4,
				width: GALLERY_WIDTH,
				maxWidth: "100%",
			}}
		>
			{paths.map((path, index) => (
				<button
					key={`${path}-${index}`}
					type="button"
					onClick={() => {
						if (onItemClick) onItemClick(index);
						else onClick?.();
					}}
					aria-label="Открыть миниатюры"
					title={emptyLabel}
					style={{
						width: MINI,
						height: MINI,
						padding: 3,
						border: "1px solid #e5e7eb",
						borderRadius: 4,
						background: "#fafafa",
						cursor: "pointer",
					}}
				>
					<img
						src={imageSrc(path)}
						alt=""
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				</button>
			))}
			{(onAdd || onClick) && (
				<Button
					type="dashed"
					onClick={onAdd ?? onClick}
					aria-label={addLabel ?? emptyLabel}
					title={addLabel ?? emptyLabel}
					icon={<PlusOutlined />}
					style={{
						width: MINI,
						minWidth: MINI,
						height: MINI,
						padding: 0,
						borderRadius: 4,
						background: "#fafafa",
					}}
				/>
			)}
			{trailingItem}
		</div>
	);
}

function TexturePreviewModal({
	texture,
	open,
	onClose,
	onEdit,
}: {
	texture: ApiTexture | null;
	open: boolean;
	onClose: () => void;
	onEdit: () => void;
}) {
	return (
		<Modal
			open={open}
			onCancel={onClose}
			footer={
				<Button
					aria-label="Редактировать текстуру"
					icon={<EditOutlined />}
					onClick={onEdit}
				>
					Редактировать текстуру
				</Button>
			}
			title={texture ? `Фактура: ${texture.name}` : "Фактура"}
			destroyOnHidden
			width={720}
		>
			{texture && (
				<div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
					<img
						src={imageSrc(texture.swatch_image)}
						alt={texture.name}
						style={{
							width: 280,
							height: 280,
							objectFit: "cover",
							borderRadius: 8,
							border: "1px solid #e5e7eb",
							background: "#fafafa",
						}}
					/>
					<div>
						<Text strong style={{ fontSize: 18 }}>
							{texture.name}
						</Text>
						<div style={{ marginTop: 16 }}>
							<Text type="secondary">Артикул: </Text>
							<Text code>{texture.slug}</Text>
						</div>
						<div style={{ marginTop: 8 }}>
							<Text type="secondary">Порядок: </Text>
							<Text>{texture.sort_order}</Text>
						</div>
						<div style={{ marginTop: 8 }}>
							<Text type="secondary">Активна: </Text>
							<Text>{texture.is_active ? "Да" : "Нет"}</Text>
						</div>
					</div>
				</div>
			)}
		</Modal>
	);
}

interface PanelPreviewDrawerProps {
	panel: ApiPanel | null;
	onClose: () => void;
	onEdit: () => void;
	photos: string[];
	uploadingKey: string | null;
	onUpload: (file: File, replaceIndex: number | null) => void;
	onDeletePhoto: (index: number) => void;
}

function PanelPreviewDrawer({
	panel,
	onClose,
	onEdit,
	photos,
	uploadingKey,
	onUpload,
	onDeletePhoto,
}: PanelPreviewDrawerProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [uploadSlot, setUploadSlot] = useState<number | null>(null);
	const openPicker = (slot: number | null) => {
		setUploadSlot(slot);
		inputRef.current?.click();
	};
	return (
		<Drawer
			open={!!panel}
			onClose={onClose}
			title={panel ? `Базовая форма: ${panel.name}` : "Базовая форма"}
			width={520}
			destroyOnHidden
			footer={
				<Space style={{ width: "100%", justifyContent: "flex-end" }}>
					<Button onClick={onClose}>Закрыть</Button>
					<Button
						type="primary"
						icon={<EditOutlined />}
						aria-label="Редактировать базовую панель"
						onClick={onEdit}
					>
						Редактировать базовую панель
					</Button>
				</Space>
			}
		>
			{panel && (
				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{photos.length > 0 && (
						<img
							src={imageSrc(photos[0])}
							alt={panel.name}
							style={{
								width: "100%",
								maxHeight: 360,
								objectFit: "cover",
								borderRadius: 8,
							}}
						/>
					)}
					<Text strong style={{ fontSize: 16 }}>
						{panel.name}
					</Text>
					<Text type="secondary">{panel.size_label}</Text>
					<div>
						<Text type="secondary">Артикул: </Text>
						<Text code>{panel.slug}</Text>
					</div>
					<div>
						<Text type="secondary">Цена: </Text>
						<Text>{panel.base_price} ₽</Text>
					</div>
					{panel.description && <Text>{panel.description}</Text>}
					<div>
						<Text strong style={{ fontSize: 14 }}>
							Фото формы
						</Text>
						<div style={{ marginTop: 8 }}>
							<GalleryCell
								paths={photos}
								emptyLabel="Добавить фото формы"
								addLabel="Добавить фото формы"
								onAdd={() => openPicker(null)}
								trailingItem={
									photos.length > 0 ? (
										<Space size={4} wrap>
											{photos.map((photoPath, index) => (
												<Space
													key={`${photoPath}-${index}`}
													size={4}
													wrap={false}
												>
													<Button
														size="small"
														icon={<UploadOutlined />}
														aria-label={`Заменить фото ${index + 1}`}
														title="Заменить фото"
														loading={uploadingKey === `${panel.id}:${index}`}
														onClick={() => openPicker(index)}
													>
														Фото {index + 1}
													</Button>
													<Popconfirm
														title="Удалить фото?"
														okText="Удалить"
														okButtonProps={{ danger: true }}
														cancelText="Отмена"
														onConfirm={() => onDeletePhoto(index)}
													>
														<Button
															size="small"
															danger
															icon={<DeleteOutlined />}
															aria-label={`Удалить фото ${index + 1}`}
															title="Удалить фото"
														>
															Удалить
														</Button>
													</Popconfirm>
												</Space>
											))}
										</Space>
									) : undefined
								}
							/>
						</div>
						<input
							type="file"
							accept="image/*"
							style={{ display: "none" }}
							aria-label="Выбор файла фото формы"
							ref={inputRef}
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (!file) return;
								onUpload(file, uploadSlot);
							}}
						/>
					</div>
				</div>
			)}
		</Drawer>
	);
}

export default function AdminPanelsPage({
	embedded = false,
	panel,
}: AdminPanelsPageProps = {}) {
	const [addExecutionOpen, setAddExecutionOpen] = useState(false);
	const [addExecutionPanel, setAddExecutionPanel] = useState<ApiPanel | null>(
		null,
	);
	const [editor, setEditor] = useState<
		"panel" | "texture" | ApiPanel | ApiTexture | null
	>(null);
	const [addTextureId, setAddTextureId] = useState<string>();
	const [filterPanelId, setFilterPanelId] = useState<string>();
	const [filterTextureId, setFilterTextureId] = useState<string>();
	const [filterSize, setFilterSize] = useState<string>();
	const selectedPanelId = panel?.id ?? filterPanelId;
	const selectedTextureId = filterTextureId;
	const [editingVariant, setEditingVariant] = useState<ApiPanelVariant | null>(
		null,
	);
	const [photoDrafts] = useState(() => new Map<string, VariantPhotoDraft>());
	const [editingVariantFocus, setEditingVariantFocus] = useState<
		"executions" | "designs" | "recommendations" | null
	>(null);
	const [previewPanel, setPreviewPanel] = useState<ApiPanel | null>(null);
	const [previewTexture, setPreviewTexture] = useState<ApiTexture | null>(null);
	const [templatePick, setTemplatePick] = useState<{
		panelId: string;
		textureId?: string;
	}>({ panelId: "" });
	// Пара «панель+текстура», только что сохранённая кнопкой «Добавить строку»:
	// обычную строку этой пары закрепляем сразу под полем добавления,
	// поверх серверного порядка, пока пользователь не перезагрузит страницу.
	const [sessionStartedAt] = useState(() => Date.now());
	const [pinnedRowKey, setPinnedRowKey] = useState<string | null>(null);
	const [photoUploadTarget, setPhotoUploadTarget] = useState<string | null>(
		null,
	);
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);
	const updatePanel = useUpdatePanel();

	const deletePanel = useDeletePanel();
	const updateRowActivity = useUpdatePanelVariantRowActivity();
	const reorderVariants = useReorderPanelVariants();

	const {
		data: variants,
		isLoading,
		refetch,
	} = usePanelVariantsAdminList({
		// The form filter groups multiple panel IDs by slug. Fetch all executions
		// so selecting a form cannot turn rows into assignment-only placeholders.
		panel_id: panel?.id,
		allPages: true,
	});
	const { data: panels, refetch: refetchPanels } = usePanelsAdminList(
		{
			page: 1,
			size: 100,
			search: null,
			isActive: null,
		},
		{ enabled: !panel },
	);
	const selectedPanel =
		panel ?? panels?.items.find((item) => item.id === filterPanelId);
	const selectedPanelFamily = selectedPanel
		? selectedPanel.slug.replace(/-(?:300x300|300x600|600x600)$/, "")
		: undefined;
	const { data: textures } = useAdminTextures();
	const { data: assignments, refetch: refetchAssignments } =
		usePanelTextureAssignments();
	const updateVariant = useUpdatePanelVariant();
	const deleteVariantGroup = useDeletePanelVariantGroup();
	const deleteVariantRow = useDeletePanelVariantRow();

	const updateRowTexture = useUpdatePanelVariantRowTexture();

	const panelMap = new Map(panels?.items.map((p) => [p.id, p]) ?? []);
	if (panel) panelMap.set(panel.id, panel);
	const textureMap = new Map(textures?.map((t) => [t.id, t]) ?? []);
	const displayPreviewPanel = previewPanel
		? (panelMap.get(previewPanel.id) ?? previewPanel)
		: null;
	const catalogAssignments = useMemo(() => {
		const rows = (assignments ?? [])
			.filter(
				(assignment) =>
					assignment.is_catalog_row && panelMap.has(assignment.panel_id),
			)
			.sort(
				(a, b) =>
					a.sort_order - b.sort_order ||
					b.created_at.localeCompare(a.created_at) ||
					a.id.localeCompare(b.id),
			);
		// New forms occupy the top section even after their first texture is set.
		// Merge virtual and newly persisted rows by the panel creation date so
		// assigning one texture cannot move that row past its neighbours.
		const unassigned = Array.from(panelMap.values()).filter(
			(base) => !rows.some((row) => row.panel_id === base.id),
		);
		const firstRows = rows.filter((row) => row.sort_order < 0);
		const firstPanels = Array.from(
			new Set([
				...unassigned.map((base) => base.id),
				...firstRows.map((row) => row.panel_id),
			]),
		)
			.map((id) => panelMap.get(id)!)
			.sort(
				(a, b) =>
					b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
			);
		const ordered = [...firstPanels];
		// Old copies with a -copy slug remain next to their source. New copies
		// share the source slug and are grouped by creation order naturally.
		for (const copy of firstPanels) {
			const source = firstPanels.find(
				(candidate) =>
					candidate.id !== copy.id &&
					(copy.name === candidate.name ||
						copy.name === `${candidate.name} (копия)`) &&
					new RegExp(
						`^${candidate.slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-copy(?:-\\d+)?$`,
					).test(copy.slug),
			);
			if (!source) continue;
			const current = ordered.indexOf(copy);
			ordered.splice(current, 1);
			ordered.splice(ordered.indexOf(source), 0, copy);
		}
		return [
			...ordered.flatMap((base) => {
				const persisted = firstRows.filter((row) => row.panel_id === base.id);
				return persisted.length
					? persisted
					: [
							{
								id: `unassigned:${base.id}`,
								panel_id: base.id,
								texture_id: "",
								is_active: base.is_active,
								is_catalog_row: true,
								sort_order: -1,
								created_at: base.created_at,
								updated_at: base.created_at,
							},
						];
			}),
			...rows.filter((row) => row.sort_order >= 0),
		];
	}, [assignments, panelMap]);
	const panelFilterOptions = useMemo(() => {
		const families = new Map<string, ApiPanel>();
		for (const base of panelMap.values()) {
			const family = base.slug.replace(/-(?:300x300|300x600|600x600)$/, "");
			const current = families.get(family);
			if (!current || base.slug.endsWith("-300x300"))
				families.set(family, base);
		}
		return Array.from(families.values()).map((base) => ({
			value: base.id,
			label: base.name,
		}));
	}, [panels?.items, panel?.id, panel?.name]);
	const textureFilterOptions = useMemo(
		() =>
			Array.from(
				new Set(catalogAssignments.map((assignment) => assignment.texture_id)),
			).map((textureId) => ({
				value: textureId,
				label: textureMap.get(textureId)?.name ?? "Фактура",
			})),
		[catalogAssignments, textureMap],
	);
	const variantRows = useMemo(() => {
		const groups = new Map<string, ApiPanelVariant[]>();
		for (const variant of variants?.items ?? []) {
			const key = `${variant.panel_id}:${variant.texture_id}`;
			groups.set(key, [...(groups.get(key) ?? []), variant]);
		}
		return catalogAssignments
			.filter(
				(assignment) =>
					(!selectedPanelFamily ||
						panelMap
							.get(assignment.panel_id)
							?.slug.replace(/-(?:300x300|300x600|600x600)$/, "") ===
							selectedPanelFamily) &&
					(!selectedTextureId || assignment.texture_id === selectedTextureId) &&
					(!filterSize ||
						`${panelMap.get(assignment.panel_id)?.width_mm}x${panelMap.get(assignment.panel_id)?.height_mm}` ===
							filterSize),
			)
			.map((assignment) => {
				const executions = [
					...(groups.get(`${assignment.panel_id}:${assignment.texture_id}`) ??
						[]),
				].sort((a, b) => a.sort_order - b.sort_order);
				return executions[0]
					? { ...executions[0], is_active: assignment.is_active, executions }
					: {
							id: `assignment:${assignment.id}`,
							panel_id: assignment.panel_id,
							texture_id: assignment.texture_id,
							name: "",
							slug: "",
							color_id: null,
							color_hex: null,
							image_paths: [],
							design_image_paths: [],
							recommendation_image_paths: [],
							sort_order: 0,
							is_active: assignment.is_active,
							created_at: assignment.created_at,
							updated_at: assignment.updated_at,
							executions,
						};
			});
	}, [
		catalogAssignments,
		selectedPanelFamily,
		selectedTextureId,
		filterSize,
		panelMap,
		variants?.items,
	]);

	// Верхняя пустая строка — только конструктор новой строки: выбранные
	// в ней панель и текстура создают новую строку сохранением, а не
	// редактированием. Ничего серверного в шаблоне не трогаем, пока
	// пользователь не нажмёт «Добавить строку»: базовая панель и текстура
	// уже созданы заранее.
	const templateHeadRow: ApiPanelVariant & { executions: ApiPanelVariant[] } = {
		id: "template:",
		panel_id: templatePick.panelId,
		texture_id: templatePick.textureId ?? "",
		name: "",
		slug: "",
		color_id: null,
		color_hex: null,
		image_paths: [],
		design_image_paths: [],
		recommendation_image_paths: [],
		sort_order: 0,
		is_active: true,
		created_at: "",
		updated_at: "",
		executions: [] as ApiPanelVariant[],
	};
	const tableRows = (() => {
		const sortedRows = sortPanels(
			variantRows,
			(row) => panelMap.get(row.panel_id)?.name ?? "",
			(row) =>
				catalogAssignments.find(
					(a) => a.panel_id === row.panel_id && a.texture_id === row.texture_id,
				)?.created_at ?? row.created_at,
			sessionStartedAt,
		);
		if (!pinnedRowKey) return [templateHeadRow, ...sortedRows];
		const pinnedIndex = sortedRows.findIndex(
			(row) => `${row.panel_id}:${row.texture_id}` === pinnedRowKey,
		);
		if (pinnedIndex <= 0) return [templateHeadRow, ...sortedRows];
		const rows = [...sortedRows];
		const [pinned] = rows.splice(pinnedIndex, 1);
		return [templateHeadRow, pinned, ...rows];
	})();
	const templateReady = Boolean(templatePick.panelId && templatePick.textureId);
	// Template-row picker: all base panels (new rows land on top anyway).
	const templatePanelOptions = Array.from(panelMap.values())
		.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
		.map((base) => ({
			value: base.id,
			label: `${base.name} · ${base.size_label}`,
		}));

	async function handleCreateRow() {
		if (!templatePick.panelId) {
			message.warning("Сначала выберите базовую форму");
			return;
		}
		if (!templatePick.textureId) {
			message.warning("Сначала выберите текстуру");
			return;
		}
		try {
			await updateRowTexture.mutateAsync({
				panel_id: templatePick.panelId,
				current_texture_id: "",
				texture_id: templatePick.textureId,
			});
			setPinnedRowKey(`${templatePick.panelId}:${templatePick.textureId}`);
			setTemplatePick({ panelId: "" });
			setPage(1);
			message.success("Строка создана");
			await Promise.all([refetch(), refetchAssignments()]);
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Не удалось создать строку",
			);
		}
	}

	async function handleDeleteGroup(record: ApiPanelVariant) {
		try {
			await deleteVariantGroup.mutateAsync({
				panelId: record.panel_id,
				textureId: record.texture_id,
			});
			message.success("Все варианты исполнения удалены");
			await Promise.all([refetch(), refetchAssignments()]);
		} catch {
			message.error("Не удалось удалить варианты исполнения");
		}
	}

	function renderGalleryClear(
		record: ApiPanelVariant & { executions: ApiPanelVariant[] },
		field: "design_image_paths" | "recommendation_image_paths",
		label: string,
	) {
		const targets = record.executions.filter(
			(execution) => execution[field].length > 0,
		);
		return (
			<Popconfirm
				title={label + "?"}
				description="Будут очищены только фотографии этой галереи. Исполнения и строка сохранятся."
				okText="Очистить"
				cancelText="Отмена"
				okButtonProps={{ danger: true }}
				onConfirm={async () => {
					try {
						for (const execution of targets)
							await updateVariant.mutateAsync({
								variantId: execution.id,
								body: { [field]: [] },
							});
						await refetch();
						message.success("Галерея очищена");
					} catch {
						message.error(
							"Не удалось полностью очистить галерею. Проверьте оставшиеся фото.",
						);
						await refetch();
					}
				}}
			>
				<Button
					type="text"
					danger
					icon={<ClearOutlined />}
					aria-label={label}
					title={label}
					disabled={targets.length === 0}
					loading={updateVariant.isPending}
					style={{
						width: MINI,
						minWidth: MINI,
						height: MINI,
						padding: 0,
						border: 0,
						background: "transparent",
					}}
				/>
			</Popconfirm>
		);
	}

	async function handleDeleteRow(record: ApiPanelVariant) {
		if (record.id.startsWith("template:")) {
			// Шапка-конструктор существует только на клиенте: сбрасываем
			// выбор, базовую панель и назначения не трогаем.
			setTemplatePick({ panelId: "" });
			return;
		}
		try {
			// Мгновенно убираем из локального кеша, чтобы строка пропала сразу.
			if (record.texture_id) {
				deleteVariantRow.mutate({
					panelId: record.panel_id,
					textureId: record.texture_id,
				});
			} else {
				deletePanel.mutate(record.panel_id);
			}
			if (selectedPanelId === record.panel_id) setFilterPanelId(undefined);
			if (selectedTextureId === record.texture_id)
				setFilterTextureId(undefined);
			message.success("Строка удалена");
		} catch {
			message.error("Не удалось удалить строку");
		}
	}

	async function handlePanelPhotoUpload(
		targetPanel: ApiPanel,
		file: File,
		replaceIndex: number | null,
	) {
		const uploadKey = `${targetPanel.id}:${replaceIndex ?? "add"}`;
		setPhotoUploadTarget(uploadKey);
		try {
			const asset = await uploadFile({ file, purpose: "PANEL_PHOTO" });
			const current = targetPanel.photo_paths.length
				? [...targetPanel.photo_paths]
				: targetPanel.photo_path
					? [targetPanel.photo_path]
					: [];
			const next =
				replaceIndex === null
					? [...current, asset.path].slice(0, 2)
					: current.map((path, index) =>
							index === replaceIndex ? asset.path : path,
						);
			await updatePanel.mutateAsync({
				panelId: targetPanel.id,
				body: { photo_paths: next },
			});
			message.success(
				replaceIndex === null ? "Фото добавлено" : "Фото заменено",
			);
			await refetchPanels();
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Не удалось загрузить фото",
			);
		} finally {
			setPhotoUploadTarget(null);
		}
	}

	async function handlePanelPhotoDelete(targetPanel: ApiPanel, index: number) {
		const current = targetPanel.photo_paths.length
			? [...targetPanel.photo_paths]
			: targetPanel.photo_path
				? [targetPanel.photo_path]
				: [];
		const next = current.filter((_, photoIndex) => photoIndex !== index);
		try {
			await updatePanel.mutateAsync({
				panelId: targetPanel.id,
				body: { photo_paths: next },
			});
			message.success("Фото удалено");
			await refetchPanels();
		} catch {
			message.error("Не удалось удалить фото");
		}
	}

	async function handleTextureChange(
		record: ApiPanelVariant,
		textureId: string,
	) {
		if (!record.panel_id) {
			message.warning("Сначала выберите базовую форму");
			return;
		}
		try {
			await updateRowTexture.mutateAsync({
				panel_id: record.panel_id,
				current_texture_id: record.texture_id,
				texture_id: textureId,
			});
			message.success("Текстура обновлена");
			await Promise.all([refetch(), refetchAssignments()]);
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Не удалось обновить текстуру",
			);
		}
	}

	function openVariantEditor(
		record: ApiPanelVariant,
		focus: "executions" | "designs" | "recommendations",
	) {
		photoDrafts.clear();
		setEditingVariant(record);
		setEditingVariantFocus(focus);
	}

	function openExecutionCreator(record: ApiPanelVariant) {
		const targetPanel = panelMap.get(record.panel_id);
		if (!targetPanel) {
			message.error("Не удалось определить панель для этой строки");
			return;
		}
		setAddExecutionPanel(targetPanel);
		setAddTextureId(record.texture_id);
		setAddExecutionOpen(true);
	}

	const textureOptions = (textures ?? []).map((t) => ({
		value: t.id,
		label: t.name,
		swatch: t.swatch_image,
	}));
	const sizeOptions = PANEL_SIZES.map((s) => ({
		value: `${s.width}x${s.height}`,
		label: s.label,
	}));

	<style>{`
				.ant-select-dropdown.ww-admin-texture-dropdown {
					padding: 0;
					background: #fff;
					border: 1px solid #1f2a44;
					border-radius: 10px;
					box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.08);
					min-width: 240px;
					max-height: 70vh;
					background-clip: padding-box;
				}
				.ant-select-dropdown.ww-admin-texture-dropdown .rc-virtual-list {
					overflow-y: auto !important;
				}
				.ant-select-dropdown.ww-admin-texture-dropdown .ant-select-item {
					padding: 8px 12px;
					transition: background 120ms ease;
				}
				.ant-select-dropdown.ww-admin-texture-dropdown .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
					background: #eef2ff;
				}
				.ant-select-dropdown.ww-admin-texture-dropdown .ant-select-item-option-selected {
					background: #dbe4ff;
					font-weight: 600;
				}
				.ant-select-dropdown-mask {
					background-color: rgba(15, 23, 42, 0.55) !important;
				}
			`}</style>;
	const columns = [
		{
			title: "ID",
			dataIndex: "panel_id",
			key: "panel_id",
			width: 46,
			render: (panelId: string, record: ApiPanelVariant) => {
				if (record.id.startsWith("template:")) {
					// Поле добавления: ячейка ID остаётся пустой.
					return null;
				}
				return (
					<Tooltip title={`Скопировать ID базовой панели: ${panelId}`}>
						<Button
							type="text"
							size="small"
							icon={<CopyOutlined />}
							onClick={() => {
								navigator.clipboard?.writeText(panelId);
								message.success("ID скопирован");
							}}
							aria-label="Скопировать ID"
						/>
					</Tooltip>
				);
			},
		},
		{
			title: (
				<Space wrap={false} style={{ whiteSpace: "nowrap" }}>
					Базовые формы
					<Button
						type="text"
						size="small"
						icon={<PlusOutlined />}
						aria-label="Добавить панель"
						onClick={() => setEditor("panel")}
					/>
				</Space>
			),
			key: "panel",
			width: 240,
			onHeaderCell: () => ({ style: { paddingInline: 4 } }),
			onCell: () => ({ style: { paddingInline: 4 } }),
			render: (_: unknown, record: ApiPanelVariant) => {
				// Шапка-конструктор новой строки: выбор из уже созданных
				// базовых панелей, ничего серверного не трогаем.
				if (record.id.startsWith("template:")) {
					return (
						<Select
							showSearch
							optionFilterProp="label"
							placeholder="Базовая панель…"
							allowClear
							style={{ width: "100%" }}
							size="small"
							aria-label="Базовая панель для новой строки"
							value={templatePick.panelId || undefined}
							options={templatePanelOptions}
							onChange={(panelId) => {
								setTemplatePick({ panelId: panelId ?? "" });
								setPage(1);
							}}
						/>
					);
				}
				const targetPanel = panelMap.get(record.panel_id);
				if (!targetPanel) return record.panel_id;
				const panelPhotos = targetPanel.photo_paths.length
					? targetPanel.photo_paths
					: targetPanel.photo_path
						? [targetPanel.photo_path]
						: [];
				return (
					<div
						style={{
							display: "flex",
							gap: 8,
							width: "100%",
							alignItems: "flex-start",
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 6,
								width: 40,
								minWidth: 40,
								marginRight: 8,
							}}
						>
							<Tooltip title="Просмотр формы">
								<Button
									type="text"
									size="small"
									aria-label="Просмотр формы"
									icon={<EyeOutlined />}
									onClick={() => setPreviewPanel(targetPanel)}
									style={{ padding: 4 }}
								/>
							</Tooltip>
							<Button
								type="text"
								size="small"
								icon={<EditOutlined />}
								onClick={() => setEditor(targetPanel)}
								aria-label="Редактировать панель"
								style={{ padding: 4 }}
							/>
							<Popconfirm
								title="Удалить всю строку?"
								description={
									record.texture_id
										? "Будут удалены все исполнения этой строки. Если это последняя строка панели, базовая панель тоже будет удалена."
										: "Будет удалена базовая панель без назначенной фактуры."
								}
								okText="Удалить строку"
								okButtonProps={{ danger: true }}
								cancelText="Отмена"
								onConfirm={() => handleDeleteRow(record)}
							>
								<Button
									type="text"
									size="small"
									danger
									icon={<DeleteOutlined />}
									aria-label="Удалить строку"
									loading={deleteVariantRow.isPending || deletePanel.isPending}
								/>
							</Popconfirm>
							<Switch
								size="small"
								checked={record.is_active}
								loading={updateRowActivity.isPending || updatePanel.isPending}
								aria-label="Активность варианта"
								onChange={async (value) => {
									try {
										if (record.texture_id) {
											await updateRowActivity.mutateAsync({
												panel_id: record.panel_id,
												texture_id: record.texture_id,
												is_active: value,
											});
										} else {
											await updatePanel.mutateAsync({
												panelId: record.panel_id,
												body: { is_active: value },
											});
										}
										message.success(
											value ? "Вариант активирован" : "Вариант скрыт",
										);
									} catch {
										message.error("Не удалось обновить активность");
									}
								}}
							/>
						</div>
						<div
							style={{
								flex: 1,
								minWidth: 0,
								display: "flex",
								flexDirection: "column",
								gap: 6,
							}}
						>
							<Text
								strong
								ellipsis={{ tooltip: targetPanel.name }}
								style={{ whiteSpace: "normal" }}
							>
								{targetPanel.name}
							</Text>
							<GalleryCell
								paths={panelPhotos}
								emptyLabel="Просмотр фото формы"
								addLabel="Добавить фото формы"
								onItemClick={() => setPreviewPanel(targetPanel)}
								onAdd={() => setPreviewPanel(targetPanel)}
								trailingItem={
									<Popconfirm
										title="Удалить все фото базовой формы?"
										description="Миниатюры будут убраны из карточки формы."
										okText="Удалить все"
										okButtonProps={{ danger: true }}
										cancelText="Отмена"
										onConfirm={async () => {
											try {
												await updatePanel.mutateAsync({
													panelId: targetPanel.id,
													body: { photo_paths: [] },
												});
												message.success("Фото удалены");
												await refetchPanels();
											} catch {
												message.error("Не удалось удалить фото");
											}
										}}
									>
										<Button
											type="text"
											danger
											icon={<ClearOutlined />}
											disabled={panelPhotos.length === 0}
											aria-label="Удалить все фото формы"
											title="Удалить все фото формы"
											style={{
												width: MINI,
												minWidth: MINI,
												height: MINI,
												padding: 0,
												border: 0,
												borderRadius: 0,
												background: "transparent",
											}}
										/>
									</Popconfirm>
								}
							/>
							<Select
								value={`${targetPanel.width_mm}x${targetPanel.height_mm}`}
								onChange={async (value) => {
									const [width, height] = value.split("x").map(Number);
									const size = PANEL_SIZES.find(
										(s) => s.width === width && s.height === height,
									);
									try {
										await updatePanel.mutateAsync({
											panelId: targetPanel.id,
											body: {
												width_mm: width,
												height_mm: height,
												size_label: size?.label ?? `${width}x${height} мм`,
											},
										});
										message.success("Размер обновлён");
										await refetchPanels();
									} catch {
										message.error("Не удалось обновить размер");
									}
								}}
								options={sizeOptions}
								style={{ width: "50%" }}
								size="small"
								aria-label="Размер"
							/>
						</div>
					</div>
				);
			},
		},
		{
			title: (
				<Space wrap={false} size={2} style={{ whiteSpace: "nowrap" }}>
					Текстура
					<Button
						type="text"
						size="small"
						icon={<PlusOutlined />}
						aria-label="Добавить текстуру"
						onClick={() => setEditor("texture")}
					/>
				</Space>
			),
			key: "texture",
			width: 285,
			render: (_: unknown, record: ApiPanelVariant) => {
				// Шапка-конструктор: выбор из уже созданных текстур,
				// сохранение — только кнопкой «Добавить строку».
				if (record.id.startsWith("template:")) {
					return (
						<AntdSelect
							value={templatePick.textureId || undefined}
							placeholder="Выберите текстуру"
							allowClear
							onChange={(value) =>
								setTemplatePick((prev) => ({
									...prev,
									textureId: value ?? undefined,
								}))
							}
							style={{ width: "100%" }}
							size="small"
							showSearch
							optionFilterProp="label"
							aria-label="Текстура для новой строки"
							options={textureOptions.map((opt) => ({
								value: opt.value,
								label: opt.label,
							}))}
						/>
					);
				}
				const current = textureMap.get(record.texture_id);
				const swatchStyle: React.CSSProperties = {
					width: MINI,
					height: MINI,
					objectFit: "cover",
					borderRadius: 4,
					border: "1px solid #e5e7eb",
					flexShrink: 0,
					background: "#fff",
				};
				const rowStyle: React.CSSProperties = {
					display: "flex",
					alignItems: "center",
					gap: 8,
					width: "100%",
				};
				return (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							width: "100%",
						}}
					>
						<Tooltip
							title={
								current
									? `Просмотр фактуры ${current.name}`
									: "Текстура не выбрана"
							}
						>
							<Button
								type="text"
								size="small"
								icon={<EyeOutlined />}
								aria-label="Просмотр фактуры"
								disabled={!current}
								onClick={() => current && setPreviewTexture(current)}
								style={{ padding: 4, height: MINI, width: MINI }}
							/>
						</Tooltip>
						<div style={{ flex: 1, minWidth: 0 }}>
							<AntdSelect
								value={record.texture_id || undefined}
								placeholder="Выберите текстуру"
								onChange={(value) => handleTextureChange(record, value)}
								style={{ width: "100%" }}
								size="small"
								showSearch
								virtual={false}
								listHeight={480}
								popupMatchSelectWidth={320}
								dropdownStyle={{ padding: 0 }}
								popupClassName="ww-admin-texture-dropdown"
								optionFilterProp="label"
								aria-label="Текстура"
								labelRender={({ label }) => (
									<Tooltip title={String(label ?? "")}>
										<span
											style={{
												display: "block",
												whiteSpace: "nowrap",
												overflow: "hidden",
												textOverflow: "ellipsis",
											}}
										>
											{label}
										</span>
									</Tooltip>
								)}
							>
								{textureOptions.map((opt) => (
									<AntdSelect.Option
										key={opt.value}
										value={opt.value}
										label={opt.label}
									>
										<div style={rowStyle}>
											<img
												src={imageSrc(opt.swatch)}
												alt=""
												style={swatchStyle}
											/>
											<span>{opt.label}</span>
										</div>
									</AntdSelect.Option>
								))}
							</AntdSelect>
						</div>
					</div>
				);
			},
		},
		{
			title: (
				<Space>
					Варианты исполнений
					<Button
						type="text"
						size="small"
						icon={<PlusOutlined />}
						aria-label="Добавить вариант исполнения"
						onClick={() => setAddExecutionOpen(true)}
					/>
				</Space>
			),
			key: "executions",
			width: 220,
			onHeaderCell: () => ({ style: { paddingInline: 8 } }),
			onCell: () => ({
				style: { paddingInline: 8, verticalAlign: "top" as const },
			}),
			render: (
				_: unknown,
				record: ApiPanelVariant & { executions: ApiPanelVariant[] },
			) => {
				if (record.id.startsWith("template:")) {
					return (
						<Button
							type="primary"
							size="small"
							disabled={!templateReady || updateRowTexture.isPending}
							loading={updateRowTexture.isPending}
							onClick={handleCreateRow}
							aria-label="Добавить строку"
						>
							Добавить строку
						</Button>
					);
				}
				return (
					<GalleryCell
						paths={record.executions
							.map((execution) => execution.image_paths[0])
							.filter(Boolean)}
						emptyLabel="Добавить вариант исполнения"
						addLabel="Добавить вариант исполнения в эту строку"
						onItemClick={(index) =>
							openVariantEditor(
								record.executions.filter(
									(execution) => execution.image_paths[0],
								)[index],
								"executions",
							)
						}
						onAdd={() => openExecutionCreator(record)}
						trailingItem={
							<Popconfirm
								title="Удалить все варианты исполнения в этой строке?"
								description="Товарные и интерьерные фото будут отвязаны от всех вариантов этой строки."
								okText="Удалить все"
								okButtonProps={{ danger: true }}
								cancelText="Отмена"
								onConfirm={() => handleDeleteGroup(record)}
							>
								<Button
									type="text"
									danger
									icon={<ClearOutlined />}
									disabled={record.executions.length === 0}
									aria-label="Удалить все варианты исполнения"
									title="Удалить все варианты исполнения"
									style={{
										width: MINI,
										minWidth: MINI,
										height: MINI,
										padding: 0,
										border: 0,
										borderRadius: 0,
										background: "transparent",
									}}
								/>
							</Popconfirm>
						}
					/>
				);
			},
		},
		{
			title: "Фото в дизайне",
			key: "designs",
			width: 180,
			onHeaderCell: () => ({ style: { paddingInline: 4 } }),
			onCell: () => ({
				style: { paddingInline: 4, verticalAlign: "top" as const },
			}),
			render: (
				_: unknown,
				record: ApiPanelVariant & { executions: ApiPanelVariant[] },
			) => {
				if (record.id.startsWith("template:")) {
					// Поле добавления: фото подтянутся после сохранения строки.
					return null;
				}
				const designItems = record.executions.flatMap((execution) =>
					execution.design_image_paths.map((path) => ({ path, execution })),
				);
				return (
					<GalleryCell
						paths={designItems.map((item) => item.path)}
						emptyLabel="Добавить фото в дизайне"
						addLabel="Добавить фото в дизайне"
						onItemClick={(index) =>
							openVariantEditor(designItems[index].execution, "designs")
						}
						onAdd={() => {
							const firstExecution = record.executions[0];
							if (firstExecution) {
								openVariantEditor(firstExecution, "designs");
							} else {
								openExecutionCreator(record);
							}
						}}
						trailingItem={renderGalleryClear(
							record,
							"design_image_paths",
							"Очистить все фото в дизайне",
						)}
					/>
				);
			},
		},
		{
			title: "Рекомендации",
			key: "recommendations",
			width: 180,
			onHeaderCell: () => ({ style: { paddingInline: 4 } }),
			onCell: () => ({
				style: { paddingInline: 4, verticalAlign: "top" as const },
			}),
			render: (
				_: unknown,
				record: ApiPanelVariant & { executions: ApiPanelVariant[] },
			) => {
				if (record.id.startsWith("template:")) {
					// Поле добавления: рекомендации подтянутся после сохранения строки.
					return null;
				}
				const recommendationItems = record.executions.flatMap((execution) =>
					execution.recommendation_image_paths.map((path) => ({
						path,
						execution,
					})),
				);
				return (
					<GalleryCell
						paths={recommendationItems.map((item) => item.path)}
						emptyLabel="Добавить рекомендацию"
						addLabel="Добавить рекомендацию"
						onItemClick={(index) =>
							openVariantEditor(
								recommendationItems[index].execution,
								"recommendations",
							)
						}
						onAdd={() => {
							const firstExecution = record.executions[0];
							if (firstExecution) {
								openVariantEditor(firstExecution, "recommendations");
							} else {
								openExecutionCreator(record);
							}
						}}
						trailingItem={renderGalleryClear(
							record,
							"recommendation_image_paths",
							"Очистить все рекомендации",
						)}
					/>
				);
			},
		},
	];

	return (
		<motion.div
			className="admin-panels-page"
			initial="hidden"
			animate="visible"
			variants={fadeUpVariants}
			style={{
				padding: "24px 0",
				maxWidth: "none",
				margin: 0,
				width: "100%",
				minWidth: 1200,
			}}
		>
			{!embedded && (
				<motion.div
					variants={fadeUpVariants}
					custom={0}
					style={{ marginBottom: 24 }}
				>
					<Text strong style={{ fontSize: 24 }}>
						Варианты панелей
					</Text>
				</motion.div>
			)}

			<motion.div
				className="admin-panels-filters"
				variants={fadeUpVariants}
				custom={1}
				style={{ marginBottom: 16 }}
			>
				<Space wrap>
					<Select
						aria-label="Базовая форма"
						disabled={!!panel}
						placeholder="Все базовые формы"
						allowClear
						showSearch
						optionFilterProp="label"
						style={{ minWidth: 220 }}
						value={selectedPanelId}
						onChange={(panelId) => {
							setFilterPanelId(panelId);
							setPage(1);
						}}
						options={panelFilterOptions}
					/>
					<Select
						aria-label="Фильтр по текстуре"
						placeholder="Все текстуры"
						allowClear
						showSearch
						optionFilterProp="label"
						style={{ minWidth: 220 }}
						value={selectedTextureId}
						onChange={(textureId) => {
							setFilterTextureId(textureId);
							setPage(1);
						}}
						options={textureFilterOptions}
					/>
					<Select
						aria-label="Фильтр по размеру"
						placeholder="Все размеры"
						allowClear
						style={{ minWidth: 180 }}
						value={filterSize}
						onChange={(size) => {
							setFilterSize(size);
							setPage(1);
						}}
						options={sizeOptions}
					/>
				</Space>
			</motion.div>

			<motion.div variants={fadeUpVariants} custom={2}>
				<Card>
					<Table
						rowKey="id"
						dataSource={tableRows}
						columns={columns}
						tableLayout="fixed"
						loading={isLoading}
						style={{ width: "100%" }}
						pagination={{
							current: page,
							pageSize,
							total: tableRows.length,
							showSizeChanger: true,
							onChange: (next, size) => {
								setPage(next);
								setPageSize(size);
							},
						}}
					/>
				</Card>
			</motion.div>

			{editor && (
				<Suspense fallback={<Text>Загрузка редактора…</Text>}>
					{editor === "panel" ||
					(typeof editor === "object" && "width_mm" in editor) ? (
						<PanelsManager
							editorOnly
							initialPanel={
								typeof editor === "object" && "width_mm" in editor
									? (editor as ApiPanel)
									: undefined
							}
							onEditorClose={() => {
								setEditor(null);
								setPage(1);
								refetchPanels();
							}}
						/>
					) : (
						<TexturesManager
							editorOnly
							initialTexture={
								typeof editor === "object" && !("width_mm" in editor)
									? editor
									: undefined
							}
							onEditorClose={() => setEditor(null)}
						/>
					)}
				</Suspense>
			)}
			<AddExecutionModal
				key={
					addExecutionPanel?.id ??
					selectedPanelId ??
					panels?.items?.[0]?.id ??
					panel?.id ??
					"new"
				}
				open={addExecutionOpen}
				textureId={addTextureId}
				panel={
					addExecutionPanel ??
					panels?.items?.find((p) => p.id === selectedPanelId) ??
					panels?.items?.[0] ??
					panel ??
					null
				}
				onClose={() => {
					setAddExecutionOpen(false);
					setAddExecutionPanel(null);
					setAddTextureId(undefined);
				}}
				onCreated={() => {
					refetch();
					refetchAssignments();
				}}
			/>

			{editingVariant && (
				<AdminVariantEditModal
					key={`${editingVariant.id}-${editingVariantFocus}`}
					open
					variant={editingVariant}
					photoDrafts={photoDrafts}
					initialFocus={editingVariantFocus ?? "executions"}
					onEditExecution={() => setEditingVariantFocus("executions")}
					siblingVariants={(variants?.items ?? []).filter(
						(item) =>
							item.panel_id === editingVariant.panel_id &&
							item.texture_id === editingVariant.texture_id,
					)}
					onSelectVariant={(variant) => setEditingVariant(variant)}
					onReorderVariants={async (orderedIds) => {
						await reorderVariants.mutateAsync({
							panel_id: editingVariant.panel_id,
							texture_id: editingVariant.texture_id,
							ordered_ids: orderedIds,
						});
						await refetch();
					}}
					panelName={panelMap.get(editingVariant.panel_id)?.name}
					panelSize={panelMap.get(editingVariant.panel_id)?.size_label}
					onClose={() => {
						photoDrafts.clear();
						setEditingVariant(null);
						setEditingVariantFocus(null);
					}}
					onSaved={() => refetch()}
				/>
			)}

			<TexturePreviewModal
				texture={previewTexture}
				onEdit={() => {
					setEditor(previewTexture);
					setPreviewTexture(null);
				}}
				open={!!previewTexture}
				onClose={() => setPreviewTexture(null)}
			/>
			<PanelPreviewDrawer
				panel={displayPreviewPanel}
				onClose={() => setPreviewPanel(null)}
				onEdit={() => {
					if (previewPanel) {
						setEditor(previewPanel);
						setPreviewPanel(null);
					}
				}}
				photos={
					displayPreviewPanel
						? displayPreviewPanel.photo_paths.length
							? displayPreviewPanel.photo_paths
							: displayPreviewPanel.photo_path
								? [displayPreviewPanel.photo_path]
								: []
						: []
				}
				uploadingKey={photoUploadTarget}
				onUpload={(file, replaceIndex) =>
					displayPreviewPanel &&
					handlePanelPhotoUpload(displayPreviewPanel, file, replaceIndex)
				}
				onDeletePhoto={(index) =>
					displayPreviewPanel &&
					handlePanelPhotoDelete(displayPreviewPanel, index)
				}
			/>
		</motion.div>
	);
}
