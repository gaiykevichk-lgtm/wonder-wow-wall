/**
 * Phase Panel Creator Wizard — Step 1: Choose Design.
 */

import React, { useRef } from "react";
import { Input, Select, Skeleton, Typography, message } from "antd";
import { SearchOutlined, UploadOutlined } from "@ant-design/icons";
import { motion } from "framer-motion";
import { imageSrc } from "../../../../shared/lib/imageSrc";
import { useUpdateDesign } from "../../api/catalogAdminApi";
import type { ApiAdminDesign } from "../../api/catalogAdminApi";
import { catalogAdminKeys } from "../../api/catalogAdminApi";
import { useQueryClient } from "@tanstack/react-query";

const { Title, Text } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
	hidden: { opacity: 0, y: 24 },
	visible: (i: number = 0) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
	}),
};

interface StepDesignProps {
	designs: ApiAdminDesign[];
	selectedDesignId: string | null;
	onSelect: (design: ApiAdminDesign) => void;
	loading: boolean;
	search: string;
	onSearchChange: (v: string) => void;
	categoryFilter: string | null;
	onCategoryChange: (v: string | null) => void;
	categories: Array<{ id: string; name: string }>;
}

function UploadButton({
	design,
	onUpdated,
}: {
	design: ApiAdminDesign;
	onUpdated: (design: ApiAdminDesign) => void;
}) {
	const qc = useQueryClient();
	const updateMutation = useUpdateDesign();
	const inputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		if (!file.type.startsWith("image/")) {
			message.error("Пожалуйста, выберите изображение");
			return;
		}

		// Validate file size (max 5MB)
		if (file.size > 5 * 1024 * 1024) {
			message.error("Файл слишком большой. Максимум 5 МБ");
			return;
		}

		// Convert to base64
		const reader = new FileReader();
		reader.onload = async () => {
			const base64 = reader.result as string;
			try {
				const updated = await updateMutation.mutateAsync({
					designId: design.id,
					body: { image: base64 },
				});
				message.success("Фото загружено");
				onUpdated(updated);
				// Invalidate cache
				qc.invalidateQueries({ queryKey: catalogAdminKeys.designsLists });
			} catch {
				message.error("Не удалось загрузить фото");
			}
		};
		reader.readAsDataURL(file);
	};

	return (
		<>
			<input
				type="file"
				accept="image/*"
				ref={inputRef}
				onChange={handleFileChange}
				style={{ display: "none" }}
			/>
			<button
				onClick={() => inputRef.current?.click()}
				style={{
					position: "absolute",
					bottom: 8,
					right: 8,
					width: 32,
					height: 32,
					borderRadius: "50%",
					border: "none",
					background: "rgba(0,0,0,0.6)",
					color: "#fff",
					cursor: "pointer",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 14,
					opacity: updateMutation.isPending ? 0.5 : 1,
					transition: "opacity 0.2s",
				}}
				title="Загрузить фото"
				disabled={updateMutation.isPending}
			>
				<UploadOutlined />
			</button>
		</>
	);
}

export function StepDesign({
	designs,
	selectedDesignId,
	onSelect,
	loading,
	search,
	onSearchChange,
	categoryFilter,
	onCategoryChange,
	categories,
}: StepDesignProps) {
	return (
		<div>
			{/* Header */}
			<motion.div
				variants={fadeUpVariants}
				custom={0}
				style={{ marginBottom: 24 }}
			>
				<Title level={4} style={{ margin: 0 }}>
					Шаг 1: Выберите дизайн
				</Title>
				<Text type="secondary">
					Выберите одну форму (паркль) для загрузки изображений комбинаций.
				</Text>
			</motion.div>

			{/* Filters */}
			<motion.div
				variants={fadeUpVariants}
				custom={1}
				style={{
					display: "flex",
					gap: 12,
					marginBottom: 24,
					flexWrap: "wrap",
				}}
			>
				<Input
					placeholder="Поиск по названию..."
					prefix={<SearchOutlined />}
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					style={{ width: 280 }}
					allowClear
				/>
				<Select
					placeholder="Все категории"
					value={categoryFilter}
					onChange={onCategoryChange}
					allowClear
					style={{ width: 200 }}
					options={[
						{ value: "", label: "Все категории" },
						...categories.map((c) => ({ value: c.id, label: c.name })),
					]}
				/>
				{selectedDesignId && (
					<Text type="success" style={{ marginLeft: "auto" }}>
						Выбран: {designs.find((d) => d.id === selectedDesignId)?.name}
					</Text>
				)}
			</motion.div>

			{/* Design grid */}
			{loading ? (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
						gap: 16,
					}}
				>
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton.Image
							key={i}
							active
							style={{ width: "100%", height: 200 }}
						/>
					))}
				</div>
			) : (
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
						gap: 16,
					}}
				>
					{designs.map((design, i) => {
						const isSelected = design.id === selectedDesignId;
						return (
							<motion.div
								key={design.id}
								variants={fadeUpVariants}
								custom={2 + i}
								onClick={() => onSelect(design)}
								style={{
									border: isSelected
										? "2px solid #1890ff"
										: "2px solid transparent",
									borderRadius: 8,
									overflow: "hidden",
									cursor: "pointer",
									transition: "border-color 0.2s",
									background: isSelected ? "#e6f7ff" : "#fff",
									boxShadow: isSelected
										? "0 4px 12px rgba(24, 144, 255, 0.2)"
										: "0 2px 8px rgba(0,0,0,0.08)",
								}}
							>
								<div style={{ position: "relative" }}>
									<img
										src={imageSrc(design.image)}
										alt={design.name}
										style={{
											width: "100%",
											height: 160,
											objectFit: "cover",
											background: "#f5f5f5",
										}}
										onError={(e) => {
											(e.target as HTMLImageElement).src =
												'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="160" fill="%23f0f0f0"%3E%3Crect width="200" height="160"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999"%3ENo image%3C/text%3E%3C/svg%3E';
										}}
									/>
									<UploadButton design={design} onUpdated={onSelect} />
									{isSelected && (
										<div
											style={{
												position: "absolute",
												top: 8,
												right: 48,
												width: 24,
												height: 24,
												borderRadius: "50%",
												background: "#1890ff",
												color: "#fff",
												display: "flex",
												alignItems: "center",
												justifyContent: "center",
												fontSize: 14,
												fontWeight: "bold",
											}}
										>
											✓
										</div>
									)}
								</div>
								<div style={{ padding: "12px 12px 16px" }}>
									<div style={{ fontWeight: 500, marginBottom: 4 }}>
										{design.name}
									</div>
									<Text type="secondary" style={{ fontSize: 12 }}>
										{design.category_id
											? `ID: ${design.category_id.slice(0, 8)}...`
											: ""}
									</Text>
								</div>
							</motion.div>
						);
					})}
				</div>
			)}
		</div>
	);
}
