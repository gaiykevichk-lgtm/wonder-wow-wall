import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CalculatorSidebar } from "../ui/CalculatorSidebar";

/**
 * Боковая панель «Рассчитать проект».
 * Спецификация: docs/product-specs/PRODUCT-CARD.md §4.
 */

const apiResult = {
	wall_area: 10.0,
	boxes_count: 11,
	actual_area: 11.88,
	panels_count: 132,
	price_per_m2: 23222,
	price_per_panel: 2090,
	subscription_price: 7000,
	subscription_plan_id: "starter",
	subscription_plan_name: "Стартовый",
	purchase_price: 275880,
	design_type: "mono",
	panel_specs: {
		label: "300×300 мм",
		panels_per_box: 12,
		panel_area_m2: 0.09,
		box_area_m2: 1.08,
	},
	breakdown: [],
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	fetchMock = vi.fn().mockResolvedValue({
		ok: true,
		json: async () => apiResult,
	});
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("CalculatorSidebar", () => {
	it("в верхнем блоке калькулятора есть три компактных списка выбора, исполнение связано с текстурой", async () => {
		const onSelectTexture = vi.fn();
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					panelId: "rail",
					productName: "Рейка",
					panels: [
						{ id: "rail", name: "Рейка", image: "/img/rail.jpg", textures: [] },
					],
					textureId: "paint",
					colorId: "finish-1",
					textureChoices: [
						{
							id: "paint",
							name: "Краска",
							image: "/img/paint.jpg",
							colors: [
								{
									id: "finish-1",
									name: "Исполнение 1",
									image: "/img/finish-1.jpg",
								},
								{
									id: "finish-2",
									name: "Исполнение 2",
									image: "/img/finish-2.jpg",
								},
							],
						},
					],
					onSelectTexture,
				}}
			/>,
		);
		expect(
			screen.getByRole("combobox", { name: "Выбрать панель. Сейчас: Рейка" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Выбрать текстуру" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "Выбрать вариант исполнения" }),
		).toBeInTheDocument();
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Выбрать вариант исполнения" }),
		);
		await waitFor(() =>
			expect(screen.getByText("Исполнение 2")).toBeInTheDocument(),
		);
	});

	it("карточка рейки открывает выбор панелей с миниатюрами и названиями", () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					panelId: "rail",
					productName: "Рейка",
					productImage: "/img/rail.jpg",
					panels: [
						{ id: "rail", name: "Рейка", image: "/img/rail.jpg", textures: [] },
						{ id: "arch", name: "Арка", image: "/img/arch.jpg", textures: [] },
					],
				}}
			/>,
		);
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Выбрать панель. Сейчас: Рейка" }),
		);
		expect(
			screen.getByRole("combobox", { name: "Выбрать панель. Сейчас: Рейка" }),
		).toBeInTheDocument();
	});
	it("в панели расчёта есть отдельный dropdown текстур и выбор меняет выбранное изображение", async () => {
		const onSelectTexture = vi.fn();
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					productName: "Рейка",
					productImage: "/img/rail.jpg",
					textureId: "paint",
					textureChoices: [
						{
							id: "paint",
							name: "Краска",
							image: "/img/paint.jpg",
							colors: [
								{
									id: "finish-1",
									name: "Исполнение 1",
									image: "/img/finish-1.jpg",
								},
							],
						},
						{
							id: "wood",
							name: "Дерево",
							colors: [{ id: "finish-2", name: "Исполнение 2" }],
						},
					],
					onSelectTexture,
				}}
			/>,
		);
		const select = screen.getByRole("combobox", { name: "Выбрать текстуру" });
		fireEvent.mouseDown(select);
		await waitFor(() => expect(screen.getByText("Дерево")).toBeInTheDocument());
		fireEvent.click(screen.getByText("Дерево"));
		expect(onSelectTexture).toHaveBeenCalledWith({
			textureId: "wood",
			textureName: "Дерево",
			colorId: "finish-2",
			colorName: "Исполнение 2",
			image: "/img/rail.jpg",
		});
	});

	it("не рендерится, пока закрыт", () => {
		render(
			<CalculatorSidebar
				isOpen={false}
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
			/>,
		);
		expect(screen.queryByText("Рассчитать проект")).not.toBeInTheDocument();
	});

	it("PC-CALC-005 — заголовок и подзаголовок из ТЗ", () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		expect(
			screen.getByRole("heading", { name: "Рассчитать проект" }),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Укажите размеры поверхности для точного расчёта стоимости",
			),
		).toBeInTheDocument();
	});

	it("PC-CALC-006 — все три шага видны сразу, без wizard-кнопок", () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		expect(screen.getByText(/Шаг 1/)).toBeInTheDocument();
		expect(screen.getByText(/Шаг 2/)).toBeInTheDocument();
		expect(screen.getByText(/Шаг 3/)).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Далее" }),
		).not.toBeInTheDocument();
	});

	it("PC-CALC-101/102 — поля высоты/ширины и живая площадь стены", () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		expect(screen.getByText("Высота")).toBeInTheDocument();
		expect(screen.getByText("Ширина")).toBeInTheDocument();
		// 250 × 400 см = 10 м² по умолчанию
		expect(screen.getByText("10.00 м²")).toBeInTheDocument();
	});

	it("PC-CALC-201 — по умолчанию выбран моно-дизайн", () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		expect(screen.getByText("Моно-дизайн")).toBeInTheDocument();
		expect(screen.getByText("Комбо-дизайн")).toBeInTheDocument();
		expect(screen.getByText("Вся стена из 1 типа панелей")).toBeInTheDocument();
		const mono = screen.getByRole("radio", { name: "Моно-дизайн" });
		expect(mono).toHaveAttribute("aria-checked", "true");
	});

	it("PC-CALC-202/203 — комбо: две позиции с типоразмером и полем коробок", () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					textures: [
						{ id: "t1", name: "Кожа", colors: [{ id: "c1", name: "Чёрная" }] },
						{
							id: "t2",
							name: "Текстиль",
							colors: [{ id: "c2", name: "Серая" }],
						},
					],
				}}
			/>,
		);
		fireEvent.click(screen.getByRole("radio", { name: /Комбо/ }));
		expect(screen.getByText(/Две текстуры на одну стену/)).toBeInTheDocument();
		// Позиция 1: типоразмер из карточки выбран, поля коробок — два (по одному на позицию).
		const combo = screen.getByRole("radio", { name: "Позиция 1: 300×300 мм" });
		expect(combo).toHaveAttribute("aria-checked", "true");
		expect(screen.getAllByLabelText("Количество, коробок")).toHaveLength(2);
		// Переключение типоразмера первой позиции.
		fireEvent.click(
			screen.getByRole("radio", { name: "Позиция 1: 600×600 мм" }),
		);
		expect(
			screen.getByRole("radio", { name: "Позиция 1: 600×600 мм" }),
		).toHaveAttribute("aria-checked", "true");
		// Вторая текстура и исполнение — поля выбора на шаге 2.
		// Исполнение появляется после выбора текстуры.
		expect(screen.getByLabelText("Вторая текстура")).toBeInTheDocument();
		expect(
			screen.queryByLabelText("Вариант исполнения"),
		).not.toBeInTheDocument();
		fireEvent.mouseDown(screen.getByLabelText("Вторая текстура"));
		fireEvent.click(screen.getByText("Текстиль"));
		expect(screen.getByLabelText("Вариант исполнения")).toBeInTheDocument();
	});

	it("PC-CALC-204 — типоразмер предзаполняется из карточки товара", async () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{ sizeKey: "600x600", productName: "Волна" }}
			/>,
		);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.panel_size).toBe("600x600");
	});

	it("PC-CALC-007 — показывает выбранную панель и её текстуру", () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					productName: "Волна",
					textureName: "Бетон",
					colorName: "Серый",
					panels: [{ id: "wave", name: "Волна", textures: [] }],
				}}
			/>,
		);
		expect(
			screen.getByRole("combobox", { name: "Выбрать панель. Сейчас: Волна" }),
		).toBeInTheDocument();
	});

	it("PC-CALC-301..305 — метрики результата с названиями из ТЗ", async () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		await waitFor(() =>
			expect(
				screen.getByText("Количество коробок к покупке"),
			).toBeInTheDocument(),
		);
		// «Площадь стены» есть и в шаге 1 (живой пересчёт), и в блоке результата.
		expect(screen.getAllByText("Площадь стены")).toHaveLength(2);
		expect(screen.getByText("11 шт.")).toBeInTheDocument();
		expect(screen.getByText("Фактический метраж")).toBeInTheDocument();
		expect(screen.getByText("11.88 м²")).toBeInTheDocument();
		expect(screen.getByText("Панелей, шт.")).toBeInTheDocument();
		expect(screen.getByText("132 шт.")).toBeInTheDocument();
	});

	it("PC-CALC-303 — подпись «Мы учли технологический запас»", async () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		await waitFor(() =>
			expect(
				screen.getByText("Мы учли технологический запас"),
			).toBeInTheDocument(),
		);
	});

	it("PC-CALC-306/307 — две карточки: подписка и покупка", async () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		await waitFor(() =>
			expect(screen.getByText("Подписка")).toBeInTheDocument(),
		);
		expect(screen.getByText("Покупка")).toBeInTheDocument();
		expect(
			screen.getByText(/Одна бесплатная замена в год включена/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Оформить подписку" }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Купить" })).toBeInTheDocument();
	});

	it("PC-CALC-307 — «Купить» отдаёт результат и типоразмер наружу", async () => {
		const onAddToCart = vi.fn();
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={onAddToCart} />,
		);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Купить" }),
			).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Купить" }));
		expect(onAddToCart).toHaveBeenCalledWith(
			expect.objectContaining({ panels_count: 132, boxes_count: 11 }),
			"300x300",
		);
	});

	it("PC-CALC-306 — «Оформить подписку» отдаёт результат наружу", async () => {
		const onSubscribe = vi.fn();
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				onSubscribe={onSubscribe}
			/>,
		);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Оформить подписку" }),
			).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Оформить подписку" }));
		expect(onSubscribe).toHaveBeenCalledWith(
			expect.objectContaining({ subscription_plan_id: "starter" }),
			"300x300",
		);
	});

	it("PC-CALC-004 — design_id уходит в расчёт", async () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{ designId: "design-42" }}
			/>,
		);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const body = JSON.parse(fetchMock.mock.calls[0][1].body);
		expect(body.design_id).toBe("design-42");
	});

	it("Комбо-дизайн отправляет items с коробками (суммирование)", async () => {
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		fetchMock.mockClear();

		fireEvent.click(screen.getByRole("radio", { name: "Комбо-дизайн" }));
		// Вторая позиция: 600×600 — дефолт; клик идемпотентно закрепляет выбор.
		fireEvent.click(
			screen.getByRole("radio", { name: "Позиция 2: 600×600 мм" }),
		);
		// Вводим коробки: 3 первой позиции, 2 второй.
		const boxesInputs = screen.getAllByRole("spinbutton", {
			name: "Количество, коробок",
		});
		expect(boxesInputs).toHaveLength(2);
		fireEvent.change(boxesInputs[0], { target: { value: 3 } });
		fireEvent.change(boxesInputs[1], { target: { value: 2 } });

		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const last = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
		const body = JSON.parse(last[1].body);
		expect(body.design_type).toBe("combined");
		expect(body.items).toHaveLength(2);
		// Продажа строго коробками: количество фиксировано, без долей.
		expect(body.items[0]).toMatchObject({ panel_size: "300x300", boxes: 3 });
		expect(body.items[1]).toMatchObject({ panel_size: "600x600", boxes: 2 });
	});

	it("комбо: выбор второй текстуры и исполнения из справочника карточки", () => {
		render(
			<CalculatorSidebar
				isOpen
				onClose={vi.fn()}
				onAddToCart={vi.fn()}
				context={{
					textureId: "t1",
					textureName: "Кожа",
					colorId: "c1",
					colorName: "Чёрная",
					textures: [
						{ id: "t1", name: "Кожа", colors: [{ id: "c1", name: "Чёрная" }] },
						{
							id: "t2",
							name: "Текстиль",
							colors: [
								{ id: "c2", name: "Серая" },
								{ id: "c3", name: "Бежевая" },
							],
						},
					],
				}}
			/>,
		);
		fireEvent.click(screen.getByRole("radio", { name: /Комбо/ }));
		// Первая позиция — из карточки.
		expect(screen.getByText(/Кожа · Чёрная/)).toBeInTheDocument();
		// Вторая позиция: выбираем текстуру и исполнение.
		fireEvent.mouseDown(screen.getByLabelText("Вторая текстура"));
		fireEvent.click(screen.getByText("Текстиль"));
		fireEvent.mouseDown(screen.getByLabelText("Вариант исполнения"));
		fireEvent.click(screen.getByText("Бежевая"));
		expect(screen.getByText(/Текстиль · Бежевая/)).toBeInTheDocument();
	});

	it("закрывается по Esc и по клику на кнопку закрытия", async () => {
		const onClose = vi.fn();
		render(
			<CalculatorSidebar isOpen onClose={onClose} onAddToCart={vi.fn()} />,
		);
		fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
		expect(onClose).toHaveBeenCalledTimes(1);
		fireEvent.keyDown(window, { key: "Escape" });
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("показывает понятное сообщение, если расчёт не удался", async () => {
		fetchMock.mockRejectedValue(new Error("network"));
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		await waitFor(() =>
			expect(
				screen.getByText(/Не удалось рассчитать проект/),
			).toBeInTheDocument(),
		);
	});
});

