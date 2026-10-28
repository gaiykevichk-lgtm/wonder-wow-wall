/**
 * Unified admin Каталог page. The execution-facing tabs use the same
 * panel_variant records as the overview table, so product and design photos
 * cannot silently drift into an unrelated image catalog.
 *
 *   1. Варианты панелей    — grouped overview
 *   2. Базовые формы       — panels
 *   3. Текстуры            — textures
 *   4. Варианты исполнений — panel_variants + image_paths
 *   5. Цвета               — optional colour dictionary
 *   6. Фото в дизайне      — panel_variants + design_image_paths
 *   7. Рекомендации        — recommendation imagery
 *   8. Изображения — mono/combined texture imagery
 *
 * URL is the source of truth: `?tab=<key>`. Legacy URLs (`/admin/textures`,
 * `/admin/panels`, `/admin/upload`, `/admin/recommendations`) are routed
 * by `shared/router.tsx` to `/admin/catalog?tab=<key>`.
 */

import { Tabs, Typography } from "antd";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import { type CatalogTab, parseTab } from "../model/catalogAdminStore";
import AdminPanelsPage from "./AdminPanelsPage";
import AdminExecutionsPage from "./AdminExecutionsPage";
import AdminUploadPage from "./AdminUploadPage";
import AdminTexturesPage from "./AdminTexturesPage";
import AdminTextureCombinationsTab from "./AdminTextureCombinationsTab";

const { Title } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
	}),
};

export default function AdminCatalogPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const tab: CatalogTab = parseTab(searchParams.get("tab"));

	function setTab(next: CatalogTab): void {
		const params = new URLSearchParams(searchParams);
		if (next === "panels") params.delete("tab");
		else params.set("tab", next);
		setSearchParams(params, { replace: false });
	}

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
					items={[
						{
							key: "panels",
							label: "Варианты панелей",
							children: <AdminPanelsPage embedded />,
						},
						{
							key: "forms",
							label: "Базовые формы",
							children: <AdminUploadPage hideHeader />,
						},
						{
							key: "textures",
							label: "Текстуры",
							children: (
								<AdminTexturesPage
									embedded
									hideInnerTabs
									initialSubTab="textures"
								/>
							),
						},
						{
							key: "executions",
							label: "Варианты исполнений",
							children: <AdminExecutionsPage mode="executions" />,
						},
						{
							key: "colors",
							label: "Цвета",
							children: (
								<AdminTexturesPage
									embedded
									hideInnerTabs
									initialSubTab="colors"
								/>
							),
						},
						{
							key: "images",
							label: "Фото в дизайне",
							children: <AdminExecutionsPage mode="designs" />,
						},
						{
							key: "recommendations",
							label: "Рекомендации",
							children: <AdminExecutionsPage mode="recommendations" />,
						},
						{
							key: "texture-images",
							label: "Пространства",
							children: <AdminTextureCombinationsTab />,
						},
					]}
				/>
			</motion.div>
		</motion.div>
	);
}
