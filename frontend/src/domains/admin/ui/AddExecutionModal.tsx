import type { ApiPanel } from "../api/panelsAdminApi";
import AdminVariantEditModal from "./AdminVariantEditModal";

interface Props {
	open: boolean;
	onClose: () => void;
	panel: ApiPanel | null;
	textureId?: string;
	onCreated?: () => void;
}

export default function AddExecutionModal({
	open,
	onClose,
	panel,
	textureId,
	onCreated,
}: Props) {
	if (!open || !panel) return null;
	return (
		<AdminVariantEditModal
			key={`${panel.id}-${textureId ?? "new"}`}
			open
			creating
			variant={{
				id: "",
				panel_id: panel.id,
				texture_id: textureId ?? "",
				name: "",
				color_id: null,
				color_hex: null,
				image_paths: [],
				design_image_paths: [],
				recommendation_image_paths: [],
				sort_order: 0,
				is_active: true,
				created_at: "",
				updated_at: "",
			}}
			panelName={panel.name}
			panelSize={panel.size_label}
			onClose={onClose}
			onSaved={onCreated}
		/>
	);
}
