import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Фаза 8 «Глобальные фирменные элементы»: логотип в шапке должен оставаться
// брендовым. Шрифт покрывается theme.test.ts (FONT_FAMILY) и index.css —
// здесь проверяется только сам знак и то, что шапка ссылается на него.

const logoSvg = readFileSync(
	path.resolve(process.cwd(), "public/www_logo.svg"),
	"utf8",
);
const headerSource = readFileSync(
	path.resolve(process.cwd(), "src/shared/ui/ShopHeader.tsx"),
	"utf8",
);

describe("brand identity — ShopHeader (Фаза 8)", () => {
	it("логотип использует брендовый зелёный", () => {
		expect(logoSvg.toUpperCase()).toContain("#229A34");
	});

	it("в шапке и мобильном drawer один и тот же файл логотипа", () => {
		const uses = headerSource.match(/src="\/www_logo\.svg"/g) ?? [];
		expect(uses).toHaveLength(2);
	});

	it("логотип не подменяется сторонним изображением", () => {
		const imgs = [...headerSource.matchAll(/<img\s*\n?\s*src="([^"]+)"/g)].map(
			(match) => match[1],
		);
		for (const src of imgs) {
			expect(src).toBe("/www_logo.svg");
		}
	});

	it("шапка не объявляет собственный шрифт — наследует брендовый", () => {
		expect(headerSource).not.toMatch(/fontFamily:/);
	});
});
