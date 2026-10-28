/**
 * Edit an EXISTING panel variant.
 *
 * Complements `AdminPanelsWizard` (which only creates): here an admin can
 * change the texture, add/remove/reorder photos and toggle activity
 * without deleting the row and re-uploading everything.
 *
 * Photo edits stay in draft state. Save sends metadata and both galleries
 * in one PATCH; Cancel does not alter the product. Uploads are serialized
 * to prevent concurrent files from overwriting draft arrays.
 *
 * The parent MUST mount this with `key={variant.id}` — all local state is
 * seeded from props at mount, which keeps the "reset when a different
 * variant is opened" logic out of an effect.
 */

import { useRef, useState } from "react";

export type VariantPhotoDraft = { image_paths: string[]; design_image_paths: string[]; recommendation_image_paths: string[] };
import {
	Modal,
	Form,
	Input,
	Select,
	Switch,
	Upload,
	Button,
	Image,
	Space,
	Typography,
	Tag,
	Tooltip,
	Alert,
	message,
} from "antd";
import {
	UploadOutlined,
	DeleteOutlined,
	ArrowLeftOutlined,
	ArrowRightOutlined,
	StarFilled,
	LeftOutlined,
	RightOutlined,
} from "@ant-design/icons";

import { imageSrc } from "../../../shared/lib/imageSrc";
import { useAdminTextures } from "../api/texturesAdminApi";
import {
	useUpdatePanelVariant,
	useCreatePanelVariant,
	uploadFileToS3,
	type ApiPanelVariant,
} from "../api/panelVariantsAdminApi";

const { Text } = Typography;

