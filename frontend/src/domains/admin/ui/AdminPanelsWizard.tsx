/**
 * Panel Variant Wizard.
 *
 * 5-step wizard:
 * 1. Select panel sizes (checkbox, one or many)
 * 2. Upload up to 2 catalog photos per selected size
 * 3. Select textures (from DB)
 * 4. Upload grid: for each size×texture combination
 * 5. Review + save
 *
 * Colour was removed from the product model — the photos communicate the
 * finish, so there is no colour step and no `color_hex` in the payload.
 *
 * Step 2 photos are PERSISTED ONTO THE PANEL (`photo_paths`), not just
 * held in wizard state: they are what the public catalog card renders.
 * Everything from step 4 becomes `panel_variants` rows instead.
 */

import { useState, useCallback } from "react";
import {
	Modal,
	Steps,
	Button,
	Card,
	Row,
	Col,
	Typography,
	Space,
	Upload,
	Checkbox,
	message,
	Spin,
	Image,
	Empty,
	Tooltip,
	Alert,
	Tag,
} from "antd";
import {
	CheckCircleFilled,
	DeleteOutlined,
	UploadOutlined,
	ArrowLeftOutlined,
	ArrowRightOutlined,
	HolderOutlined,
} from "@ant-design/icons";
import { motion, AnimatePresence } from "framer-motion";

import { imageSrc } from "../../../shared/lib/imageSrc";
import { usePanelsAdminList, useUpdatePanel } from "../api/panelsAdminApi";
import { useAdminTextures } from "../api/texturesAdminApi";
import {
	useCreatePanelVariantsBatch,
	uploadFileToS3,
} from "../api/panelVariantsAdminApi";

const { Title, Text } = Typography;
const { Dragger } = Upload;

// ─── Types ────────────────────────────────────────────────────────────

/** How many catalog photos a single panel may carry. Mirrors the
 * `max_length=2` cap on `PanelCreate.photo_paths` in the backend. */
const MAX_CATALOG_PHOTOS = 2;

interface SelectedSize {
	panelId: string;
	panelName: string;
	panelPrice: number;
	sizeLabel: string;
	/** Ordered catalog gallery, max `MAX_CATALOG_PHOTOS`. First = primary. */
	catalogPhotos: string[];
}

interface PhotoItem {
	id: string;
	path: string;
	isPrimary: boolean;
}

interface TexturePhoto {
	textureId: string;
	textureName: string;
	sizeId: string;
	sizeLabel: string;
	photos: PhotoItem[];
}

interface WizardState {
	sizes: SelectedSize[];
	selectedTextureIds: string[];
	photoGrid: TexturePhoto[];
}

// ─── Step 1: Select Sizes ─────────────────────────────────────────────

interface Step1Props {
	selectedSizes: SelectedSize[];
	onChange: (sizes: SelectedSize[]) => void;
}

