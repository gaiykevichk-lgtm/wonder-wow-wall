import { useState } from "react";
import {
	Button,
	Card,
	Image,
	Input,
	Popconfirm,
	Select,
	Space,
	Switch,
	Table,
	Typography,
	message,
} from "antd";
import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
	ReloadOutlined,
} from "@ant-design/icons";
import {
	usePanelVariantsAdminList,
	useDeletePanelVariant,
	useUpdatePanelVariant,
	type ApiPanelVariant,
} from "../api/panelVariantsAdminApi";
import { usePanelsAdminList } from "../api/panelsAdminApi";
import { useAdminTextures } from "../api/texturesAdminApi";
import { imageSrc } from "../../../shared/lib/imageSrc";
import AdminVariantEditModal from "./AdminVariantEditModal";
import AddExecutionModal from "./AddExecutionModal";

const { Text } = Typography;

type ExecutionTabMode = "executions" | "designs" | "recommendations";

interface AdminExecutionsPageProps {
	mode?: ExecutionTabMode;
	/** Backward-compatible prop for old callers. */
	designs?: boolean;
}

const MODE_CONFIG = {
	executions: {
		galleryTitle: null,
		addLabel: "Добавить фото исполнения",
		emptyLabel: "Нет фото исполнения",
	},
	designs: {
		galleryTitle: "Фото в дизайне",
		addLabel: "Добавить фото в дизайне",
		emptyLabel: "Нет фото в дизайне",
	},
	recommendations: {
		galleryTitle: "Рекомендации",
		addLabel: "Добавить рекомендацию",
		emptyLabel: "Нет рекомендаций",
	},
} as const;

/**
 * One execution source for all three tabs. The execution itself is always
 * represented by its product thumbnail; auxiliary galleries stay in their own
 * column and persist on the same panel_variant row.
 */
