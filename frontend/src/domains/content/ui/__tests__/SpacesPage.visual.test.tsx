import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import SpacesPage from "../SpacesPage";

const spacesJson = JSON.parse(
	readFileSync(
		path.resolve(process.cwd(), "public/content/spaces.json"),
		"utf8",
	),
);
const spacesCss = readFileSync(
	path.resolve(process.cwd(), "src/domains/content/ui/SpacesPage.css"),
	"utf8",
);

// spacesApi грузит public/content/spaces.json через fetch — в jsdom подставляем мок.
// Управляемые карточки (/spaces/cards) в этих сценариях отсутствуют → страница
// работает на классических интерьерах.
beforeAll(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string) => {
			const ok = (body: unknown) =>
				Promise.resolve({ ok: true, json: async () => body });
			if (url.includes("/spaces/cards")) return ok([]);
			return ok(JSON.parse(JSON.stringify(spacesJson)));
		}),
	);
});

function LocationProbe() {
	const location = useLocation();
	return <div data-testid="loc">{location.pathname + location.search}</div>;
}

function renderAt(initialEntry: string) {
	return render(
		<MemoryRouter initialEntries={[initialEntry]}>
			<Routes>
				<Route path="/spaces" element={<SpacesPage />} />
				<Route path="/catalog/:panelId" element={<LocationProbe />} />
			</Routes>
			<LocationProbe />
		</MemoryRouter>,
	);
}

describe("Светлая структура каталога пространств", () => {
 it("living открывает гостиную, выбор фактуры не выдаёт исходное фото за новую отделку", async () => {
  const { container } = renderAt("/spaces?room=living&style=all");
  await waitFor(() => expect(container.querySelector(".spaces-photo")).toBeInTheDocument());
  fireEvent.click(container.querySelector(".spaces-photo")!);
  const picture = document.querySelector(".space-viewer-scene img")!;
  const originalSrc = picture.getAttribute("src");
  expect(picture.getAttribute("alt")).toContain("гостиная");
  const textures = document.querySelectorAll(".space-texture-group button");
  fireEvent.click(textures[1]);
  expect(textures[1]).toHaveAttribute("aria-pressed", "true");
  expect(picture).toHaveAttribute("src", originalSrc!);
  expect(picture.getAttribute("alt")).toContain("исходное фото");
  expect(document.querySelector(".space-render-notice")).toHaveTextContent("ещё нет фото в админке");
 });
 it("показывает hero без матрицы, информацию под фото и открывает светлый просмотр", async () => {
  const { container } = renderAt("/spaces");
  expect(screen.getByRole("heading", { level: 1, name: "Время наполнять." })).toBeInTheDocument();
  await waitFor(() => expect(container.querySelectorAll(".spaces-card").length).toBeGreaterThan(0));
  expect(container.querySelector(".spaces-hero canvas")).toBeNull();
  const card = container.querySelector(".spaces-card")!;
  expect(card.querySelector(".spaces-photo h3")).toBeNull();
  expect(card.querySelector(".spaces-card-copy h3")).toBeInTheDocument();
  fireEvent.click(card.querySelector(".spaces-photo")!);
  await waitFor(() => expect(document.querySelector(".spaces-fitting")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Моно" })).toBeInTheDocument();
 });
 it("разделяет мобильные фильтры на самостоятельные однострочные ленты", async () => {
  expect(spacesCss).toContain(".spaces-filter-row>.spaces-chip-group{flex:0 0 auto;flex-wrap:nowrap;min-width:max-content}");
  expect(spacesCss).toContain("overflow-x:auto");
  expect(spacesCss).toContain("white-space:nowrap");
  const { container } = renderAt("/spaces");
  await screen.findByRole("button", { name: "Все комнаты" });
  fireEvent.click(screen.getByRole("button", { name: "Гостиная" }));
  await waitFor(() =>
   expect(container.querySelectorAll(".spaces-filter-row")).toHaveLength(4),
  );
  const rows = container.querySelectorAll(".spaces-filter-row");
  expect(Array.from(rows).map((row) => row.querySelector(".spaces-filter-label")?.textContent)).toEqual([
   "Тип",
   "Зона",
   "Стиль",
   "Фактура",
  ]);
  for (const row of rows) {
   expect(row.querySelectorAll(":scope > .spaces-chip-group")).toHaveLength(1);
  }
 });
});
