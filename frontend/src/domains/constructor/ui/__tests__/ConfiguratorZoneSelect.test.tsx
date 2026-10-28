import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { App as AntApp } from "antd";

// Модуль API целиком подменяем: проверяем поведение интерфейса, а не сеть.
vi.mock("../../api/configuratorApi", async () => {
	const actual = await vi.importActual<
		typeof import("../../api/configuratorApi")
	>("../../api/configuratorApi");
	return {
		...actual,
		createSession: vi.fn(),
		getSession: vi.fn(),
		updateSession: vi.fn(),
		generateProposals: vi.fn(),
		stitchPanorama: vi.fn(),
	};
});

vi.mock("../../../catalog/api/catalogApi", () => ({
 usePanels: () => ({ data: { items: [{ id: "panel-pro", name: "Арка", is_active: true, form_preview_path: "/uploads/arka.jpg" }] } }),
 useTextures: () => ({ data: [{ id: "texture-pro", name: "Дерево", swatch_image: "/uploads/wood.jpg" }] }),
 usePanelVariants: () => ({ data: [{ id: "variant-pro", panel_id: "panel-pro", texture_id: "texture-pro", name: "Арка дуб", is_active: true, image_paths: ["/uploads/execution.jpg"] }] }),
}));

import { createSession, getSession, generateProposals } from "../../api/configuratorApi";
import ConfiguratorAiPage from "../ConfiguratorAiPage";

const PROPOSALS = {
	session_id: "sess-1",
	proposals: ["A", "B", "C"].map((tag) => ({
		id: `p-${tag}`,
		variant_tag: `Вариант ${tag}`,
		texture_name: "Дуб натуральный",
		color_name: "Медовый",
		style: "Скандинавский",
		area_m2: 8.64,
		coverage: "70% стены",
		status: "ready" as const,
		preview_url: `/uploads/preview-${tag}.jpg`,
		reason: "Тёплый тон подходит к освещению",
		calc: {
			boxes_count: 3,
			panels_count: 24,
			actual_area: 8.64,
			purchase_price: 28800,
			price_per_m2: 3333,
		},
	})),
};

const PHOTO_BOX = { x: 100, y: 200, width: 400, height: 300 };

const SESSION = {
	id: "sess-1",
	photo_url: "/uploads/wall.jpg",
	answers: {
		area_choice: "whole",
		width_m: 3.4,
		height_m: 2.7,
		style: "Скандинавский",
		material: "Камень и дерево",
		comment: "",
		zone: null,
		panel_id: null,
	},
	proposals: null,
};

let lastClient: QueryClient | null = null;
function renderPage(state?: unknown) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	lastClient = client;
	return render(
		<QueryClientProvider client={client}>
			<AntApp>
				<MemoryRouter initialEntries={[{ pathname: "/configurator", state }]}>
					<ConfiguratorAiPage />
				</MemoryRouter>
			</AntApp>
		</QueryClientProvider>,
	);
}

/** jsdom не считает геометрию — задаём бокс фото так, как его видит браузер. */
function stubBox(el: Element, box: DOMRectInit = PHOTO_BOX) {
	const x = box.x ?? 0;
	const y = box.y ?? 0;
	const width = box.width ?? 0;
	const height = box.height ?? 0;
	el.getBoundingClientRect = () => ({
		x,
		y,
		width,
		height,
		top: y,
		left: x,
		right: x + width,
		bottom: y + height,
		toJSON: () => ({}),
	});
}

async function openStep2() {
	renderPage();
	await screen.findByAltText("Ваша стена");
}

async function switchToFragment() {
	fireEvent.click(screen.getByText("Только фрагмент"));
	await waitFor(() =>
		expect(document.querySelector(".zone-selector")).not.toBeNull(),
	);
	return document.querySelector(".zone-selector") as HTMLElement;
}

/** Протягиваем рамку указателем: top-left → bottom-right от бокса фото. */
function dragRect(el: HTMLElement, pointerType: "mouse" | "touch") {
	stubBox(el);
	const base = {
		pointerId: 1,
		isPrimary: true,
		button: 0,
		buttons: 1,
		bubbles: true,
		cancelable: true,
		pointerType,
	};
	fireEvent.pointerDown(el, {
		...base,
		clientX: PHOTO_BOX.x + 40,
		clientY: PHOTO_BOX.y + 30,
	});
	fireEvent.pointerMove(el, {
		...base,
		clientX: PHOTO_BOX.x + 240,
		clientY: PHOTO_BOX.y + 210,
	});
	fireEvent.pointerUp(el, {
		...base,
		buttons: 0,
		clientX: PHOTO_BOX.x + 240,
		clientY: PHOTO_BOX.y + 210,
	});
}

