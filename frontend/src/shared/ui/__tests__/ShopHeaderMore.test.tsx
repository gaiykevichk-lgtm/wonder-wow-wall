import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ConfigProvider } from "antd";
import { ShopHeader } from "../ShopHeader";

function CurrentPath() {
	const location = useLocation();
	return <span data-testid="current-path">{location.pathname}</span>;
}

describe("ShopHeader — меню «Ещё»", () => {
	it("открывает меню нажатием и остаётся на текущей странице", () => {
		render(
			<MemoryRouter initialEntries={["/configurator"]}>
				<ConfigProvider>
					<ShopHeader />
					<CurrentPath />
				</ConfigProvider>
			</MemoryRouter>,
		);
		const more = screen.getByRole("button", { name: "Ещё" });
		fireEvent.click(more);
		expect(more.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByTestId("current-path").textContent).toBe("/configurator");
	});
});
