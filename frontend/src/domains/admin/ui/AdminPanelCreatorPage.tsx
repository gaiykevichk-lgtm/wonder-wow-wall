/**
 * Phase Panel Creator Wizard — main wizard page.
 *
 * Orchestrates all 4 steps and manages the wizard state.
 */

import React, { useEffect, useMemo, useCallback } from "react";
import { useQueries } from "@tanstack/react-query";
import { Button, message, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import { useAdminDesigns, useAdminCategories } from "../api/catalogAdminApi";
import {
	useAdminTextures,
	useCreateVariantImageBatch,
	type ApiTextureColor,
} from "../api/texturesAdminApi";
import { ApiError } from "../../../shared/api";
import { api } from "../../../shared/api";

import { usePanelCreatorStore } from "../model/panelCreatorStore";
import {
	WizardLayout,
	StepDesign,
	StepTextures,
	StepSizes,
	StepUpload,
} from "./PanelCreator";
import type { VariantImageBatchPayload } from "../api/texturesAdminApi";

const DEFAULT_DESIGNS_QUERY = {
	page: 1,
	size: 200,
	sort: "name",
	categoryId: null,
	search: null,
};

export default function AdminPanelCreatorPage() {
	const navigate = useNavigate();

	// ── Wizard state ──────────────────────────────────────────────────────
	const {
		currentStep,
		goNext,
		goBack,
		reset,
		selectedDesign,
		setDesign,
		selectedTextureIds,
		toggleTexture,
		selectAllTextures,
		deselectAllTextures,
		selectedSizes,
		toggleSize,
		selectAllSizes,
		deselectAllSizes,
		variants,
		buildVariants,
		setVariantImage,
		setVariantHex,
		clearVariantImage,
		setVariantsImage,
	} = usePanelCreatorStore();

	// ── Data queries ─────────────────────────────────────────────────────
	const [designSearch, setDesignSearch] = React.useState("");
	const [categoryFilter, setCategoryFilter] = React.useState<string | null>(
		null,
	);

	const designsQuery = useAdminDesigns({
		...DEFAULT_DESIGNS_QUERY,
		search: designSearch || null,
		categoryId: categoryFilter,
	});
	const designs = designsQuery.data?.items ?? [];

	const categoriesQuery = useAdminCategories();
	const categories = categoriesQuery.data?.items ?? [];

	const texturesQuery = useAdminTextures();
	const textures = texturesQuery.data ?? [];

	// Fetch colors for every selected texture in parallel
	const selectedTextureIdsArray = useMemo(
		() => [...selectedTextureIds],
		[selectedTextureIds],
	);
	const textureColorResults = useQueries({
		queries: selectedTextureIdsArray.map((textureId) => ({
			queryKey: ["admin", "textureColors", textureId],
			queryFn: () =>
				api.get<ApiTextureColor[]>(`/admin/textures/${textureId}/colors`),
			staleTime: 30_000,
			retry: false,
		})),
	});

	// Build a map of textureId -> colors for all selected textures
	const textureColorsMap = useMemo(() => {
		const map = new Map<string, ApiTextureColor[]>();
		selectedTextureIdsArray.forEach((textureId, index) => {
			const data = textureColorResults[index]?.data;
			if (data) {
				map.set(textureId, data);
			}
		});
		return map;
	}, [selectedTextureIdsArray, textureColorResults]);

	const textureNamesMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const t of textures) {
			map.set(t.id, t.name);
		}
		return map;
	}, [textures]);

	// ── Build variants when moving to step 4 ─────────────────────────────
	const lastBuiltStepRef = React.useRef<number>(0);

	const buildIfNeeded = useCallback(() => {
		if (currentStep === 4 && lastBuiltStepRef.current !== 4) {
			// Wait until all color queries are loaded
			const allLoaded = selectedTextureIdsArray.every((id) =>
				textureColorsMap.has(id),
			);
			if (allLoaded) {
				buildVariants(textureColorsMap, textureNamesMap);
				lastBuiltStepRef.current = 4;
			}
		} else if (currentStep !== 4) {
			lastBuiltStepRef.current = currentStep;
		}
	}, [
		currentStep,
		textureColorsMap,
		textureNamesMap,
		buildVariants,
		selectedTextureIdsArray,
	]);

	useEffect(() => {
		buildIfNeeded();
	}, [buildIfNeeded]);

	// ── Batch save mutation ───────────────────────────────────────────────
	const saveMutation = useCreateVariantImageBatch();

	// ── Step validation ─────────────────────────────────────────────────
	const canGoNext = (() => {
		switch (currentStep) {
			case 1:
				return selectedDesign !== null;
			case 2:
				return selectedTextureIds.size > 0;
			case 3:
				return selectedSizes.size > 0;
			case 4:
				return variants.some((v) => !!v.imagePath); // At least one has an image
			default:
				return false;
		}
	})();

	const canSave = variants.filter((v) => !!v.imagePath).length > 0;

	// ── Navigation handlers ──────────────────────────────────────────────
	function handleNext() {
		if (currentStep < 4) {
			goNext();
		}
	}

	function handleSave() {
		if (!selectedDesign) return;

		const payload: VariantImageBatchPayload = {
			design_id: selectedDesign.id,
			variants: variants
				.filter((v) => !!v.imagePath)
				.map((v) => ({
					texture_id: v.textureId,
					color_id: v.colorId,
					image_path: v.imagePath!,
					size_key: v.sizeKey,
					hex: v.hex,
				})),
		};

		saveMutation.mutate(payload, {
			onSuccess: (data) => {
				const total = data.total_processed;
				const errors = data.errors.length;
				if (errors > 0) {
					message.warning(
						`Сохранено ${total - errors} комбинаций, ${errors} с ошибками`,
					);
				} else {
					message.success(`Сохранено ${total} комбинаций`);
				}
				// Navigate to textures page
				navigate("/admin/textures?tab=images");
			},
			onError: (err: unknown) => {
				if (err instanceof ApiError && err.body?.detail) {
					message.error(String(err.body.detail));
				} else {
					message.error("Не удалось сохранить");
				}
			},
		});
	}

	function handleReset() {
		Modal.confirm({
			title: "Начать сначала?",
			content: "Все未保存的更改将被丢弃。",
			okText: "Начать сначала",
			okButtonProps: { danger: true },
			cancelText: "Отмена",
			onOk: () => {
				reset();
			},
		});
	}

	// ── Render ───────────────────────────────────────────────────────────
	return (
		<div>
			<WizardLayout
				currentStep={currentStep}
				onNext={handleNext}
				onBack={goBack}
				onReset={handleReset}
				nextLabel={currentStep === 4 ? "Сохранить всё" : "Далее"}
				nextDisabled={!canGoNext}
				nextLoading={saveMutation.isPending}
			>
				{/* Step 1: Design */}
				{currentStep === 1 && (
					<StepDesign
						designs={designs}
						selectedDesignId={selectedDesign?.id ?? null}
						onSelect={setDesign}
						loading={designsQuery.isFetching}
						search={designSearch}
						onSearchChange={setDesignSearch}
						categoryFilter={categoryFilter}
						onCategoryChange={setCategoryFilter}
						categories={categories}
					/>
				)}

				{/* Step 2: Textures */}
				{currentStep === 2 && (
					<StepTextures
						textures={textures}
						selectedIds={selectedTextureIds}
						onToggle={toggleTexture}
						onSelectAll={() => selectAllTextures(textures.map((t) => t.id))}
						onDeselectAll={deselectAllTextures}
					/>
				)}

				{/* Step 3: Sizes */}
				{currentStep === 3 && (
					<StepSizes
						selectedSizes={selectedSizes}
						onToggle={toggleSize}
						onSelectAll={selectAllSizes}
						onDeselectAll={deselectAllSizes}
					/>
				)}

				{/* Step 4: Upload */}
				{currentStep === 4 && (
					<StepUpload
						variants={variants}
						designName={selectedDesign?.name ?? ""}
						onSetVariantImage={setVariantImage}
						onSetVariantHex={setVariantHex}
						onClearVariantImage={clearVariantImage}
						onBatchApply={setVariantsImage}
					/>
				)}
			</WizardLayout>

			{/* Save button for step 4 */}
			{currentStep === 4 && (
				<div
					style={{
						position: "fixed",
						bottom: 24,
						right: 24,
						zIndex: 100,
					}}
				>
					<Button
						type="primary"
						size="large"
						icon={<SaveOutlined />}
						loading={saveMutation.isPending}
						disabled={!canSave}
						onClick={handleSave}
						style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}
					>
						Сохранить{" "}
						{canSave ? `(${variants.filter((v) => !!v.imagePath).length})` : ""}
					</Button>
				</div>
			)}
		</div>
	);
}
