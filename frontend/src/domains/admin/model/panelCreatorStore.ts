/**
 * Phase Panel Creator Wizard — wizard state management.
 *
 * Holds the current wizard step, selected design/textures/sizes,
 * and the variant entries being configured.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { ApiAdminDesign } from "../api/catalogAdminApi";
import type { ApiTextureColor } from "../api/texturesAdminApi";

// ─── Types ────────────────────────────────────────────────────────────────

/** Valid panel size keys. */
export type PanelSizeKey = "30x30" | "30x60" | "60x60";

export const PANEL_SIZES: Array<{
	key: PanelSizeKey;
	label: string;
	width: number;
	height: number;
}> = [
	{ key: "30x30", label: "30×30 см", width: 300, height: 300 },
	{ key: "30x60", label: "30×60 см", width: 300, height: 600 },
	{ key: "60x60", label: "60×60 см", width: 600, height: 600 },
];

/**
 * Single variant entry — represents one image/color upload for a
 * (texture, color, size) combination.
 */
export interface VariantEntry {
	/** Unique key: `${textureId}:${colorId}:${sizeKey}` */
	key: string;
	textureId: string;
	textureName: string;
	colorId: string;
	colorName: string;
	sizeKey: PanelSizeKey;
	/** Uploaded image path, or null if not yet uploaded */
	imagePath: string | null;
	/** Override hex for this variant (null = use TextureColor.hex) */
	hex: string | null;
	/** Whether a file is currently being uploaded */
	uploading: boolean;
}

export type WizardStep = 1 | 2 | 3 | 4;

interface PanelCreatorState {
	// ── Navigation ────────────────────────────────────────────────────────
	currentStep: WizardStep;
	setStep: (step: WizardStep) => void;
	goNext: () => void;
	goBack: () => void;

	// ── Step 1: Design ───────────────────────────────────────────────────
	selectedDesign: ApiAdminDesign | null;
	setDesign: (design: ApiAdminDesign | null) => void;

	// ── Step 2: Textures ─────────────────────────────────────────────────
	selectedTextureIds: Set<string>;
	toggleTexture: (textureId: string) => void;
	selectAllTextures: (allIds: string[]) => void;
	deselectAllTextures: () => void;
	setTextures: (ids: string[]) => void;

	// ── Step 3: Sizes ────────────────────────────────────────────────────
	selectedSizes: Set<PanelSizeKey>;
	toggleSize: (sizeKey: PanelSizeKey) => void;
	selectAllSizes: () => void;
	deselectAllSizes: () => void;

	// ── Step 4: Variants ─────────────────────────────────────────────────
	/** All generated variant entries for the current configuration */
	variants: VariantEntry[];
	/** Set the image path for a variant */
	setVariantImage: (key: string, imagePath: string) => void;
	/** Set the hex color for a variant */
	setVariantHex: (key: string, hex: string) => void;
	/** Mark a variant as currently uploading */
	setVariantUploading: (key: string, uploading: boolean) => void;
	/** Set multiple variants to the same image (batch apply) */
	setVariantsImage: (keys: string[], imagePath: string) => void;
	/** Build variant entries from selected textures + colors + sizes */
	buildVariants: (
		textureColors: Map<string, ApiTextureColor[]>,
		textureNames: Map<string, string>,
	) => void;
	/** Clear a variant's image */
	clearVariantImage: (key: string) => void;

