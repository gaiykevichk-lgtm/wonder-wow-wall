import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

class IntersectionObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
}
// @ts-expect-error — global polyfill for jsdom
globalThis.IntersectionObserver = IntersectionObserverStub;

// ─── Mock data ───────────────────────────────────────────────────────────────

function makeVariant(
	overrides: Partial<{
		id: string;
		panel_id: string;
		panel_name: string;
		panel_size: string;
		texture_id: string;
		texture_name: string;
		color_id: string | null;
		color_hex: string | null;
		image_paths: string[];
		sort_order: number;
		is_active: boolean;
	}> = {},
) {
	return {
		id: "v1",
		panel_id: "panel-1",
		panel_name: "Плоская S",
		panel_size: "30×30 см",
		texture_id: "tex-wood",
		texture_name: "Дерево",
		color_id: null,
		color_hex: null,
		image_paths: ["variants/panel-1/wood/1.png"],
		sort_order: 0,
		is_active: true,
		...overrides,
	};
}

// ─── Mock usePanelVariants ───────────────────────────────────────────────────

const mockUsePanelVariants = vi.fn();
// `usePanels` supplies the panel-level catalog gallery (`photo_paths`).
// Defaults to an empty list so the existing cases keep exercising the
// texture-preview fallback path.
// Loosely typed on purpose: the tests only need `data.items`, and an
// explicit `never[]` default would reject the panel fixtures below.
const mockUsePanels = vi.fn<() => {
	data: { items: unknown[]; total: number } | undefined;
	isLoading: boolean;
}>();
vi.mock("../api/catalogApi", () => ({
	usePanelVariants: (...args: unknown[]) => mockUsePanelVariants(...args),
	usePanels: () => mockUsePanels(),
}));

// ─── Mock navigate ──────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return { ...actual, useNavigate: () => mockNavigate };
});

// ─── Import after mocks ─────────────────────────────────────────────────────

import CatalogPage from "../ui/CatalogPage";
import { groupVariantsToPanels } from "../ui/panelHelpers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockBaseFormsFromVariants() {
	const variants = mockUsePanelVariants()?.data ?? [];
	const items = variants.map((v: ReturnType<typeof makeVariant>) => ({
		id: v.panel_id, name: v.panel_name, slug: v.panel_id,
		width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0,
		description: "Описание формы из админки", photo_path: "panel.png",
		photo_paths: ["panel.png"], form_preview_path: "form.png", is_active: true,
	})).filter((p: { id: string }, i: number, all: { id: string }[]) => all.findIndex((x) => x.id === p.id) === i);
	mockUsePanels.mockReturnValue({ data: { items, total: items.length }, isLoading: false });
}

