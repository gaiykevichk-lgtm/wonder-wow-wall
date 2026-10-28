/**
 * Phase 7B — admin panels (physical SKU) management page.
 *
 * Layout:
 *   ┌────────────────────── header: title + «+ Добавить панель» ──────────┐
 *   │  ┌─ Status ─┬─ Search (name/slug) ─┬─ [Сбросить] ─┐                 │
 *   │  └──────────┴───────────────────────┴──────────────┘                 │
 *   │                                                                      │
 *   │  ┌── AntD <Table> ────────────────────────────────────────────────┐ │
 *   │  │ Фото · Название · Slug · Размер · Цена · Активна (Switch) · ⋯ │ │
 *   │  └────────────────────────────────────────────────────────────────┘ │
 *   │                                                                      │
 *   │  Drawer (right) — create/edit form with AdminFileUpload for photo   │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth for filters and pagination (Phase 4A pattern).
 * Filters are applied client-side because the admin endpoint takes only
 * offset/limit — we fetch a page, then narrow it. Search/active filtering
 * is a user-experience nicety; the backend is the truth on the row set.
 *
 * Mutations:
 *   * Inline `<Switch>` toggle for `is_active` — no confirmation, change
 *     is reversible by toggling back. Optimistic UX via React Query
 *     `setQueryData` on success.
 *   * Delete is wrapped in `<Popconfirm>` (DoD § "destructive actions
 *     require confirmation").
 *   * Create/edit go through a single `<Drawer>` with the same form —
 *     the only difference is whether `panelId` is set.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
	Button,
	Checkbox,
	Modal,
	Form,
	Input,
	InputNumber,
	Popconfirm,
	Select,
	Space,
	Switch,
	Table,
	Typography,
	message,
} from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import { sortPanels } from "../lib/sortPanels";
import { ApiError } from "../../../shared/api";
import { imageSrc } from "../../../shared/lib/imageSrc";
import { PANEL_SIZES } from "../../../shared/config/constants";
import { AdminFileUpload } from "../../../shared/ui/AdminFileUpload";
import {
	type ApiPanel,
	type PanelCreatePayload,
	type PanelUpdatePayload,
	type PanelsAdminQuery,
	useCreatePanelSizes,
	useDeletePanel,
	usePanelsAdminList,
	useUpdatePanel,
} from "../api/panelsAdminApi";
import {
	ACTIVE_OPTIONS,
	DEFAULT_PAGE,
	DEFAULT_SIZE,
	applyFilterPatch,
	queryFromSearchParams,
	searchParamsFromQuery,
	slugify,
} from "../model/panelsAdminStore";

const { Title } = Typography;
const { TextArea } = Input;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
	}),
};

interface PanelFormValues {
	name: string;
	slug: string;
	width_mm: number;
	height_mm: number;
	sizes: Array<"300x300" | "300x600" | "600x600">;
	size_label: string;
	base_price: number;
	description: string;
	thickness_mm: number;
	execution: string;
	mounting_system: string;
	base_material: string;
	packaging: string;
	photo_path: string;
	is_active: boolean;
}

const EMPTY_FORM: PanelFormValues = {
	name: "",
	slug: "",
	width_mm: 300,
	height_mm: 300,
	sizes: [],
	size_label: "",
	base_price: 0,
	description: "",
	thickness_mm: 3,
	execution: "Архитектурное декоративное покрытие",
	mounting_system: "Запатентованная система быстрой замены",
	base_material: "Ультралёгкий композит высокой плотности",
	packaging: "",
	photo_path: "",
	is_active: true,
};

function panelToForm(p: ApiPanel): PanelFormValues {
	return {
		name: p.name,
		slug: p.slug,
		width_mm: p.width_mm,
		height_mm: p.height_mm,
		sizes: [],
		size_label: p.size_label,
		base_price: p.base_price,
		description: p.description,
		thickness_mm: p.thickness_mm ?? 3,
		execution: p.execution ?? EMPTY_FORM.execution,
		mounting_system: p.mounting_system ?? EMPTY_FORM.mounting_system,
		base_material: p.base_material ?? EMPTY_FORM.base_material,
		packaging: p.packaging ?? "",
		photo_path: p.photo_path,
		is_active: p.is_active,
	};
}

function formatRub(value: number): string {
	return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatSize(p: ApiPanel): string {
	// Dimensions are stored in mm; always show centimetres regardless of a
	// legacy free-text label (which may say either 30×30 or 300×300).
	const width = p.width_mm / 10;
	const height = p.height_mm / 10;
	return `${width}×${height} см`;
}

interface PanelFamily {
	key: string;
	name: string;
	bySize: ApiPanel[];
	primary: ApiPanel;
}

/** Canonical size keys (`widthxheight` in mm) — same values as PANEL_SIZES. */
const SIZE_FILTER_OPTIONS = PANEL_SIZES.map((s) => ({
	value: `${s.width}x${s.height}`,
	label: s.label,
}));

