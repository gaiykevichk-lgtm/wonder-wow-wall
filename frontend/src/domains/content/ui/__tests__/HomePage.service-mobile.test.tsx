import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ServiceBannerSection } from "../HomePage";

const homePageSource = readFileSync(
	path.resolve(process.cwd(), "src/domains/content/ui/HomePage.tsx"),
	"utf8",
);

describe("ServiceBannerSection — мобильная компоновка", () => {
	it("собирает преимущества в компактную одноколоночную секцию", () => {
		render(
			<MemoryRouter>
				<ServiceBannerSection />
			</MemoryRouter>,
		);

		expect(document.querySelectorAll(".home-service-card")).toHaveLength(2);
		expect(homePageSource).toContain(
			"grid-template-columns: minmax(0, 1fr) !important;",
		);
		expect(homePageSource).toContain("font-size: 24px;");
		expect(homePageSource).toContain(
			".home-service-signature { display: none !important; }",
		);
	});
});
