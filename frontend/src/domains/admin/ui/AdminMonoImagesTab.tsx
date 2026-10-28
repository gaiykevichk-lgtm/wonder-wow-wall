/**
 * Tab «Моно изображения» inside AdminCatalogPage.
 *
 * Manages «texture visualizations» — backgrounded hero images shown for
 * a single texture on the public site. Each row binds a `texture_id` and
 * carries optional media (image/video), poster, background, title/subtitle
 * and a description.
 *
 * Read/write goes through `texturesVisualizationAdminApi`; texture
 * selection uses `useAdminTextures` so we can resolve the human-friendly
 * label and filter by `is_active`.
 */

import { useMemo, useState } from "react";
import {
	Alert,
	Button,
	Drawer,
	Empty,
	Form,
	Image,
	Input,
	InputNumber,
	Popconfirm,
	Select,
	Space,
	Switch,
	Table,
	message,
} from "antd";
import type { TableProps } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";

import { imageSrc } from "../../../shared/lib/imageSrc";
import { AdminFileUpload } from "../../../shared/ui/AdminFileUpload";
import { useAdminTextures, type ApiTexture } from "../api/texturesAdminApi";
import {
	type ApiTextureVisualization,
	type TextureVisualizationCreatePayload,
	type TextureVisualizationUpdatePayload,
	useCreateTextureVisualization,
	useDeleteTextureVisualization,
	useTextureVisualizationsAdmin,
	useUpdateTextureVisualization,
} from "../api/texturesVisualizationAdminApi";

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

// ─── Form ────────────────────────────────────────────────────────────

interface MonoImageFormValues {
	texture_id: string;
	media_type: "image" | "video";
	title: string;
	subtitle: string;
	scroll_hint: string;
	description: string;
	sort_order: number;
	is_active: boolean;
}

const EMPTY_MONO_FORM: MonoImageFormValues = {
	texture_id: "",
	media_type: "image",
	title: "",
	subtitle: "",
	scroll_hint: "",
	description: "",
	sort_order: 0,
	is_active: true,
};

function vizToForm(v: ApiTextureVisualization): MonoImageFormValues {
	return {
		texture_id: v.texture_id,
		media_type: v.media_type,
		title: v.title,
		subtitle: v.subtitle,
		scroll_hint: v.scroll_hint,
		description: v.description,
		sort_order: v.sort_order,
		is_active: v.is_active,
	};
}