function panelSizeKey(p: ApiPanel): string {
	return `${p.width_mm}x${p.height_mm}`;
}

function panelFamilyKey(panel: ApiPanel): string {
	// Different sizes and legacy duplicated slugs of one named form belong
	// together. Never rewrite or delete the underlying SKU IDs.
	return panel.name.trim().toLocaleLowerCase("ru-RU").replace(/\s+/g, " ");
}

function groupPanelFamilies(panels: ApiPanel[]): PanelFamily[] {
	const groups = new Map<string, ApiPanel[]>();
	for (const panel of panels) {
		const key = panelFamilyKey(panel);
		groups.set(key, [...(groups.get(key) ?? []), panel]);
	}
	return [...groups].map(([key, members]) => {
		const bySize = [...members].sort(
			(a, b) =>
				a.width_mm - b.width_mm ||
				a.height_mm - b.height_mm ||
				a.created_at.localeCompare(b.created_at) ||
				a.id.localeCompare(b.id),
		);
		return { key, name: members[0].name, bySize, primary: bySize[0] };
	});
}

function formatDate(iso: string): string {
	return dayjs(iso).format("DD.MM.YYYY");
}

interface AdminUploadPageProps {
	hideHeader?: boolean;
	editorOnly?: boolean;
	initialPanel?: ApiPanel;
	onEditorClose?: () => void;
}

