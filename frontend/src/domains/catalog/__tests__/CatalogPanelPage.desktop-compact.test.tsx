import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
	path.resolve(process.cwd(), "src/domains/catalog/ui/CatalogPanelPage.tsx"),
	"utf8",
);

describe("CatalogPanelPage — компактная правая колонка на ПК", () => {
	it("уменьшает интервалы шагов только выше мобильного breakpoint", () => {
		expect(source).toContain("@media(min-width:981px){");
		expect(source).toContain(".panel-config-column{max-width:460px}");
		expect(source).toContain(
			".panel-config-step{padding:2px 0 12px;margin-bottom:10px}",
		);
		expect(source).toContain(
			".panel-config-step h2{margin-bottom:8px;font-size:18px}",
		);
		expect(source).toContain(
			".panel-picto-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px 4px;border:2px solid #d2d2d7;background:#fff;border-radius:12px;cursor:pointer;color:",
		);
		expect(source).toContain(".panel-buy-layout{padding-bottom:44px}");
		expect(source).toContain(
			"@media(min-width:981px){.panel-finish-step{padding-bottom:10px;margin-bottom:8px}}",
		);
		expect(source).toContain(
			"@media(max-width:640px){.panel-finish-step{padding-bottom:12px;margin-bottom:10px}.panel-finish-step .panel-finish-heading{margin-bottom:8px}}",
		);
		expect(source).toContain(
			".panel-companions-wide{max-width:1320px;margin:0 auto;padding:0 32px 40px}",
		);
		expect(source).toContain(
			".panel-companions-wide .panel-companions-inner{max-width:none !important;margin:0 !important}",
		);
		expect(source).toContain(
			".panel-companions-wide .panel-companions-track{gap:16px !important;overflow-x:hidden !important}",
		);
		expect(source).toContain(
			".panel-companions-wide .panel-companion-card{width:calc((100% - 48px)/4) !important;min-width:0}",
		);
	});
});