export default function AdminMonoImagesTab() {
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [filterTextureId, setFilterTextureId] = useState<string | undefined>(
		undefined,
	);

	const [form] = Form.useForm<MonoImageFormValues>();
	const [mediaPath, setMediaPath] = useState<string>("");
	const [posterPath, setPosterPath] = useState<string>("");
	const [bgPath, setBgPath] = useState<string>("");

	const texturesQuery = useAdminTextures();
	const textures = texturesQuery.data ?? [];

	const vizQuery = useTextureVisualizationsAdmin();
	const allViz = vizQuery.data ?? [];
	const viz = useMemo(
		() =>
			filterTextureId
				? allViz.filter((v) => v.texture_id === filterTextureId)
				: allViz,
		[allViz, filterTextureId],
	);

	const createViz = useCreateTextureVisualization();
	const updateViz = useUpdateTextureVisualization();
	const deleteViz = useDeleteTextureVisualization();

	const isSubmitting = createViz.isPending || updateViz.isPending;

	function openCreate(): void {
		setEditingId(null);
		setMediaPath("");
		setPosterPath("");
		setBgPath("");
		form.resetFields();
		form.setFieldsValue(EMPTY_MONO_FORM);
		setDrawerOpen(true);
	}

	function openEdit(v: ApiTextureVisualization): void {
		setEditingId(v.id);
		setMediaPath(v.media_url);
		setPosterPath(v.poster_url);
		setBgPath(v.bg_image_url);
		form.resetFields();
		form.setFieldsValue(vizToForm(v));
		setDrawerOpen(true);
	}

	function closeDrawer(): void {
		setDrawerOpen(false);
		setEditingId(null);
		form.resetFields();
		setMediaPath("");
		setPosterPath("");
		setBgPath("");
	}

	function onSubmit(): void {
		form
			.validateFields()
			.then((values) => {
				if (editingId === null) {
					const payload: TextureVisualizationCreatePayload = {
						texture_id: values.texture_id,
						media_type: values.media_type,
						media_url: mediaPath,
						poster_url: posterPath,
						bg_image_url: bgPath,
						title: values.title,
						subtitle: values.subtitle,
						scroll_hint: values.scroll_hint,
						description: values.description,
						sort_order: values.sort_order,
						is_active: values.is_active,
					};
					createViz.mutate(payload, {
						onSuccess: () => {
							message.success("Визуализация добавлена");
							closeDrawer();
						},
						onError: (err) =>
							message.error(
								err instanceof Error
									? err.message
									: "Не удалось создать визуализацию",
							),
					});
				} else {
					const payload: TextureVisualizationUpdatePayload = {
						media_type: values.media_type,
						media_url: mediaPath,
						poster_url: posterPath,
						bg_image_url: bgPath,
						title: values.title,
						subtitle: values.subtitle,
						scroll_hint: values.scroll_hint,
						description: values.description,
						sort_order: values.sort_order,
						is_active: values.is_active,
					};
					updateViz.mutate(
						{ vizId: editingId, payload },
						{
							onSuccess: () => {
								message.success("Визуализация обновлена");
								closeDrawer();
							},
							onError: (err) =>
								message.error(
									err instanceof Error
										? err.message
										: "Не удалось сохранить визуализацию",
								),
						},
					);
				}
			})
			.catch(() => {
				/* validation already shown by Form */
			});
	}

	function textureName(id: string): string {
		const t: ApiTexture | undefined = textures.find((x) => x.id === id);
		return t?.name ?? id;
	}

	const columns: TableProps<ApiTextureVisualization>["columns"] = [
		{
			title: "Текстура",
			dataIndex: "texture_id",
			key: "texture_id",
			width: 200,
			render: (id: string) => textureName(id),
		},
		{
			title: "Заголовок",
			dataIndex: "title",
			key: "title",
			ellipsis: true,
		},
		{
			title: "Тип",
			dataIndex: "media_type",
			key: "media_type",
			width: 80,
			render: (t: "image" | "video") => t,
		},
		{
			title: "Превью",
			dataIndex: "media_url",
			key: "media_url",
			width: 100,
			render: (path: string) =>
				path ? (
					<Image
						src={imageSrc(path)}
						alt=""
						style={{ width: 80, height: 50, objectFit: "cover" }}
					/>
				) : (
					"—"
				),
		},
		{
			title: "Активна",
			dataIndex: "is_active",
			key: "is_active",
			width: 100,
			render: (active: boolean, row) => (
				<Switch
					checked={active}
					onChange={(checked) =>
						updateViz.mutate({
							vizId: row.id,
							payload: { is_active: checked },
						})
					}
				/>
			),
		},
		{
			title: "Порядок",
			dataIndex: "sort_order",
			key: "sort_order",
			width: 90,
		},
		{
			title: "Действия",
			key: "actions",
			width: 140,
			render: (_v, row) => (
				<Space>
					<Button
						type="text"
						icon={<EditOutlined />}
						onClick={() => openEdit(row)}
					/>
					<Popconfirm
						title="Удалить визуализацию?"
						onConfirm={() =>
							deleteViz.mutate(row.id, {
								onSuccess: () => message.success("Удалено"),
								onError: (err) =>
									message.error(
										err instanceof Error ? err.message : "Не удалось удалить",
									),
							})
						}
					>
						<Button type="text" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<>
			<motion.div variants={fadeUpVariants} custom={0}>
				<div
					style={{
						display: "flex",
						gap: 12,
						marginBottom: 16,
						flexWrap: "wrap",
						alignItems: "center",
					}}
				>
					<Select
						placeholder="Все текстуры"
						allowClear
						style={{ minWidth: 240 }}
						value={filterTextureId}
						onChange={(v) => setFilterTextureId(v ?? undefined)}
						options={textures.map((t) => ({ value: t.id, label: t.name }))}
					/>
					<div style={{ flex: 1 }} />
					<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
						Добавить визуализацию
					</Button>
				</div>
			</motion.div>

			<motion.div variants={fadeUpVariants} custom={1}>
				{vizQuery.error && (
					<Alert
						type="error"
						showIcon
						message="Не удалось загрузить визуализации"
						description={(vizQuery.error as Error).message}
						style={{ marginBottom: 16 }}
					/>
				)}

				{viz.length === 0 && !vizQuery.isFetching ? (
					<Empty description="Нет визуализаций. Нажмите «Добавить визуализацию», чтобы создать первую." />
				) : (
					<Table<ApiTextureVisualization>
						rowKey="id"
						dataSource={viz}
						columns={columns}
						loading={vizQuery.isFetching}
						pagination={false}
					/>
				)}
			</motion.div>

			<Drawer
				title={
					editingId === null
						? "Новая визуализация"
						: "Редактировать визуализацию"
				}
				styles={{ wrapper: { width: 520 } }}
				open={drawerOpen}
				onClose={closeDrawer}
				destroyOnHidden
				extra={
					<Space>
						<Button onClick={closeDrawer} disabled={isSubmitting}>
							Отмена
						</Button>
						<Button type="primary" onClick={onSubmit} loading={isSubmitting}>
							{editingId === null ? "Создать" : "Сохранить"}
						</Button>
					</Space>
				}
			>
				<Form<MonoImageFormValues> form={form} layout="vertical">
					<Form.Item
						name="texture_id"
						label="Текстура"
						rules={[{ required: true, message: "Выберите текстуру" }]}
					>
						<Select
							placeholder="Выберите текстуру"
							options={textures.map((t) => ({
								value: t.id,
								label: t.name,
							}))}
							disabled={editingId !== null}
						/>
					</Form.Item>

					<Form.Item
						name="media_type"
						label="Тип медиа"
						rules={[{ required: true }]}
					>
						<Select
							options={[
								{ value: "image", label: "Изображение" },
								{ value: "video", label: "Видео" },
							]}
						/>
					</Form.Item>

					<Form.Item label="Медиа (image/video)">
						<AdminFileUpload
							purpose="TEXTURE_VISUALIZATION_MEDIA"
							hint="Загрузите основной медиафайл"
							onUploaded={(asset) => {
								setMediaPath(asset.path);
								message.success("Медиа загружено");
							}}
						/>
						{mediaPath && (
							<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
								{mediaPath}
							</div>
						)}
					</Form.Item>

					<Form.Item label="Постер (опц.)">
						<AdminFileUpload
							purpose="TEXTURE_VISUALIZATION_POSTER"
							hint="Превью для видео"
							onUploaded={(asset) => {
								setPosterPath(asset.path);
								message.success("Постер загружен");
							}}
						/>
						{posterPath && (
							<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
								{posterPath}
							</div>
						)}
					</Form.Item>

					<Form.Item label="Фон (опц.)">
						<AdminFileUpload
							purpose="TEXTURE_VISUALIZATION_BG"
							hint="Фоновое изображение сцены"
							onUploaded={(asset) => {
								setBgPath(asset.path);
								message.success("Фон загружен");
							}}
						/>
						{bgPath && (
							<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
								{bgPath}
							</div>
						)}
					</Form.Item>

					<Form.Item name="title" label="Заголовок">
						<Input maxLength={120} />
					</Form.Item>

					<Form.Item name="subtitle" label="Подзаголовок">
						<Input maxLength={120} />
					</Form.Item>

					<Form.Item name="scroll_hint" label="Подсказка при прокрутке">
						<Input maxLength={120} />
					</Form.Item>

					<Form.Item name="description" label="Описание">
						<TextArea rows={3} maxLength={1000} />
					</Form.Item>

					<Form.Item
						name="sort_order"
						label="Порядок сортировки"
						rules={[{ required: true }]}
					>
						<InputNumber min={0} max={10_000} style={{ width: "100%" }} />
					</Form.Item>

					<Form.Item name="is_active" label="Активна" valuePropName="checked">
						<Switch />
					</Form.Item>
				</Form>
			</Drawer>
		</>
	);
}
