import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SpacesPage from "../SpacesPage";

const spacesJson = JSON.parse(
	readFileSync(
		path.resolve(process.cwd(), "public/content/spaces.json"),
		"utf8",
	),
);

// spacesApi грузит public/content/spaces.json через fetch — в jsdom подставляем мок.
// Публичные карточки в этих сценариях отсутствуют → страница работает
// на классических интерьерах.
beforeAll(() => {
	const viFn = vi.fn((url: string) => {
		const ok = (body: unknown) =>
			Promise.resolve({ ok: true, json: async () => body });
		if (url.includes("/spaces/cards")) {
			return ok([
				{
					id: "space-card",
					mode: "mono",
					title: "Гостиничный интерьер",
					subtitle: "Панель",
					price: "",
					area: "",
					category: "home",
					projectAddress: "living",
					image: "MISC/photo.png",
					images: ["MISC/photo.png"],
					textureId1: "texture",
					textureId2: "texture",
					panelFamily1: "untrusted-slug",
					panelFamily2: "untrusted-slug",
					executionVariantId: "target-variant",
				},
			]);
		}
		if (url.includes("/panel-variants")) {
			return ok([
				{
					id: "target-variant",
					panel_id: "target-panel-id",
					panel_name: "Панель для карточки",
					panel_size: "30×30 см",
					texture_id: "target-texture",
					texture_name: "Дерево",
					name: "Вариант",
					color_id: null,
					color_hex: null,
					image_paths: [],
					sort_order: 0,
					is_active: true,
				},
			]);
		}
		if (url.includes("/panels")) {
			return ok({
				items: [
					{
						id: "target-panel-id",
						name: "Панель для карточки",
						slug: "panel-route-slug",
						width_mm: 300,
						height_mm: 300,
						size_label: "300×300 мм",
						base_price: 100,
						description: "",
						photo_path: "",
						photo_paths: [],
						form_preview_path: "",
						is_active: true,
					},
				],
				total: 1,
			});
		}
		return ok(JSON.parse(JSON.stringify(spacesJson)));
	});
	vi.stubGlobal("fetch", viFn);
});

function LocationProbe() {
	const location = useLocation();
	return <div data-testid="loc">{location.pathname + location.search}</div>;
}

