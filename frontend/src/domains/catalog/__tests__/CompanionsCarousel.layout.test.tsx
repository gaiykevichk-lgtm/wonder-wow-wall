import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	path.resolve(process.cwd(), "src/domains/catalog/ui/CompanionsCarousel.tsx"),
	"utf8",
);

describe("CompanionsCarousel — шаг прокрутки", () => {
	it("прокручивает карусель на ширину одной фактической карточки вместе с gap", () => {
		expect(source).toContain(
			"(firstCard?.getBoundingClientRect().width ?? 300) + gap",
		);
		expect(source).not.toContain("const scrollAmount = 300;");
	});
});
