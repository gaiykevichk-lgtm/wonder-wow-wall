import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PanelPreviewGallery } from "../ui/PanelPreviewGallery";
vi.mock("framer-motion", () => ({
	useReducedMotion: () => true,
}));
const base = { id: "base", url: "/base.jpg", title: "Базовая панель" };
const interior = { id: "interior", url: "/interior.jpg", title: "Интерьер" };
describe("PanelPreviewGallery", () => {
	it("сразу показывает выбранную фактуру и сохраняет её после появления интерьера", () => {
		const { rerender } = render(<PanelPreviewGallery slides={[base, interior]} initialId="interior" />);
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute("data-active-slide", "interior");
		rerender(<PanelPreviewGallery slides={[base, interior, { id: "new", url: "/new.jpg", title: "Ещё интерьер" }]} initialId="interior" />);
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute("data-active-slide", "interior");
		rerender(<PanelPreviewGallery slides={[base, interior]} initialId="base" />);
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute("data-active-slide", "base");
	});
	it("показывает hover-кадр, не меняя выбранный слайд", () => {
		const { rerender } = render(
			<PanelPreviewGallery slides={[base, interior]} initialId="base" />,
		);
		expect(screen.getByAltText("Базовая панель")).toBeTruthy();
		rerender(
			<PanelPreviewGallery
				slides={[base, interior]}
				initialId="base"
				hoverId="interior"
			/>,
		);
		expect(screen.getByAltText("Интерьер")).toBeTruthy();
		expect(document.querySelector("[data-active-slide]")).toHaveAttribute(
			"data-active-slide",
			"base",
		);
	});

	it("объявляет новые слайды и листает кнопками, клавиатурой и свайпом", () => {
		const { rerender } = render(<PanelPreviewGallery slides={[base]} />);
		expect(screen.queryByRole("status")).toBeNull();
		rerender(<PanelPreviewGallery slides={[base, interior]} />);
		expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
		const previousButton = screen.getByRole("button", {
			name: "Предыдущий слайд",
		});
		const nextButton = screen.getByRole("button", {
			name: "Следующий слайд",
		});
		expect(previousButton).toHaveTextContent("");
		expect(nextButton).toHaveTextContent("");
		expect(previousButton.querySelector("svg")).toBeTruthy();
		expect(nextButton.querySelector("svg")).toBeTruthy();
		fireEvent.click(nextButton);
		expect(screen.getByAltText("Интерьер")).toHaveAttribute("src", "/interior.jpg");
		fireEvent.keyDown(screen.getByRole("region"), { key: "ArrowLeft" });
		expect(screen.getByAltText("Базовая панель")).toBeTruthy();
		fireEvent.touchStart(screen.getByRole("region"), { touches: [{ clientX: 200 }] });
		fireEvent.touchEnd(screen.getByRole("region"), { changedTouches: [{ clientX: 80 }] });
		expect(screen.getByAltText("Интерьер")).toBeTruthy();
		rerender(<PanelPreviewGallery slides={[base]} />);
		expect(screen.getByAltText("Базовая панель")).toBeTruthy();
	});
});
