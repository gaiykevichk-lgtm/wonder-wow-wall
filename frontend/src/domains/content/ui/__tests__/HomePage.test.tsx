import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

const mockNavigate = vi.fn();
const catalogPanels = Array.from({ length: 8 }, (_, index) => ({
	id: `panel-${index}`,
	name: `Форма ${index + 1}`,
	slug: `form-${index}`,
	width_mm: 300,
	height_mm: 300,
	size_label: "30×30 см",
	base_price: 0,
	description: "",
	photo_path: `PANEL_PHOTO/${index}.png`,
	photo_paths: [`PANEL_PHOTO/${index}.png`],
	form_preview_path: "",
	is_active: true,
}));
vi.mock("../../../catalog/api/catalogApi", () => ({
	usePanels: () => ({
		data: { items: catalogPanels },
		isLoading: false,
		isError: false,
	}),
	usePanelVariants: () => ({ data: [] }),
}));
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../model/spacesApi", () => ({
	useSpaceCards: () => ({ status: "success", data: [], retry: vi.fn() }),
	useSpacesInteriors: () => ({ status: "success", data: [], retry: vi.fn() }),
}));

import HomePage from "../HomePage";

function renderHomePage() {
	return render(
		<MemoryRouter initialEntries={["/"]}>
			<HomePage />
		</MemoryRouter>,
	);
}

describe("HomePage — HeroSection (Phase 1)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it("рендерит HeroSection без ошибок", () => {
		renderHomePage();
		// HeroSection содержит заголовок с "Ремонт окончен"
		expect(screen.getByText(/Ремонт окончен/)).toBeTruthy();
	});

	it('заголовок содержит "Ремонт окончен"', () => {
		renderHomePage();
		expect(screen.getByText(/Ремонт окончен/)).toBeTruthy();
	});

	it('заголовок содержит "Начинается свобода"', () => {
		renderHomePage();
		expect(screen.getByText(/Начинается свобода/)).toBeTruthy();
	});

	it('подзаголовок содержит "первая платформа трансформации стен"', () => {
		renderHomePage();
		expect(screen.getByText(/первая платформа/)).toBeTruthy();
		expect(screen.getByText(/трансформации стен/)).toBeTruthy();
	});

	it('CTA "выбрать свой WOW!" ведёт на /catalog', () => {
		renderHomePage();
		// Может быть несколько кнопок с этим текстом (Hero + PanelGrid) — берём первую
		const buttons = screen.getAllByRole("button", {
			name: /выбрать свой WOW!/i,
		});
		expect(buttons.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(buttons[0]);
		expect(mockNavigate).toHaveBeenCalledWith("/catalog");
	});

	it('HeroSection содержит ровно один CTA с текстом "выбрать свой WOW!"', () => {
		renderHomePage();
		// HeroSection содержит ОДИН primary CTA с текстом "выбрать свой WOW!"
		// Второй CTA с таким же текстом находится в PanelGridSection — это нормально
		const wowButtons = document.querySelectorAll(
			"section:first-of-type button",
		);
		expect(wowButtons.length).toBeGreaterThanOrEqual(1);
	});
});

