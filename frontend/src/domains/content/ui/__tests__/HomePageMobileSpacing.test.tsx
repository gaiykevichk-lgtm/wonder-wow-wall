import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ServiceBannerSection } from "../HomePage";

describe("ServiceBannerSection — мобильный заголовок", () => {
	it("сохраняет пробел между фразами при скрытом переносе", () => {
		const { container } = render(<MemoryRouter><ServiceBannerSection /></MemoryRouter>);
		const title = container.querySelector(".home-service-card-title");
		expect(title?.textContent).toBe("Ваш смартфон Ваш дизайнер");
	});
});
