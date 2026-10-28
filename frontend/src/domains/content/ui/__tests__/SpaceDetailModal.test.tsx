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

vi.mock("../../../catalog/ui/CalculatorSidebar", () => ({
	CalculatorSidebar: ({
		context,
		onSelectPanel,
	}: {
		onSelectPanel: (panel: { id: string }) => void;
		context: {
			panelId: string;
			panels: { id: string; name: string }[];
			colorId: string;
			textureId: string;
			onSelectTexture: (selection: {
				textureId: string;
				colorId: string;
			}) => void;
		};
	}) => (
		<div
			data-testid="space-calc"
			data-selected-variant={context.colorId}
			data-selected-panel={context.panelId}
			data-selected-texture={context.textureId}
		>
			<button
				onClick={() =>
					onSelectPanel(
						context.panels.find((panel) => panel.id === "panel-reyka")!,
					)
				}
			>
				Выбрать рейку
			</button>
			<select
				aria-label="Вариант исполнения"
				value={context.colorId}
				onChange={(event) =>
					context.onSelectTexture({
						textureId: context.textureId,
						colorId: event.target.value,
					})
				}
			>
				<option value="var-1">Исполнение 1</option>
				<option value="var-2">Исполнение 2</option>
				<option value="var-3">Исполнение 3</option>
			</select>
			Расчёт проекта
		</div>
	),
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
					images: ["MISC/photo3.png"],
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

describe("SpaceDetailModal — единое окно пространства", () => {
	it("клик по карточке открывает модалку: фото и описание слева, расчёт справа", async () => {
		stubCards();
		render(
			<MemoryRouter initialEntries={["/spaces"]}>
				<Routes>
					<Route path="/spaces" element={<SpacesPage />} />
					<Route path="/catalog/:panelId" element={<LocationProbe />} />
					<Route path="*" element={<LocationProbe />} />
				</Routes>
			</MemoryRouter>,
		);
		const opener = await screen.findByRole("button", {
			name: "Открыть пространство: Современная гостиная",
		});
		fireEvent.click(opener);

		fireEvent.click(await screen.findByText("Выбрать рейку"));
		expect(
			screen.getByTestId("space-calc").getAttribute("data-selected-panel"),
		).toBe("panel-reyka");
		expect(
			screen.getByTestId("space-calc").getAttribute("data-selected-texture"),
		).toBe("tex-metal");
		expect(
			screen.getByTestId("space-calc").getAttribute("data-selected-variant"),
		).toBe("var-reyka");
		expect(screen.getByAltText("Пример исполнения Металл 1 из каталога")).toHaveAttribute("src", "/uploads/design/reyka.png");
		expect(screen.getByText(/не фотография этого пространства/)).toBeTruthy();
		// слева: описание пространства
		const story = await screen.findByLabelText("Описание пространства");
		expect(story).toBeTruthy();
		expect(story.querySelector("h2")?.textContent).toBe("Современная гостиная");
		expect(
			document.querySelector(".space-detail-modal .ant-modal-close"),
		).toBeNull();
		expect(
			story.querySelector(".space-detail-description")?.textContent,
		).not.toBe("Панель Арка в дереве");
		expect(
			screen.getByRole("button", { name: "Хочу такую панель!" }),
		).toBeTruthy();
		expect(
			document.querySelector(".space-detail-gallery-cta-layer"),
		).toBeTruthy();
		const nextPhotoButton = screen.getByRole("button", {
			name: "Следующее фото",
		});
		expect(nextPhotoButton).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Показать фото 2" }));
		await waitFor(() => {
			expect(screen.getByAltText(/фото 2/)).toBeTruthy();
			expect(
				screen.getByTestId("space-calc").getAttribute("data-selected-variant"),
			).toBe("var-2");
			expect(
				screen
					.getByRole("button", { name: "Показать фото 2" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			expect(document.querySelector(".space-detail-calculation")).toBeTruthy();
		});
		fireEvent.click(screen.getByRole("button", { name: "Предыдущее фото" }));
		await waitFor(() => {
			expect(screen.getByAltText(/фото 1/)).toBeTruthy();
			expect(
				screen.getByTestId("space-calc").getAttribute("data-selected-variant"),
			).toBe("var-1");
		});
		fireEvent.change(
			screen.getByRole("combobox", { name: "Вариант исполнения" }),
			{
				target: { value: "var-3" },
			},
		);
		await waitFor(() => {
			expect(screen.getByAltText(/фото 3/)).toBeTruthy();
			expect(
				screen
					.getByRole("button", { name: "Показать фото 3" })
					.getAttribute("aria-pressed"),
			).toBe("true");
			expect(
				screen.getByTestId("space-calc").getAttribute("data-selected-variant"),
			).toBe("var-3");
		});
		fireEvent.click(screen.getByRole("button", { name: "Хочу такую панель!" }));
		await waitFor(() => {
			expect(screen.getAllByTestId("loc")[0].textContent).toContain(
				"/catalog/panel-arka?variantId=var-3",
			);
		});
		expect(screen.queryByLabelText("Исполнение панели")).toBeNull();
		expect(screen.queryByText("Исполнение", { selector: "label" })).toBeNull();
		expect(screen.queryByLabelText("Вариант материала")).toBeNull();
		expect(screen.queryByText("Вариант материала")).toBeNull();

		// справа: расчёт проекта остаётся доступен после CTA-навигации
		expect(screen.queryByText(/привяжите к пространству/i)).toBeNull();
	});
});
