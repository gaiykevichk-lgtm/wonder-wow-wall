import { act, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ScrollToTop } from "../ScrollToTop";

function RouteControls() {
	const navigate = useNavigate();
	return (
		<>
			<button type="button" onClick={() => navigate("/catalog/panel-1")}>Товар</button>
			<button type="button" onClick={() => navigate("/catalog?size=30x30")}>Фильтр</button>
		</>
	);
}

describe("ScrollToTop", () => {
	const scrollTo = vi.fn();

	beforeEach(() => {
		scrollTo.mockReset();
		vi.stubGlobal("scrollTo", scrollTo);
	});

	it("scrolls to the document top when a product route opens", () => {
		render(
			<MemoryRouter initialEntries={["/catalog"]}>
				<ScrollToTop />
				<RouteControls />
			</MemoryRouter>,
		);
		scrollTo.mockClear();

		act(() => {
			document.querySelector<HTMLButtonElement>("button")?.click();
		});

		expect(scrollTo).toHaveBeenCalledOnce();
		expect(scrollTo).toHaveBeenCalledWith({
			top: 0,
			left: 0,
			behavior: "auto",
		});
	});

	it("does not reset scrolling when only catalog filters change", () => {
		render(
			<MemoryRouter initialEntries={["/catalog"]}>
				<ScrollToTop />
				<RouteControls />
			</MemoryRouter>,
		);
		scrollTo.mockClear();

		act(() => {
			document.querySelectorAll<HTMLButtonElement>("button")[1]?.click();
		});

		expect(scrollTo).not.toHaveBeenCalled();
	});
});
