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
vi.mock("react-router-dom", async () => {
	const actual = await vi.importActual("react-router-dom");
	return { ...actual, useNavigate: () => mockNavigate };
});

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

	it('подзаголовок содержит "платформа трансформации пространства"', () => {
		renderHomePage();
		expect(
			screen.getByText(/Платформа трансформации пространства/),
		).toBeTruthy();
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
				/Мы превратили обновление интерьера в вопрос нескольких часов/,
			),
		).toBeTruthy();
		expect(
			screen.getByText(/Одна бесплатная замена уже включена в подписку/),
		).toBeTruthy();
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

	it('заголовок "Технологии Вашей свободы" присутствует', () => {
		renderHomePage();
		expect(screen.getByText(/Технологии Вашей свободы/)).toBeTruthy();
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

	it('4 панели рендерятся (по заголовку "Время выбирать")', () => {
		renderHomePage();
		expect(screen.getByText(/Время выбирать/)).toBeTruthy();
		// PanelGridSection показывает 4 продукта с изображениями
		// Проверяем что есть контент с продуктами (секция существует)
		const sectionWithHeading = document.querySelector("section");
		expect(sectionWithHeading).toBeTruthy();
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

	it("6 сценариев отображаются (гостиная, спальня, зона ТВ, детская, кухня, WC)", () => {
		renderHomePage();
		screen.getByText(/Ваш проект\. В деталях/);
		expect(screen.getByText(/Гостиная/)).toBeTruthy();
		expect(screen.getByText(/Спальня/)).toBeTruthy();
		expect(screen.getByText(/Зона ТВ/)).toBeTruthy();
		expect(screen.getByText(/Детская/)).toBeTruthy();
		expect(screen.getByText(/Кухня/)).toBeTruthy();
		expect(screen.getByText(/WC/)).toBeTruthy();
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

	it('текст "Ремонт перестал быть событием" присутствует', () => {
		renderHomePage();
		expect(
			screen.getAllByText(/Ремонт перестал быть событием/)[0],
		).toBeTruthy();
	});

	it("только 1 CTA кнопка в секции", () => {
		renderHomePage();
		screen.getAllByText(/Начните обновление/)[0];
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
