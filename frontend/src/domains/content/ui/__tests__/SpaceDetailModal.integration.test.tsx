import { afterEach, describe, expect, it, vi } from "vitest";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SpacesPage from "../SpacesPage";

vi.mock("../../../catalog/api/catalogApi", () => ({
	usePanels: () => ({
		data: {
			items: [
				{
					id: "panel-arka",
					slug: "arka",
					name: "АРКА",
					form_preview_path: "",
					photo_path: "arka.png",
				},
				{
					id: "panel-reyka",
					slug: "reyka",
					name: "РЕЙКА",
					photo_path: "reyka.png",
				},
			],
		},
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	}),
	usePanelVariants: () => ({
		data: [
			{
				id: "var-reyka",
				panel_id: "panel-reyka",
				panel_name: "РЕЙКА",
				texture_id: "tex-metal",
				texture_name: "Металл",
				name: "Металл 1",
				image_paths: ["metal.png"],
				design_image_paths: ["design/reyka.png"],
			},
			{
				id: "c632aa99-d63a-4ea0-8263-a6f2839e11d3",
				panel_id: "panel-reyka",
				panel_name: "РЕЙКА",
				texture_id: "tex-metal",
				texture_name: "Металл",
				name: "4",
				image_paths: ["metal4.png"],
			},
			{
				id: "var-1",
				panel_id: "panel-arka",
				panel_name: "АРКА",
				texture_id: "tex-wood",
				texture_name: "Дерево",
				name: "Исполнение 1",
				image_paths: ["MISC/cover.png"],
			},
			{
				id: "var-2",
				panel_id: "panel-arka",
				panel_name: "АРКА",
				texture_id: "tex-wood",
				texture_name: "Дерево",
				name: "Исполнение 2",
				image_paths: ["MISC/photo2.png"],
			},
			{
				id: "var-3",
				panel_id: "panel-arka",
				panel_name: "АРКА",
				texture_id: "tex-wood",
				texture_name: "Дерево",
				name: "Исполнение 3",
				image_paths: ["MISC/photo3.png"],
			},
		],
		isLoading: false,
		isError: false,
		refetch: vi.fn(),
	}),
}));

function LocationProbe() {
	const location = useLocation();
	return <div data-testid="loc">{location.pathname + location.search}</div>;
}

const mockFetch = vi.fn();
(globalThis as { fetch?: unknown }).fetch = mockFetch;