export default function AdminUploadPage({
	hideHeader = false,
	editorOnly = false,
	initialPanel,
	onEditorClose,
}: AdminUploadPageProps = {}) {
	const [searchParams, setSearchParams] = useSearchParams();

	const query: PanelsAdminQuery = useMemo(
		() => queryFromSearchParams(searchParams),
		[searchParams],
	);

	const { data, isFetching, error } = usePanelsAdminList(query, {
		allPages: !editorOnly,
	});
	const [sessionStartedAt] = useState(() => Date.now());
	const [selectedPanelIds, setSelectedPanelIds] = useState<
		Record<string, string>
	>({});
	// Local (non-URL) size filter for the «Базовые формы» tab — narrows the
	// grouped families without touching the backend query contract.
	const [sizeFilter, setSizeFilter] = useState<string | undefined>(undefined);
	const createMutation = useCreatePanelSizes();
	const updateMutation = useUpdatePanel();
	const deleteMutation = useDeletePanel();

	// Drawer state — `editingId === null` means «create new», a string is
	// «edit existing». The form is a single instance reused for both modes
	// (Phase 5/4B pattern); reset on open to drop stale values.
	const [drawerOpen, setDrawerOpen] = useState(editorOnly);
	const [editingId, setEditingId] = useState<string | null>(
		initialPanel?.id ?? null,
	);
	const [form] = Form.useForm<PanelFormValues>();
	// Ordered catalog gallery. The public card uses the first photo normally
	// and the second on hover, so the editor must expose both persisted paths.
	const [photoPaths, setPhotoPaths] = useState<string[]>(() =>
		initialPanel?.photo_paths?.length
			? initialPanel.photo_paths
			: initialPanel?.photo_path
				? [initialPanel.photo_path]
				: [],
	);
	const [previousInitialPanel, setPreviousInitialPanel] =
		useState(initialPanel);
	if (editorOnly && initialPanel !== previousInitialPanel) {
		setPreviousInitialPanel(initialPanel);
		setEditingId(initialPanel?.id ?? null);
		setPhotoPaths(
			initialPanel?.photo_paths?.length
				? initialPanel.photo_paths
				: initialPanel?.photo_path
					? [initialPanel.photo_path]
					: [],
		);
		setDrawerOpen(true);
	}
	// Last auto-generated slug — lets us distinguish "user has not touched
	// the slug field" (auto-fill on every name keystroke) from "user has
	// edited the slug" (stop auto-filling so we don't clobber their edit).
	// Cleared on drawer close.
	const lastAutoSlugRef = useRef<string>("");
	// Same idea for the size label: auto-fill «{wCm}×{hCm} см» from the
	// width/height fields in edit mode; manual edits to the label stop the
	// auto-fill. Cleared on drawer open/close.
	const lastAutoSizeLabelRef = useRef<string>("");

	useEffect(() => {
		if (!editorOnly || !initialPanel) return;
		form.setFieldsValue(panelToForm(initialPanel));
	}, [editorOnly, form, initialPanel]);

	// Local mirror for the search input — same UX as users page (typing
	// shouldn't fire a request per keystroke; debounce by Enter).
	const [searchDraft, setSearchDraft] = useState<string>(query.search ?? "");
	const [prevQuerySearch, setPrevQuerySearch] = useState<string | null>(
		query.search ?? null,
	);
	if (query.search !== prevQuerySearch) {
		setPrevQuerySearch(query.search ?? null);
		setSearchDraft(query.search ?? "");
	}

	function updateUrl(next: PanelsAdminQuery): void {
		setSearchParams(searchParamsFromQuery(next), { replace: false });
	}

	function onActiveChange(value: "true" | "false" | null | undefined): void {
		const isActive = value === "true" ? true : value === "false" ? false : null;
		updateUrl(applyFilterPatch(query, { isActive }));
	}

	function onSearchChange(value: string): void {
		const cleaned = value.trim();
		updateUrl(applyFilterPatch(query, { search: cleaned || null }));
	}

	function onResetFilters(): void {
		setSearchParams(new URLSearchParams(), { replace: false });
	}

	function onTableChange(pagination: TablePaginationConfig): void {
		updateUrl({
			...query,
			page: pagination.current ?? DEFAULT_PAGE,
			size: pagination.pageSize ?? DEFAULT_SIZE,
		});
	}

	function openCreateDrawer(): void {
		setEditingId(null);
		setPhotoPaths([]);
		lastAutoSlugRef.current = "";
		lastAutoSizeLabelRef.current = "";
		form.resetFields();
		form.setFieldsValue(EMPTY_FORM);
		setCreateName("");
		setDrawerOpen(true);
	}

	function openEditDrawer(panel: ApiPanel): void {
		setEditingId(panel.id);
		setPhotoPaths(
			panel.photo_paths?.length > 0
				? panel.photo_paths
				: panel.photo_path
					? [panel.photo_path]
					: [],
		);
		lastAutoSlugRef.current = "";
		lastAutoSizeLabelRef.current = "";
		form.resetFields();
		form.setFieldsValue(panelToForm(panel));
		setDrawerOpen(true);
	}

	function openAddSizeDrawer(panel: ApiPanel): void {
		setEditingId(null);
		setPhotoPaths([]);
		form.resetFields();
		const baseSlug = panel.slug.replace(/-(300x300|300x600|600x600)$/, "");
		form.setFieldsValue({
			...EMPTY_FORM,
			name: panel.name,
			slug: baseSlug,
			description: panel.description,
			thickness_mm: panel.thickness_mm ?? 3,
			execution: panel.execution ?? EMPTY_FORM.execution,
			mounting_system: panel.mounting_system ?? EMPTY_FORM.mounting_system,
			base_material: panel.base_material ?? EMPTY_FORM.base_material,
			packaging: panel.packaging ?? "",
		});
		lastAutoSlugRef.current = baseSlug;
		lastAutoSizeLabelRef.current = "";
		setCreateName(panel.name);
		setDrawerOpen(true);
	}

	function closeDrawer(): void {
		onEditorClose?.();
		setDrawerOpen(false);
		setEditingId(null);
		lastAutoSizeLabelRef.current = "";
		form.resetFields();
		setPhotoPaths([]);
		lastAutoSlugRef.current = "";
		setCreateName("");
	}

	function handleApiError(err: unknown, fallback: string): void {
		if (err instanceof ApiError && err.body?.code === "panel_slug_conflict") {
			// Surface as inline form error so the admin sees it next to the field
			// they need to fix, rather than a top-toast that disappears.
			form.setFields([{ name: "slug", errors: ["Slug уже занят"] }]);
			return;
		}
		if (err instanceof ApiError && err.body?.code === "panel_size_conflict") {
			// Same form name + dimensions already exist. Point at both fields
			// involved so the admin can change the name or pick another size.
			const detail =
				(err.body?.detail as string) ||
				"Такая форма уже существует в этом размере";
			if (editingId === null) {
				form.setFields([{ name: "sizes", errors: [detail] }]);
			} else {
				form.setFields([{ name: "name", errors: [detail] }]);
			}
			return;
		}
		if (err instanceof ApiError && err.body?.code === "panel_not_found") {
			message.error("Панель не найдена — возможно, удалена в другой вкладке");
			return;
		}
		message.error(err instanceof Error ? err.message : fallback);
	}

	function onSubmitForm(): void {
		form
			.validateFields()
			.then((values) => {
				const payload: PanelCreatePayload = {
					name: values.name.trim(),
					slug: values.slug.trim(),
					width_mm: values.width_mm,
					height_mm: values.height_mm,
					size_label: values.size_label?.trim() ?? "",
					base_price: values.base_price,
					description: values.description.trim(),
					thickness_mm: values.thickness_mm,
					execution: values.execution.trim(),
					mounting_system: values.mounting_system.trim(),
					base_material: values.base_material.trim(),
					packaging: values.packaging.trim(),
					photo_path: photoPaths[0] ?? "",
					photo_paths: photoPaths,
					is_active: values.is_active,
				};

				if (editingId === null) {
					createMutation.mutate(
						{
							name: payload.name,
							slug: payload.slug,
							sizes: values.sizes,
							description: payload.description,
							thickness_mm: payload.thickness_mm,
							execution: payload.execution,
							mounting_system: payload.mounting_system,
							base_material: payload.base_material,
							packaging: payload.packaging,
							is_active: payload.is_active,
						},
						{
							onSuccess: () => {
								message.success("Выбранные размеры подключены");
								closeDrawer();
							},
							onError: (err) =>
								handleApiError(err, "Не удалось создать панель"),
						},
					);
				} else {
					// PATCH — send the full form (we don't track per-field dirtiness
					// because the backend treats `null` ≠ "unset"; sending the full
					// object is simpler and behaves identically when nothing changed.
					updateMutation.mutate(
						{ panelId: editingId, body: payload as PanelUpdatePayload },
						{
							onSuccess: () => {
								message.success("Изменения сохранены");
								closeDrawer();
							},
							onError: (err) => handleApiError(err, "Не удалось сохранить"),
						},
					);
				}
			})
			.catch(() => {
				/* Form shows inline errors */
			});
	}

	function onToggleActive(panel: ApiPanel, nextActive: boolean): void {
		updateMutation.mutate(
			{ panelId: panel.id, body: { is_active: nextActive } },
			{
				onSuccess: () => {
					message.success(nextActive ? "Панель активирована" : "Панель скрыта");
				},
				onError: (err) =>
					handleApiError(err, "Не удалось переключить активность"),
			},
		);
	}

	function onDelete(panel: ApiPanel): void {
		deleteMutation.mutate(panel.id, {
			onSuccess: () => message.success("Панель удалена"),
			onError: (err) => handleApiError(err, "Не удалось удалить"),
		});
	}

	// Fetch all filtered SKUs before grouping so variants on different API
	// pages still appear in the same form; paginate the grouped forms here.
	const allFamilies = sortPanels(
		groupPanelFamilies(data?.items ?? []),
		(family) => family.name,
		(family) =>
			family.bySize
				.map((p) => p.created_at)
				.sort()
				.at(-1) ?? "",
		sessionStartedAt,
	);
	const families = sizeFilter
		? allFamilies
				.map((family) => ({
					...family,
					bySize: family.bySize.filter(
						(panel) => panelSizeKey(panel) === sizeFilter,
					),
				}))
				.filter((family) => family.bySize.length > 0)
				.map((family) => ({ ...family, primary: family.bySize[0] }))
		: allFamilies;
	const visibleItems = families.slice(
		(query.page - 1) * query.size,
		query.page * query.size,
	);
	const selectedPanel = (family: PanelFamily): ApiPanel =>
		family.bySize.find((panel) => panel.id === selectedPanelIds[family.key]) ??
		family.primary;

	// Sizes already present for the form being created — the wizard must
	// not offer them again (backend also rejects with panel_size_conflict).
	const [createName, setCreateName] = useState("");
	const existingCreateSizes = new Set(
		(data?.items ?? [])
			.filter(
				(panel) =>
					panelFamilyKey(panel) ===
					panelFamilyKey({ name: createName } as ApiPanel),
			)
			.map(panelSizeKey),
	);

	const columns: TableProps<PanelFamily>["columns"] = [
		{
			title: "Фото",
			key: "photo",
			width: 90,
			render: (_v, family) => {
				const path = selectedPanel(family).photo_path;
				return path ? (
					<img
						// Phase 7A/7B audit fix — single shared `imageSrc` helper.
						// Previously inline ternary doubled the `/uploads/` prefix
						// for legacy seed paths (`/images/...`) and dropped `data:`
						// URIs entirely. See `shared/lib/imageSrc.ts`.
						src={imageSrc(path)}
						alt=""
						style={{
							width: 56,
							height: 56,
							objectFit: "cover",
							borderRadius: 6,
							background: "#F5F5F5",
						}}
					/>
				) : (
					<div
						style={{
							width: 56,
							height: 56,
							borderRadius: 6,
							background: "#F5F5F5",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#9CA3AF",
							fontSize: 11,
						}}
					>
						нет
					</div>
				);
			},
		},
		{
			title: "Название",
			key: "name",
			render: (_v, family) => (
				<div>
					<div style={{ fontWeight: 500 }}>{family.name}</div>
					<div style={{ fontSize: 12, color: "#6B7280" }}>
						{selectedPanel(family).slug}
					</div>
				</div>
			),
		},
		{
			title: "Размер",
			key: "size",
			width: 170,
			render: (_v, family) => (
				<Select
					aria-label={`Размер формы ${family.name}`}
					value={selectedPanel(family).id}
					style={{ width: "100%" }}
					onChange={(id) =>
						setSelectedPanelIds((prev) => ({ ...prev, [family.key]: id }))
					}
					options={family.bySize.map((panel) => ({
						value: panel.id,
						label: `${formatSize(panel)}${family.bySize.filter((item) => item.width_mm === panel.width_mm && item.height_mm === panel.height_mm).length > 1 ? ` · ID ${panel.id}` : ""}`,
					}))}
				/>
			),
		},
		{
			title: "Цена",
			key: "base_price",
			width: 120,
			align: "right",
			render: (_v, family) => formatRub(selectedPanel(family).base_price),
		},
		{
			title: "Активна",
			key: "is_active",
			width: 110,
			align: "center",
			render: (_v, family) => {
				const row = selectedPanel(family);
				return (
					<Switch
						checked={row.is_active}
						loading={
							updateMutation.isPending &&
							updateMutation.variables?.panelId === row.id
						}
						onChange={(next) => onToggleActive(row, next)}
					/>
				);
			},
		},
		{
			title: "Создана",
			key: "created_at",
			width: 130,
			render: (_v, family) => formatDate(selectedPanel(family).created_at),
		},
		{
			title: "",
			key: "actions",
			width: 150,
			render: (_v, family) => {
				const row = selectedPanel(family);
				return (
					<Space size="small">
						<Button
							type="text"
							icon={<PlusOutlined />}
							onClick={() => openAddSizeDrawer(family.bySize[0] ?? row)}
							aria-label="Подключить размер"
						/>
						<Button
							type="text"
							icon={<EditOutlined />}
							onClick={() => openEditDrawer(row)}
							aria-label="Редактировать"
						/>
						<Popconfirm
							title="Удалить панель?"
							description="Действие необратимо. Связанные рекомендации будут очищены."
							okText="Удалить"
							okButtonProps={{ danger: true }}
							cancelText="Отмена"
							onConfirm={() => onDelete(row)}
						>
							<Button
								type="text"
								danger
								icon={<DeleteOutlined />}
								loading={
									deleteMutation.isPending &&
									deleteMutation.variables === row.id
								}
								aria-label="Удалить"
							/>
						</Popconfirm>
					</Space>
				);
			},
		},
	];

	const hasActiveFilters = query.isActive !== null || query.search !== null;
	const isSubmitting = createMutation.isPending || updateMutation.isPending;

	return (
		<motion.div
			className="admin-forms-page"
			initial="hidden"
			animate="visible"
			variants={fadeUpVariants}
			style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}
		>
			{!editorOnly && !hideHeader && (
				<motion.div
					variants={fadeUpVariants}
					custom={0}
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: 24,
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<Title level={3} style={{ margin: 0 }}>
						Панели
					</Title>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={openCreateDrawer}
					>
						Добавить панель
					</Button>
				</motion.div>
			)}
			{!editorOnly && hideHeader && (
				<div
					style={{
						display: "flex",
						justifyContent: "flex-end",
						marginBottom: 16,
					}}
				>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={openCreateDrawer}
					>
						Добавить форму
					</Button>
				</div>
			)}

			{!editorOnly && (
				<motion.div
					className="admin-forms-filters"
					variants={fadeUpVariants}
					custom={1}
				>
					<Space wrap style={{ marginBottom: 16 }}>
						<Select<"true" | "false" | null>
							placeholder="Статус"
							allowClear
							style={{ minWidth: 180 }}
							value={
								query.isActive === null
									? undefined
									: query.isActive
										? "true"
										: "false"
							}
							onChange={onActiveChange}
							options={ACTIVE_OPTIONS}
						/>
						<Input.Search
							placeholder="Поиск: название, slug"
							allowClear
							value={searchDraft}
							onChange={(e) => setSearchDraft(e.target.value)}
							onSearch={onSearchChange}
							style={{ width: 280 }}
						/>
						<Select<string>
							aria-label="Фильтр по размеру"
							placeholder="Все размеры"
							allowClear
							style={{ minWidth: 180 }}
							value={sizeFilter}
							onChange={(value) => {
								setSizeFilter(value);
								updateUrl({ ...query, page: DEFAULT_PAGE });
							}}
							options={SIZE_FILTER_OPTIONS}
						/>
						{(hasActiveFilters || !!sizeFilter) && (
							<Button
								onClick={() => {
									setSizeFilter(undefined);
									onResetFilters();
								}}
							>
								Сбросить
							</Button>
						)}
					</Space>
				</motion.div>
			)}

			{!editorOnly && error && (
				<motion.div variants={fadeUpVariants} custom={2}>
					<Alert
						type="error"
						showIcon
						message="Не удалось загрузить панели"
						description={(error as Error).message}
						style={{ marginBottom: 16 }}
					/>
				</motion.div>
			)}

			{!editorOnly && (
				<motion.div variants={fadeUpVariants} custom={2}>
					<Table<PanelFamily>
						rowKey="key"
						scroll={{ x: 980 }}
						dataSource={visibleItems}
						columns={columns}
						loading={isFetching}
						onChange={onTableChange}
						pagination={{
							current: query.page,
							pageSize: query.size,
							// Pagination counts forms, not the number of size SKUs.
							total: families.length,
							showSizeChanger: true,
							pageSizeOptions: [25, 50, 100, 200],
							showTotal: (total) => `Всего: ${total}`,
						}}
					/>
				</motion.div>
			)}

			<Modal
				title={editingId === null ? "Новая панель" : "Редактировать панель"}
				width={640}
				open={drawerOpen}
				onCancel={closeDrawer}
				destroyOnHidden
				footer={
					<Space>
						<Button onClick={closeDrawer} disabled={isSubmitting}>
							Отмена
						</Button>
						<Button
							type="primary"
							onClick={onSubmitForm}
							loading={isSubmitting}
						>
							{editingId === null ? "Создать" : "Сохранить"}
						</Button>
					</Space>
				}
			>
				<Form<PanelFormValues>
					form={form}
					layout="vertical"
					initialValues={EMPTY_FORM}
					onValuesChange={(changed) => {
						// Auto-fill size label «{wCm}×{hCm} см» from width/height.
						// Works in both edit and «add size» drawers: the label
						// follows the dimensions until the admin edits it
						// manually. Applied only when both fields hold valid
						// positive numbers; existing panel rows keep their
						// stored label until a dimension is touched.
						if ("width_mm" in changed || "height_mm" in changed) {
							const width = Number(form.getFieldValue("width_mm"));
							const height = Number(form.getFieldValue("height_mm"));
							if (
								Number.isFinite(width) &&
								Number.isFinite(height) &&
								width > 0 &&
								height > 0
							) {
								const currentLabel =
									(form.getFieldValue("size_label") as string) ?? "";
								if (
									currentLabel === "" ||
									currentLabel === lastAutoSizeLabelRef.current
								) {
									const next = `${width / 10}×${height / 10} см`;
									form.setFieldsValue({ size_label: next });
									lastAutoSizeLabelRef.current = next;
								}
							}
						}
						// Auto-fill slug from the name on create only — once the
						// admin has typed in the slug field manually we must NOT
						// overwrite their value on every keystroke. We track the
						// last auto-generated slug in a ref; if the current slug
						// matches it (or is empty), the user hasn't touched it.
						if (editingId !== null) return;
						if (!("name" in changed)) return;
						setCreateName((changed.name as string) ?? "");
						const currentSlug = (form.getFieldValue("slug") as string) ?? "";
						if (currentSlug === "" || currentSlug === lastAutoSlugRef.current) {
							const next = slugify(changed.name as string);
							form.setFieldsValue({ slug: next });
							lastAutoSlugRef.current = next;
						}
					}}
				>
					<Form.Item
						name="name"
						label="Название"
						rules={[
							{ required: true, message: "Укажите название" },
							{ max: 255, message: "Максимум 255 символов" },
						]}
					>
						<Input placeholder="Панель 30×30" />
					</Form.Item>

					<Form.Item
						name="slug"
						label="Slug"
						tooltip="URL-идентификатор. Заполняется автоматически из названия — можно отредактировать."
						rules={[
							{ required: true, message: "Укажите slug" },
							{ max: 120, message: "Максимум 120 символов" },
							{
								pattern: /^[a-z0-9-]+$/,
								message: "Только латинские буквы, цифры и дефис",
							},
						]}
					>
						<Input placeholder="panel-30x30" />
					</Form.Item>

					{editingId === null ? (
						<Form.Item
							name="sizes"
							label="Доступные размеры (отдельные панели)"
							tooltip="Размер, уже созданный для этой формы, выбрать нельзя — появится ошибка 409."
							rules={[
								{
									required: true,
									type: "array",
									min: 1,
									message: "Выберите хотя бы один размер",
								},
							]}
						>
							<Checkbox.Group
								options={PANEL_SIZES.map((s) => {
									const key = `${s.width}x${s.height}`;
									const alreadyExists = existingCreateSizes.has(key);
									return {
										label: alreadyExists ? `${s.label} — уже есть` : s.label,
										value: key,
										disabled: alreadyExists,
									};
								})}
							/>
						</Form.Item>
					) : (
						<>
							<Space style={{ width: "100%", display: "flex" }} size="middle">
								<Form.Item
									name="width_mm"
									label="Ширина (мм)"
									rules={[{ required: true, message: "Укажите ширину" }]}
									style={{ flex: 1 }}
								>
									<InputNumber
										min={1}
										max={5000}
										step={10}
										style={{ width: "100%" }}
									/>
								</Form.Item>

								<Form.Item
									name="height_mm"
									label="Высота (мм)"
									rules={[{ required: true, message: "Укажите высоту" }]}
									style={{ flex: 1 }}
								>
									<InputNumber
										min={1}
										max={5000}
										step={10}
										style={{ width: "100%" }}
									/>
								</Form.Item>
							</Space>

							<Form.Item
								name="size_label"
								label="Метка размера"
								tooltip="Подставляется автоматически из ширины и высоты (мм → см) — можно отредактировать вручную."
								rules={[{ max: 40, message: "Максимум 40 символов" }]}
							>
								<Input placeholder="30×30 см" />
							</Form.Item>
						</>
					)}

					{editingId !== null && (
						<Form.Item
							name="base_price"
							label="Базовая цена (₽)"
							rules={[{ required: true, message: "Укажите цену" }]}
						>
							<InputNumber<number>
								min={0}
								max={1_000_000}
								step={100}
								style={{ width: "100%" }}
								formatter={(v) =>
									`${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
								}
								parser={(v) => Number((v ?? "").replace(/\s/g, "")) || 0}
							/>
						</Form.Item>
					)}

					<Form.Item
						name="description"
						label="Описание"
						rules={[{ max: 4000, message: "Максимум 4000 символов" }]}
					>
						<TextArea rows={3} placeholder="Материалы, особенности, монтаж…" />
					</Form.Item>

					<Typography.Title level={5}>
						Технические характеристики
					</Typography.Title>
					<Typography.Text type="secondary">
						Размер панели берётся из выбранного размера или полей ширины и
						высоты.
					</Typography.Text>
					<Form.Item
						name="thickness_mm"
						label="Толщина (мм)"
						rules={[{ required: true, message: "Укажите толщину" }]}
					>
						<InputNumber min={1} style={{ width: "100%" }} />
					</Form.Item>
					{(
						[
							["execution", "Исполнение"],
							["mounting_system", "Система монтажа"],
							["base_material", "Основа"],
							["packaging", "Упаковка"],
						] as const
					).map(([field, label]) => (
						<Form.Item
							key={field}
							name={field}
							label={label}
							rules={[{ max: 500, message: "Максимум 500 символов" }]}
						>
							<Input
								placeholder={
									field === "packaging"
										? "Автоматически по размеру, если не указано"
										: undefined
								}
							/>
						</Form.Item>
					))}

					{editingId !== null && (
						<Form.Item label={`Фото (${photoPaths.length}/2)`}>
							<AdminFileUpload
								purpose="PANEL_PHOTO"
								hint={
									photoPaths.length >= 2
										? "Максимум 2 фото — удалите одно для замены"
										: "JPG/PNG/WebP до 10 МБ · минимум 1200×1200 px · лучше 1600×1600 · максимум 2 фото"
								}
								disabled={photoPaths.length >= 2}
								onUploaded={(asset) => {
									setPhotoPaths((current) =>
										current.includes(asset.path)
											? current
											: [...current, asset.path].slice(0, 2),
									);
									message.success("Фото загружено");
								}}
							/>
							{photoPaths.map((photoPath, index) => (
								<div
									key={photoPath}
									style={{
										marginTop: 12,
										padding: 8,
										background: "#F5F5F5",
										borderRadius: 6,
										display: "flex",
										alignItems: "center",
										gap: 12,
									}}
								>
									<img
										src={imageSrc(photoPath)}
										alt={`Фото панели ${index + 1}`}
										style={{
											width: 64,
											height: 64,
											objectFit: "cover",
											borderRadius: 4,
										}}
									/>
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ fontSize: 12, fontWeight: 600 }}>
											{index === 0 ? "Основное фото" : "Фото при наведении"}
										</div>
										<div
											style={{
												fontSize: 12,
												color: "#6B7280",
												wordBreak: "break-all",
											}}
										>
											{photoPath}
										</div>
										<Button
											type="link"
											size="small"
											style={{ padding: 0, marginTop: 4 }}
											onClick={() =>
												setPhotoPaths((current) =>
													current.filter((path) => path !== photoPath),
												)
											}
										>
											Убрать
										</Button>
									</div>
								</div>
							))}
						</Form.Item>
					)}

					<Form.Item
						name="is_active"
						label="Активна"
						valuePropName="checked"
						tooltip="Неактивные панели скрыты из публичного каталога и конструктора."
					>
						<Switch />
					</Form.Item>
				</Form>
			</Modal>
		</motion.div>
	);
}
