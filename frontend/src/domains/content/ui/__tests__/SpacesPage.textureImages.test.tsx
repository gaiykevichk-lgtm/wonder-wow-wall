import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, waitFor, fireEvent } from "@testing-library/react";
import { invalidateSpaceCards, invalidateSpaceTextureImages, invalidateSpacesCache } from "../../model/spacesApi";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SpacesPage from "../SpacesPage";

/**
 * Страница «Пространства» берёт карточки из админской вкладки «Изображения»
 * (`/api/spaces/cards`): каждая строка вкладки — карточка с фото и текстами.
 * Старый путь через `/api/spaces/texture-images` остаётся запасным вариантом.
 */
const spacesJson = JSON.parse(
	readFileSync(path.resolve(process.cwd(), "public/content/spaces.json"), "utf8"),
);
const monoWood = spacesJson.find(
	(space: { category: string; mode: string; texture: string }) =>
		space.category === "home" && space.mode === "mono" && space.texture === "wood",
);

const mockFetch = vi.fn();

function stubManagedCards() {
	mockFetch.mockImplementation((url: string) => {
			const ok = (body: unknown) => Promise.resolve({ ok: true, json: async () => body });
			if (url.includes("/spaces/page")) return ok({ heading: "Время наполнять.", intro: "Текст" });
			if (url.includes("/spaces/cards"))
				return ok([
					{
						id: "card-1",
						mode: "mono",
						title: "Современная гостиная",
						subtitle: "Современный · Текстиль · моно",
						price: "от 196 460 ₽",
						area: "Стена 8.4 м²",
						image: "MISC/wood.jpg",
						textureId1: "tex-wood",
						textureId2: "tex-wood",
					},
				]);
			if (url.includes("/spaces/texture-images"))
				return ok([
					{ id: "img-1", textureId1: "tex-wood", textureId2: "tex-wood", image: "MISC/wood.jpg" },
				]);
			if (url.includes("/textures")) return ok([{ id: "tex-wood", name: "Дерево" }]);
			if (url.includes("/spaces")) return ok([monoWood]);
			return ok([]);
		});
}

function stubFallbackInteriors() {
	// Управляемые карточки недоступны — страница падает на старый каталог интерьеров.
	mockFetch.mockImplementation((url: string) => {
		const ok = (body: unknown) => Promise.resolve({ ok: true, json: async () => body });
		if (url.includes("/spaces/page")) return ok({ heading: "Время наполнять.", intro: "Текст" });
		if (url.includes("/spaces/cards")) return Promise.resolve({ ok: false, json: async () => [] });
		if (url.includes("/spaces/texture-images"))
			return ok([
				{ id: "img-1", textureId1: "tex-wood", textureId2: "tex-wood", image: "MISC/wood.jpg" },
			]);
		if (url.includes("/textures")) return ok([{ id: "tex-wood", name: "Дерево" }]);
		if (url.includes("/spaces")) return ok([monoWood]);
		return ok([]);
	});
}

beforeAll(() => {
	expect(monoWood, "фикстура: домашний моно-интерьер с фактурой «Дерево»").toBeTruthy();
	vi.stubGlobal("fetch", mockFetch);
});

function renderPage() {
	return render(
		<MemoryRouter initialEntries={["/spaces"]}>
			<Routes>
				<Route path="/spaces" element={<SpacesPage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("SpacesPage — фото из админской вкладки «Изображения»", () => {
	afterEach(() => {
		cleanup();
		invalidateSpacesCache();
		invalidateSpaceTextureImages();
		invalidateSpaceCards();
		mockFetch.mockReset();
	});
	it("карточка показывает фото и тексты из админской вкладки «Изображения»", async () => {
		stubManagedCards();
		const { container } = renderPage();
		await waitFor(() => expect(container.querySelector(".spaces-photo img")).toBeInTheDocument());
		// storage-relative путь админки проходит через imageSrc → /uploads/…
		await waitFor(() =>
			expect(container.querySelector(".spaces-photo img")).toHaveAttribute(
				"src",
				"/uploads/MISC/wood.jpg",
			),
		);
		expect(container.querySelector(".spaces-card h3")?.textContent).toBe(
			"Современная гостиная",
		);
		expect(container.querySelector(".spaces-card")?.textContent).toContain(
			"от 196 460 ₽",
		);
		expect(container.querySelector(".spaces-card")?.textContent).toContain("Стена 8.4 м²");
	});

	it("управляемые карточки не открывают старую модалку интерьеров", async () => {
		stubManagedCards();
		const { container } = renderPage();
		await waitFor(() => expect(container.querySelector(".spaces-photo img")).toBeInTheDocument());
		expect(document.querySelector(".spaces-fitting")).not.toBeInTheDocument();
	});

	it("запасной интерьер показывает фото фактуры из админки", async () => {
		stubFallbackInteriors();
		const { container } = renderPage();
		await waitFor(() => expect(container.querySelector(".spaces-photo")).toBeInTheDocument());
		fireEvent.click(container.querySelector(".spaces-photo")!);
		await waitFor(() =>
			expect(document.querySelector(".space-viewer-scene img")).toHaveAttribute(
				"src",
				"/uploads/MISC/wood.jpg",
			),
		);
		expect(document.querySelector(".space-render-notice")).toHaveTextContent("из админской вкладки");
	});

	it("карточки в рамке, кнопки не синие (стиль проекта)", () => {
		const css = readFileSync(
			path.resolve(process.cwd(), "src/domains/content/ui/SpacesPage.css"),
			"utf8",
		);
		expect(css).toMatch(/\.spaces-card\{[^}]*border:1px solid #e5e5e7/);
		expect(css).not.toContain("#0071e3");
		expect(css).toMatch(/\.spaces-primary\{[^}]*background:#2d2d2d/);
	});
});