beforeEach(() => {
	vi.mocked(getSession).mockResolvedValue(SESSION as never);
	localStorage.clear();
	// Пользователь уже загрузил фото и находится на шаге 2.
	// usePersistedState хранит значения через JSON.stringify.
	localStorage.setItem("www.configurator.step", JSON.stringify(2));
	localStorage.setItem("www.configurator.session", JSON.stringify("sess-1"));
	localStorage.setItem("www.configurator.instructionSeen", "1");
});

describe("Конфигуратор шаг 2 — выделение стены и фрагмента", () => {
	it("фото стены отображается", async () => {
		await openStep2();
		const img = screen.getByAltText("Ваша стена") as HTMLImageElement;
		expect(img.getAttribute("src")).toBe("/uploads/wall.jpg");
	});

	it("«Вся стена» даёт видимый отклик, а не молчит", async () => {
		await openStep2();
		expect(screen.getByText("Выделена вся стена")).toBeInTheDocument();
	});

	it("переключатель режима реагирует на клик", async () => {
		await openStep2();
		await switchToFragment();
	});

	it("режим фрагмента показывает подсказку, что именно рисовать", async () => {
		await openStep2();
		await switchToFragment();
		expect(screen.getByText(/протяните рамку по стене/i)).toBeInTheDocument();
	});

	it("мышь: протянутая рамка сохраняется и остаётся видимой", async () => {
		await openStep2();
		const overlay = await switchToFragment();
		dragRect(overlay, "mouse");

		await waitFor(() =>
			expect(screen.getByText("Сбросить выделение")).toBeInTheDocument(),
		);
		const rect = document.querySelector(".zone-selector-rect") as HTMLElement;
		expect(rect).not.toBeNull();
		// 40..240 из 400 → x 0.1, w 0.5; 30..210 из 300 → y 0.1, h 0.6
		expect(rect.style.left).toBe("10%");
		expect(rect.style.top).toBe("10%");
		expect(rect.style.width).toBe("50%");
		expect(rect.style.height).toBe("60%");
	});

	it("палец на телефоне: рамка сохраняется (регрессия touch)", async () => {
		await openStep2();
		const overlay = await switchToFragment();
		// Мышиных событий на мобильном нет вообще — обработчики обязаны
		// быть pointer-, иначе фрагмент физически нельзя выделить.
		dragRect(overlay, "touch");

		await waitFor(() =>
			expect(screen.getByText("Сбросить выделение")).toBeInTheDocument(),
		);
	});

	it("сброс выделения возвращает подсказку", async () => {
		await openStep2();
		const overlay = await switchToFragment();
		dragRect(overlay, "mouse");
		await waitFor(() =>
			expect(screen.getByText("Сбросить выделение")).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Сбросить выделение"));
		await waitFor(() =>
			expect(screen.queryByText("Сбросить выделение")).not.toBeInTheDocument(),
		);
		expect(screen.getByText(/протяните рамку по стене/i)).toBeInTheDocument();
	});

	it("возврат к «всей стене» очищает фрагмент — в расчёт не уйдёт противоречие", async () => {
		await openStep2();
		const overlay = await switchToFragment();
		dragRect(overlay, "mouse");
		await waitFor(() =>
			expect(screen.getByText("Сбросить выделение")).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByText("Вся стена"));
		await waitFor(() =>
			expect(document.querySelector(".zone-selector")).toBeNull(),
		);
		expect(screen.getByText("Выделена вся стена")).toBeInTheDocument();
	});

	it("нулевой бокс фото не рождает NaN-координат", async () => {
		await openStep2();
		const overlay = await switchToFragment();
		// До загрузки изображения getBoundingClientRect даёт нулевую ширину.
		stubBox(overlay, { x: 0, y: 0, width: 0, height: 0 });
		fireEvent.pointerDown(overlay, {
			pointerId: 1,
			clientX: 10,
			clientY: 10,
		});
		fireEvent.pointerUp(overlay, { pointerId: 1, clientX: 10, clientY: 10 });
		document.querySelector(".zone-selector-rect");
		expect(document.querySelector(".zone-selector-rect")).toBeNull();
		expect(screen.queryByText("Сбросить выделение")).not.toBeInTheDocument();
	});
});

describe("Конфигуратор шаг 2 — кнопка «Подобрать варианты»", () => {
	beforeEach(() => {
		vi.mocked(generateProposals).mockReset();
	});

	it("клик запускает генерацию (регрессия: onFinish ≠ событие)", async () => {
		vi.mocked(generateProposals).mockResolvedValue(PROPOSALS as never);
		await openStep2();

		fireEvent.click(screen.getByRole("button", { name: /подобрать варианты/i }));

		// onFinish в antd получает values формы, а не событие: `e.preventDefault()`
		// на значениях бросает TypeError, и onSubmit() не вызывался никогда.
		await waitFor(() =>
			expect(generateProposals).toHaveBeenCalledWith(
				"sess-1",
				expect.objectContaining({ area_choice: "whole" }),
			),
		);
	});

	it("успех открывает шаг 3 с тремя вариантами", async () => {
		vi.mocked(generateProposals).mockResolvedValue(PROPOSALS as never);
		await openStep2();

		fireEvent.click(screen.getByRole("button", { name: /подобрать варианты/i }));

		await waitFor(() =>
			expect(screen.getAllByText("Дуб натуральный").length).toBeGreaterThan(0),
		);
	});

	it("поздний рефетч GET не стирает шаг 3 (гонка кеша)", async () => {
		vi.mocked(generateProposals).mockResolvedValue(PROPOSALS as never);
		await openStep2();
		fireEvent.click(
			screen.getByRole("button", { name: /подобрать варианты/i }),
		);
		await waitFor(() =>
			expect(screen.getAllByText("Дуб натуральный").length).toBeGreaterThan(0),
		);

		// Раньше onSubmitDialog дополнительно дёргал PUT /sessions, чей
		// invalidateQueries поднимал рефетч GET с proposals:null — он приходил
		// позже setQueryData и оставлял пустой экран.
		const before = document.querySelectorAll(".proposals-tabs").length;
		lastClient!.invalidateQueries({ queryKey: ["configurator", "sess-1"] });
		await waitFor(() => expect(getSession).toHaveBeenCalled());
		await new Promise((o) => setTimeout(o, 120));

		expect(document.querySelectorAll(".proposals-tabs").length).toBe(before);
		expect(
			screen.getAllByText("Дуб натуральный").length,
		).toBeGreaterThan(0);
	});

	it("подбор не дёргает отдельный PUT ответов", async () => {
		vi.mocked(generateProposals).mockResolvedValue(PROPOSALS as never);
		const { updateSession } = await import("../../api/configuratorApi");
		await openStep2();
		fireEvent.click(
			screen.getByRole("button", { name: /подобрать варианты/i }),
		);
		await waitFor(() => expect(generateProposals).toHaveBeenCalled());
		// Ответы уходят в теле POST /proposals — второй запрос не нужен.
		expect(updateSession).not.toHaveBeenCalled();
	});

	it("ошибка API не молчит — пользователь видит причину", async () => {
		vi.mocked(generateProposals).mockRejectedValue(new Error("сервер занят"));
		await openStep2();

		fireEvent.click(screen.getByRole("button", { name: /подобрать варианты/i }));

		await waitFor(() =>
			expect(screen.getByText(/сервер занят/i)).toBeInTheDocument(),
		);
	});

});


describe("Фото с главной", () => {
 it("принимает новую сессию вместо старой и не загружает файл повторно", async () => {
  renderPage({ uploadedSession: { id: "home-new", photo_url: "/uploads/home-new.png" } });
  await waitFor(() => expect(localStorage.getItem("www.configurator.session")).toBe(JSON.stringify("home-new")));
  expect(localStorage.getItem("www.configurator.step")).toBe("2");
  expect(createSession).not.toHaveBeenCalled();
  expect(getSession).toHaveBeenCalledWith("home-new");
 });
});

it("PRO заменяет стиль/материал тремя полями и требует выбор исполнения", async () => {
 await openStep2();
 fireEvent.click(screen.getByRole("switch", { name: "Режим PRO" }));
 expect(screen.queryByText("Стиль")).not.toBeInTheDocument();
 expect(screen.queryByText("Материал")).not.toBeInTheDocument();
 expect(screen.getByRole("combobox", { name: "Базовая панель" })).toBeInTheDocument();
 expect(screen.getByRole("combobox", { name: "Текстура" })).toBeDisabled();
 expect(screen.getByRole("combobox", { name: "Вариант исполнения" })).toBeDisabled();
 expect(screen.getByRole("button", { name: "Подобрать варианты" })).toBeDisabled();
});