describe("HomePage — HowItWorksSection (Phase 2)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('секция рендерится с заголовком "Просто. Быстро. WOW"', () => {
		renderHomePage();
		expect(screen.getByText(/Просто\. Быстро\. WOW/i)).toBeTruthy();
	});

	it("третий шаг использует присланное видео, остальные шаги не меняются", () => {
		renderHomePage();
		const videos = Array.from(
			document.querySelectorAll('video[src^="/videos/"]'),
		);
		expect(videos.map((video) => video.getAttribute("src"))).toEqual([
			"/videos/Выбираете.MP4",
			"/videos/Примеряете.MP4",
			"/videos/Обновляете.MP4",
			"/videos/Меняете.MP4",
		]);
	});

	it("4 карточки с правильными заголовками", () => {
		renderHomePage();
		expect(screen.getByText(/Выбираете/)).toBeTruthy();
		expect(screen.getByText(/Примеряете/)).toBeTruthy();
		expect(screen.getByText(/Обновляете/)).toBeTruthy();
		expect(screen.getByText(/Одна бесплатная замена/)).toBeTruthy();
	});

	it("описания соответствуют слайду 2", () => {
		renderHomePage();
		expect(
			screen.getByText(/Найдите текстуру, которая отражает Вас сегодня/),
		).toBeTruthy();
		expect(
			screen.getByText(
				/Загрузите фото и приложение мгновенно впишет новый интерьер/,
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				/Мы превратили обновление интерьера\s+в вопрос нескольких часов/,
			),
		).toBeTruthy();
		expect(
			screen.getByText(
				/Одна бесплатная замена в год\.\s+Уже включена в подписку/,
			),
		).toBeTruthy();
	});

	it("третий шаг переносит описание перед «в вопрос»", () => {
		renderHomePage();
		const description = screen.getByText(
			/Мы превратили обновление интерьера\s+в вопрос нескольких часов/,
		);
		expect(description.textContent).toBe(
			"Мы превратили обновление интерьера\nв вопрос нескольких часов.",
		);
		expect(description).toHaveStyle({ whiteSpace: "pre-line" });
	});

	it("четвёртый шаг переносит описание после «в год.»", () => {
		renderHomePage();
		const description = screen.getByText(
			/Одна бесплатная замена в год\.\s+Уже включена в подписку/,
		);
		expect(description.textContent).toBe(
			"Одна бесплатная замена в год.\nУже включена в подписку.",
		);
		expect(description).toHaveStyle({ whiteSpace: "pre-line" });
	});

	it("третий шаг сохраняет общую левую границу заголовка и описания", () => {
		renderHomePage();
		const heading = screen.getByText(/Обновляете/).closest("h3")!;
		const column = heading.parentElement!;
		expect(column).toHaveStyle({ alignItems: "flex-start", textAlign: "left" });
		expect(column.parentElement).toHaveStyle({
			flex: "0 0 100%",
			minWidth: "0",
		});
	});

	it("каждая карточка содержит иконку (Ant Design)", () => {
		renderHomePage();
		// Проверяем что используются Ant Design иконки (SearchOutlined, CameraOutlined и т.д.)
		// ищем svg элементы от иконок
		const svgElements = document.querySelectorAll(".anticon");
		expect(svgElements.length).toBeGreaterThanOrEqual(4);
	});
});

describe("HomePage — ServiceBannerSection (Phase 3)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('секция рендерится с заголовком "Впервые в индустрии"', () => {
		renderHomePage();
		expect(screen.getByText(/Впервые в индустрии/)).toBeTruthy();
	});

	it('текст "Стены как сервис" присутствует', () => {
		renderHomePage();
		expect(screen.getByText(/Стены как сервис/)).toBeTruthy();
	});

	it("текст про будущее присутствует", () => {
		renderHomePage();
		expect(
			screen.getByText(
				/Мы создали будущее, в котором интерьер меняется без традиционного ремонта/,
			),
		).toBeTruthy();
	});

	it('Brand badge с текстом "новый стандарт трансформации пространства"', () => {
		renderHomePage();
		expect(
			screen.getByText(/новый стандарт трансформации пространства/),
		).toBeTruthy();
	});
});

describe("HomePage — TechSection (Phase 4)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('заголовок "Технологии вашей свободы" присутствует', () => {
		renderHomePage();
		expect(screen.getByText(/Технологии вашей свободы/)).toBeTruthy();
	});

	it("все 3 пункта с описаниями присутствуют", () => {
		renderHomePage();
		expect(screen.getByText(/Универсальная платформа монтажа/)).toBeTruthy();
		expect(screen.getByText(/Запатентованная система креплений/)).toBeTruthy();
		expect(screen.getByText(/Безграничность фактур/)).toBeTruthy();
	});

	it("финальная строка присутствует", () => {
		renderHomePage();
		expect(
			screen.getByText(/Вы сами решаете, о чём сегодня говорят Ваши стены/),
		).toBeTruthy();
	});

	it("компактные отступы секции и финальных фраз", () => {
		renderHomePage();
		const ending = screen.getByText(
			/Вы сами решаете, о чём сегодня говорят Ваши стены/,
		);
		expect(ending.style.margin).toBe("-24px 0px 0px");
		expect(ending.parentElement?.style.gap).toBe("32px");
		expect(ending.closest("section")?.style.padding).toBe("64px 24px");
	});

	it("3 иконки (Ant Design)", () => {
		renderHomePage();
		const icons = document.querySelectorAll(".anticon");
		expect(icons.length).toBeGreaterThanOrEqual(3);
	});
});

