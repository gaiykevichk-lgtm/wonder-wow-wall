import { useMemo, useState } from "react";
import {
	Alert,
	Checkbox,
	Empty,
	Image,
	Input,
	Modal,
	Space,
	Spin,
	Typography,
	message,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";

import { imageSrc } from "../../../shared/lib/imageSrc";
import type { ApiPanel } from "../api/panelsAdminApi";
import {
	usePanelTextureAssignments,
	useReplacePanelTextureAssignments,
} from "../api/panelTextureAssignmentsAdminApi";
import { useAdminTextures } from "../api/texturesAdminApi";

const { Text } = Typography;

interface PanelTextureAssignmentsModalProps {
	open: boolean;
	panel: ApiPanel;
	onClose: () => void;
	onSaved?: () => void;
}

export default function PanelTextureAssignmentsModal({
	open,
	panel,
	onClose,
	onSaved,
}: PanelTextureAssignmentsModalProps) {
	const { data: textures, isLoading: texturesLoading, isError: texturesError } = useAdminTextures();
	const { data: assignments, isLoading: assignmentsLoading, isError: assignmentsError } =
		usePanelTextureAssignments(panel.id);
	const replaceAssignments = useReplacePanelTextureAssignments();
	const [search, setSearch] = useState("");
	const [selection, setSelection] = useState<string[] | null>(null);
	const [baseline, setBaseline] = useState<string[] | null>(null);

	const persistedIds = useMemo(
		() =>
			// GET /panel-texture-assignments возвращает все назначения, включая
			// неактивные (нужно таблице каталога). В модалке чекбоксы означают
			// активный набор, поэтому базовый набор строим только из активных.
			(assignments ?? []).filter((assignment) => assignment.is_active !== false).map((assignment) => assignment.texture_id),
		[assignments],
	);
	const selectedIds = selection ?? persistedIds;
	const filteredTextures = useMemo(() => {
		const query = search.trim().toLocaleLowerCase("ru");
		if (!query) return textures ?? [];
		return (textures ?? []).filter((texture) =>
			`${texture.name} ${texture.slug}`.toLocaleLowerCase("ru").includes(query),
		);
	}, [search, textures]);

	const toggle = (textureId: string) => {
		if (baseline === null) setBaseline([...persistedIds]);
		setSelection((current) => {
			const base = current ?? persistedIds;
			return base.includes(textureId)
				? base.filter((id) => id !== textureId)
				: [...base, textureId];
		});
	};

	const handleSave = async () => {
		if (texturesLoading || assignmentsLoading || texturesError || assignmentsError || replaceAssignments.isPending) return;
		try {
			await replaceAssignments.mutateAsync({
				panelId: panel.id,
				textureIds: selectedIds,
				expectedTextureIds: baseline ?? persistedIds,
			});
			message.success("Назначения текстур сохранены");
			onSaved?.();
			onClose();
		} catch {
			message.error("Не удалось сохранить назначения. Возможно, они изменены другим редактором: закройте и откройте форму заново.");
		}
	};

	const loading = texturesLoading || assignmentsLoading;

	return (
		<Modal
			open={open}
			title={`Текстуры панели · ${panel.name}`}
			width={680}
			onCancel={() => { if (!replaceAssignments.isPending) onClose(); }}
			closable={!replaceAssignments.isPending}
			maskClosable={!replaceAssignments.isPending}
			cancelButtonProps={{ disabled: replaceAssignments.isPending }}
			okButtonProps={{ disabled: loading || texturesError || assignmentsError }}
			onOk={handleSave}
			okText="Сохранить назначения"
			cancelText="Отмена"
			confirmLoading={replaceAssignments.isPending}
			destroyOnHidden
		>
			<Alert
				type="info"
				showIcon
				message="Отметьте только доступные для этой панели текстуры"
				description="Отключение текстуры не удаляет варианты и фотографии. При повторном подключении они сохранятся."
				style={{ margin: "16px 0" }}
			/>
			<Input
				allowClear
				prefix={<SearchOutlined />}
				placeholder="Найти текстуру"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
				style={{ marginBottom: 12 }}
			/>
			{texturesError || assignmentsError ? (
				<Alert type="error" showIcon message="Не удалось загрузить назначения. Сохранение заблокировано, чтобы не потерять существующие связи." />
			) : loading ? (
				<div style={{ padding: 48, textAlign: "center" }}>
					<Spin />
				</div>
			) : filteredTextures.length === 0 ? (
				<Empty description="Текстуры не найдены" />
			) : (
				<Space
					direction="vertical"
					size={0}
					style={{ width: "100%", maxHeight: 420, overflowY: "auto" }}
				>
					{filteredTextures.map((texture) => (
						<label
							key={texture.id}
							style={{
								display: "grid",
								gridTemplateColumns: "32px 44px minmax(0, 1fr)",
								alignItems: "center",
								gap: 12,
								width: "100%",
								padding: "10px 8px",
								borderBottom: "1px solid #f0f0f0",
								cursor: "pointer",
							}}
						>
							<Checkbox
								aria-label={texture.name}
								disabled={replaceAssignments.isPending}
								checked={selectedIds.includes(texture.id)}
								onChange={() => toggle(texture.id)}
							/>
							{texture.swatch_image ? (
								<Image
									src={imageSrc(texture.swatch_image)}
									alt={texture.name}
									width={40}
									height={40}
									preview={false}
									style={{ objectFit: "cover", borderRadius: 6 }}
								/>
							) : (
								<span />
							)}
							<span>
								<Text strong>{texture.name}</Text>
								<br />
								<Text type="secondary">{texture.slug}</Text>
							</span>
						</label>
					))}
				</Space>
			)}
			<div style={{ marginTop: 12 }}>
				<Text type="secondary">Выбрано: {selectedIds.length}</Text>
			</div>
		</Modal>
	);
}