function renderAt(initialEntry: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<MemoryRouter initialEntries={[initialEntry]}>
				<Routes>
					<Route path="/spaces" element={<SpacesPage />} />
					<Route path="/catalog/:panelId" element={<LocationProbe />} />
				</Routes>
				<LocationProbe />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

describe("SpacesPage (ТЗ 06)", () => {
	it("восстанавливает назначение и тип помещения из URL", async () => {
		renderAt("/spaces?cat=business&room=hotel");
		const hotelCard = await screen.findByRole("heading", {
			name: "Лобби бутик-отеля с акцентными панелями",
		});
		expect(hotelCard).toBeInTheDocument();
		const hotelChip = screen.getByRole("button", { name: "Отель" });
		expect(hotelChip).toHaveAttribute("aria-pressed", "true");
		const homeChip = screen.getByRole("button", { name: "Для дома" });
		expect(homeChip).toHaveAttribute("aria-pressed", "false");
	});

	it("смена назначения сбрасывает зависимые типы и зоны в URL", async () => {
		renderAt("/spaces?cat=business&room=hotel");
		await screen.findByRole("heading", {
			name: "Лобби бутик-отеля с акцентными панелями",
		});
		fireEvent.click(screen.getByRole("button", { name: "Для дома" }));
		await waitFor(() => {
			const probes = screen.getAllByTestId("loc");
			expect(probes[0].textContent).toContain("cat=home");
			expect(probes[0].textContent).not.toContain("room=hotel");
		});
		// Зависимый фильтр типов теперь домашний.
		expect(
			screen.getByRole("button", { name: "Гостиная" }),
		).toBeInTheDocument();
	});

	it("пустая комбинация даёт сообщение и сброс без перезагрузки", async () => {
		renderAt("/spaces?cat=social&style=loft");
		const emptyTitle = await screen.findByText(
			"В этой комбинации пока нет интерьеров",
		);
		expect(emptyTitle).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
		expect(
			await screen.findByRole("heading", {
				name: "Рекреация и холл образовательного центра",
			}),
		).toBeInTheDocument();
	});

	it("смена фактуры сохраняет сцену, CTA передаёт interiorId и variantId", async () => {
		renderAt("/spaces");
		const firstDress = (
			await screen.findAllByRole("button", { name: /Переодеть фактуры/ })
		)[0];
		fireEvent.click(firstDress);

		const secondTexture = await screen.findByRole("button", {
			name: /Серый сланец/,
		});
		fireEvent.click(secondTexture);

		// SPC-08: изображение сцены не меняется при смене фактуры.
		const sceneImg = document.querySelector(
			".ant-modal-body img",
		) as HTMLImageElement;
		expect(sceneImg).not.toBeNull();
		expect(sceneImg.getAttribute("src")).toContain("зона_тв.jpg");

		// SPC-07: быстрая смена панели + контекстный переход в карточку.
		fireEvent.click(screen.getByRole("button", { name: "ДЕМО 1" }));
		fireEvent.click(
			screen.getByRole("button", { name: /Перейти в карточку панели/ }),
		);
		await waitFor(() => {
			const probes = screen.getAllByTestId("loc");
			const navigated = probes.find((probe) =>
				probe.textContent?.startsWith("/catalog/"),
			);
			expect(navigated?.textContent).toContain("/catalog/bbe26910-6690-4f72-8878-3a8d02b6bb88");
			expect(navigated?.textContent).toContain("interiorId=home-living-tv-1");
			expect(navigated?.textContent).toContain("variantId=stone-1");
		});
	});

	it("не предлагает тип помещения без единой сцены (приёмка ТЗ 06)", async () => {
		renderAt("/spaces?cat=business");
		await screen.findByRole("heading", {
			name: "Переговорная и представительская зона офиса",
		});
		// Ресторан есть в иерархии источника (SPC-03), но реальной сцены в
		// проекте нет — ТЗ запрещает выдуманные фото, поэтому чип скрыт.
		expect(
			screen.queryByRole("button", { name: "Ресторан" }),
		).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Офис" })).toBeInTheDocument();
	});

	it("заведомо пустой room из URL не ломает ленту", async () => {
		renderAt("/spaces?cat=business&room=restaurant");
		// Считаем «все типы» вместо гарантированно пустого результата.
		expect(
			await screen.findByRole("heading", {
				name: "Переговорная и представительская зона офиса",
			}),
		).toBeInTheDocument();
	});

	it("карточка показывает тип решения и цену (SPC-06/SPC-10)", async () => {
		renderAt("/spaces?cat=home");
		const card = await screen.findByRole("heading", {
			name: "Современная гостиная с акцентной ТВ-зоной",
		});
		const article = card.closest("article.group") as HTMLElement;
		expect(article.textContent).toMatch(/комбинация/);
		expect(article.textContent).toMatch(/от [\d\s\u00a0]+ ₽/);
	});

	it("модалка открывается в «родном» режиме интерьера (SPC-06)", async () => {
		renderAt("/spaces?cat=home");
		const dress = (
			await screen.findAllByRole("button", { name: /Переодеть фактуры/ })
		)[0];
		fireEvent.click(dress);
		const combinedBtn = await screen.findByRole("button", {
			name: "Комбинация",
		});
		// home-living-tv-1 в данных — комбинированное решение.
		expect(combinedBtn).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Моно" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("переключение режима меняет схему раскладки, а не только подпись (SPC-07)", async () => {
		renderAt("/spaces?cat=home");
		const dress = (
			await screen.findAllByRole("button", { name: /Переодеть фактуры/ })
		)[0];
		fireEvent.click(dress);

		const scheme = () =>
			document.querySelector('[aria-label^="Схема раскладки"]') as HTMLElement;
		expect(scheme()).not.toBeNull();
		const combinedLabel = scheme().getAttribute("aria-label") || "";
		expect(combinedLabel).toContain("комбинация");

		fireEvent.click(screen.getByRole("button", { name: "Моно" }));
		await waitFor(() => {
			const monoLabel = scheme().getAttribute("aria-label") || "";
			expect(monoLabel).toContain("моно");
			expect(monoLabel).not.toBe(combinedLabel);
		});
	});

	it("смена фактуры меняет схему раскладки (отклик интерфейса)", async () => {
		renderAt("/spaces?cat=home");
		const dress = (
			await screen.findAllByRole("button", { name: /Переодеть фактуры/ })
		)[0];
		fireEvent.click(dress);
		// Моно, чтобы в подписи схемы было имя активной фактуры.
		fireEvent.click(screen.getByRole("button", { name: "Моно" }));

		const scheme = () =>
			document.querySelector('[aria-label^="Схема раскладки"]') as HTMLElement;
		const before = scheme().getAttribute("aria-label") || "";
		expect(before).toContain("Дуб натуральный");

		fireEvent.click(
			await screen.findByRole("button", { name: /Серый сланец/ }),
		);
		await waitFor(() => {
			expect(scheme().getAttribute("aria-label")).toContain("Серый сланец");
		});
		expect(scheme().getAttribute("aria-label")).not.toBe(before);
	});
});
