import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const spacesJson = JSON.parse(
	readFileSync(
		path.resolve(process.cwd(), "public/content/spaces.json"),
		"utf8",
	),
);

const mockUsePanels = vi.fn();
const mockUsePanelVariants = vi.fn();
const mockUseTextures = vi.fn();
const mockAddItemWithQuantity = vi.fn();
const mockSetOpen = vi.fn();
const mockUseTextureVisualization = vi.fn();

vi.mock("../api/catalogApi", () => ({
	usePanels: () => mockUsePanels(),
	usePanelVariants: (params: unknown) => mockUsePanelVariants(params),
	useTextures: () => mockUseTextures(),
	useDesigns: () => ({ data: { items: [], total: 0 }, isLoading: false }),
}));

vi.mock("../../order/model/cartStore", () => ({
	useCartStore: (selector: (state: unknown) => unknown) =>
		selector({
			addItemWithQuantity: mockAddItemWithQuantity,
			setOpen: mockSetOpen,
		}),
}));

vi.mock("../api/textureVisualizationApi", () => ({
	useTextureVisualization: (textureId: string) =>
		mockUseTextureVisualization(textureId),
}));

import CatalogPanelPage from "../ui/CatalogPanelPage";

const panel = {
	id: "panel-1",
	name: "Плоская S",
	slug: "small-square",
	width_mm: 300,
	height_mm: 300,
	size_label: "30×30 см",
	base_price: 890,
	description: "",
	photo_path: "base-panel.png",
	photo_paths: ["base-panel.png", "base-panel-hover.png"],
	form_preview_path: "",
	is_active: true,
};

const variants = [
	{
		id: "variant-wood",
		panel_id: "panel-1",
		panel_name: "Плоская S",
		panel_size: "30×30 см",
		texture_id: "wood",
		texture_name: "Дерево",
		color_id: null,
		color_hex: "0",
		image_paths: ["variants/wood-1.png", "variants/wood-2.png"],
		design_image_paths: [],
		sort_order: 0,
		is_active: true,
	},
	{
		id: "variant-textile",
		panel_id: "panel-1",
		panel_name: "Плоская S",
		panel_size: "30×30 см",
		texture_id: "textile",
		texture_name: "Текстиль",
		color_id: null,
		color_hex: "0",
		image_paths: ["variants/textile-1.png"],
		design_image_paths: ["scenarios/living.jpg"],
		sort_order: 0,
		is_active: true,
	},
];

function LocationProbe() {
	const location = useLocation();
	return (
		<output data-testid="location">{`${location.pathname}${location.search}`}</output>
	);
}

function renderPage(entry = "/catalog/panel-1") {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={client}>
			<MemoryRouter initialEntries={[entry]}>
				<Routes>
					<Route path="/catalog/:panelId" element={<CatalogPanelPage />} />
					<Route path="*" element={<LocationProbe />} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockUsePanelVariants.mockReturnValue({
		data: variants,
		isLoading: false,
		isError: false,
	});
	mockUseTextures.mockReturnValue({
		data: [
			{
				id: "wood",
				name: "Дерево",
				slug: "wood",
				swatch_image: "textures/wood.jpg",
			},
			{
				id: "textile",
				name: "Текстиль",
				slug: "textile",
				swatch_image: "textures/textile.jpg",
			},
		],
		isLoading: false,
	});
	// По умолчанию визуализации нет — блок «в интерьере» скрыт.
	mockUseTextureVisualization.mockReturnValue({ data: undefined });
});

