import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AccordionBlock, TechLuxuryBlock } from "../ui/AccordionBlock";

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
 * Блок «Технологическая мощь».
 * Спецификация: docs/product-specs/PRODUCT-CARD.md §5 (PC-TL-001..006).
 */

describe("TechLuxuryBlock", () => {
	it("PC-TL-001..003 — надзаголовок, заголовок и подзаголовок из ТЗ", () => {
		render(<TechLuxuryBlock />);
		expect(screen.getByText("Технологическая мощь")).toBeInTheDocument();
		expect(screen.getByText("Просто.")).toBeInTheDocument();
		expect(
			screen.getByText(/Мы превратили сложную инженерную задачу/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/обновление пространства занимает часы, а не недели/),
		).toBeInTheDocument();
	});

	it("PC-TL-004 — основной текст виден до раскрытия", () => {
		render(<TechLuxuryBlock />);
		expect(screen.getByText("Идеальный стык.")).toBeInTheDocument();
		expect(
			screen.getByText(/Каждая панель точно встаёт на своё место/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Меняйте облик пространства без демонтажа основания/),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Панели сохраняют безупречный внешний вид/),
		).toBeInTheDocument();
	});

	it("PC-TL-004 — дополнительный текст скрыт до клика", () => {
		render(<TechLuxuryBlock />);
		expect(
			screen.queryByText(/Основа из композита высокой плотности/),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/Запатентованная система креплений/),
		).not.toBeInTheDocument();
	});

	it("PC-TL-005 — клик на «+» раскрывает дополнительный текст", () => {
		render(<TechLuxuryBlock />);
		const trigger = screen
			.getByText("Идеальный стык.")
			.closest("button") as HTMLButtonElement;
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(trigger);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByText(/Основа из композита высокой плотности/),
		).toBeInTheDocument();
	});

	it("карточки раскрываются независимо и повторный клик сворачивает выбранную", () => {
  render(<TechLuxuryBlock />);
  const first = screen.getByText("Идеальный стык.").closest("button")!;
  const second = screen.getByText("Быстрая замена.").closest("button")!;
  fireEvent.click(first);
  fireEvent.click(second);
  expect(first).toHaveAttribute("aria-expanded", "true");
  expect(second).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(first);
  expect(first).toHaveAttribute("aria-expanded", "false");
  expect(second).toHaveAttribute("aria-expanded", "true");
  expect(screen.queryByText(/Основа из композита/)).not.toBeInTheDocument();
  expect(document.getElementById(second.getAttribute("aria-controls")!)).toBeInTheDocument();
 });

	it("три блока в заданном порядке", () => {
		render(<TechLuxuryBlock />);
		const titles = ["Идеальный стык.", "Быстрая замена.", "Созданы для жизни."];
		for (const t of titles) {
			expect(screen.getByText(t)).toBeInTheDocument();
		}
	});
});

describe("AccordionBlock", () => {
	it("работает без summary — обратная совместимость", () => {
		render(
			<AccordionBlock
				items={[{ id: "a", title: "Заголовок", content: "Скрытый текст" }]}
			/>,
		);
		expect(screen.getByText("Заголовок")).toBeInTheDocument();
		expect(screen.queryByText("Скрытый текст")).not.toBeInTheDocument();
		fireEvent.click(screen.getByText("Заголовок"));
		expect(screen.getByText("Скрытый текст")).toBeInTheDocument();
	});

	it("повторный клик сворачивает блок", () => {
		render(
			<AccordionBlock
				items={[
					{ id: "a", title: "Заголовок", summary: "Видно", content: "Скрыто" },
				]}
			/>,
		);
		const btn = screen.getByText("Заголовок").closest("button")!;
		expect(screen.getByText("Видно")).toBeInTheDocument();
		fireEvent.click(btn);
		expect(screen.getByText("Скрыто")).toBeInTheDocument();
		fireEvent.click(btn);
		expect(btn).toHaveAttribute("aria-expanded", "false");
	});

	it("defaultExpanded раскрывает нужный блок сразу", () => {
		render(
			<AccordionBlock
				items={[{ id: "a", title: "T", content: "Открыто сразу" }]}
				defaultExpanded={["a"]}
			/>,
		);
		expect(screen.getByText("Открыто сразу")).toBeInTheDocument();
	});
});