	// ── Reset ────────────────────────────────────────────────────────────
	reset: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVariantKey(
	textureId: string,
	colorId: string,
	sizeKey: PanelSizeKey,
): string {
	return `${textureId}:${colorId}:${sizeKey}`;
}

const INITIAL_STATE = {
	currentStep: 1 as WizardStep,
	selectedDesign: null,
	selectedTextureIds: new Set<string>(),
	selectedSizes: new Set<PanelSizeKey>(["30x30", "30x60", "60x60"]),
	variants: [],
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const usePanelCreatorStore = create<PanelCreatorState>()(
	devtools(
		(set, get) => ({
			...INITIAL_STATE,

			// ── Navigation ──────────────────────────────────────────────────────

			setStep: (step) => set({ currentStep: step }),

			goNext: () => {
				const { currentStep } = get();
				if (currentStep < 4) {
					set({ currentStep: (currentStep + 1) as WizardStep });
				}
			},

			goBack: () => {
				const { currentStep } = get();
				if (currentStep > 1) {
					set({ currentStep: (currentStep - 1) as WizardStep });
				}
			},

			// ── Step 1 ──────────────────────────────────────────────────────────

			setDesign: (design) => set({ selectedDesign: design }),

			// ── Step 2 ──────────────────────────────────────────────────────────

			toggleTexture: (textureId) => {
				const { selectedTextureIds } = get();
				const next = new Set(selectedTextureIds);
				if (next.has(textureId)) {
					next.delete(textureId);
				} else {
					next.add(textureId);
				}
				set({ selectedTextureIds: next });
			},

			selectAllTextures: (allIds) => {
				set({ selectedTextureIds: new Set(allIds) });
			},

			deselectAllTextures: () => {
				set({ selectedTextureIds: new Set() });
			},

			setTextures: (ids) => {
				set({ selectedTextureIds: new Set(ids) });
			},

			// ── Step 3 ──────────────────────────────────────────────────────────

			toggleSize: (sizeKey) => {
				const { selectedSizes } = get();
				const next = new Set(selectedSizes);
				if (next.has(sizeKey)) {
					next.delete(sizeKey);
				} else {
					next.add(sizeKey);
				}
				set({ selectedSizes: next });
			},

			selectAllSizes: () => {
				set({ selectedSizes: new Set(PANEL_SIZES.map((s) => s.key)) });
			},

			deselectAllSizes: () => {
				set({ selectedSizes: new Set() });
			},

			// ── Step 4 ──────────────────────────────────────────────────────────

			buildVariants: (textureColors, textureNames) => {
				const { selectedTextureIds, selectedSizes } = get();
				const variants: VariantEntry[] = [];

				for (const textureId of selectedTextureIds) {
					const colors = textureColors.get(textureId) ?? [];
					const textureName = textureNames.get(textureId) ?? "";

					for (const color of colors) {
						for (const sizeKey of selectedSizes) {
							variants.push({
								key: makeVariantKey(textureId, color.id, sizeKey),
								textureId,
								textureName,
								colorId: color.id,
								colorName: color.name,
								sizeKey,
								imagePath: null,
								hex: color.hex || null,
								uploading: false,
							});
						}
					}
				}

				set({ variants });
			},

			setVariantImage: (key, imagePath) => {
				set((state) => ({
					variants: state.variants.map((v) =>
						v.key === key ? { ...v, imagePath, uploading: false } : v,
					),
				}));
			},

			setVariantHex: (key, hex) => {
				set((state) => ({
					variants: state.variants.map((v) =>
						v.key === key ? { ...v, hex } : v,
					),
				}));
			},

			setVariantUploading: (key, uploading) => {
				set((state) => ({
					variants: state.variants.map((v) =>
						v.key === key ? { ...v, uploading } : v,
					),
				}));
			},

			setVariantsImage: (keys, imagePath) => {
				const keySet = new Set(keys);
				set((state) => ({
					variants: state.variants.map((v) =>
						keySet.has(v.key) ? { ...v, imagePath, uploading: false } : v,
					),
				}));
			},

			clearVariantImage: (key) => {
				set((state) => ({
					variants: state.variants.map((v) =>
						v.key === key ? { ...v, imagePath: null } : v,
					),
				}));
			},

			// ── Reset ────────────────────────────────────────────────────────────

			reset: () => set(INITIAL_STATE),
		}),
		{ name: "PanelCreatorStore" },
	),
);