describe("CatalogPanelPage", () => {
	it("counts one execution per admin variant row, not every gallery photo", async () => {
		mockUsePanels.mockReturnValue({
			data: { items: [panel], total: 1 },
			isLoading: false,
			isError: false,
		});
		mockUsePanelVariants.mockReturnValue({
			data: Array.from({ length: 5 }, (_, index) => ({
				id: `leather-${index}`,
				panel_id: "panel-1",
				panel_name: "АРКА",
				panel_size: "30×30 см",
				texture_id: "leather",
				texture_name: "Кожа",
				color_id: null,
				color_hex: "",
				image_paths:
					index === 0
						? [
								"leather-1.png",
								"leather-gallery-2.png",
								"leather-gallery-3.png",
								"leather-gallery-4.png",
								"leather-gallery-5.png",
							]
						: [`leather-${index + 1}.png`],
				design_image_paths: [],
				recommendation_image_paths: [],
				sort_order: index,
				is_active: true,
			})),
			isLoading: false,
			isError: false,
		});
		mockUseTextures.mockReturnValue({
			data: [
				{
					id: "leather",
					name: "Кожа",
					slug: "koja",
					swatch_image: "leather.jpg",
				},
			],
		});
		renderPage();
		fireEvent.click(await screen.findByRole("button", { name: /Кожа/ }));
		await waitFor(() =>
			expect(
				screen.getByRole("heading", { name: "Исполнение. Кожа · 5 вариантов" }),
			).toBeInTheDocument(),
		);
		expect(screen.getAllByRole("button", { name: /Исполнение/ })).toHaveLength(
			5,
		);
	});
	it("keeps a loading state instead of flashing the not-found screen", () => {
		mockUsePanels.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		mockUsePanelVariants.mockReturnValue({
			data: undefined,
			isLoading: true,
			isError: false,
		});
		renderPage();
		expect(screen.queryByText("Панель не найдена")).toBeNull();
		expect(document.querySelector(".panel-skeleton-page")).toBeTruthy();
	});

	it("renders product data and the Apple-style configuration steps", () => {
		mockUsePanels.mockReturnValue({
			data: { items: [panel], total: 1 },
			isLoading: false,
			isError: false,
		});
		renderPage();
		expect(screen.getByRole("heading", { name: "Плоская S" })).toBeTruthy();
		expect(screen.getByText("Материал.")).toBeTruthy();
		expect(screen.getAllByText("Дерево").length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText("Текстиль").length).toBeGreaterThanOrEqual(1);
	});

	it("keeps the material picker as compact 4-column pictograms on desktop and mobile and restores the Просто block", () => {
		const { container } = renderPage();
		const styles = container.querySelector("style")?.textContent || "";

		expect(
			styles.match(
				/\.panel-picto-grid\{display:grid;grid-template-columns:repeat\(4,1fr\)/g,
			),
		).toHaveLength(2);
		expect(styles).toContain(
			".panel-config-step{padding:2px 0 12px;margin-bottom:10px}",
		);
		expect(styles).toContain(
			".panel-config-step{padding:8px 0 10px;margin-bottom:8px",
		);
		expect(
			screen.getByRole("region", { name: "Технологическая роскошь" }),
		).toBeTruthy();
		expect(screen.getByText("Просто.")).toBeTruthy();
		expect(screen.queryByText("Продуманная система")).toBeNull();
		expect(styles).toContain(
			".panel-tech-luxury-wrap{padding:56px max(32px,calc((100% - 1256px)/2));background:#f5f5f7;margin-top:0}",
		);
	});

	it("показывает переключатель доступных размеров панели", () => {
		const { container } = renderPage();
		const styles = container.querySelector("style")?.textContent || "";

		expect(
			screen.getByRole("radiogroup", { name: "Выбор размера" }),
		).toBeTruthy();
		expect(screen.getByRole("radio", { name: /30×30 см/ })).toHaveAttribute(
			"aria-checked",
			"true",
		);
		expect(screen.getByRole("radio", { name: /30×60 см/ })).toBeTruthy();
		expect(screen.getByRole("radio", { name: /60×60 см/ })).toBeTruthy();
		expect(styles).toContain(
			".panel-size-step{padding-bottom:9px;margin-bottom:7px}",
		);
	});

	it("показывает в шаге 1 фото текстуры, а не фото исполнения", () => {
		renderPage();
		const woodCard = screen.getByRole("button", { name: /Дерево/ });
		const texturePhoto = woodCard.querySelector("img");
		expect(texturePhoto).toHaveAttribute("src", "/uploads/textures/wood.jpg");
		expect(texturePhoto).not.toHaveAttribute(
			"src",
			expect.stringContaining("variants/wood-1.png"),
		);
	});

	it("показывает исходное базовое фото без обработки и поднимает его к заголовку на десктопе", () => {
		const { container } = renderPage();
		const preview = screen.getByAltText("Плоская S — базовая форма");
		const styles = container.querySelector("style")?.textContent || "";

		expect(preview).toHaveClass("panel-base-preview");
		expect(preview.closest(".panel-visual-column")).toHaveClass(
			"panel-visual-column--base",
		);
		expect(styles).toContain(".panel-visual-column--base{margin-top:-95px}");
		expect(styles).toContain(".panel-visual-column--base{margin-top:0}");
		expect(preview).toHaveAttribute("src", "/uploads/base-panel.png");
		expect(container.querySelector("svg filter")).toBeNull();
		expect(styles).not.toContain("panel-remove-near-white");
		expect(styles).toContain(
			"border:0;outline:0;box-shadow:none;transform:none;background:transparent;filter:none;clip-path:none;mask:none",
		);
	});

	it("обе кнопки конфигуратора доступны для базовой формы и ведут в конфигуратор", () => {
		renderPage();
		const topButton = screen.getByRole("button", { name: "Конфигуратор" });
		expect(topButton).toBeEnabled();
		fireEvent.click(topButton);
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/configurator?panelId=panel-1&sizeKey=300x300",
		);

		renderPage();
		const bottomButton = screen.getByRole("button", {
			name: "Открыть конфигуратор →",
		});
		expect(bottomButton).toBeEnabled();
		fireEvent.click(bottomButton);
		expect(screen.getAllByTestId("location").at(-1)).toHaveTextContent(
			"/configurator?panelId=panel-1&sizeKey=300x300",
		);
	});

	it("показывает второе фото базовой формы при фокусе без элементов слайдера", () => {
		renderPage();
		const basePreview = screen.getByRole("region", {
			name: "Базовая форма панели",
		});
		expect(screen.getByAltText("Плоская S — базовая форма")).toBeTruthy();
		expect(
			screen.queryByRole("region", { name: "Фотографии панели" }),
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: "Следующий слайд" }),
		).toBeNull();
		expect(screen.queryByRole("status")).toBeNull();
		fireEvent.focus(basePreview);
		expect(
			screen.getByAltText("Плоская S — базовая форма при наведении"),
		).toHaveAttribute("src", "/uploads/base-panel-hover.png");
		fireEvent.blur(basePreview);
		expect(screen.getByAltText("Плоская S — базовая форма")).toBeTruthy();
	});

	it("скрывает временные информационные блоки слева", () => {
		renderPage();
		expect(screen.queryByText("Магнитная система")).toBeNull();
		expect(screen.queryByText("Продуманная система")).toBeNull();
	});

	it("показывает универсальное число исполнений одной строкой", () => {
		renderPage();
		fireEvent.click(screen.getByRole("button", { name: /Текстиль/ }));

		const heading = screen.getByRole("heading", {
			name: "Исполнение. Текстиль · 1 вариант",
		});
		expect(heading).toHaveClass("panel-finish-heading");
		expect(heading.closest("section")).toHaveClass("panel-finish-step");
		expect(heading).toHaveStyle({
			whiteSpace: "nowrap",
			color: "#1d1d1f",
		});
		expect(heading.querySelector("span")).toHaveTextContent(
			"Текстиль · 1 вариант",
		);
		expect(heading.querySelector("span")).toHaveStyle({ color: "#86868b" });

		fireEvent.click(screen.getByRole("button", { name: /Дерево/ }));
		expect(
			screen.getByRole("heading", {
				name: "Исполнение. Дерево · 1 вариант",
			}),
		).toBeTruthy();
	});

	it("places companions after specs on mobile and in a separate two-column-wide desktop block", () => {
		mockUsePanels.mockReturnValue({
			data: {
				items: [
					panel,
					{
						...panel,
						id: "panel-2",
						name: "Компаньон",
						photo_path: "companion.png",
					},
				],
				total: 2,
			},
			isLoading: false,
			isError: false,
		});
		const { container } = renderPage();
		const specs = container.querySelector<HTMLElement>(
			".panel-spec-after-step4",
		);
		const mobileCompanions = container.querySelector<HTMLElement>(
			".panel-companions-mobile",
		);
		expect(specs).toContainElement(mobileCompanions);
		expect(specs?.querySelector(".panel-companions-section")).toBeTruthy();
		const buyLayout = container.querySelector<HTMLElement>(".panel-buy-layout");
		const desktopCompanions = container.querySelector<HTMLElement>(
			".panel-companions-desktop.panel-companions-wide",
		);
		expect(desktopCompanions).toBeTruthy();
		expect(buyLayout).not.toContainElement(desktopCompanions);
		expect(buyLayout?.nextElementSibling).toBe(desktopCompanions);
	});

	it("adds the selected texture, finish and quantity to the cart", () => {
		mockUsePanels.mockReturnValue({
			data: { items: [panel], total: 1 },
			isLoading: false,
			isError: false,
		});
		renderPage();
		fireEvent.click(screen.getByRole("button", { name: /Текстиль/ }));
		fireEvent.click(
			screen.getByRole("button", { name: "Увеличить количество" }),
		);
		fireEvent.click(
			screen.getAllByRole("button", { name: /Добавить в корзину/ })[0],
		);
		expect(mockAddItemWithQuantity).toHaveBeenCalledWith(
			expect.objectContaining({
				productId: "panel-1",
				textureId: "textile",
				textureName: "Текстиль",
				image: "variants/textile-1.png",
				price: 2090,
				sizeKey: "300x300",
				size: "300×300 мм",
			}),
			2,
		);
		expect(mockSetOpen).toHaveBeenCalledWith(true);
	});
});