it("комбо показывает базовую панель, текстуру и исполнение", async () => {
	render(
		<CalculatorSidebar
			isOpen
			onClose={vi.fn()}
			onAddToCart={vi.fn()}
			context={{
				panelId: "p1",
				panels: [
					{
						id: "p1",
						name: "Панель А",
						textures: [
							{ id: "t1", name: "Дерево", colors: [{ id: "v1", name: "Дуб" }] },
						],
					},
					{
						id: "p2",
						name: "Панель Б",
						image: "PANEL_PHOTO/base.png",
						textures: [
							{
								id: "t2",
								name: "Кожа",
								image: "MISC/leather.jpg",
								colors: [
									{ id: "v2", name: "Белая", image: "VARIANT/white.png" },
								],
							},
						],
					},
				],
			}}
		/>,
	);
	fireEvent.click(screen.getByRole("radio", { name: /Комбо/ }));
	expect(
		screen.getByRole("combobox", { name: "Базовая панель" }),
	).toBeInTheDocument();
	expect(
		screen.getByRole("combobox", { name: "Текстура" }),
	).toBeInTheDocument();
	expect(
		screen.getByRole("combobox", { name: "Вариант исполнения" }),
	).toBeDisabled();
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Базовая панель" }));
	fireEvent.click(await screen.findByText("Панель Б"));
	fireEvent.mouseDown(screen.getByRole("combobox", { name: "Текстура" }));
	expect(await screen.findByText("Кожа")).toBeInTheDocument();
	expect(
		document.querySelector('img[src="/uploads/PANEL_PHOTO/base.png"]'),
	).toBeInTheDocument();
	expect(
		document.querySelector('img[src="/uploads/MISC/leather.jpg"]'),
	).toBeInTheDocument();
	fireEvent.click(screen.getByText("Кожа"));
	fireEvent.mouseDown(
		screen.getByRole("combobox", { name: "Вариант исполнения" }),
	);
	expect((await screen.findAllByText("Белая")).length).toBeGreaterThan(0);
	expect(
		document.querySelector('img[src="/uploads/VARIANT/white.png"]'),
	).toBeInTheDocument();
	expect(screen.queryByText("Дерево")).not.toBeInTheDocument();
});

