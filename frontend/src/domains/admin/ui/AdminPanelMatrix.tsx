/**
 * Flat «Панель × Текстура» matrix.
 *
 * Each row is a single combination of a panel and an active texture
 * assignment. The previous nested expandable view made it hard to scan
 * which textures and photos are attached — moderators asked for the
 * classic flat table back, so this view returns to that.
 *
 * Columns: ID, Панель, Текстура, Фото исполнений, Фото в дизайне, Активен.
 * Filters: panel selector, search, "active only" toggle. Rows can be
 * edited (assignments / variant photos) or deleted via inline buttons.
 */

import { lazy, Suspense, useMemo, useState } from "react";
import {
	Alert,
	Button,
	Empty,
	Input,
	Popconfirm,
	Select,
	Space,
	Spin,
	Table,
	Tag,
	Tooltip,
	Typography,
	message,
} from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	PictureOutlined,
} from "@ant-design/icons";
import { imageSrc } from "../../../shared/lib/imageSrc";
import {
	type ApiPanel,
	useDeletePanel,
	usePanelsAdminList,
} from "../api/panelsAdminApi";
import {
	type ApiPanelVariant,
	usePanelVariantsAdminList,
} from "../api/panelVariantsAdminApi";
import {
	type ApiPanelTextureAssignment,
	usePanelTextureAssignments,
} from "../api/panelTextureAssignmentsAdminApi";
import {
	type ApiTexture,
	useAdminTextures,
} from "../api/texturesAdminApi";
import { api, ApiError } from "../../../shared/api";

const PanelTextureAssignmentsModal = lazy(
	() => import("./PanelTextureAssignmentsModal"),
);
const AdminVariantEditModal = lazy(() => import("./AdminVariantEditModal"));

/** One flattened row of the matrix. */
interface MatrixRow {
	key: string;
	panel: ApiPanel;
	texture: ApiTexture | null;
	assignment: ApiPanelTextureAssignment | null;
	variant: ApiPanelVariant | null;
}

/** Build a flat matrix out of panel × (assignment+texture). */
function buildMatrix(
	panels: ApiPanel[],
	textures: ApiTexture[],
	assignments: ApiPanelTextureAssignment[],
	variants: ApiPanelVariant[],
): MatrixRow[] {
	const texturesById = new Map(textures.map((texture) => [texture.id, texture]));
	const variantsByKey = new Map<string, ApiPanelVariant>();
	for (const variant of variants) {
		if (variant.is_active) {
			variantsByKey.set(`${variant.panel_id}:${variant.texture_id}`, variant);
		}
	}
	const rows: MatrixRow[] = [];
	for (const panel of panels) {
		const panelAssignments = assignments.filter(
			(assignment) => assignment.panel_id === panel.id && assignment.is_active,
		);
		if (panelAssignments.length === 0) {
			rows.push({
				key: `${panel.id}:none`,
				panel,
				texture: null,
				assignment: null,
				variant: null,
			});
			continue;
		}
		for (const assignment of panelAssignments) {
			const texture = texturesById.get(assignment.texture_id) ?? null;
			rows.push({
				key: `${panel.id}:${assignment.texture_id}`,
				panel,
				texture,
				assignment,
				variant:
					variantsByKey.get(`${panel.id}:${assignment.texture_id}`) ?? null,
			});
		}
	}
	return rows;
}

function ImageCell({
	paths,
	emptyLabel,
}: {
	paths: string[];
	emptyLabel: string;
}): React.ReactElement {
	if (paths.length === 0) {
		return <Typography.Text type="secondary">{emptyLabel}</Typography.Text>;
	}
	const visible = paths.slice(0, 3);
	const extra = paths.length - visible.length;
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				flexWrap: "wrap",
			}}
		>
			{visible.map((path) => (
				<img
					key={path}
					src={imageSrc(path)}
					alt=""
					width={36}
					height={36}
					style={{
						objectFit: "cover",
						borderRadius: 4,
						border: "1px solid #e5e7eb",
						background: "#fff",
					}}
				/>
			))}
			{extra > 0 && <Tag>+{extra}</Tag>}
		</div>
	);
}

