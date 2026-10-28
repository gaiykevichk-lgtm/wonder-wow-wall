import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();
let rows: Array<{
	id: string;
	texture_id_1: string;
	texture_id_2: string;
	panel_family_1?: string;
	panel_family_2?: string;
	image_path: string;
	created_at: string;
	card?: { title?: string; subtitle?: string; price?: string; area?: string; category?: string };
}> = [];

vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({
		data: [
			{ id: "texture-1", name: "Кожа" },
			{ id: "texture-2", name: "Текстиль" },
		],
	}),
}));

vi.mock("../api/panelsAdminApi", () => ({
	usePanelsAdminList: () => ({
		data: {
			items: [
				{ id: "panel-1", name: "Рейка", slug: "reika-300x300" },
				{ id: "panel-2", name: "Арка", slug: "arka-300x300" },
			],
			total: 2,
			offset: 0,
			limit: 100,
		},
		isFetching: false,
	}),
}));

vi.mock("../api/textureCombinationsAdminApi", () => ({
	SPACE_CARD_CATEGORIES: [
		{ value: "home", label: "Для дома" },
		{ value: "business", label: "Для бизнеса" },
		{ value: "social", label: "Социальные объекты" },
	],
	useTextureCombinationImagesAdmin: () => ({ data: rows, isFetching: false }),
	// Мок mutate сразу зовёт onSuccess — как успешный ответ сервера.
	// Нужен для цепочки последовательных созданий нескольких карточек.
	useCreateTextureCombinationImage: () => ({
		mutate: (...args: unknown[]) => {
			createMutate(...args);
			const opts = args[1] as { onSuccess?: () => void } | undefined;
			opts?.onSuccess?.();
		},
		isPending: false,
	}),
	useUpdateTextureCombinationImage: () => ({
		mutate: updateMutate,
		isPending: false,
	}),
	useDeleteTextureCombinationImage: () => ({ mutate: deleteMutate }),
}));

vi.mock("../../../shared/ui/AdminFileUpload", () => ({
	AdminFileUpload: ({
		hint,
		onUploaded,
	}: {
		hint: string;
		onUploaded?: (asset: { path: string }) => void;
	}) => (
		<button
			type="button"
			data-testid="upload-hint"
			onClick={() => {
				uploadSeq += 1;
				onUploaded?.({ path: `replacement-${uploadSeq}.webp` });
			}}
		>
			{hint}
		</button>
	),
}));

let uploadSeq = 0;

import AdminTextureCombinationsTab from "../ui/AdminTextureCombinationsTab";