function renderPage() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<MemoryRouter initialEntries={["/catalog"]}>
				<CatalogPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockNavigate.mockReset();
	// `clearAllMocks` wipes call history but keeps a `mockReturnValue`, so
	// re-assert the empty-gallery default explicitly — otherwise the last
	// test that stubbed `usePanels` would leak its panels into the next one.
	mockUsePanels.mockReturnValue({ data: { items: [], total: 0 }, isLoading: false });
});

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("groupVariantsToPanels", () => {
	it("groups multiple variants of the same panel into one card", () => {
		const variants = [
			makeVariant({
				id: "v1",
				texture_id: "t1",
				texture_name: "Дерево",
				image_paths: ["/wood/1.png"],
			}),
			makeVariant({
				id: "v2",
				texture_id: "t1",
				texture_name: "Дерево",
				image_paths: ["/wood/1.png"],
			}),
			makeVariant({
				id: "v3",
				texture_id: "t2",
				texture_name: "Кожа",
				image_paths: ["/leather/1.png"],
			}),
		];

		const panels = groupVariantsToPanels(variants, variants.map((v) => ({ id: v.panel_id, name: v.panel_name, slug: v.panel_id, width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0, description: "", photo_path: "", photo_paths: [], form_preview_path: "", is_active: true })).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));

		expect(panels).toHaveLength(1);
		expect(panels[0].panel_name).toBe("Плоская S");
		expect(panels[0].textures).toHaveLength(2); // Дерево + Кожа
	});

	it("uses base-form fields and ignores stale variant metadata", () => {
		const panel = {
			id: "panel-1", name: "Имя из админки", slug: "shape",
			width_mm: 600, height_mm: 600, size_label: "60×60 см",
			base_price: 2400, description: "Правильное описание из админки",
			photo_path: "panel.png", photo_paths: ["panel.png"],
			form_preview_path: "form.png", is_active: true,
		};
		const result = groupVariantsToPanels(
			[makeVariant({ panel_name: "Старое имя", panel_size: "30×30 см" })],
			[panel],
		);
		expect(result[0]).toMatchObject({
			panel_name: "Имя из админки", panel_size: "60×60 см",
			base_price: 2400, description: "Правильное описание из админки",
			catalog_photos: ["panel.png"], form_preview: "form.png",
		});
		expect(groupVariantsToPanels([makeVariant()], [])).toEqual([]);
	});

	it("groups variants by panel_id when multiple panels exist", () => {
		const variants = [
			makeVariant({
				id: "v1",
				panel_id: "panel-1",
				panel_name: "Плоская S",
				texture_id: "t1",
				texture_name: "Дерево",
			}),
			makeVariant({
				id: "v2",
				panel_id: "panel-2",
				panel_name: "Большая панель",
				texture_id: "t1",
				texture_name: "Дерево",
			}),
		];

		const panels = groupVariantsToPanels(variants, variants.map((v) => ({ id: v.panel_id, name: v.panel_name, slug: v.panel_id, width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0, description: "", photo_path: "", photo_paths: [], form_preview_path: "", is_active: true })).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));

		expect(panels).toHaveLength(2);
	});

	it("uses first image_path as preview for each texture", () => {
		const variants = [
			makeVariant({
				id: "v1",
				texture_id: "t1",
				texture_name: "Дерево",
				image_paths: ["/wood/first.png", "/wood/second.png"],
			}),
		];

		const panels = groupVariantsToPanels(variants, variants.map((v) => ({ id: v.panel_id, name: v.panel_name, slug: v.panel_id, width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0, description: "", photo_path: "", photo_paths: [], form_preview_path: "", is_active: true })).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));

		expect(panels[0].textures[0].preview_path).toBe("/wood/first.png");
	});

	it("counts variant colors per texture", () => {
		const variants = [
			makeVariant({ id: "v1", texture_id: "t1", texture_name: "Кожа" }),
			makeVariant({ id: "v2", texture_id: "t1", texture_name: "Кожа" }),
			makeVariant({ id: "v3", texture_id: "t1", texture_name: "Кожа" }),
		];

		const panels = groupVariantsToPanels(variants, variants.map((v) => ({ id: v.panel_id, name: v.panel_name, slug: v.panel_id, width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0, description: "", photo_path: "", photo_paths: [], form_preview_path: "", is_active: true })).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));

		expect(panels[0].textures[0].variant_count).toBe(3);
	});

	it("sorts textures alphabetically", () => {
		const variants = [
			makeVariant({ id: "v1", texture_id: "t3", texture_name: "Текстиль" }),
			makeVariant({ id: "v2", texture_id: "t1", texture_name: "Дерево" }),
			makeVariant({ id: "v3", texture_id: "t2", texture_name: "Кожа" }),
		];

		const panels = groupVariantsToPanels(variants, variants.map((v) => ({ id: v.panel_id, name: v.panel_name, slug: v.panel_id, width_mm: 300, height_mm: 300, size_label: v.panel_size, base_price: 0, description: "", photo_path: "", photo_paths: [], form_preview_path: "", is_active: true })).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i));

		expect(
			panels[0].textures.map((t: { texture_name: string }) => t.texture_name),
		).toEqual(["Дерево", "Кожа", "Текстиль"]);
	});
});

// ─── Integration tests ────────────────────────────────────────────────────────