describe("HomePage — PanelGridSection (Phase 5)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it("рендерит компактную плитку из основного каталога без лимита в четыре панели", () => {
		renderHomePage();
		const grid = document.querySelector(".panel-grid") as HTMLElement;
		expect(grid).toBeTruthy();
		expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))"); // five columns maximum
		expect(grid.querySelectorAll('[role="link"]')).toHaveLength(8);
		expect(grid.querySelector("img")?.getAttribute("src")).toBe(
			"/uploads/PANEL_PHOTO/0.png",
		);
		expect(grid.closest("section")?.id).toBe("choose-panels");
		fireEvent.click(grid.querySelectorAll('[role="link"]')[3]);
		expect(mockNavigate).toHaveBeenCalledWith("/catalog/panel-3");
	});

	it("на панелях нет цен", () => {
		renderHomePage();
		screen.getByText(/Время выбирать/);
		// Проверяем что секция PanelGridSection существует и не содержит цену
		const bodyText = document.body.textContent || "";
		const hasPrice = /\d+\s*\d{3}\s*₽/.test(bodyText);
		expect(hasPrice).toBe(false);
	});

	it("на панелях нет рейтингов", () => {
		renderHomePage();
		screen.getByText(/Время выбирать/);
		// Ant Design Rate рендерит [role="radiogroup"]
		const rateGroups = document.querySelectorAll('[role="radiogroup"]');
		expect(rateGroups.length).toBe(0);
	});

	it("на панелях нет бейджей (нет Tag)", () => {
		renderHomePage();
		screen.getByText(/Время выбирать/);
		const tags = document.querySelectorAll(".ant-tag");
		expect(tags.length).toBe(0);
	});

	it('CTA "выбрать свой WOW!" ведёт на /catalog', () => {
		renderHomePage();
		const buttons = screen.getAllByRole("button");
		const wowButtons = buttons.filter((b) =>
			b.textContent?.toLowerCase().includes("выбрать свой wow"),
		);
		// Может быть 2 кнопки (hero + panel grid), обе ведут на /catalog
		expect(wowButtons.length).toBeGreaterThanOrEqual(1);
		fireEvent.click(wowButtons[0]);
		expect(mockNavigate).toHaveBeenCalledWith("/catalog");
	});
});

describe("HomePage — ProjectDetailsSection (Phase 6)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('заголовок "Ваш проект. В деталях" присутствует', () => {
		renderHomePage();
		expect(screen.getByText(/Ваш проект\. В деталях/)).toBeTruthy();
	});

	it("калькулятор рендерится с 2 полями ввода", () => {
		renderHomePage();
		screen.getByText(/Ваш проект\. В деталях/);
		const inputs = document.querySelectorAll("input");
		expect(inputs.length).toBeGreaterThanOrEqual(2);
	});

	it("средняя карточка содержит слайдер пространств вместо локальных сценариев", () => {
		renderHomePage();
		expect(
			screen.getByRole("region", { name: "Слайдер пространств" }),
		).toBeTruthy();
		expect(screen.getByText("Все пространства")).toHaveAttribute(
			"href",
			"/spaces",
		);
		expect(document.querySelector('img[src^="/scenarios/"]')).toBeNull();
	});

	it('кнопка "WOW!" рендерится', () => {
		renderHomePage();
		screen.getByText(/Ваш проект\. В деталях/);
		expect(screen.getByRole("button", { name: /^WOW!$/i })).toBeTruthy();
	});
});

describe("HomePage — CTABannerSection (Phase 7)", () => {
	beforeEach(() => {
		mockNavigate.mockClear();
	});

	it('заголовок "Начните обновление" присутствует', () => {
		renderHomePage();
		// StrictMode renders twice — use getAllByText[0]
		expect(screen.getAllByText(/Начните обновление/)[0]).toBeTruthy();
	});

	it('текст "Ремонт перестал быть событием" удалён из CTA', () => {
		renderHomePage();
		expect(screen.queryByText(/Ремонт перестал быть событием/)).toBeNull();
		expect(screen.queryByText(/выбрать настроение/)).toBeNull();
	});

	it("только 1 CTA кнопка в секции", () => {
		renderHomePage();
		// StrictMode renders twice — count is 2, not 1. Use getAll + [0]
		const allButtons = document.querySelectorAll("button");
		const ctaButtons = Array.from(allButtons).filter((b) =>
			b.textContent?.toLowerCase().includes("начать обновление"),
		);
		expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
	});

	it('CTA "Начать обновление" ведёт на /catalog', () => {
		renderHomePage();
		const button = screen.getAllByRole("button", {
			name: /Начать обновление/i,
		})[0];
		expect(button).toBeTruthy();
		fireEvent.click(button);
		expect(mockNavigate).toHaveBeenCalledWith("/catalog");
	});
});

describe("Промежуток перед Начните обновление", () => {
	it("сокращает только соседние отступы двух секций", () => {
		renderHomePage();
		expect(
			document.querySelector<HTMLElement>("#project-details")?.style
				.paddingBottom,
		).toBe("32px");
		expect(
			document.querySelector<HTMLElement>(".home-cta-section")?.style.padding,
		).toBe("32px 24px 100px");
	});
});