function swapByIndex<T>(items: T[], index: number, direction: -1 | 1): T[] {
	const target = index + direction;
	if (target < 0 || target >= items.length) return items;
	const next = [...items];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

interface AdminVariantEditModalProps {
	open: boolean;
	variant: ApiPanelVariant | null;
	creating?: boolean;
	siblingVariants?: ApiPanelVariant[];
	photoDrafts?: Map<string, VariantPhotoDraft>;
	onSelectVariant?: (variant: ApiPanelVariant) => void;
	onReorderVariants?: (orderedIds: string[]) => Promise<void>;
	onEditExecution?: () => void;
	/** Which gallery to focus when the modal opens. Defaults to executions. */
	initialFocus?: "executions" | "designs" | "recommendations";
	/** Panel display name — the admin variant API returns only `panel_id`,
	 * so the parent (which already loads the panel list) passes it down. */
	panelName?: string;
	/** Panel size label, same reason as `panelName`. */
	panelSize?: string;
	onClose: () => void;
	onSaved?: () => void;
}

export default function AdminVariantEditModal({
	open,
	variant,
	creating = false,
	siblingVariants = [],
	photoDrafts,
	onSelectVariant,
	onReorderVariants,
	onEditExecution,
	initialFocus = "executions",
	panelName,
	panelSize,
	onClose,
	onSaved,
}: AdminVariantEditModalProps) {
	const [form] = Form.useForm();
	const { data: textures, isLoading: texturesLoading } = useAdminTextures();

	const updateVariant = useUpdatePanelVariant();
	const createVariant = useCreatePanelVariant();
	const saving = updateVariant.isPending || createVariant.isPending;
	const uploadQueue = useRef<Promise<void>>(Promise.resolve());
	const pendingUploads = useRef(0);

	// Local mirror of the server photo list so reorder feels instant. Every
	// mutation below still round-trips and re-seeds this from the response.
	// Seeded at mount from props — see the `key={variant.id}` contract above.
	const draft = variant ? photoDrafts?.get(variant.id) : undefined;
	const [photos, setPhotos] = useState<string[]>(draft?.image_paths ?? variant?.image_paths ?? []);
	const [uploading, setUploading] = useState(false);
	const [designPhotos, setDesignPhotos] = useState<string[]>(
		draft?.design_image_paths ?? variant?.design_image_paths ?? [],
	);
	const [recommendationPhotos, setRecommendationPhotos] = useState<string[]>(
		draft?.recommendation_image_paths ?? variant?.recommendation_image_paths ?? [],
	);
	const [orderedVariants, setOrderedVariants] = useState<ApiPanelVariant[]>(
		[...siblingVariants].sort((a, b) => a.sort_order - b.sort_order),
	);
	const [reordering, setReordering] = useState(false);
	const designQueue = useRef<Promise<void>>(Promise.resolve());
	const designPending = useRef(0);
	const [designUploading, setDesignUploading] = useState(false);
	const recommendationQueue = useRef<Promise<void>>(Promise.resolve());
	const recommendationPending = useRef(0);
	const [recommendationUploading, setRecommendationUploading] = useState(false);

	if (!variant) return null;

	const changeGallery = (kind: keyof VariantPhotoDraft, change: (items: string[]) => string[]) => {
		const current = photoDrafts?.get(variant.id) ?? { image_paths: photos, design_image_paths: designPhotos, recommendation_image_paths: recommendationPhotos };
		const next = change(current[kind]);
		photoDrafts?.set(variant.id, { ...current, [kind]: next });
		if (kind === "image_paths") setPhotos(next);
		if (kind === "design_image_paths") setDesignPhotos(next);
		if (kind === "recommendation_image_paths") setRecommendationPhotos(next);
	};
	const selectVariant = (item: ApiPanelVariant) => {
		if (pendingUploads.current || designPending.current || recommendationPending.current || saving) return;
		onSelectVariant?.(item);
	};

	// Photo changes stay local until Save. Cancelling never edits the product.
	const enqueueUpload = (file: File) => {
		if (!(form.getFieldValue("texture_id") || variant.texture_id)) {
			message.warning("Сначала выберите текстуру");
			return false;
		}
		pendingUploads.current += 1;
		setUploading(true);
		uploadQueue.current = uploadQueue.current.then(async () => {
			try {
				const path = await uploadFileToS3(
					file,
					variant.panel_id,
					form.getFieldValue("texture_id") || variant.texture_id,
				);
				changeGallery("image_paths", (items) => [...new Set([...items, path])]);
			} catch {
				message.error(
					"Не удалось загрузить фото. Остальные изменения сохранены в форме.",
				);
			} finally {
				pendingUploads.current -= 1;
				setUploading(pendingUploads.current > 0);
			}
		});
		return false;
	};
	const handleUpload = (file: File) => enqueueUpload(file);

	// Загрузка фото в дизайне — отдельная очередь, чтобы не блокировать
	// основную загрузку товарных фото.
	const handleUploadDesign = (file: File) => {
		if (!(form.getFieldValue("texture_id") || variant.texture_id)) {
			message.warning("Сначала выберите текстуру");
			return false;
		}
		designPending.current += 1;
		setDesignUploading(true);
		designQueue.current = designQueue.current.then(async () => {
			try {
				const path = await uploadFileToS3(
					file,
					variant.panel_id,
					form.getFieldValue("texture_id") || variant.texture_id,
					creating ? undefined : variant.id,
				);
				changeGallery("design_image_paths", (items) => [...new Set([...items, path])]);
			} catch {
				message.error("Не удалось загрузить фото в дизайне");
			} finally {
				designPending.current -= 1;
				setDesignUploading(designPending.current > 0);
			}
		});
		return false;
	};

	const handleUploadRecommendation = (file: File) => {
		if (!(form.getFieldValue("texture_id") || variant.texture_id)) {
			message.warning("Сначала выберите текстуру");
			return false;
		}
		recommendationPending.current += 1;
		setRecommendationUploading(true);
		recommendationQueue.current = recommendationQueue.current.then(async () => {
			try {
				const path = await uploadFileToS3(
					file,
					variant.panel_id,
					form.getFieldValue("texture_id") || variant.texture_id,
					creating ? undefined : variant.id,
				);
				changeGallery("recommendation_image_paths", (items) => [...new Set([...items, path])]);
			} catch {
				message.error("Не удалось загрузить рекомендацию");
			} finally {
				recommendationPending.current -= 1;
				setRecommendationUploading(recommendationPending.current > 0);
			}
		});
		return false;
	};

	// Товарные фото: реордер и удаление. Дизайнерские фото живут в
	// отдельной модалке, открываемой кнопкой ниже.
	const movePhoto = (index: number, direction: -1 | 1) =>
		changeGallery("image_paths", (items) => swapByIndex(items, index, direction));
	const handleRemove = (path: string) =>
		changeGallery("image_paths", (items) => items.filter((item) => item !== path));

	const moveVariant = async (index: number, direction: -1 | 1) => {
		const next = swapByIndex(orderedVariants, index, direction);
		if (next === orderedVariants || !onReorderVariants) return;
		setOrderedVariants(next);
		setReordering(true);
		try {
			await onReorderVariants(next.map((item) => item.id));
			message.success("Порядок вариантов сохранён");
		} catch {
			setOrderedVariants(orderedVariants);
			message.error("Не удалось изменить порядок вариантов");
		} finally {
			setReordering(false);
		}
	};

	const handleSave = async () => {
		if (
			pendingUploads.current > 0 ||
			designPending.current > 0 ||
			recommendationPending.current > 0 ||
			saving
		)
			return;
		try {
			const values =
				initialFocus === "executions"
					? await form.validateFields()
					: form.getFieldsValue();
			const body = {
				name: (values.name ?? variant.name ?? "").trim(),
				slug: (values.slug ?? variant.slug ?? "").trim(),
				texture_id: values.texture_id ?? variant.texture_id,
				is_active: values.is_active ?? variant.is_active,
				image_paths: photos,
				design_image_paths: designPhotos,
				recommendation_image_paths: recommendationPhotos,
			};
			if (creating) {
				await createVariant.mutateAsync({
					...body,
					panel_id: variant.panel_id,
					sort_order: variant.sort_order ?? siblingVariants.length,
					color_id: null,
					color_hex: null,
				});
			} else {
				const changed = new Map(photoDrafts);
				changed.set(variant.id, { image_paths: photos, design_image_paths: designPhotos, recommendation_image_paths: recommendationPhotos });
				for (const [id, galleries] of changed) {
					const sibling = siblingVariants.find((item) => item.id === id);
					if (id !== variant.id && !sibling) throw new Error("Исполнение больше не найдено");
					const source = id === variant.id ? variant : sibling!;
					await updateVariant.mutateAsync({ variantId: id, body: id === variant.id ? body : {
						name: source.name, slug: source.slug, texture_id: source.texture_id,
						is_active: source.is_active, ...galleries,
					} });
					photoDrafts?.delete(id);
				}
			}
			message.success("Вариант сохранён");
			onSaved?.();
			onClose();
		} catch (err) {
			// validateFields rejects with its own shape; only report real
			// request failures so a validation error doesn't show a toast.
			if (err && typeof err === "object" && "errorFields" in err) return;
			message.error("Ошибка сохранения");
		}
	};

	return (
		<>
			<Modal
				title={
					<Space>
						<span>
							{creating
								? "Добавить исполнение"
								: initialFocus === "designs"
									? "Фото в дизайне"
									: initialFocus === "recommendations"
										? "Рекомендации"
										: "Редактировать исполнение"}
						</span>
						{panelName && <Tag>{panelName}</Tag>}
						{panelSize && <Tag color="blue">{panelSize}</Tag>}
					</Space>
				}
				open={open}
				onCancel={() => {
					if (!uploading && !designUploading && !recommendationUploading && !saving) onClose();
				}}
				maskClosable={false}
				closable={!uploading && !designUploading && !recommendationUploading && !saving}
				cancelButtonProps={{
					disabled: uploading || designUploading || recommendationUploading || saving,
				}}
				okButtonProps={{
					disabled: uploading || designUploading || recommendationUploading,
				}}
				onOk={handleSave}
				okText="Сохранить"
				cancelText="Отмена"
				confirmLoading={saving}
				width={720}
				destroyOnHidden
			>
				{initialFocus === "executions" && (
					<div>
						{orderedVariants.length > 0 && (
							<div style={{ marginBottom: 18 }}>
								<Text strong style={{ display: "block", marginBottom: 8 }}>
									Варианты исполнений
								</Text>
								<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
									{orderedVariants.map((item, index) => (
										<div
											key={item.id}
											style={{
												width: 92,
												padding: 6,
												border:
													item.id === variant.id
														? "2px solid #1f1f1f"
														: "1px solid #e5e7eb",
												borderRadius: 8,
												background: "#fff",
											}}
										>
											<button
												type="button"
												onClick={() =>
													item.id !== variant.id && selectVariant(item)
												}
												aria-pressed={item.id === variant.id}
												aria-label={`Вариант ${index + 1}`}
												style={{
													padding: 0,
													border: 0,
													background: "transparent",
													cursor: "pointer",
												}}
											>
												{item.image_paths[0] ? (
													<img
														src={imageSrc(item.image_paths[0])}
														alt=""
														style={{
															width: 78,
															height: 68,
															objectFit: "cover",
															borderRadius: 5,
														}}
													/>
												) : (
													<div
														style={{
															width: 78,
															height: 68,
															background: "#f5f5f5",
															borderRadius: 5,
														}}
													/>
												)}
												<Text
													style={{
														display: "block",
														fontSize: 12,
														marginTop: 4,
													}}
													ellipsis
												>
													{item.name?.trim() || `Вариант ${index + 1}`}
												</Text>
											</button>
											{orderedVariants.length > 1 && (
												<Space size={0} style={{ marginTop: 3 }}>
													<Button
														type="text"
														size="small"
														aria-label={`Переместить вариант ${index + 1} влево`}
														icon={<LeftOutlined />}
														disabled={index === 0 || reordering}
														onClick={() => moveVariant(index, -1)}
													/>
													<Button
														type="text"
														size="small"
														aria-label={`Переместить вариант ${index + 1} вправо`}
														icon={<RightOutlined />}
														disabled={
															index === orderedVariants.length - 1 || reordering
														}
														onClick={() => moveVariant(index, 1)}
													/>
												</Space>
											)}
										</div>
									))}
								</div>
							</div>
						)}
						<Form
							form={form}
							layout="vertical"
							style={{ marginTop: 16 }}
							initialValues={{
								name: variant.name ?? "",
								slug: variant.slug ?? "",
								texture_id: variant.texture_id || undefined,
								is_active: variant.is_active,
							}}
						>
							<Form.Item
								name="name"
								label="Название исполнения"
								rules={[{ required: true, whitespace: true, max: 160 }]}
							>
								<Input placeholder="Исполнение 1" maxLength={160} />
							</Form.Item>
							<Form.Item name="slug" label="Слаг исполнения" rules={[{ pattern: /^[a-z0-9]*(?:-[a-z0-9]+)*$/, message: "Латинские строчные буквы, цифры и дефис" }]}><Input maxLength={160} placeholder="variant-name" /></Form.Item>
							<Form.Item
								name="texture_id"
								label="Текстура"
								rules={[{ required: true, message: "Выберите текстуру" }]}
							>
								<Select
									disabled={uploading || designUploading || saving}
									loading={texturesLoading}
									virtual={false}
									placeholder="Выберите текстуру"
									showSearch
									optionFilterProp="label"
									options={
										textures?.map((t) => ({ value: t.id, label: t.name })) ?? []
									}
								/>
							</Form.Item>

							<Form.Item
								name="is_active"
								label="Активен"
								valuePropName="checked"
							>
								<Switch />
							</Form.Item>
						</Form>

						{/* Товарные фото исполнения (лицо карточки). Первое — главное. */}
						<div style={{ marginTop: 16 }}>
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: 8,
								}}
							>
								<Text strong>Фото</Text>
								<Text type="secondary" style={{ fontSize: 12 }}>
									{photos.length} шт. · первое — главное
								</Text>
							</div>

							{photos.length === 0 ? (
								<Text type="secondary">Фото пока нет</Text>
							) : (
								<div
									style={{
										display: "grid",
										gridTemplateColumns:
											"repeat(auto-fill, minmax(140px, 1fr))",
										gap: 12,
										marginBottom: 16,
									}}
								>
									{photos.map((path, idx) => (
										<div
											key={path}
											style={{
												border:
													idx === 0 ? "2px solid #4CAF50" : "1px solid #e5e7eb",
												borderRadius: 8,
												padding: 4,
												background: "#fafafa",
												position: "relative",
											}}
										>
											<Image
												src={imageSrc(path)}
												alt={`Фото ${idx + 1}`}
												style={{
													width: "100%",
													height: 110,
													objectFit: "cover",
													borderRadius: 4,
												}}
												preview
											/>
											{idx === 0 && (
												<Tag
													color="green"
													style={{
														position: "absolute",
														top: 8,
														left: 8,
														margin: 0,
														fontSize: 10,
													}}
												>
													<StarFilled /> Главное
												</Tag>
											)}
											<Space
												size={2}
												style={{
													width: "100%",
													justifyContent: "center",
													marginTop: 4,
												}}
											>
												<Tooltip title="Левее">
													<Button
														size="small"
														type="text"
														icon={<ArrowLeftOutlined />}
														disabled={idx === 0 || saving}
														onClick={() => movePhoto(idx, -1)}
													/>
												</Tooltip>
												<Tooltip title="Правее">
													<Button
														size="small"
														type="text"
														icon={<ArrowRightOutlined />}
														disabled={idx === photos.length - 1 || saving}
														onClick={() => movePhoto(idx, 1)}
													/>
												</Tooltip>
												<Tooltip
													title={
														photos.length <= 1
															? "Нельзя удалить последнее фото"
															: "Удалить"
													}
												>
													<Button
														size="small"
														type="text"
														danger
														icon={<DeleteOutlined />}
														disabled={photos.length <= 1 || saving}
														onClick={() => handleRemove(path)}
													/>
												</Tooltip>
											</Space>
										</div>
									))}
								</div>
							)}

							<Space>
								<Upload
									multiple
									beforeUpload={handleUpload}
									showUploadList={false}
									accept="image/jpeg,image/png,image/webp"
									disabled={uploading || saving}
								>
									<Button icon={<UploadOutlined />} loading={uploading}>
										Добавить фото
									</Button>
								</Upload>
							</Space>
						</div>
					</div>
				)}
				{(initialFocus === "designs" || initialFocus === "recommendations") && (
					<div>
						{onEditExecution && <Button onClick={onEditExecution} disabled={designUploading || saving} style={{ marginBottom: 16 }}>Редактировать исполнение и порядок</Button>}
						{siblingVariants.length > 0 && (
							<div style={{ marginBottom: 18 }}>
								<Text strong style={{ display: "block", marginBottom: 8 }}>
									Выберите вариант исполнения
								</Text>
								<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
									{orderedVariants.map((item, index) => (
										<button
											key={item.id}
											type="button"
											onClick={() =>
												item.id !== variant.id && selectVariant(item)
											}
											aria-pressed={item.id === variant.id}
											aria-label={`Вариант ${index + 1}`}
											style={{
												width: 92,
												padding: 6,
												border:
													item.id === variant.id
														? "2px solid #1f1f1f"
														: "1px solid #e5e7eb",
												borderRadius: 8,
												background: "#fff",
												cursor: "pointer",
											}}
										>
											{item.image_paths[0] ? (
												<img
													src={imageSrc(item.image_paths[0])}
													alt=""
													style={{
														width: 78,
														height: 68,
														objectFit: "cover",
														borderRadius: 5,
													}}
												/>
											) : (
												<div
													style={{
														width: 78,
														height: 68,
														background: "#f5f5f5",
														borderRadius: 5,
													}}
												/>
											)}
											<Text
												style={{ display: "block", fontSize: 12, marginTop: 4 }}
												ellipsis
											>
												{item.name?.trim() || `Вариант ${index + 1}`}
											</Text>
										</button>
									))}
								</div>
							</div>
						)}
						<Alert
							type="info"
							showIcon
							title={`${initialFocus === "recommendations" ? "Рекомендации варианта" : "Фото варианта"}: ${variant.name?.trim() || variant.id.slice(0, 8)}`}
							description={
								initialFocus === "designs"
									? "Фото в дизайне привязаны только к этому варианту исполнения."
									: "Рекомендации привязаны только к этому варианту исполнения и хранятся отдельно от фото в дизайне."
							}
							style={{ marginBottom: 16 }}
						/>
						{(() => {
							const isRecommendations = initialFocus === "recommendations";
							const gallery = isRecommendations
								? recommendationPhotos
								: designPhotos;
							const busy = isRecommendations
								? recommendationUploading
								: designUploading;
							const galleryKind = isRecommendations ? "recommendation_image_paths" : "design_image_paths";
							const label = isRecommendations ? "Рекомендации" : "Фото в дизайне";
							const uploadLabel = isRecommendations
								? "Загрузить рекомендации"
								: "Загрузить фото в дизайне";
							return (
								<>
									<Text strong style={{ display: "block", marginBottom: 8 }}>
										{label} ({gallery.length})
									</Text>
									<Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
										{isRecommendations
											? "Эти изображения используются как рекомендации для выбранного исполнения."
											: "Эти снимки показываются в галерее карточки товара после выбора данного исполнения."}
									</Text>
									{gallery.length === 0 ? (
										<Text type="secondary">{label} пока не добавлены</Text>
									) : (
										<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
											{gallery.map((path, idx) => (
												<div key={path} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 4, background: "#fafafa" }}>
													<Image
														src={imageSrc(path)}
														alt={`${isRecommendations ? "Рекомендация" : "Дизайн"} ${idx + 1}`}
														style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 4 }}
														preview
													/>
													<Button size="small" type="text" danger block aria-label={`Удалить: ${label}`} icon={<DeleteOutlined />} disabled={busy} onClick={() => changeGallery(galleryKind, (items) => items.filter((item) => item !== path))}>Удалить</Button>
												</div>
											))}
										</div>
									)}
									<Upload multiple beforeUpload={isRecommendations ? handleUploadRecommendation : handleUploadDesign} showUploadList={false} accept="image/jpeg,image/png,image/webp" disabled={busy}>
										<Button aria-label={uploadLabel} icon={<UploadOutlined />} loading={busy}>{uploadLabel}</Button>
									</Upload>
								</>
							);
						})()}
					</div>
				)}
			</Modal>
		</>
	);
}