export default function AdminPanelMatrix(): React.ReactElement {
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [panelFilter, setPanelFilter] = useState<string | "all">("all");
	const [activeOnly, setActiveOnly] = useState<boolean | null>(null);
	const [page, setPage] = useState(1);
	const [size, setSize] = useState(50);
	const [editing, setEditing] = useState<{
		row: MatrixRow;
		mode: "variant" | "assignments";
	} | null>(null);

	const panelsQuery = usePanelsAdminList({
		page,
		size: Math.max(size, 200),
		search: search || null,
		isActive: activeOnly,
	});
	const texturesQuery = useAdminTextures();
	const assignmentsQuery = usePanelTextureAssignments();
	const variantsQuery = usePanelVariantsAdminList({
		limit: 200,
		offset: 0,
	});

	const deletePanel = useDeletePanel();

	const rows = useMemo(
		() =>
			buildMatrix(
				panelsQuery.data?.items ?? [],
				texturesQuery.data ?? [],
				assignmentsQuery.data ?? [],
				variantsQuery.data?.items ?? [],
			),
		[
			panelsQuery.data,
			texturesQuery.data,
			assignmentsQuery.data,
			variantsQuery.data,
		],
	);

	const filteredRows = useMemo(() => {
		if (panelFilter === "all") return rows;
		return rows.filter((row) => row.panel.id === panelFilter);
	}, [rows, panelFilter]);

	const panelsForSelect = useMemo(() => {
		const all = panelsQuery.data?.items ?? [];
		const map = new Map<string, ApiPanel>();
		for (const panel of all) map.set(panel.id, panel);
		// Include panels that only appear through rows (when filter hides them)
		for (const row of rows) map.set(row.panel.id, row.panel);
		return Array.from(map.values()).sort((a, b) =>
			a.name.localeCompare(b.name, "ru"),
		);
	}, [panelsQuery.data, rows]);

	const error =
		panelsQuery.error ?? texturesQuery.error ?? assignmentsQuery.error;

	async function handleDeleteAssignment(row: MatrixRow): Promise<void> {
		if (!row.assignment) return;
		try {
			await api.delete(
				`/admin/panel-texture-assignments/${row.assignment.id}`,
			);
			message.success("Связь удалена");
			assignmentsQuery.refetch();
			variantsQuery.refetch();
		} catch (cause) {
			const text =
				cause instanceof ApiError ? cause.message : "Не удалось удалить связь";
			message.error(text);
		}
	}

	return (
		<section aria-label="Товарная матрица">
			<Space wrap style={{ marginBottom: 16 }}>
				<Select
					value={panelFilter}
					onChange={(value: string | "all") => {
						setPanelFilter(value);
						setPage(1);
					}}
					style={{ width: 240 }}
					aria-label="Фильтр по панели"
					options={[
						{ value: "all", label: "Все панели" },
						...panelsForSelect.map((panel) => ({
							value: panel.id,
							label: panel.name,
						})),
					]}
				/>
				<Input.Search
					placeholder="Поиск панели"
					allowClear
					value={searchInput}
					onChange={(event) => setSearchInput(event.target.value)}
					onSearch={(value) => {
						setSearch(value.trim());
						setPage(1);
					}}
					style={{ width: 240 }}
				/>
				<Select
					value={activeOnly === null ? "all" : String(activeOnly)}
					onChange={(value) => {
						setActiveOnly(value === "all" ? null : value === "true");
						setPage(1);
					}}
					style={{ width: 160 }}
					aria-label="Активность"
					options={[
						{ value: "all", label: "Все статусы" },
						{ value: "true", label: "Активные" },
						{ value: "false", label: "Неактивные" },
					]}
				/>
				<Button
					onClick={() => {
						panelsQuery.refetch();
						texturesQuery.refetch();
						assignmentsQuery.refetch();
						variantsQuery.refetch();
					}}
				>
					Обновить
				</Button>
			</Space>

			{error && (
				<Alert
					type="error"
					showIcon
					message="Не удалось загрузить данные"
					action={
						<Button
							onClick={() => {
								panelsQuery.refetch();
								texturesQuery.refetch();
								assignmentsQuery.refetch();
								variantsQuery.refetch();
							}}
						>
							Повторить
						</Button>
					}
				/>
			)}

			<Table<MatrixRow>
				rowKey="key"
				dataSource={filteredRows}
				loading={
					panelsQuery.isFetching ||
					texturesQuery.isFetching ||
					assignmentsQuery.isFetching ||
					variantsQuery.isFetching
				}
				locale={{ emptyText: <Empty description="Нет связей" /> }}
				pagination={{
					current: page,
					pageSize: size,
					total: filteredRows.length,
					showSizeChanger: true,
					pageSizeOptions: ["25", "50", "100"],
					onChange: (next, nextSize) => {
						setPage(next);
						setSize(nextSize);
					},
				}}
				scroll={{ x: 1100 }}
				columns={[
					{
						title: "ID",
						key: "id",
						width: 160,
						render: (_, row) => (
							<Space direction="vertical" size={0}>
								<Typography.Text
									copyable={{ text: row.panel.id }}
									style={{ fontSize: 12 }}
								>
									{row.panel.id.slice(0, 8)}
								</Typography.Text>
								<Button
									type="link"
									size="small"
									style={{ padding: 0 }}
									onClick={() => {
										navigator.clipboard?.writeText(row.panel.id);
										message.success("ID скопирован");
									}}
								>
									скопировать
								</Button>
							</Space>
						),
					},
					{
						title: "Панель",
						key: "panel",
						render: (_, row) => (
							<Space direction="vertical" size={2}>
								<Space size={6}>
									<Typography.Text strong>{row.panel.name}</Typography.Text>
									<Tooltip title="Назначить текстуры панели">
										<Button
											type="text"
											size="small"
											icon={<EditOutlined />}
											aria-label="Редактировать панель"
											onClick={() =>
												setEditing({ row, mode: "assignments" })
											}
										/>
									</Tooltip>
								</Space>
								<Typography.Text type="secondary">
									{row.panel.size_label}
								</Typography.Text>
							</Space>
						),
					},
					{
						title: "Текстура",
						key: "texture",
						render: (_, row) => {
							if (!row.texture) {
								return <Typography.Text type="secondary">—</Typography.Text>;
							}
							return (
								<Space size={8}>
									<img
										src={imageSrc(row.texture.swatch_image)}
										alt=""
										width={32}
										height={32}
										style={{
											objectFit: "cover",
											borderRadius: 4,
											border: "1px solid #e5e7eb",
										}}
									/>
									<Typography.Text>{row.texture.name}</Typography.Text>
								</Space>
							);
						},
					},
					{
						title: "Фото исполнений",
						key: "variant-photos",
						render: (_, row) =>
							row.variant ? (
								<ImageCell paths={row.variant.image_paths} emptyLabel="Нет" />
							) : (
								<Typography.Text type="secondary">Нет</Typography.Text>
							),
					},
					{
						title: "Фото в дизайне",
						key: "design-photos",
						render: (_, row) =>
							row.variant ? (
								<ImageCell
									paths={row.variant.design_image_paths}
									emptyLabel="Нет"
								/>
							) : (
								<Typography.Text type="secondary">Нет</Typography.Text>
							),
					},
					{
						title: "Активен",
						key: "active",
						width: 120,
						render: (_, row) => (
							<Tag color={row.assignment?.is_active ? "green" : "default"}>
								{row.assignment?.is_active ? "Да" : "Нет"}
							</Tag>
						),
					},
					{
						title: "",
						key: "actions",
						width: 160,
						render: (_, row) => (
							<Space>
								<Tooltip title="Изменить фото варианта">
									<Button
										type="text"
										icon={<PictureOutlined />}
										disabled={!row.texture}
										onClick={() => setEditing({ row, mode: "variant" })}
									/>
								</Tooltip>
								<Tooltip title="Назначить текстуры">
									<Button
										type="text"
										icon={<EditOutlined />}
										onClick={() =>
											setEditing({ row, mode: "assignments" })
										}
									/>
								</Tooltip>
								{row.assignment ? (
									<Popconfirm
										title="Удалить связь с текстурой?"
										description="Существующие фото варианта сохранятся."
										okText="Удалить"
										cancelText="Отмена"
										onConfirm={() => handleDeleteAssignment(row)}
									>
										<Button
											type="text"
											icon={<DeleteOutlined />}
											danger
											aria-label="Удалить связь"
										/>
									</Popconfirm>
								) : (
									<Popconfirm
										title="Удалить панель?"
										description="Это действие нельзя отменить."
										okText="Удалить"
										cancelText="Отмена"
										onConfirm={async () => {
											try {
												await deletePanel.mutateAsync(row.panel.id);
												message.success("Панель удалена");
											} catch (cause) {
												const text =
													cause instanceof ApiError
														? cause.message
														: "Не удалось удалить панель";
												message.error(text);
											}
										}}
									>
										<Button
											type="text"
											icon={<DeleteOutlined />}
											danger
											aria-label="Удалить панель"
										/>
									</Popconfirm>
								)}
							</Space>
						),
					},
				]}
			/>

			{editing?.mode === "assignments" && (
				<Suspense fallback={<Spin />}>
					<PanelTextureAssignmentsModal
						open
						panel={editing.row.panel}
						onClose={() => {
							setEditing(null);
							assignmentsQuery.refetch();
							variantsQuery.refetch();
						}}
					/>
				</Suspense>
			)}
			{editing?.mode === "variant" && editing.row.variant && (
				<Suspense fallback={<Spin />}>
					<AdminVariantEditModal
						open
						variant={editing.row.variant}
						panelName={editing.row.panel.name}
						panelSize={editing.row.panel.size_label}
						onClose={() => {
							setEditing(null);
							variantsQuery.refetch();
						}}
					/>
				</Suspense>
			)}
		</section>
	);
}