function stubCards() {
	mockFetch.mockImplementation((url: string) => {
		const ok = (body: unknown) =>
			Promise.resolve({ ok: true, json: async () => body });
		if (url.includes("/calculate"))
			return Promise.resolve({ ok: false, status: 503 });
		if (url.includes("/spaces/page"))
			return ok({ heading: "Заголовок", intro: "Текст" });
		if (url.includes("/spaces/cards"))
			return ok([
				{
					id: "card-1",
					mode: "mono",
					title: "Современная гостиная",
					subtitle: "Панель Арка в дереве",
					price: "196 460 ₽",
					area: "6 м²",
					category: "home",
					image: "MISC/cover.png",
					// дубль обложки в галерее — модалка должна показать её один раз
					images: ["MISC/cover.png"],
					textureId1: "tex-wood",
					textureId2: "tex-wood",
					executionVariantId: "var-1",
					panelFamily1: "arka",
					panelFamily2: "arka",
				},
				{
					id: "card-2",
					projectId: "card-1",
					mode: "mono",
					title: "Современная гостиная",
					subtitle: "Панель Арка в другом исполнении",
					price: "196 460 ₽",
					area: "6 м²",
					category: "home",
					image: "MISC/photo2.png",
					images: ["MISC/photo2.png"],
					textureId1: "tex-wood",
					textureId2: "tex-wood",
					executionVariantId: "var-2",
					panelFamily1: "arka",
					panelFamily2: "arka",
				},
				{
					id: "card-3",
					projectId: "card-1",
					mode: "mono",
					title: "Современная гостиная",
					subtitle: "Панель Арка в третьем исполнении",
					price: "196 460 ₽",
					area: "6 м²",
					category: "home",
					image: "MISC/photo3.png",
					images: [
						"MISC/photo3.png",
						"MISC/0a6a3680-289c-4b54-b703-088afaf2cadd.png",
					],
					textureId1: "tex-wood",
					textureId2: "tex-wood",
					executionVariantId: "var-3",
					panelFamily1: "arka",
					panelFamily2: "arka",
				},
			]);
		if (url.includes("/spaces/texture-images")) return ok([]);
		if (url.includes("/textures"))
			return ok([{ id: "tex-wood", name: "Дерево" }]);
		if (url.includes("/spaces")) return ok([]);
		return ok([]);
	});
}

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("SpaceDetailModal с настоящим калькулятором", () => {
	it("выбор панели без связанного фото не показывает прежнее изображение; слайд восстанавливает исполнение", async () => {
		stubCards();
		render(
			<MemoryRouter initialEntries={["/spaces"]}>
				<Routes>
					<Route path="/spaces" element={<SpacesPage />} />
					<Route path="*" element={<LocationProbe />} />
				</Routes>
			</MemoryRouter>,
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Открыть пространство: Современная гостиная",
			}),
		);
		const height = await screen.findByRole("spinbutton", { name: "Высота" });
		fireEvent.change(height, { target: { value: "300" } });
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: /Выбрать панель/ }),
		);
		const option = await screen.findByText("РЕЙКА");
		fireEvent.click(option);
		await waitFor(() =>
			expect(
				screen.getByAltText("Пример исполнения Металл 1 из каталога"),
			).toHaveAttribute("src", "/uploads/design/reyka.png"),
		);
		expect(screen.getByText(/не фотография этого пространства/)).toBeTruthy();
		expect(
			screen
				.getByRole("combobox", { name: /Выбрать панель/ })
				.getAttribute("aria-label"),
		).toContain("РЕЙКА");
		fireEvent.click(screen.getByRole("button", { name: "Предыдущее фото" }));
		await waitFor(() => expect(screen.getByAltText(/фото 4/)).toBeTruthy());
		fireEvent.click(screen.getByRole("button", { name: "Показать фото 2" }));
		await waitFor(() => expect(screen.getByAltText(/фото 2/)).toBeTruthy());
		expect(
			screen
				.getByRole("combobox", { name: /Выбрать панель/ })
				.getAttribute("aria-label"),
		).toContain("АРКА");
		expect((height as HTMLInputElement).value).toBe("300");
	});
	it("кнопка передаёт в каталог выбранное исполнение", async () => {
		stubCards();
		render(
			<MemoryRouter initialEntries={["/spaces"]}>
				<Routes>
					<Route path="/spaces" element={<SpacesPage />} />
					<Route path="*" element={<LocationProbe />} />
				</Routes>
			</MemoryRouter>,
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Открыть пространство: Современная гостиная",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "Показать фото 2" }),
		);
		fireEvent.click(screen.getByRole("button", { name: "Хочу такую панель!" }));
		await waitFor(() =>
			expect(screen.getByTestId("loc")).toHaveTextContent(
				"/catalog/panel-arka?variantId=var-2",
			),
		);
	});

	it("чёрный снимок выбирает РЕЙКА, Металл, 4", async () => {
		stubCards();
		render(
			<MemoryRouter initialEntries={["/spaces"]}>
				<Routes>
					<Route path="/spaces" element={<SpacesPage />} />
					<Route path="*" element={<LocationProbe />} />
				</Routes>
			</MemoryRouter>,
		);
		fireEvent.click(
			await screen.findByRole("button", {
				name: "Открыть пространство: Современная гостиная",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "Показать фото 4" }),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: /Выбрать панель/ }),
			).toHaveAttribute("aria-label", "Выбрать панель. Сейчас: РЕЙКА"),
		);
		expect(screen.getByText("Металл")).toBeTruthy();
		expect(screen.getByText("4")).toBeTruthy();
		expect(
			screen.getByText(/Панель РЕЙКА — Металл, исполнение 4/),
		).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Хочу такую панель!" }));
		await waitFor(() =>
			expect(screen.getByTestId("loc")).toHaveTextContent(
				"/catalog/panel-reyka?variantId=c632aa99-d63a-4ea0-8263-a6f2839e11d3",
			),
		);
	});
});