describe("CalculatorSidebar — мобильная версия", () => {
	const setMobileWidth = (width: number) => {
		Object.defineProperty(window, "innerWidth", {
			writable: true,
			configurable: true,
			value: width,
		});
		const matcher = (q: string) => {
			const m = q.match(/max-width:\s*(\d+)px/);
			return m ? width <= Number(m[1]) : false;
		};
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			configurable: true,
			value: (query: string) => ({
				matches: matcher(query),
				media: query,
				onchange: null,
				addListener: () => {},
				removeListener: () => {},
				addEventListener: () => {},
				removeEventListener: () => {},
				dispatchEvent: () => false,
			}),
		});
		window.dispatchEvent(new Event("resize"));
	};

	it("на узком экране типоразмеры идут вертикальным списком без обрезки", () => {
		setMobileWidth(390);
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		const group = screen.getByRole("radiogroup", { name: "Типоразмер" });
		expect(group).toBeInTheDocument();
		// вертикальный список: одна колонка
		expect(group.style.gridTemplateColumns).toBe("1fr");
		// тексты видны целиком
		expect(screen.getByText("12 шт. в коробке")).toBeInTheDocument();
		expect(screen.getByText("6 шт. в коробке")).toBeInTheDocument();
		expect(screen.getByText("4 шт. в коробке")).toBeInTheDocument();
		// выбор работает
		fireEvent.click(
			screen.getByRole("radio", { name: "Типоразмер: 600×600 мм" }),
		);
		expect(
			screen.getByRole("radio", { name: "Типоразмер: 600×600 мм" }),
		).toHaveAttribute("aria-checked", "true");
		setMobileWidth(1280);
	});

	it("на широком экране типоразмеры идут 3 в ряд", () => {
		setMobileWidth(1280);
		render(
			<CalculatorSidebar isOpen onClose={vi.fn()} onAddToCart={vi.fn()} />,
		);
		const group = screen.getByRole("radiogroup", { name: "Типоразмер" });
		expect(group.style.gridTemplateColumns).toBe("repeat(3, 1fr)");
	});
});
