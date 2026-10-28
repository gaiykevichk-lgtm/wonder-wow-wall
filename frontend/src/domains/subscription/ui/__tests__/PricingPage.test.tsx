import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PricingPage from "../PricingPage";

vi.mock("../../../../shared/api/shopApi", () => ({
	useShopSettings: () => ({ designOverlayPrice: 0 }),
	useSubscriptionPlansList: () => [],
}));

describe("PricingPage", () => {
	it("splits benefit headlines into two lines and starts each description sentence on a new line", () => {
		const { container } = render(<MemoryRouter><PricingPage /></MemoryRouter>);
		const headings = ["Свобода действий.", "Свобода решений.", "Свобода владения."];
		for (const title of headings) {
			const heading = screen.getByRole("heading", { name: new RegExp(title.replace(".", "\\.")) });
			expect(heading.querySelectorAll("span")).toHaveLength(2);
			expect(Array.from(heading.querySelectorAll("span")).every((line) => line.style.display === "block")).toBe(true);
		}
		const benefitGrid = container.querySelector(".benefits-grid");
		expect(benefitGrid?.querySelectorAll("h3 + p")).toHaveLength(3);
		expect(benefitGrid?.querySelectorAll("h3 + p span")).toHaveLength(8);
		expect(Array.from(benefitGrid?.querySelectorAll("h3 + p span") ?? []).every((line) => (line as HTMLElement).style.display === "block")).toBe(true);
	});

	it("shows the same selected background video as the homepage behind the subscription heading", () => {
		(window as Window & { __heroIdx?: number }).__heroIdx = 1;
		render(<MemoryRouter><PricingPage /></MemoryRouter>);
		const heading = screen.getByRole("heading", { name: "Свобода обновления. Стены как сервис." });
		const hero = heading.closest("section");
		const video = hero?.querySelector("video");
		expect(video?.autoplay).toBe(true);
		expect(video?.muted).toBe(true);
		expect(video?.loop).toBe(true);
		expect(video?.querySelector('source[src="/herovideo/IMG_6431.MP4"]')).not.toBeNull();
		expect(hero?.textContent).toContain("WONDER WOW WALL меняет философию владения интерьером");
	});

	it("presents the investment message as a single styled quote", () => {
		const { container } = render(<MemoryRouter><PricingPage /></MemoryRouter>);
		const section = screen.getByRole("region", { name: "Философия подписки" });
		const quote = section.querySelector("blockquote");
		expect(quote).not.toBeNull();
		expect(quote?.textContent).toBe("Вы инвестируете только в свои ощущения от пространства и возможность менять его по первому желанию");
		expect(quote?.querySelector("p")?.style.fontFamily).toContain("SF Pro Display");
		expect(container.querySelectorAll('section[aria-label="Философия подписки"]')).toHaveLength(1);
	});

	it("does not render the transparent pricing section but keeps the plans", () => {
		render(<MemoryRouter><PricingPage /></MemoryRouter>);
		expect(screen.queryByRole("heading", { name: "Прозрачное ценообразование" })).not.toBeInTheDocument();
		expect(screen.queryByText("Базовая панель:")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { name: "Выберите свой план" })).toBeInTheDocument();
	});
});
