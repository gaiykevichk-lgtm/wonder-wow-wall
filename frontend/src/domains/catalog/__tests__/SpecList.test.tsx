import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpecList } from "../ui/SpecList";

// jsdom не поставляет `IntersectionObserver`, а framer-motion `whileInView`
// его требует. Такой же стаб, как в CatalogPage.test.tsx.
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

/**
 * Технические характеристики карточки товара.
 * Спецификация: docs/product-specs/PRODUCT-CARD.md §6 (PC-SPEC-001..011).
 */

const open = () =>
	fireEvent.click(screen.getByText("Технические характеристики"));

describe("SpecList", () => {
	it("список скрыт до клика", () => {
		render(<SpecList specs={[]} />);
		expect(screen.queryByText("Толщина")).not.toBeInTheDocument();
		open();
		expect(screen.getByText("Толщина")).toBeInTheDocument();
	});

	it("PC-SPEC-011 — всегда 6 обязательных параметров даже при пустых specs", () => {
		render(<SpecList specs={[]} />);
		open();
		for (const label of [
			"Размер панели",
			"Толщина",
			"Исполнение",
			"Система монтажа",
			"Основа",
			"Упаковка",
		]) {
			expect(screen.getByText(label)).toBeInTheDocument();
		}
		expect(screen.getByText("3 мм")).toBeInTheDocument();
		expect(
			screen.getByText("Запатентованная система быстрой замены"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Ультралёгкий композит высокой плотности"),
		).toBeInTheDocument();
	});

	it("PC-SPEC-001 — размер панели меняется вместе с выбором", () => {
		render(<SpecList specs={[]} panelSize="600x600" />);
		open();
		expect(screen.getByText("600×600 мм")).toBeInTheDocument();
	});

	it("PC-SPEC-006 — упаковка зависит от типоразмера", () => {
		const { unmount } = render(<SpecList specs={[]} panelSize="300x300" />);
		open();
		expect(screen.getByText("12 панелей – 1,08 м²")).toBeInTheDocument();
		unmount();

		render(<SpecList specs={[]} panelSize="300x600" />);
		open();
		expect(screen.getByText("6 панелей – 1,08 м²")).toBeInTheDocument();
	});

	it("PC-SPEC-006 — 600×600 даёт 4 панели и 1,44 м²", () => {
		render(<SpecList specs={[]} panelSize="600x600" />);
		open();
		expect(screen.getByText("4 панели – 1,44 м²")).toBeInTheDocument();
	});

	it("PC-SPEC-003 — исполнение зависит от текстуры: кожа", () => {
		render(<SpecList specs={[]} execution="кожа" />);
		open();
		expect(screen.getByText("Интерьерная кожа")).toBeInTheDocument();
	});

	it("PC-SPEC-003 — исполнение зависит от текстуры: ткань", () => {
		render(<SpecList specs={[]} execution="ткань" />);
		open();
		expect(screen.getByText("Интерьерная ткань")).toBeInTheDocument();
	});

	it("без текстуры исполнение — архитектурное покрытие по умолчанию", () => {
		render(<SpecList specs={[]} />);
		open();
		expect(
			screen.getByText("Архитектурное декоративное покрытие"),
		).toBeInTheDocument();
	});

	it("значения из товара перекрывают дефолты", () => {
		render(<SpecList specs={[{ label: "Толщина", value: "5 мм" }]} />);
		open();
		expect(screen.getByText("5 мм")).toBeInTheDocument();
		expect(screen.queryByText("3 мм")).not.toBeInTheDocument();
	});

	it("дополнительные параметры товара не теряются", () => {
		render(<SpecList specs={[{ label: "Уход", value: "Влажная уборка" }]} />);
		open();
		expect(screen.getByText("Уход")).toBeInTheDocument();
		expect(screen.getByText("Влажная уборка")).toBeInTheDocument();
		// и обязательные при этом на месте
		expect(screen.getByText("Основа")).toBeInTheDocument();
	});
});