describe("CatalogPage", () => {
	it("renders loading skeletons while variants are loading", () => {
		mockUsePanelVariants.mockReturnValue({ data: undefined, isLoading: true });
		mockUsePanels.mockReturnValue({ data: undefined, isLoading: true });
		renderPage();
		expect(screen.getByText("Всё начинается с чистого холста")).toBeTruthy();
	});

	it("renders one card per unique panel (not per variant)", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [
				makeVariant({
					id: "v1",
					panel_id: "p1",
					panel_name: "Плоская S",
					texture_id: "t1",
					texture_name: "Дерево",
				}),
				makeVariant({
					id: "v2",
					panel_id: "p1",
					panel_name: "Плоская S",
					texture_id: "t1",
					texture_name: "Дерево",
				}), // duplicate
				makeVariant({
					id: "v3",
					panel_id: "p1",
					panel_name: "Плоская S",
					texture_id: "t2",
					texture_name: "Кожа",
				}),
			],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();

		// Should show 1 card (not 3)
		const cards = document.querySelectorAll(".catalog-forms-grid > div");
		expect(cards.length).toBe(1);
		expect(screen.getByText("Плоская S")).toBeTruthy();
	});

	it("shows texture swatches on panel card", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [
				makeVariant({
					id: "v1",
					texture_id: "t1",
					texture_name: "Дерево",
					image_paths: ["/wood.png"],
				}),
				makeVariant({
					id: "v2",
					texture_id: "t2",
					texture_name: "Кожа",
					image_paths: ["/leather.png"],
				}),
			],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();

		expect(screen.getByText("Описание формы из админки")).toBeTruthy();
		expect(screen.queryByText("Дерево, Кожа")).toBeNull();
	});

	it("navigates to /catalog/:panelId on card click", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [makeVariant({ panel_id: "panel-abc" })],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();

		fireEvent.click(screen.getByText("Плоская S"));
		expect(mockNavigate).toHaveBeenCalledWith("/catalog/panel-abc");
	});

	it("filters by panel size tab", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [
				makeVariant({
					panel_id: "p1",
					panel_name: "Плоская S",
					panel_size: "30×30 см",
				}),
				makeVariant({
					panel_id: "p2",
					panel_name: "Большая",
					panel_size: "60×60 см",
				}),
			],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();
		expect(screen.getByText("Плоская S")).toBeTruthy();
		expect(screen.getByText("Большая")).toBeTruthy();

		// Click 30×30 filter
		fireEvent.click(screen.getAllByText("30×30 см")[0]);
		expect(screen.getByText("Плоская S")).toBeTruthy();
		expect(screen.queryByText("Большая")).toBeNull();
	});

	it("filters by search query", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [
				makeVariant({
					panel_id: "p1",
					panel_name: "Плоская S",
					texture_id: "t1",
					texture_name: "Дерево",
				}),
				makeVariant({
					panel_id: "p2",
					panel_name: "Большая панель",
					texture_id: "t2",
					texture_name: "Кожа",
				}),
			],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();

		const searchInput = screen.getByPlaceholderText(
			"Поиск по названию, описанию или фактуре...",
		);
		fireEvent.change(searchInput, { target: { value: "Дерево" } });

		expect(screen.getByText("Плоская S")).toBeTruthy();
		expect(screen.queryByText("Большая панель")).toBeNull();
	});

	it("shows empty state when no panels match", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [makeVariant({ panel_id: "p1", panel_name: "Плоская S" })],
			isLoading: false,
		});

		mockBaseFormsFromVariants();
		renderPage();

		const searchInput = screen.getByPlaceholderText(
			"Поиск по названию, описанию или фактуре...",
		);
		fireEvent.change(searchInput, {
			target: { value: "несуществующая панель" },
		});

		expect(screen.getByText("Ничего не найдено")).toBeTruthy();
	});

	// ─── Panel catalog gallery (photo_paths) ────────────────────────────────

	it("prefers the panel catalog photo over the texture preview", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [
				makeVariant({
					panel_id: "p1",
					image_paths: ["variants/p1/wood/texture-preview.png"],
				}),
			],
			isLoading: false,
		});
		mockUsePanels.mockReturnValue({
			data: {
				items: [
					{
						id: "p1",
						name: "Плоская S",
						slug: "small-square",
						width_mm: 300,
						height_mm: 300,
						size_label: "30×30 см",
						base_price: 890,
						description: "",
						photo_path: "panels/p1/catalog-1.png",
						photo_paths: ["panels/p1/catalog-1.png", "panels/p1/catalog-2.png"],
						is_active: true,
					},
				],
				total: 1,
			},
			isLoading: false,
		});

		renderPage();

		const img = screen
			.getAllByRole("img")
			.find((el) => el.getAttribute("alt") === "Плоская S");
		expect(img?.getAttribute("src")).toContain("panels/p1/catalog-1.png");
		expect(img?.style.transform).toBe("");
		expect(img?.closest(".catalog-panel-image")).toBeTruthy();
	});

	it("keeps the catalog photo unscaled when the card is hovered", () => {
		mockUsePanelVariants.mockReturnValue({
			data: [makeVariant({ panel_id: "p1" })],
			isLoading: false,
		});
		mockUsePanels.mockReturnValue({
			data: {
				items: [
					{
						id: "p1",
						name: "Плоская S",
						slug: "small-square",
						width_mm: 300,
						height_mm: 300,
						size_label: "30×30 см",
						base_price: 890,
						description: "",
						photo_path: "panels/p1/catalog-1.png",
						photo_paths: ["panels/p1/catalog-1.png", "panels/p1/catalog-2.png"],
						is_active: true,
					},
				],
				total: 1,
			},
			isLoading: false,
		});

		renderPage();
		const photo = screen.getByAltText("Плоская S");
		const card = photo.closest(".catalog-forms-grid > div");
		expect(card).toBeTruthy();
		fireEvent.mouseEnter(card!);

		expect(screen.getByAltText("Плоская S").getAttribute("src")).toContain(
			"panels/p1/catalog-2.png",
		);
		expect(screen.getByAltText("Плоская S").style.transform).toBe("");
		expect((card as HTMLElement).style.transform).not.toContain("scale");
	});

	it("renders a card for a panel that has photos but no variants", () => {
		mockUsePanelVariants.mockReturnValue({ data: [], isLoading: false });
		mockUsePanels.mockReturnValue({
			data: {
				items: [
					{
						id: "p-new",
						name: "Новая форма",
						slug: "new-shape",
						width_mm: 300,
						height_mm: 600,
						size_label: "30×60 см",
						base_price: 1490,
						description: "",
						photo_path: "panels/p-new/a.png",
						photo_paths: ["panels/p-new/a.png"],
						is_active: true,
					},
				],
				total: 1,
			},
			isLoading: false,
		});

		renderPage();

		expect(screen.getByText("Новая форма")).toBeTruthy();
	});
});
