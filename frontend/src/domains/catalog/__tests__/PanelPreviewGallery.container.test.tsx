import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
	path.resolve(process.cwd(), "src/domains/catalog/ui/PanelPreviewGallery.css"),
	"utf8",
);

describe("PanelPreviewGallery — контейнер превью", () => {
	it("показывает квадратное превью без серой рамки и служебного отступа", () => {
		expect(css).toContain("aspect-ratio: 1 / 1;");
		expect(css).toContain(
			".panel-page .panel-visual-column > .panel-main-image {\n\tbackground: transparent;",
		);
		expect(css).toContain(
			".panel-slide-gallery .panel-squeeze-strip {\n\tinset: 0;",
		);
		expect(css).toContain(
			".panel-slide-gallery .panel-squeeze-main {\n\tbackground: transparent;",
		);
	});

	it("не трансформирует основное фото при hover или focus", () => {
		expect(css).not.toContain("perspective(1100px)");
		expect(css).not.toContain("rotateY(-3deg)");
		expect(css).not.toContain(".panel-slide-gallery:hover .panel-slide-image");
	});
});
