/**
 * Phase 7A — admin Catalog management page (categories + designs).
 *
 * Layout:
 *   ┌──────────────── header: title ───────────────┐
 *   │  ┌── Tabs: «Категории» | «Дизайны» ──────┐   │
 *   │  └────────────────────────────────────────┘   │
 *   │                                                │
 *   │  ┌── AntD <Table> per active tab ─────────┐   │
 *   │  └────────────────────────────────────────┘   │
 *   │                                                │
 *   │  Drawer (right) — create/edit form            │
 *   └────────────────────────────────────────────────┘
 *
 * URL is the source of truth (Phase 4A pattern):
 *   * `?tab=designs` — switch to designs tab.
 *   * `?category_id=…&search=…&sort=…&page=…&size=…` — designs filters.
 *
 * Inline mutations:
 *   * Designs: `<Switch>` to toggle `is_published` via the dedicated
 *     `POST /designs/:id/toggle-visibility` endpoint.
 *   * Both: `<Popconfirm>` wraps every destructive button (DoD § "no
 *     accidental deletes").
 *
 * Modal split — categories and designs share the page but have separate
 * `<Drawer>` forms. The `editingId` shape is wide enough to carry both
 * (`{ kind, id }`) so we don't accidentally cross-fire mutations.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
	Button,
	Drawer,
	Form,
	Input,
	InputNumber,
	Popconfirm,
	Select,
	Space,
	Switch,
	Table,
	Tabs,
	Tag,
	Typography,
	message,
} from "antd";
import type { TablePaginationConfig, TableProps } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import { ApiError } from "../../../shared/api";
import { imageSrc } from "../../../shared/lib/imageSrc";
import { AdminFileUpload } from "../../../shared/ui/AdminFileUpload";
import {
	type ApiAdminCategory,
	type ApiAdminDesign,
	type CategoryCreatePayload,
	type CategoryUpdatePayload,
	type DesignCreatePayload,
	type DesignUpdatePayload,
	type DesignsAdminQuery,
	useAdminCategories,
	useAdminDesigns,
	useCreateCategory,
	useCreateDesign,
	useDeleteCategory,
	useDeleteDesign,
	useToggleDesignVisibility,
	useUpdateCategory,
	useUpdateDesign,
	// `useAdminDesign` (single-row fetch) intentionally NOT imported —
	// the page builds the form from the table row directly. Reintroduce
	// when (and if) a deep-link `/admin/catalog/designs/:id` route lands.
} from "../api/catalogAdminApi";
import {
	type CatalogTab,
	DEFAULT_PAGE,
	DEFAULT_SIZE,
	SORT_OPTIONS,
	applyFilterPatch,
	parseTab,
	queryFromSearchParams,
	searchParamsFromQuery,
	slugify,
} from "../model/catalogAdminStore";

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

// ─── Form value shapes ─────────────────────────────────────────────────

interface CategoryFormValues {
	name: string;
	slug: string;
	image: string;
}

const EMPTY_CATEGORY_FORM: CategoryFormValues = {
	name: "",
	slug: "",
	image: "",
};

interface DesignFormValues {
	name: string;
	slug: string;
	category_id: string;
	style: string;
	image: string;
	preview_image: string;
	description: string;
	price: number;
	is_published: boolean;
	is_new: boolean;
	is_popular: boolean;
}

const EMPTY_DESIGN_FORM: DesignFormValues = {
	name: "",
	slug: "",
	category_id: "",
	style: "",
	image: "",
	preview_image: "",
	description: "",
	price: 1200,
	is_published: true,
	is_new: false,
	is_popular: false,
};

function categoryToForm(c: ApiAdminCategory): CategoryFormValues {
	return { name: c.name, slug: c.slug, image: c.image };
}

function designToForm(d: ApiAdminDesign): DesignFormValues {
	return {
		name: d.name,
		slug: d.slug,
		category_id: d.category_id,
		style: d.style,
		image: d.image,
		preview_image: d.preview_image,
		description: d.description,
		price: d.price,
		is_published: d.is_published,
		is_new: d.is_new,
		is_popular: d.is_popular,
	};
}

function formatRub(value: number): string {
	return `${value.toLocaleString("ru-RU")} ₽`;
}

function formatDate(iso: string): string {
	return dayjs(iso).format("DD.MM.YYYY");
}

// `imageSrc` is now lifted to `shared/lib/imageSrc.ts` so this page and
// `AdminUploadPage` (Phase 7B) share one canonical implementation —
// previously each had a divergent inline copy. See module docstring.

// ─── Page ──────────────────────────────────────────────────────────────

export default function AdminCatalogPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const tab: CatalogTab = parseTab(searchParams.get("tab"));
	const query: DesignsAdminQuery = useMemo(
		() => queryFromSearchParams(searchParams),
		[searchParams],
	);

	const {
		data: categoriesData,
		error: categoriesError,
		isFetching: categoriesFetching,
	} = useAdminCategories();
	const {
		data: designsData,
		error: designsError,
		isFetching: designsFetching,
	} = useAdminDesigns(query);

	const createCategory = useCreateCategory();
	const updateCategory = useUpdateCategory();
	const deleteCategory = useDeleteCategory();
	const createDesign = useCreateDesign();
	const updateDesign = useUpdateDesign();
	const deleteDesign = useDeleteDesign();
	const toggleVisibility = useToggleDesignVisibility();

	// ── Tab state ─────────────────────────────────────────────────────
	// Switching to «categories» strips designs-only params (`page`,
	// `category_id`, `search`, `sort`, `size`) — the categories tab has
	// no pagination and no filters, so leaving them in the URL would
	// pollute bookmarks. Switching to «designs» preserves the current
	// query so a deep-link back-and-forth round-trips. (N1 follow-up
	// from the Phase 7A audit.)
	function setTab(next: CatalogTab): void {
		if (next === "categories") {
			const params = new URLSearchParams();
			// No `tab` param either — categories is the default.
			setSearchParams(params, { replace: false });
			return;
		}
		const nextParams = searchParamsFromQuery(query, next);
		setSearchParams(nextParams, { replace: false });
	}

	// ── Designs filter state ──────────────────────────────────────────
	const [searchDraft, setSearchDraft] = useState(query.search ?? "");
	useEffect(() => {
		setSearchDraft(query.search ?? "");
	}, [query.search]);

	function updateUrl(next: DesignsAdminQuery): void {
		setSearchParams(searchParamsFromQuery(next, tab), { replace: false });
	}

	function onCategoryFilterChange(value: string | null | undefined): void {
		updateUrl(applyFilterPatch(query, { categoryId: value || null }));
	}

	function onSearchChange(value: string): void {
		const cleaned = value.trim();
		updateUrl(applyFilterPatch(query, { search: cleaned || null }));
	}

	function onSortChange(value: string): void {
		updateUrl(applyFilterPatch(query, { sort: value }));
	}

	function onTableChange(pagination: TablePaginationConfig): void {
		updateUrl({
			...query,
			page: pagination.current ?? DEFAULT_PAGE,
			size: pagination.pageSize ?? DEFAULT_SIZE,
		});
	}

	// ── Drawers ───────────────────────────────────────────────────────
	type DrawerKind = "category" | "design" | null;
	const [drawerKind, setDrawerKind] = useState<DrawerKind>(null);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [categoryForm] = Form.useForm<CategoryFormValues>();
	const [designForm] = Form.useForm<DesignFormValues>();
	const lastAutoSlugRef = useRef<string>("");

	function closeDrawer(): void {
		setDrawerKind(null);
		setEditingId(null);
		categoryForm.resetFields();
		designForm.resetFields();
		lastAutoSlugRef.current = "";
	}

	function openCreateCategory(): void {
		setDrawerKind("category");
		setEditingId(null);
		lastAutoSlugRef.current = "";
		categoryForm.setFieldsValue(EMPTY_CATEGORY_FORM);
	}

	function openEditCategory(c: ApiAdminCategory): void {
		setDrawerKind("category");
		setEditingId(c.id);
		lastAutoSlugRef.current = "";
		categoryForm.setFieldsValue(categoryToForm(c));
	}

	function openCreateDesign(): void {
		setDrawerKind("design");
		setEditingId(null);
		lastAutoSlugRef.current = "";
		// Pre-select the currently filtered category, if any — saves a click
		// when the admin is filling out a category before switching tabs.
		designForm.setFieldsValue({
			...EMPTY_DESIGN_FORM,
			category_id: query.categoryId ?? "",
		});
	}

	function openEditDesign(d: ApiAdminDesign): void {
		setDrawerKind("design");
		setEditingId(d.id);
		lastAutoSlugRef.current = "";
		designForm.setFieldsValue(designToForm(d));
	}

	function handleApiError(err: unknown, fallback: string): void {
		if (err instanceof ApiError) {
			const code = err.body?.code;
			if (
				code === "category_slug_conflict" ||
				code === "design_slug_conflict"
			) {
				const formInstance =
					drawerKind === "category" ? categoryForm : designForm;
				formInstance.setFields([{ name: "slug", errors: ["Slug уже занят"] }]);
				return;
			}
			if (code === "category_in_use") {
				message.error("Нельзя удалить: к категории привязаны дизайны");
				return;
			}
			if (code === "category_not_found" || code === "design_not_found") {
				message.error("Запись не найдена — возможно, удалена в другой вкладке");
				return;
			}
		}
		message.error(err instanceof Error ? err.message : fallback);
	}

	// ── Submit handlers ───────────────────────────────────────────────

	function onSubmitCategory(): void {
		categoryForm
			.validateFields()
			.then((values) => {
				const payload: CategoryCreatePayload = {
					name: values.name.trim(),
					slug: values.slug.trim(),
					image: (values.image ?? "").trim(),
				};
				if (editingId === null) {
					createCategory.mutate(payload, {
						onSuccess: () => {
							message.success("Категория создана");
							closeDrawer();
						},
						onError: (err) => handleApiError(err, "Не удалось создать"),
					});
				} else {
					updateCategory.mutate(
						{ categoryId: editingId, body: payload as CategoryUpdatePayload },
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
				/* form validation errors render inline */
			});
	}

	function onSubmitDesign(): void {
		designForm
			.validateFields()
			.then((values) => {
				const payload: DesignCreatePayload = {
					name: values.name.trim(),
					slug: values.slug.trim(),
					category_id: values.category_id,
					style: values.style.trim(),
					image: values.image.trim(),
					preview_image: values.preview_image.trim(),
					description: values.description.trim(),
					price: values.price,
					colors: [],
					is_published: values.is_published,
					is_new: values.is_new,
					is_popular: values.is_popular,
				};
				if (editingId === null) {
					createDesign.mutate(payload, {
						onSuccess: () => {
							message.success("Дизайн создан");
							closeDrawer();
						},
						onError: (err) => handleApiError(err, "Не удалось создать"),
					});
				} else {
					updateDesign.mutate(
						{ designId: editingId, body: payload as DesignUpdatePayload },
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
				/* form validation errors render inline */
			});
	}

	// ── Inline actions ────────────────────────────────────────────────

	function onToggleVisibility(d: ApiAdminDesign): void {
		toggleVisibility.mutate(d.id, {
			onSuccess: (next) => {
				message.success(
					next.is_published ? "Дизайн опубликован" : "Дизайн скрыт",
				);
			},
			onError: (err) =>
				handleApiError(err, "Не удалось переключить публикацию"),
		});
	}

	function onDeleteCategory(c: ApiAdminCategory): void {
		deleteCategory.mutate(c.id, {
			onSuccess: () => message.success("Категория удалена"),
			onError: (err) => handleApiError(err, "Не удалось удалить"),
		});
	}

	function onDeleteDesign(d: ApiAdminDesign): void {
		deleteDesign.mutate(d.id, {
			onSuccess: () => message.success("Дизайн удалён"),
			onError: (err) => handleApiError(err, "Не удалось удалить"),
		});
	}

	// ── Lookup helpers ────────────────────────────────────────────────
	const categoriesById = useMemo(() => {
		const map = new Map<string, ApiAdminCategory>();
		for (const c of categoriesData?.items ?? []) map.set(c.id, c);
		return map;
	}, [categoriesData]);

	const categoryOptions = useMemo(
		() =>
			(categoriesData?.items ?? []).map((c) => ({
				value: c.id,
				label: c.name,
			})),
		[categoriesData],
	);

	// ─── Columns ───────────────────────────────────────────────────────

	const categoryColumns: TableProps<ApiAdminCategory>["columns"] = [
		{
			title: "Изображение",
			dataIndex: "image",
			key: "image",
			width: 90,
			render: (path: string) =>
				path ? (
					<img
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
				),
		},
		{
			title: "Имя",
			dataIndex: "name",
			key: "name",
			render: (name: string, row) => (
				<div>
					<div style={{ fontWeight: 500 }}>{name}</div>
					<div style={{ fontSize: 12, color: "#6B7280" }}>{row.slug}</div>
				</div>
			),
		},
		{
			title: "Дизайнов",
			dataIndex: "designs_count",
			key: "designs_count",
			width: 120,
			align: "right",
		},
		{
			title: "",
			key: "actions",
			width: 110,
			render: (_v, row) => (
				<Space size="small">
					<Button
						type="text"
						icon={<EditOutlined />}
						onClick={() => openEditCategory(row)}
						aria-label="Редактировать категорию"
					/>
					<Popconfirm
						title="Удалить категорию?"
						description={
							row.designs_count > 0
								? `К категории привязано дизайнов: ${row.designs_count}. Удаление запрещено — сначала перенесите или удалите дизайны.`
								: "Действие необратимо."
						}
						okText="Удалить"
						okButtonProps={{ danger: true, disabled: row.designs_count > 0 }}
						cancelText="Отмена"
						onConfirm={() => onDeleteCategory(row)}
					>
						<Button
							type="text"
							danger
							icon={<DeleteOutlined />}
							loading={
								deleteCategory.isPending && deleteCategory.variables === row.id
							}
							aria-label="Удалить категорию"
						/>
					</Popconfirm>
				</Space>
			),
		},
	];

	const designColumns: TableProps<ApiAdminDesign>["columns"] = [
		{
			title: "Превью",
			dataIndex: "image",
			key: "image",
			width: 90,
			render: (path: string) =>
				path ? (
					<img
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
				),
		},
		{
			title: "Имя",
			dataIndex: "name",
			key: "name",
			render: (name: string, row) => (
				<div>
					<div style={{ fontWeight: 500 }}>{name}</div>
					<div style={{ fontSize: 12, color: "#6B7280" }}>{row.slug}</div>
				</div>
			),
		},
		{
			title: "Категория",
			dataIndex: "category_id",
			key: "category_id",
			width: 180,
			render: (id: string) => categoriesById.get(id)?.name ?? id,
		},
		{
			title: "Цена",
			dataIndex: "price",
			key: "price",
			width: 110,
			align: "right",
			render: formatRub,
		},
		{
			title: "Опубликован",
			dataIndex: "is_published",
			key: "is_published",
			width: 130,
			align: "center",
			render: (published: boolean, row) => (
				<Switch
					checked={published}
					loading={
						toggleVisibility.isPending && toggleVisibility.variables === row.id
					}
					onChange={() => onToggleVisibility(row)}
				/>
			),
		},
		{
			title: "Метки",
			key: "flags",
			width: 140,
			render: (_v, row) => (
				<Space size={4}>
					{row.is_new && <Tag color="green">new</Tag>}
					{row.is_popular && <Tag color="gold">hit</Tag>}
				</Space>
			),
		},
		{
			title: "Создан",
			dataIndex: "created_at",
			key: "created_at",
			width: 120,
			render: formatDate,
		},
		{
			title: "",
			key: "actions",
			width: 110,
			render: (_v, row) => (
				<Space size="small">
					<Button
						type="text"
						icon={<EditOutlined />}
						onClick={() => openEditDesign(row)}
						aria-label="Редактировать дизайн"
					/>
					<Popconfirm
						title="Удалить дизайн?"
						description="Действие необратимо. Связанные рекомендации будут очищены."
						okText="Удалить"
						okButtonProps={{ danger: true }}
						cancelText="Отмена"
						onConfirm={() => onDeleteDesign(row)}
					>
						<Button
							type="text"
							danger
							icon={<DeleteOutlined />}
							loading={
								deleteDesign.isPending && deleteDesign.variables === row.id
							}
							aria-label="Удалить дизайн"
						/>
					</Popconfirm>
				</Space>
			),
		},
	];

	const isCategorySubmitting =
		createCategory.isPending || updateCategory.isPending;
	const isDesignSubmitting = createDesign.isPending || updateDesign.isPending;

	// ─── Render ────────────────────────────────────────────────────────

	return (
		<motion.div
			initial="hidden"
			animate="visible"
			variants={fadeUpVariants}
			style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}
		>
			<motion.div variants={fadeUpVariants} custom={0}>
				<Title level={3} style={{ marginBottom: 24 }}>
					Каталог
				</Title>
			</motion.div>

			<motion.div variants={fadeUpVariants} custom={1}>
				<Tabs
					activeKey={tab}
					onChange={(key) => setTab(key as CatalogTab)}
					tabBarExtraContent={
						tab === "categories" ? (
							<Button
								type="primary"
								icon={<PlusOutlined />}
								onClick={openCreateCategory}
							>
								Добавить категорию
							</Button>
						) : (
							<Button
								type="primary"
								icon={<PlusOutlined />}
								onClick={openCreateDesign}
							>
								Добавить дизайн
							</Button>
						)
					}
					items={[
						{
							key: "categories",
							label: "Категории",
							children: (
								<>
									{categoriesError && (
										<Alert
											type="error"
											showIcon
											message="Не удалось загрузить категории"
											description={(categoriesError as Error).message}
											style={{ marginBottom: 16 }}
										/>
									)}
									<Table<ApiAdminCategory>
										rowKey="id"
										dataSource={categoriesData?.items ?? []}
										columns={categoryColumns}
										loading={categoriesFetching}
										pagination={false}
									/>
								</>
							),
						},
						{
							key: "designs",
							label: "Дизайны",
							children: (
								<>
									<Space wrap style={{ marginBottom: 16 }}>
										<Select<string>
											placeholder="Категория"
											allowClear
											style={{ minWidth: 200 }}
											value={query.categoryId ?? undefined}
											onChange={onCategoryFilterChange}
											options={categoryOptions}
										/>
										<Input.Search
											placeholder="Поиск: имя, slug"
											allowClear
											value={searchDraft}
											onChange={(e) => setSearchDraft(e.target.value)}
											onSearch={onSearchChange}
											style={{ width: 280 }}
										/>
										<Select
											style={{ minWidth: 180 }}
											value={query.sort}
											onChange={onSortChange}
											options={SORT_OPTIONS}
										/>
									</Space>

									{designsError && (
										<Alert
											type="error"
											showIcon
											message="Не удалось загрузить дизайны"
											description={(designsError as Error).message}
											style={{ marginBottom: 16 }}
										/>
									)}

									<Table<ApiAdminDesign>
										rowKey="id"
										dataSource={designsData?.items ?? []}
										columns={designColumns}
										loading={designsFetching}
										onChange={onTableChange}
										pagination={{
											current: query.page,
											pageSize: query.size,
											total: designsData?.total ?? 0,
											showSizeChanger: true,
											pageSizeOptions: [25, 50, 100, 200],
											showTotal: (total) => `Всего: ${total}`,
										}}
									/>
								</>
							),
						},
					]}
				/>
			</motion.div>

			{/* ─── Category drawer ─────────────────────────────────────── */}
			<Drawer
				title={
					editingId === null ? "Новая категория" : "Редактировать категорию"
				}
				styles={{ wrapper: { width: 480 } }}
				open={drawerKind === "category"}
				onClose={closeDrawer}
				destroyOnHidden
				extra={
					<Space>
						<Button onClick={closeDrawer} disabled={isCategorySubmitting}>
							Отмена
						</Button>
						<Button
							type="primary"
							onClick={onSubmitCategory}
							loading={isCategorySubmitting}
						>
							{editingId === null ? "Создать" : "Сохранить"}
						</Button>
					</Space>
				}
			>
				<Form<CategoryFormValues>
					form={categoryForm}
					layout="vertical"
					initialValues={EMPTY_CATEGORY_FORM}
					onValuesChange={(changed) => {
						if (editingId !== null) return;
						if (!("name" in changed)) return;
						const currentSlug =
							(categoryForm.getFieldValue("slug") as string) ?? "";
						if (currentSlug === "" || currentSlug === lastAutoSlugRef.current) {
							const next = slugify(changed.name as string);
							categoryForm.setFieldsValue({ slug: next });
							lastAutoSlugRef.current = next;
						}
					}}
				>
					<Form.Item
						name="name"
						label="Название"
						rules={[
							{ required: true, message: "Укажите название" },
							{ max: 100, message: "Максимум 100 символов" },
						]}
					>
						<Input placeholder="Природа" />
					</Form.Item>

					<Form.Item
						name="slug"
						label="Slug"
						rules={[
							{ required: true, message: "Укажите slug" },
							{ max: 100, message: "Максимум 100 символов" },
							{
								pattern: /^[a-z0-9-]+$/,
								message: "Только латинские буквы, цифры и дефис",
							},
						]}
					>
						<Input placeholder="nature" />
					</Form.Item>

					<Form.Item label="Изображение" name="image">
						<Input
							placeholder="Путь к загруженному файлу"
							style={{ marginBottom: 8 }}
						/>
					</Form.Item>
					<AdminFileUpload
						purpose="BANNER"
						hint="JPG/PNG до 10 МБ"
						onUploaded={(asset) => {
							categoryForm.setFieldsValue({ image: asset.path });
							message.success("Изображение загружено");
						}}
					/>
				</Form>
			</Drawer>

			{/* ─── Design drawer ───────────────────────────────────────── */}
			<Drawer
				title={editingId === null ? "Новый дизайн" : "Редактировать дизайн"}
				styles={{ wrapper: { width: 560 } }}
				open={drawerKind === "design"}
				onClose={closeDrawer}
				destroyOnHidden
				extra={
					<Space>
						<Button onClick={closeDrawer} disabled={isDesignSubmitting}>
							Отмена
						</Button>
						<Button
							type="primary"
							onClick={onSubmitDesign}
							loading={isDesignSubmitting}
						>
							{editingId === null ? "Создать" : "Сохранить"}
						</Button>
					</Space>
				}
			>
				<Form<DesignFormValues>
					form={designForm}
					layout="vertical"
					initialValues={EMPTY_DESIGN_FORM}
					onValuesChange={(changed) => {
						if (editingId !== null) return;
						if (!("name" in changed)) return;
						const currentSlug =
							(designForm.getFieldValue("slug") as string) ?? "";
						if (currentSlug === "" || currentSlug === lastAutoSlugRef.current) {
							const next = slugify(changed.name as string);
							designForm.setFieldsValue({ slug: next });
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
						<Input placeholder="Лес на рассвете" />
					</Form.Item>

					<Form.Item
						name="slug"
						label="Slug"
						rules={[
							{ required: true, message: "Укажите slug" },
							{ max: 255, message: "Максимум 255 символов" },
							{
								pattern: /^[a-z0-9-]+$/,
								message: "Только латинские буквы, цифры и дефис",
							},
						]}
					>
						<Input placeholder="forest-sunrise" />
					</Form.Item>

					<Form.Item
						name="category_id"
						label="Категория"
						rules={[{ required: true, message: "Выберите категорию" }]}
					>
						<Select
							placeholder="Категория"
							options={categoryOptions}
							showSearch
							optionFilterProp="label"
						/>
					</Form.Item>

					<Form.Item
						name="price"
						label="Цена (₽)"
						rules={[{ required: true, message: "Укажите цену" }]}
					>
						<InputNumber
							min={0}
							max={1_000_000}
							step={100}
							style={{ width: "100%" }}
							formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
							parser={(v) => Number((v ?? "").replace(/\s/g, "")) || 0}
						/>
					</Form.Item>

					<Form.Item
						name="description"
						label="Описание"
						rules={[{ max: 4000, message: "Максимум 4000 символов" }]}
					>
						<TextArea rows={3} placeholder="Описание дизайна…" />
					</Form.Item>

					<Form.Item label="Превью (overlay)" name="image">
						<Input
							placeholder="Путь к загруженному файлу"
							style={{ marginBottom: 8 }}
						/>
					</Form.Item>
					<AdminFileUpload
						purpose="DESIGN_PREVIEW"
						hint="JPG/PNG до 10 МБ"
						onUploaded={(asset) => {
							designForm.setFieldsValue({ image: asset.path });
							message.success("Превью загружено");
						}}
					/>

					<Form.Item
						label="Силуэт формы (preview_image)"
						name="preview_image"
						tooltip="Белый силуэт формы панели для каталога"
					>
						<Input
							placeholder="Путь к загруженному файлу"
							style={{ marginBottom: 8 }}
						/>
					</Form.Item>
					<AdminFileUpload
						purpose="DESIGN_PREVIEW"
						hint="JPG/PNG — белый силуэт формы"
						onUploaded={(asset) => {
							designForm.setFieldsValue({ preview_image: asset.path });
							message.success("Силуэт загружен");
						}}
					/>

					<Form.Item
						name="is_published"
						label="Опубликован"
						valuePropName="checked"
						tooltip="Скрытый дизайн не виден в публичном каталоге."
					>
						<Switch />
					</Form.Item>

					<Space size="large">
						<Form.Item name="is_new" label="Новинка" valuePropName="checked">
							<Switch />
						</Form.Item>
						<Form.Item name="is_popular" label="Хит" valuePropName="checked">
							<Switch />
						</Form.Item>
					</Space>
				</Form>
			</Drawer>
		</motion.div>
	);
}