describe("AdminTextureCombinationsTab", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rows = [];
		uploadSeq = 0;
	});

	it("объединяет моно и комбинации в одном экране", () => {
		render(<AdminTextureCombinationsTab />);

		expect(screen.getByText("Моно")).toBeInTheDocument();
		expect(screen.getByText("Комбинации")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Добавляйте несколько интерьерных фотографий для одной текстуры и одной базовой панели.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Нет моно изображений")).toBeInTheDocument();
	});

	it("редактирует ранее добавленное моно изображение без смены ID", async () => {
		rows = [
			{
				id: "image-1",
				texture_id_1: "texture-1",
				texture_id_2: "texture-1",
				image_path: "old.webp",
				created_at: "2026-09-18T10:00:00Z",
			},
		];
		render(<AdminTextureCombinationsTab />);

		fireEvent.click(
			screen.getByRole("button", { name: "Редактировать изображение" }),
		);
		expect(
			screen.getByText("Редактировать моно изображение"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Фотографии карточки \(1\)/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", { name: "Обложка карточки" }),
		).toHaveAttribute("src", expect.stringContaining("old.webp"));
		fireEvent.mouseDown(screen.getByLabelText("Текстура изображения"));
		fireEvent.click(screen.getByText("Текстиль"));
		fireEvent.click(
			screen.getByText(
				"Выберите одно или несколько фото — они добавятся в галерею этой карточки",
			),
		);
		expect(
			screen.getByText(/Фотографии карточки \(2\)/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("img", { name: "Фото 2 карточки" }),
		).toHaveAttribute("src", expect.stringContaining("replacement-1.webp"));
		fireEvent.click(
			screen.getByRole("button", { name: "Сохранить" }),
		);

		await waitFor(() =>
			expect(updateMutate).toHaveBeenCalledWith(
				{
					id: "image-1",
					body: {
						texture_id_1: "texture-2",
						texture_id_2: "texture-2",
						panel_family_1: "",
						panel_family_2: "",
						image_path: "old.webp",
						image_paths: ["old.webp", "replacement-1.webp"],
						card: { title: "", subtitle: "", price: "", area: "", category: "home" },
					},
				},
				expect.any(Object),
			),
		);
	});

	it("переключает интерфейс на режим комбинаций", () => {
		render(<AdminTextureCombinationsTab />);

		fireEvent.click(screen.getByText("Комбинации"));

		expect(
			screen.getByText(
				"Добавляйте несколько интерьерных фотографий для одной пары текстур и одной пары базовых панелей.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText("Нет изображений для комбинаций текстур"),
		).toBeInTheDocument();
		expect(screen.getByText("Первая текстура")).toBeInTheDocument();
		expect(screen.getByText("Вторая текстура")).toBeInTheDocument();
	});

	it("передаёт тексты карточки при добавлении нового фото", async () => {
		render(<AdminTextureCombinationsTab />);

		// Выбираем моно-текстуру и базовую панель, заполняем тексты карточки.
		fireEvent.mouseDown(screen.getByText("Текстура"));
		fireEvent.click(screen.getByText("Кожа"));
		fireEvent.mouseDown(screen.getByText("Базовая панель"));
		fireEvent.click(screen.getByText("Рейка"));
		fireEvent.change(screen.getByLabelText("Название карточки"), {
			target: { value: "Современная гостиная" },
		});
		fireEvent.change(screen.getByLabelText("Детали карточки"), {
			target: { value: "Современный · Текстиль · моно" },
		});
		fireEvent.change(screen.getByLabelText("Цена карточки"), {
			target: { value: "от 196 460 ₽" },
		});
		fireEvent.change(screen.getByLabelText("Площадь карточки"), {
			target: { value: "Стена 8.4 м²" },
		});

		// Загрузка фото подготавливает файлы, отдельная кнопка создаёт строки.
		fireEvent.click(screen.getByText(/Загрузите одно или несколько фото/));
		fireEvent.click(screen.getByRole("button", { name: "Создать карточку" }));

		await waitFor(() =>
			expect(createMutate).toHaveBeenCalledWith(
				{
					texture_id_1: "texture-1",
					texture_id_2: "texture-1",
					panel_family_1: "reika",
					panel_family_2: "reika",
					image_path: "replacement-1.webp",
					image_paths: ["replacement-1.webp"],
					card: {
						title: "Современная гостиная",
						subtitle: "Современный · Текстиль · моно",
						price: "от 196 460 ₽",
						area: "Стена 8.4 м²",
						category: "home",
					},
				},
				expect.any(Object),
			),
		);
	});

	it("создаёт одну карточку с галереей из нескольких фото", async () => {
		render(<AdminTextureCombinationsTab />);

		fireEvent.mouseDown(screen.getByText("Текстура"));
		fireEvent.click(screen.getByText("Кожа"));
		fireEvent.mouseDown(screen.getByText("Базовая панель"));
		fireEvent.click(screen.getByText("Рейка"));
		fireEvent.change(screen.getByLabelText("Название карточки"), {
			target: { value: "Современная гостиная" },
		});

		// Два фото подряд — превью обоих видно до создания.
		fireEvent.click(screen.getByText(/Загрузите одно или несколько фото/));
		fireEvent.click(screen.getByText(/Загрузите одно или несколько фото/));
		expect(
			screen.getByRole("button", { name: "Создать карточку (фото: 2)" }),
		).toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Создать карточку (фото: 2)" }),
		);

		await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
		expect(createMutate).toHaveBeenCalledWith(
			expect.objectContaining({
				panel_family_1: "reika",
				panel_family_2: "reika",
				image_path: "replacement-1.webp",
				image_paths: ["replacement-1.webp", "replacement-2.webp"],
			}),
			expect.any(Object),
		);
	});

	it("показывает тексты существующей карточки в списке и правит их", async () => {
		rows = [
			{
				id: "image-2",
				texture_id_1: "texture-1",
				texture_id_2: "texture-1",
				image_path: "old.webp",
				created_at: "2026-09-18T10:00:00Z",
				card: {
					title: "Современная гостиная",
					subtitle: "Современный · Текстиль · моно",
					price: "от 196 460 ₽",
					area: "Стена 8.4 м²",
					category: "home",
				},
			},
		];
		render(<AdminTextureCombinationsTab />);

		// Колонка «Карточка страницы» — это инпуты: значения уже видны в полях строки.
		expect(
			screen.getByLabelText(`Название карточки — image-2`),
		).toHaveValue("Современная гостиная");
		expect(
			screen.getByLabelText(`Детали карточки — image-2`),
		).toHaveValue("Современный · Текстиль · моно");
		// Фотография строки видна прямо в таблице.
		expect(
			screen.getByRole("img", { name: "Фотография — Кожа" }),
		).toHaveAttribute("src", expect.stringContaining("old.webp"));

		fireEvent.click(
			screen.getByRole("button", { name: "Редактировать изображение" }),
		);
		// Правка прямо в строке: меняем название и жмём «Сохранить тексты».
		const titleInput = screen.getByLabelText("Название карточки — image-2");
		fireEvent.change(titleInput, { target: { value: "Лофт гостиная" } });
		fireEvent.click(
			screen.getByRole("button", {
				name: "Сохранить тексты карточки — image-2",
			}),
		);

		await waitFor(() =>
			expect(updateMutate).toHaveBeenCalledWith(
				{
					id: "image-2",
					body: {
						texture_id_1: "texture-1",
						texture_id_2: "texture-1",
						panel_family_1: "",
						panel_family_2: "",
						image_path: "old.webp",
						card: {
							title: "Лофт гостиная",
							subtitle: "Современный · Текстиль · моно",
							price: "от 196 460 ₽",
							area: "Стена 8.4 м²",
							category: "home",
						},
					},
				},
				expect.any(Object),
			),
		);

		// Правка через модалку тоже осталась: поле предзаполнено значением карточки.
		fireEvent.click(
			screen.getByRole("button", { name: "Редактировать изображение" }),
		);
		expect(
			screen.getByDisplayValue("Современная гостиная"),
		).toBeInTheDocument();
	});

	it("сохраняет назначение карточки для страницы «Пространства»", async () => {
		render(<AdminTextureCombinationsTab />);

		fireEvent.mouseDown(screen.getByText("Текстура"));
		fireEvent.click(screen.getByText("Кожа"));
		fireEvent.mouseDown(screen.getByText("Базовая панель"));
		fireEvent.click(screen.getByText("Рейка"));
		fireEvent.change(screen.getByLabelText("Название карточки"), {
			target: { value: "Офис в центре" },
		});
		// Назначение — выпадающий список: третий слот сетки полей.
		fireEvent.mouseDown(screen.getByLabelText("Назначение карточки"));
		fireEvent.click((await screen.findAllByText("Для бизнеса")).at(-1)!);
		expect(
			screen.getByLabelText("Назначение карточки").closest(".ant-select"),
		).toHaveTextContent("Для бизнеса");

		fireEvent.click(screen.getByText(/Загрузите одно или несколько фото/));
		fireEvent.click(screen.getByRole("button", { name: "Создать карточку" }));

		await waitFor(() =>
			expect(createMutate).toHaveBeenCalledWith(
				expect.objectContaining({
					card: expect.objectContaining({ category: "business" }),
				}),
				expect.any(Object),
			),
		);
	});
});
 describe("Единицы цены и площади", () => {
	it("добавляет единицы после ввода и не дублирует их", async () => {
		render(<AdminTextureCombinationsTab />);
		const price = screen.getByLabelText("Цена карточки");
		const area = screen.getByLabelText("Площадь карточки");
		fireEvent.change(price, { target: { value: "196 460" } });
		fireEvent.blur(price);
		expect(price).toHaveValue("196 460 ₽");
		fireEvent.blur(price);
		expect(price).toHaveValue("196 460 ₽");
		fireEvent.change(area, { target: { value: "8,4" } });
		fireEvent.blur(area);
		expect(area).toHaveValue("8,4 м²");
		fireEvent.blur(area);
		expect(area).toHaveValue("8,4 м²");
		fireEvent.change(area, { target: { value: "" } });
		fireEvent.blur(area);
		expect(area).toHaveValue("");
	});
 });