function Step1SelectSizes({ selectedSizes, onChange }: Step1Props) {
	const { data: panels, isLoading } = usePanelsAdminList({
		page: 1,
		size: 100,
		search: null,
		isActive: true,
	});

	const selectedIds = selectedSizes.map((s) => s.panelId);

	const handleToggle = (
		panelId: string,
		panelName: string,
		panelPrice: number,
		panelSizeLabel: string,
	) => {
		if (selectedIds.includes(panelId)) {
			onChange(selectedSizes.filter((s) => s.panelId !== panelId));
		} else {
			onChange([
				...selectedSizes,
				{
					panelId,
					panelName,
					panelPrice,
					sizeLabel: panelSizeLabel,
					catalogPhotos: [],
				},
			]);
		}
	};

	if (isLoading)
		return (
			<div style={{ textAlign: "center", padding: 40 }}>
				<Spin size="large" />
			</div>
		);

	const panelItems = panels?.items || [];

	return (
		<div>
			<Title level={4} style={{ marginBottom: 8 }}>
				Выберите размеры панелей
			</Title>
			<Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
				Можно выбрать один или несколько размеров. Для каждого размера нужно
				будет загрузить главное фото.
			</Text>

			<Row gutter={[16, 16]}>
				{panelItems.map((panel) => {
					const isSelected = selectedIds.includes(panel.id);
					return (
						<Col xs={24} sm={12} md={8} key={panel.id}>
							<Card
								hoverable
								onClick={() =>
									handleToggle(
										panel.id,
										panel.name,
										panel.base_price,
										panel.size_label,
									)
								}
								style={{
									border: isSelected ? "2px solid #4CAF50" : undefined,
									background: isSelected ? "#f6ffed" : undefined,
								}}
								cover={
									panel.photo_path ? (
										<Image
											src={imageSrc(panel.photo_path)}
											alt={panel.name}
											style={{ height: 120, objectFit: "cover" }}
											preview={false}
										/>
									) : (
										<div
											style={{
												height: 120,
												background: "#f5f5f5",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Text type="secondary">Нет фото</Text>
										</div>
									)
								}
							>
								<Card.Meta
									title={
										<Space>
											<Checkbox checked={isSelected} />
											{panel.name}
										</Space>
									}
									description={
										<div>
											<Text>{panel.size_label}</Text>
											<br />
											<Text strong style={{ color: "#4CAF50" }}>
												{panel.base_price.toLocaleString("ru-RU")} ₽
											</Text>
										</div>
									}
								/>
							</Card>
						</Col>
					);
				})}
			</Row>
		</div>
	);
}

// ─── Step 2: Catalog Photos for Sizes ───────────────────────────────

interface Step2Props {
	sizes: SelectedSize[];
	onChange: (sizes: SelectedSize[]) => void;
}

function Step2CatalogPhotos({ sizes, onChange }: Step2Props) {
	// Keyed by panelId so two cards can upload concurrently without the
	// second one hijacking the first one's spinner.
	const [uploading, setUploading] = useState<Record<string, boolean>>({});

	const handleUpload = async (sizeId: string, file: File) => {
		const target = sizes.find((s) => s.panelId === sizeId);
		if (target && target.catalogPhotos.length >= MAX_CATALOG_PHOTOS) {
			message.warning(`Максимум ${MAX_CATALOG_PHOTOS} фото на панель`);
			return false;
		}
		setUploading((u) => ({ ...u, [sizeId]: true }));
		try {
			const objectKey = await uploadFileToS3(file, sizeId);
			onChange(
				sizes.map((s) =>
					s.panelId === sizeId
						? {
								...s,
								// Re-cap here too: two files dropped at once both
								// pass the pre-check above before either resolves.
								catalogPhotos: [...s.catalogPhotos, objectKey].slice(
									0,
									MAX_CATALOG_PHOTOS,
								),
							}
						: s,
				),
			);
			message.success("Фото загружено");
		} catch (err) {
			console.error("Upload error:", err);
			message.error("Ошибка загрузки фото");
		} finally {
			setUploading((u) => ({ ...u, [sizeId]: false }));
		}
		return false;
	};

	const handleRemove = (sizeId: string, path: string) => {
		onChange(
			sizes.map((s) =>
				s.panelId === sizeId
					? { ...s, catalogPhotos: s.catalogPhotos.filter((p) => p !== path) }
					: s,
			),
		);
	};

	const handleMakePrimary = (sizeId: string, path: string) => {
		onChange(
			sizes.map((s) =>
				s.panelId === sizeId
					? {
							...s,
							catalogPhotos: [
								path,
								...s.catalogPhotos.filter((p) => p !== path),
							],
						}
					: s,
			),
		);
	};

	return (
		<div>
			<Title level={4} style={{ marginBottom: 8 }}>
				Фото для каталога
			</Title>
			<Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
				Загрузите до {MAX_CATALOG_PHOTOS} фото для каждого размера — именно они
				показываются в каталоге. Первое фото — главное.
			</Text>

			<Row gutter={[16, 16]}>
				{sizes.map((size) => {
					const isFull = size.catalogPhotos.length >= MAX_CATALOG_PHOTOS;
					return (
						<Col xs={24} sm={12} md={12} key={size.panelId}>
							<Card
								title={
									<Space>
										<CheckCircleFilled
											style={{
												color:
													size.catalogPhotos.length > 0 ? "#4CAF50" : "#ccc",
											}}
										/>
										{size.panelName}
									</Space>
								}
								extra={
									<Space size={4}>
										<Tag>{size.sizeLabel}</Tag>
										<Tag color={isFull ? "green" : "blue"}>
											{size.catalogPhotos.length}/{MAX_CATALOG_PHOTOS}
										</Tag>
									</Space>
								}
							>
								{size.catalogPhotos.length > 0 && (
									<Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
										{size.catalogPhotos.map((path, idx) => (
											<Col span={12} key={path}>
												<div style={{ position: "relative" }}>
													<Image
														src={imageSrc(path)}
														alt={`${size.panelName} ${idx + 1}`}
														style={{
															width: "100%",
															height: 130,
															objectFit: "cover",
															borderRadius: 8,
														}}
														preview
													/>
													{idx === 0 ? (
														<Tag
															color="green"
															style={{
																position: "absolute",
																top: 6,
																left: 6,
																margin: 0,
															}}
														>
															Главное
														</Tag>
													) : (
														<Tooltip title="Сделать главным">
															<Button
																size="small"
																onClick={() =>
																	handleMakePrimary(size.panelId, path)
																}
																style={{
																	position: "absolute",
																	top: 6,
																	left: 6,
																}}
															>
																★
															</Button>
														</Tooltip>
													)}
													<Button
														type="text"
														danger
														size="small"
														icon={<DeleteOutlined />}
														onClick={() => handleRemove(size.panelId, path)}
														style={{
															position: "absolute",
															top: 4,
															right: 4,
															background: "#fff",
														}}
													/>
												</div>
											</Col>
										))}
									</Row>
								)}

								{!isFull && (
									<Dragger
										showUploadList={false}
										beforeUpload={(file) => {
											handleUpload(size.panelId, file);
											return false;
										}}
										disabled={uploading[size.panelId]}
									>
										<p className="ant-upload-drag-icon">
											{uploading[size.panelId] ? (
												<Spin size="small" />
											) : (
												<UploadOutlined />
											)}
										</p>
										<p className="ant-upload-text">
											{size.catalogPhotos.length === 0
												? "Загрузить главное фото"
												: "Загрузить второе фото"}
										</p>
									</Dragger>
								)}
							</Card>
						</Col>
					);
				})}
			</Row>
		</div>
	);
}

// ─── Step 3: Select Textures ─────────────────────────────────────────

interface Step3Props {
	selectedTextureIds: string[];
	onChange: (ids: string[]) => void;
}

function Step3SelectTextures({ selectedTextureIds, onChange }: Step3Props) {
	const { data: textures, isLoading } = useAdminTextures();

	const handleToggle = (textureId: string) => {
		if (selectedTextureIds.includes(textureId)) {
			onChange(selectedTextureIds.filter((id) => id !== textureId));
		} else {
			onChange([...selectedTextureIds, textureId]);
		}
	};

	if (isLoading)
		return (
			<div style={{ textAlign: "center", padding: 40 }}>
				<Spin size="large" />
			</div>
		);

	const selectedTextures = textures?.filter((t) =>
		selectedTextureIds.includes(t.id),
	);

	return (
		<div>
			<Title level={4} style={{ marginBottom: 8 }}>
				Выберите текстуры
			</Title>
			<Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
				Выберите одну или несколько текстур из базы данных.
			</Text>

			{selectedTextureIds.length > 0 && (
				<Alert
					type="info"
					showIcon
					message={`Выбрано текстур: ${selectedTextureIds.length}`}
					description={
						<Space wrap>
							{selectedTextures?.map((t) => (
								<Tag key={t.id} color="blue">
									{t.name}
								</Tag>
							))}
						</Space>
					}
					style={{ marginBottom: 24 }}
				/>
			)}

			<Row gutter={[16, 16]}>
				{textures?.map((texture) => {
					const isSelected = selectedTextureIds.includes(texture.id);
					return (
						<Col xs={24} sm={12} md={8} key={texture.id}>
							<Card
								hoverable
								onClick={() => handleToggle(texture.id)}
								style={{
									border: isSelected ? "2px solid #4CAF50" : undefined,
									background: isSelected ? "#f6ffed" : undefined,
								}}
								cover={
									texture.swatch_image ? (
										<Image
											src={imageSrc(texture.swatch_image)}
											alt={texture.name}
											style={{ height: 100, objectFit: "cover" }}
											preview={false}
										/>
									) : (
										<div
											style={{
												height: 100,
												background: "#f5f5f5",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
											}}
										>
											<Text type="secondary">Нет swatch</Text>
										</div>
									)
								}
							>
								<Card.Meta
									title={
										<Space>
											<Checkbox checked={isSelected} />
											{texture.name}
										</Space>
									}
								/>
							</Card>
						</Col>
					);
				})}
			</Row>
		</div>
	);
}

// ─── Step 4: Photo Grid ──────────────────────────────────────────────

interface Step4Props {
	sizes: SelectedSize[];
	textureIds: string[];
	photoGrid: TexturePhoto[];
	onChange: (grid: TexturePhoto[]) => void;
}

function Step4PhotoGrid({
	sizes,
	textureIds,
	photoGrid,
	onChange,
}: Step4Props) {
	const { data: textures } = useAdminTextures();
	const [uploadingCell, setUploadingCell] = useState<string | null>(null);

	const getCellPhotos = (sizeId: string, textureId: string): PhotoItem[] => {
		return (
			photoGrid.find((p) => p.sizeId === sizeId && p.textureId === textureId)
				?.photos || []
		);
	};

	const handleUpload = async (
		sizeId: string,
		textureId: string,
		textureName: string,
		sizeLabel: string,
		file: File,
	) => {
		const cellKey = `${sizeId}-${textureId}`;
		setUploadingCell(cellKey);
		try {
			// Upload to S3 and get real object_key
			const objectKey = await uploadFileToS3(file, sizeId, textureId);
			const photoId = `${cellKey}-${objectKey.split("/").pop()}`;

			const existingIndex = photoGrid.findIndex(
				(p) => p.sizeId === sizeId && p.textureId === textureId,
			);

			if (existingIndex >= 0) {
				const updated = [...photoGrid];
				updated[existingIndex] = {
					...updated[existingIndex],
					photos: [
						...updated[existingIndex].photos,
						{ id: photoId, path: objectKey, isPrimary: false },
					],
				};
				onChange(updated);
			} else {
				onChange([
					...photoGrid,
					{
						sizeId,
						textureId,
						textureName,
						sizeLabel,
						photos: [
							{
								id: photoId,
								path: objectKey,
								isPrimary: photoGrid.length === 0,
							},
						],
					},
				]);
			}
			message.success("Фото загружено");
		} catch (err) {
			console.error("Upload error:", err);
			message.error("Ошибка загрузки фото");
		} finally {
			setUploadingCell(null);
		}
		return false;
	};

	const handleRemovePhoto = (
		sizeId: string,
		textureId: string,
		photoId: string,
	) => {
		onChange(
			photoGrid
				.map((p) => {
					if (p.sizeId === sizeId && p.textureId === textureId) {
						return {
							...p,
							photos: p.photos.filter((ph) => ph.id !== photoId),
						};
					}
					return p;
				})
				.filter((p) => p.photos.length > 0),
		);
	};

	const handleSetPrimary = (
		sizeId: string,
		textureId: string,
		photoId: string,
	) => {
		onChange(
			photoGrid.map((p) => {
				if (p.sizeId === sizeId && p.textureId === textureId) {
					return {
						...p,
						photos: p.photos.map((ph) => ({
							...ph,
							isPrimary: ph.id === photoId,
						})),
					};
				}
				return p;
			}),
		);
	};

	const selectedTextures = textures?.filter((t) => textureIds.includes(t.id));

	if (!selectedTextures || selectedTextures.length === 0) {
		return (
			<div style={{ textAlign: "center", padding: 40 }}>
				<Empty description="Сначала выберите текстуры на шаге 3" />
			</div>
		);
	}

	return (
		<div>
			<Title level={4} style={{ marginBottom: 8 }}>
				Загрузите фотографии для каждой комбинации
			</Title>
			<Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
				Сетка: {sizes.length} размер(ов) × {selectedTextures.length} текстур(ы)
				= {sizes.length * selectedTextures.length} ячеек
			</Text>

			{sizes.map((size) => (
				<div key={size.panelId} style={{ marginBottom: 32 }}>
					<Title level={5}>
						<Space>
							<CheckCircleFilled style={{ color: "#4CAF50" }} />
							{size.panelName}
							<Tag>{size.sizeLabel}</Tag>
						</Space>
					</Title>

					<Row gutter={[16, 16]}>
						{selectedTextures.map((texture) => {
							const cellKey = `${size.panelId}-${texture.id}`;
							const photos = getCellPhotos(size.panelId, texture.id);

							return (
								<Col xs={24} sm={12} md={8} key={cellKey}>
									<Card
										size="small"
										title={<span style={{ fontSize: 13 }}>{texture.name}</span>}
										extra={
											<Tooltip title="Количество фото">
												<Tag>{photos.length}</Tag>
											</Tooltip>
										}
									>
										{photos.length > 0 && (
											<div
												style={{
													display: "flex",
													gap: 4,
													flexWrap: "wrap",
													marginBottom: 8,
												}}
											>
												{photos.map((photo, idx) => (
													<div key={photo.id} style={{ position: "relative" }}>
														<Image
															src={imageSrc(photo.path)}
															alt={`Photo ${idx + 1}`}
															style={{
																width: 60,
																height: 60,
																objectFit: "cover",
																borderRadius: 4,
																border: photo.isPrimary
																	? "2px solid #4CAF50"
																	: undefined,
															}}
															preview
														/>
														{photo.isPrimary && (
															<div
																style={{
																	position: "absolute",
																	bottom: 2,
																	left: 2,
																	background: "#4CAF50",
																	color: "#fff",
																	fontSize: 8,
																	padding: "1px 3px",
																	borderRadius: 2,
																}}
															>
																Главное
															</div>
														)}
														<div
															style={{
																position: "absolute",
																top: 2,
																right: 2,
																display: "flex",
																flexDirection: "column",
																gap: 1,
															}}
														>
															{!photo.isPrimary && (
																<Tooltip title="Сделать главным">
																	<Button
																		type="text"
																		size="small"
																		icon={<HolderOutlined />}
																		style={{
																			width: 20,
																			height: 20,
																			minWidth: 20,
																			background: "#fff",
																			fontSize: 10,
																		}}
																		onClick={() =>
																			handleSetPrimary(
																				size.panelId,
																				texture.id,
																				photo.id,
																			)
																		}
																	/>
																</Tooltip>
															)}
															<Tooltip title="Удалить">
																<Button
																	type="text"
																	danger
																	size="small"
																	icon={<DeleteOutlined />}
																	style={{
																		width: 20,
																		height: 20,
																		minWidth: 20,
																		fontSize: 10,
																	}}
																	onClick={() =>
																		handleRemovePhoto(
																			size.panelId,
																			texture.id,
																			photo.id,
																		)
																	}
																/>
															</Tooltip>
														</div>
													</div>
												))}
											</div>
										)}

										<Dragger
											showUploadList={false}
											beforeUpload={(file) => {
												handleUpload(
													size.panelId,
													texture.id,
													texture.name,
													size.sizeLabel,
													file,
												);
												return false;
											}}
											disabled={uploadingCell === cellKey}
										>
											<p className="ant-upload-drag-icon">
												{uploadingCell === cellKey ? (
													<Spin size="small" />
												) : (
													<UploadOutlined />
												)}
											</p>
											<p className="ant-upload-text" style={{ fontSize: 12 }}>
												Загрузить
											</p>
										</Dragger>
									</Card>
								</Col>
							);
						})}
					</Row>
				</div>
			))}
		</div>
	);
}

// ─── Step 6: Review ──────────────────────────────────────────────────

interface Step6Props {
	sizes: SelectedSize[];
	textureIds: string[];
	photoGrid: TexturePhoto[];
}

function Step6Review({ sizes, textureIds, photoGrid }: Step6Props) {
	const { data: textures } = useAdminTextures();
	const selectedTextures = textures?.filter((t) => textureIds.includes(t.id));

	const totalPhotos = photoGrid.reduce((acc, p) => acc + p.photos.length, 0);
	const totalCatalogPhotos = sizes.reduce(
		(acc, s) => acc + s.catalogPhotos.length,
		0,
	);

	return (
		<div>
			<Title level={4} style={{ marginBottom: 16 }}>
				Подтверждение
			</Title>
			<Alert
				type="info"
				showIcon
				message="Проверьте данные перед сохранением"
				description={`Фото каталога: ${totalCatalogPhotos} · вариантов текстур: ${totalPhotos} фото`}
				style={{ marginBottom: 24 }}
			/>

			<Row gutter={[16, 16]}>
				<Col span={8}>
					<Card size="small">
						<Text type="secondary">Размеров:</Text>
						<br />
						<Text strong style={{ fontSize: 24 }}>
							{sizes.length}
						</Text>
					</Card>
				</Col>
				<Col span={8}>
					<Card size="small">
						<Text type="secondary">Текстур:</Text>
						<br />
						<Text strong style={{ fontSize: 24 }}>
							{selectedTextures?.length || 0}
						</Text>
					</Card>
				</Col>
				<Col span={8}>
					<Card size="small">
						<Text type="secondary">Всего фото:</Text>
						<br />
						<Text strong style={{ fontSize: 24 }}>
							{totalPhotos}
						</Text>
					</Card>
				</Col>
			</Row>

			<Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
				Структура вариантов
			</Title>

			{photoGrid.map((cell) => (
				<Card key={`${cell.sizeId}-${cell.textureId}`} size="small">
					<Space>
						<Tag>{cell.sizeLabel}</Tag>
						<Text>{cell.textureName}</Text>
						<Text type="secondary">— {cell.photos.length} фото</Text>
					</Space>
					<div
						style={{
							display: "flex",
							gap: 8,
							marginTop: 8,
							flexWrap: "wrap",
						}}
					>
						{cell.photos.map((photo) => (
							<div key={photo.id} style={{ position: "relative" }}>
								<Image
									src={imageSrc(photo.path)}
									alt="photo"
									style={{
										width: 50,
										height: 50,
										objectFit: "cover",
										borderRadius: 4,
									}}
									preview={false}
								/>
								{photo.isPrimary && (
									<div
										style={{
											position: "absolute",
											top: 2,
											left: 2,
											background: "#4CAF50",
											color: "#fff",
											fontSize: 8,
											padding: "1px 3px",
											borderRadius: 2,
										}}
									>
										★
									</div>
								)}
							</div>
						))}
					</div>
				</Card>
			))}
		</div>
	);
}

// ─── Main Wizard Component ─────────────────────────────────────────────

interface AdminPanelsWizardProps {
	open: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	panelId?: string;
}

export default function AdminPanelsWizard({
	open,
	onClose,
	onSuccess,
}: AdminPanelsWizardProps) {
	const [currentStep, setCurrentStep] = useState(0);
	const [state, setState] = useState<WizardState>({
		sizes: [],
		selectedTextureIds: [],
		photoGrid: [],
	});
	const createBatch = useCreatePanelVariantsBatch();
	const updatePanel = useUpdatePanel();

	const steps = [
		{ title: "Размеры" },
		{ title: "Фото каталога" },
		{ title: "Текстуры" },
		{ title: "Фото текстур" },
		{ title: "Сохранение" },
	];

	const updateSizes = useCallback(
		(sizes: SelectedSize[]) => setState((s) => ({ ...s, sizes })),
		[],
	);

	const updateTextures = useCallback(
		(ids: string[]) => setState((s) => ({ ...s, selectedTextureIds: ids })),
		[],
	);

	const updateGrid = useCallback(
		(grid: TexturePhoto[]) => setState((s) => ({ ...s, photoGrid: grid })),
		[],
	);

	const handleSave = async () => {
		// One variant row per texture cell (NOT per photo): a cell's whole
		// photo set is that variant's gallery. The old code emitted one row
		// per photo with an identical `image_paths`, producing N duplicate
		// rows that the unique constraint used to hide behind distinct
		// colours — with colour gone they would be visible duplicates.
		const variants = state.photoGrid
			.filter((cell) => cell.photos.length > 0)
			.map((cell) => ({
				panel_id: cell.sizeId,
				texture_id: cell.textureId,
				image_paths: cell.photos.map((p) => p.path),
			}));

		try {
			// 1. Persist the catalog gallery onto each panel. Without this the
			// step-2 uploads would live only in wizard state and vanish —
			// they are what the public catalog card renders.
			const panelsWithPhotos = state.sizes.filter(
				(s) => s.catalogPhotos.length > 0,
			);
			for (const size of panelsWithPhotos) {
				await updatePanel.mutateAsync({
					panelId: size.panelId,
					body: {
						photo_paths: size.catalogPhotos,
						// Keep the legacy scalar in sync for consumers that still
						// read it (order items, admin table thumbnail).
						photo_path: size.catalogPhotos[0],
					},
				});
			}

			// 2. Create texture variants, grouped per panel.
			const byPanel: Record<string, typeof variants> = {};
			variants.forEach((v) => {
				if (!byPanel[v.panel_id]) byPanel[v.panel_id] = [];
				byPanel[v.panel_id].push(v);
			});

			for (const [panelId, panelVariants] of Object.entries(byPanel)) {
				await createBatch.mutateAsync({
					panel_id: panelId,
					variants: panelVariants.map((v) => ({
						texture_id: v.texture_id,
						// Colour is no longer part of the product model.
						color_id: null,
						color_hex: null,
						image_paths: v.image_paths,
					})),
				});
			}

			message.success(
				`Сохранено: фото каталога — ${panelsWithPhotos.length} панелей, вариантов — ${variants.length}`,
			);
			handleClose();
			onSuccess?.();
		} catch {
			message.error("Ошибка сохранения");
		}
	};

	const handleClose = () => {
		setCurrentStep(0);
		setState({
			sizes: [],
			selectedTextureIds: [],
			photoGrid: [],
		});
		onClose();
	};

	const canProceed = () => {
		switch (currentStep) {
			case 0:
				return state.sizes.length > 0;
			case 1:
				// At least one catalog photo per selected size; the second is
				// optional so a single-shot panel is still publishable.
				return state.sizes.every((s) => s.catalogPhotos.length > 0);
			case 2:
				return state.selectedTextureIds.length > 0;
			case 3:
				return state.photoGrid.length > 0;
			default:
				return true;
		}
	};

	const renderStep = () => {
		switch (currentStep) {
			case 0:
				return (
					<Step1SelectSizes
						selectedSizes={state.sizes}
						onChange={updateSizes}
					/>
				);
			case 1:
				return (
					<Step2CatalogPhotos sizes={state.sizes} onChange={updateSizes} />
				);
			case 2:
				return (
					<Step3SelectTextures
						selectedTextureIds={state.selectedTextureIds}
						onChange={updateTextures}
					/>
				);
			case 3:
				return (
					<Step4PhotoGrid
						sizes={state.sizes}
						textureIds={state.selectedTextureIds}
						photoGrid={state.photoGrid}
						onChange={updateGrid}
					/>
				);
			case 4:
				return (
					<Step6Review
						sizes={state.sizes}
						textureIds={state.selectedTextureIds}
						photoGrid={state.photoGrid}
					/>
				);
			default:
				return null;
		}
	};

	return (
		<Modal
			title="Создание вариантов панели"
			open={open}
			onCancel={handleClose}
			width={1000}
			footer={
				<Space>
					<Button onClick={handleClose}>Отмена</Button>
					{currentStep > 0 && (
						<Button
							icon={<ArrowLeftOutlined />}
							onClick={() => setCurrentStep((s) => s - 1)}
						>
							Назад
						</Button>
					)}
					{currentStep < steps.length - 1 ? (
						<Button
							type="primary"
							icon={<ArrowRightOutlined />}
							onClick={() => setCurrentStep((s) => s + 1)}
							disabled={!canProceed()}
						>
							Далее
						</Button>
					) : (
						<Button
							type="primary"
							onClick={handleSave}
							loading={createBatch.isPending}
						>
							Сохранить
						</Button>
					)}
				</Space>
			}
		>
			<Steps
				current={currentStep}
				items={steps.map((s) => ({ title: s.title }))}
				style={{ marginBottom: 24 }}
				size="small"
			/>
			<div style={{ minHeight: 400 }}>
				<AnimatePresence mode="wait">
					<motion.div
						key={currentStep}
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -20 }}
						transition={{ duration: 0.2 }}
					>
						{renderStep()}
					</motion.div>
				</AnimatePresence>
			</div>
		</Modal>
	);
}
