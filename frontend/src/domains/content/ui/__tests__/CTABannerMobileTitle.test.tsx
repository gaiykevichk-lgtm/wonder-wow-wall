import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CTABannerSection } from "../HomePage";

describe("CTABannerSection — мобильный заголовок", () => {
	it("разрешает перенос строки вместо обрезки краями карточки", () => {
		const { container } = render(
			<MemoryRouter>
				<CTABannerSection onCatalog={() => {}} />
			</MemoryRouter>,
		);

		const title = container.querySelector(".home-cta-title");
		expect(title?.textContent).toBe("Начните обновление.");

		const mobileCss = Array.from(container.querySelectorAll("style"))
			.map((node) => node.textContent ?? "")
			.join("\n");
		expect(mobileCss).toContain(".home-cta-title");
		expect(mobileCss).toContain("white-space: normal");
	});
});