export default function AdminExecutionsPage({
	mode: requestedMode,
	designs = false,
}: AdminExecutionsPageProps) {
	const mode: ExecutionTabMode = requestedMode ?? (designs ? "designs" : "executions");
	const config = MODE_CONFIG[mode];
	const [panelId, setPanelId] = useState<string>();
	const [textureId, setTextureId] = useState<string>();
	const [active, setActive] = useState<boolean>();
	const [search, setSearch] = useState("");
	const [editing, setEditing] = useState<ApiPanelVariant | null>(null);
	const [creating, setCreating] = useState(false);
	const [page, setPage] = useState(1);
	const variants = usePanelVariantsAdminList({
		panel_id: panelId,
		is_active: active,
		allPages: true,
	});
	const panels = usePanelsAdminList({
		page: 1,
		size: 200,
		search: null,
		isActive: null,
	});
	const textures = useAdminTextures();
	const remove = useDeletePanelVariant();
	const update = useUpdatePanelVariant();
	const panelMap = new Map(panels.data?.items.map((item) => [item.id, item]));
	const textureMap = new Map(textures.data?.map((item) => [item.id, item]));
	const rows = (variants.data?.items ?? []).filter(
		(item) =>
			(!textureId || item.texture_id === textureId) &&
			[
				item.name,
				item.slug,
				item.id,
				panelMap.get(item.panel_id)?.name,
				textureMap.get(item.texture_id)?.name,
			].some((value) =>
				value?.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
			),
	);
	const selectedPanel = panelId ? panelMap.get(panelId) : undefined;

	function galleryPaths(item: ApiPanelVariant): string[] {
		if (mode === "designs") return item.design_image_paths;
		if (mode === "recommendations") return item.recommendation_image_paths;
		return item.image_paths;
	}

	async function deleteExecution(id: string) {
		try {
			await remove.mutateAsync(id);
			message.success("Исполнение удалено");
		} catch {
			message.error("Не удалось удалить исполнение");
		}
	}

	const columns = [
		{
			title: "Базовая форма",
			key: "panel",
			render: (_: unknown, item: ApiPanelVariant) =>
				panelMap.get(item.panel_id)?.name ?? item.panel_id,
		},
		{
			title: "Текстура",
			key: "texture",
			render: (_: unknown, item: ApiPanelVariant) =>
				textureMap.get(item.texture_id)?.name ?? item.texture_id,
		},
		{
			title: "Вариант исполнения",
			key: "execution",
			width: 220,
			render: (_: unknown, item: ApiPanelVariant) => {
				const preview = item.image_paths[0];
				return (
					<button
						type="button"
						onClick={() => setEditing(item)}
						aria-label={`Открыть исполнение ${item.name || "Без названия"}`}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: 0,
							border: 0,
							background: "transparent",
							cursor: "pointer",
							textAlign: "left",
						}}
					>
						{preview ? (
							<img
								src={imageSrc(preview)}
								alt={item.name || "Вариант исполнения"}
								width={52}
								height={52}
								style={{ objectFit: "cover", borderRadius: 5, border: "1px solid #e5e7eb" }}
							/>
						) : (
							<div style={{ width: 52, height: 52, borderRadius: 5, border: "1px dashed #d1d5db", background: "#fafafa" }} />
						)}
						<Text>{item.name || "Без названия"}</Text>
					</button>
				);
			},
		},
		...(config.galleryTitle
			? [
					{
						title: config.galleryTitle,
						key: "gallery",
						width: 260,
						render: (_: unknown, item: ApiPanelVariant) => {
							const paths = galleryPaths(item);
							return (
								<Space wrap size={6}>
									<Image.PreviewGroup>
										{paths.map((path) => (
											<Image key={path} src={imageSrc(path)} width={48} height={48} style={{ objectFit: "cover", borderRadius: 4 }} />
										))}
									</Image.PreviewGroup>
									{paths.length === 0 && <Text type="secondary">{config.emptyLabel}</Text>}
									<Button type="dashed" icon={<PlusOutlined />} aria-label={config.addLabel} title={config.addLabel} onClick={() => setEditing(item)} />
								</Space>
							);
						},
					},
				]
			: []),
		{
			title: "Активен",
			key: "active",
			width: 120,
			render: (_: unknown, item: ApiPanelVariant) => (
				<Switch
					checked={item.is_active}
					onChange={async (value) => {
						try {
							await update.mutateAsync({ variantId: item.id, body: { is_active: value } });
						} catch {
							message.error("Не удалось изменить статус");
						}
					}}
				/>
			),
		},
		{
			title: "Действия",
			key: "actions",
			width: 130,
			render: (_: unknown, item: ApiPanelVariant) => (
				<Space>
					<Button icon={<EditOutlined />} aria-label="Редактировать исполнение" onClick={() => setEditing(item)} />
					{mode === "executions" && (
						<Popconfirm title="Удалить это исполнение и его фотографии?" onConfirm={() => deleteExecution(item.id)} okText="Удалить" cancelText="Отмена">
							<Button danger icon={<DeleteOutlined />} aria-label="Удалить исполнение" />
						</Popconfirm>
					)}
				</Space>
			),
		},
	];

	return (
		<Space direction="vertical" size={16} style={{ width: "100%" }}>
			<Space wrap>
				<Input.Search aria-label="Поиск исполнений" placeholder="Название исполнения" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} allowClear style={{ width: 240 }} />
				<Select aria-label="Базовые формы" placeholder="Все базовые формы" value={panelId} allowClear showSearch optionFilterProp="label" style={{ minWidth: 200 }} options={panels.data?.items.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setPanelId(value); setPage(1); }} />
				<Select aria-label="Текстура" placeholder="Все текстуры" value={textureId} allowClear showSearch optionFilterProp="label" style={{ minWidth: 180 }} options={textures.data?.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => { setTextureId(value); setPage(1); }} />
				<Select aria-label="Статус исполнений" placeholder="Все статусы" value={active} allowClear style={{ minWidth: 160 }} options={[{ value: true, label: "Активные" }, { value: false, label: "Неактивные" }]} onChange={(value) => { setActive(value); setPage(1); }} />
				<Button onClick={() => { setSearch(""); setPanelId(undefined); setTextureId(undefined); setActive(undefined); setPage(1); }}>Сбросить</Button>
				<Button icon={<ReloadOutlined />} onClick={() => variants.refetch()}>Обновить</Button>
				{mode === "executions" && (
					<Button type="primary" icon={<PlusOutlined />} disabled={!selectedPanel} title={!selectedPanel ? "Сначала выберите базовую форму" : undefined} onClick={() => setCreating(true)}>Добавить исполнение</Button>
				)}
			</Space>
			<Card>
				<Table<ApiPanelVariant> rowKey="id" dataSource={rows} columns={columns} loading={variants.isLoading} scroll={{ x: 900 }} pagination={{ current: page, onChange: setPage, showSizeChanger: true, defaultPageSize: 25 }} />
			</Card>
			{editing && (
				<AdminVariantEditModal
					key={`${editing.id}-${mode}`}
					open
					variant={editing}
					initialFocus={mode}
					panelName={panelMap.get(editing.panel_id)?.name}
					panelSize={panelMap.get(editing.panel_id)?.size_label}
					onClose={() => setEditing(null)}
					onSaved={() => variants.refetch()}
				/>
			)}
			<AddExecutionModal open={creating} panel={selectedPanel ?? null} textureId={textureId} onClose={() => setCreating(false)} onCreated={() => variants.refetch()} />
		</Space>
	);
}