describe("Блок «в интерьере»", () => {
	it("без выбранной фактуры не рендерится ни в колонке, ни в потоке", () => {
		const { container } = renderPage();
		expect(container.querySelector(".panel-interiors")).toBeNull();
	});

	it("листается только внутри выбранной фактуры: исполнение, затем фото в дизайне", () => {
		mockUsePanels.mockReturnValue({
			data: { items: [panel], total: 1 },
			isLoading: false,
			isError: false,
		});
		renderPage();
		fireEvent.click(screen.getByRole("button", { name: /Текстиль/ }));
		expect(document.querySelector(".panel-interiors")).toBeNull();
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute(
			"data-active-slide",
			"textile-0",
		);
		expect(document.querySelector("[data-active-slide] img")).toHaveAttribute(
			"src",
			expect.stringContaining("textile-1.png"),
		);
		expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
		expect(screen.queryByRole("button", { name: /Слайд .*Дерево/ })).toBeNull();
		expect(
			screen.getByRole("button", { name: /Слайд 2: Текстиль — в дизайне 1/ }),
		).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Следующий слайд" }));
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute(
			"data-active-slide",
			"design-variant-textile-0",
		);
		expect(document.querySelector("[data-active-slide] img")).toHaveAttribute(
			"src",
			expect.stringContaining("scenarios/living.jpg"),
		);
		expect(
			document.querySelector('[data-texture-id="textile"]'),
		).toHaveAttribute("aria-pressed", "true");
	});

	describe("Контекст перехода из «Пространств» (ТЗ-19)", () => {
		it("выбирает фактуру и фото исполнения по переданному variantId", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn().mockResolvedValue({
					ok: true,
					json: async () => JSON.parse(JSON.stringify(spacesJson)),
				}),
			);
			mockUsePanels.mockReturnValue({
				data: { items: [panel], total: 1 },
				isLoading: false,
				isError: false,
			});
			mockUsePanelVariants.mockReturnValue({
				data: [{ ...variants[0], id: "wood-1" }, ...variants.slice(1)],
				isLoading: false,
				isError: false,
			});
			renderPage(
				"/catalog/panel-1?interiorId=home-living-tv-1&variantId=wood-1",
			);
			const woodCard = await screen.findByRole("button", { name: /Дерево/ });
			await waitFor(() =>
				expect(woodCard).toHaveAttribute("aria-pressed", "true"),
			);
		});
	});
});
