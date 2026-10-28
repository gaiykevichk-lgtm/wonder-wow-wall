/**
 * Phase 7B — `<AdminUploadPage>` (panels SKU) smoke tests.
 *
 * Mirrors the strategy of `AdminUsersPage.test.tsx`: mock the data
 * hooks so the SUT renders synchronously, then assert:
 *   * column contract (every list-item field appears),
 *   * the «+ Добавить панель» button opens the create drawer,
 *   * the inline `<Switch>` calls the update mutation.
 *
 * AdminFileUpload is mocked away — its own behaviour is covered by
 * `uploadFile.test.ts`; here it would just bring in unrelated XHR setup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	render,
	screen,
	fireEvent,
	waitFor,
	within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "../../../shared/api";
import type { ApiPanel, ApiPanelListResponse } from "../api/panelsAdminApi";

// ─── Mocks ─────────────────────────────────────────────────────────────

const mockUseList = vi.fn();
const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("../api/panelsAdminApi", async () => {
	const actual = await vi.importActual<typeof import("../api/panelsAdminApi")>(
		"../api/panelsAdminApi",
	);
	return {
		...actual,
		usePanelsAdminList: (q: unknown) => mockUseList(q),
		useCreatePanelSizes: () => ({
			mutate: mockCreateMutate,
			isPending: false,
			variables: undefined,
		}),
		useUpdatePanel: () => ({
			mutate: mockUpdateMutate,
			isPending: false,
			variables: undefined,
		}),
		useDeletePanel: () => ({
			mutate: mockDeleteMutate,
			isPending: false,
			variables: undefined,
		}),
	};
});

// AdminFileUpload pulls in XHR-dependent code; stub it to a marker div
// so we can assert it renders inside the drawer without bringing the
// whole upload pipeline along.
vi.mock("../../../shared/ui/AdminFileUpload", () => ({
	AdminFileUpload: ({
		onUploaded,
		disabled,
	}: {
		onUploaded?: (asset: { path: string }) => void;
		disabled?: boolean;
	}) => (
		<button
			type="button"
			data-testid="admin-file-upload"
			disabled={disabled}
			onClick={() => onUploaded?.({ path: "panels/new-photo.png" })}
		>
			Загрузить
		</button>
	),
}));

import AdminUploadPage from "../ui/AdminUploadPage";

// ─── Helpers ───────────────────────────────────────────────────────────

function makePanel(over: Partial<ApiPanel> = {}): ApiPanel {
	return {
		id: "p-1",
		name: "Панель 30×30",
		slug: "panel-30x30",
		width_mm: 300,
		height_mm: 300,
		size_label: "30×30 см",
		base_price: 890,
		description: "",
		photo_path: "",
		photo_paths: [],
		is_active: true,
		created_at: "2026-04-25T10:00:00Z",
		...over,
	};
}

function renderPage(items: ApiPanel[]) {
	const response: ApiPanelListResponse = {
		items,
		total: items.length,
		offset: 0,
		limit: 50,
	};
	mockUseList.mockReturnValue({
		data: response,
		isFetching: false,
		error: null,
	});
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<MemoryRouter initialEntries={["/admin/upload"]}>
				<AdminUploadPage />
			</MemoryRouter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mockUseList.mockReset();
	mockCreateMutate.mockReset();
	mockUpdateMutate.mockReset();
	mockDeleteMutate.mockReset();
});

// ─── Tests ─────────────────────────────────────────────────────────────

describe("<AdminUploadPage>", () => {
	it("renders the page title", () => {
		renderPage([]);
		expect(screen.getByRole("heading", { name: "Панели" })).toBeInTheDocument();
	});

	it("renders one row per panel with all contract fields visible", () => {
		renderPage([
			makePanel(),
			makePanel({
				id: "p-2",
				name: "Панель 60×60",
				slug: "panel-60x60",
				width_mm: 600,
				height_mm: 600,
				size_label: "60×60 см",
				base_price: 2490,
				is_active: false,
			}),
		]);
		expect(screen.getByText("Панель 30×30")).toBeInTheDocument();
		expect(screen.getByText("Панель 60×60")).toBeInTheDocument();
		expect(screen.getByText("panel-30x30")).toBeInTheDocument();
		expect(screen.getByText("panel-60x60")).toBeInTheDocument();
		expect(screen.getByText("30×30 см")).toBeInTheDocument();
		expect(screen.getByText("60×60 см")).toBeInTheDocument();
		expect(screen.getByText("890 ₽")).toBeInTheDocument();
		expect(screen.getByText("2 490 ₽")).toBeInTheDocument();
	});

	it("объединяет форму разных размеров и сохраняет выбранный ID для редактирования", async () => {
		renderPage([
			makePanel({
				id: "p-300",
				name: "ПИРАМИДА",
				slug: "piramida-300x300",
				size_label: "300×300 мм",
			}),
			makePanel({
				id: "p-600",
				name: "ПИРАМИДА",
				slug: "piramida-600x600",
				width_mm: 600,
				height_mm: 600,
				size_label: "60×60 см",
				base_price: 2490,
			}),
		]);
		expect(screen.getAllByRole("row")).toHaveLength(2); // header + one form
		expect(screen.getAllByText("ПИРАМИДА")).toHaveLength(1);
		expect(screen.getByText("30×30 см")).toBeInTheDocument();
		const size = screen.getByRole("combobox", {
			name: "Размер формы ПИРАМИДА",
		});
		fireEvent.mouseDown(size);
		fireEvent.click(await screen.findByText("60×60 см"));
		expect(screen.getByText("2 490 ₽")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		expect(screen.getAllByDisplayValue("600")).toHaveLength(2);
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateMutate.mock.calls[0][0].panelId).toBe("p-600"),
		);
	});

	it("подставляет метку размера из ширины и высоты при редактировании", () => {
		renderPage([
			makePanel({
				id: "p-1",
				name: "АРКА",
				width_mm: 300,
				height_mm: 300,
				size_label: "",
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		const label = screen.getByLabelText("Метка размера") as HTMLInputElement;
		// Меняем высоту 300 → 600: метка пересчитывается из тех же полей.
		fireEvent.change(screen.getByLabelText("Высота (мм)"), {
			target: { value: "600" },
		});
		expect(label.value).toBe("30×60 см");
	});

	it("не затирает метку размера, отредактированную вручную", () => {
		renderPage([
			makePanel({
				id: "p-1",
				name: "АРКА",
				width_mm: 300,
				height_mm: 300,
				size_label: "",
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		const label = screen.getByLabelText("Метка размера") as HTMLInputElement;
		fireEvent.change(screen.getByLabelText("Высота (мм)"), {
			target: { value: "600" },
		});
		expect(label.value).toBe("30×60 см");
		// Ручная правка останавливает автоподстановку.
		fireEvent.change(label, { target: { value: "мой размер" } });
		fireEvent.change(screen.getByLabelText("Ширина (мм)"), {
			target: { value: "600" },
		});
		expect(label.value).toBe("мой размер");
	});

	it("показывает одинаковый формат и для legacy размера в миллиметрах", () => {
		renderPage([makePanel({ name: "АРКА", size_label: "300×300 мм" })]);
		const row = screen.getAllByRole("row")[1];
		expect(within(row).getByText("30×30 см")).toBeInTheDocument();
		expect(within(row).queryByText("300×300 мм")).not.toBeInTheDocument();
	});

	it("renders the empty-state for a zero-row response", () => {
		renderPage([]);
		expect(
			screen.getByText(
				(_, el) => el?.classList.contains("ant-empty-description") ?? false,
			),
		).toBeInTheDocument();
	});

	it("opens the create drawer on «Добавить панель»", () => {
		renderPage([]);
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		expect(screen.getByText("Новая панель")).toBeInTheDocument();
		expect(screen.getByLabelText("Название")).toBeInTheDocument();
		expect(screen.getByLabelText("Slug")).toBeInTheDocument();
		expect(screen.getByLabelText("30×30 см")).toBeInTheDocument();
		expect(screen.queryByLabelText("Базовая цена (₽)")).not.toBeInTheDocument();
		expect(screen.queryByTestId("admin-file-upload")).not.toBeInTheDocument();
	});

	it("toggling the inline Switch fires useUpdatePanel with is_active patch", () => {
		renderPage([makePanel()]);
		// The Switch is the only checkbox role rendered in the table row.
		const sw = screen.getByRole("switch");
		expect(sw).toBeInTheDocument();
		fireEvent.click(sw);
		expect(mockUpdateMutate).toHaveBeenCalledTimes(1);
		expect(mockUpdateMutate.mock.calls[0][0]).toEqual({
			panelId: "p-1",
			body: { is_active: false },
		});
	});

	it("opens the edit drawer pre-filled when the edit button is clicked", () => {
		renderPage([makePanel({ name: "Уникальное Имя 42" })]);
		// The edit button is rendered with aria-label="Редактировать".
		const editBtn = screen.getByRole("button", { name: "Редактировать" });
		fireEvent.click(editBtn);
		expect(screen.getByText("Редактировать панель")).toBeInTheDocument();
		// Form should be pre-populated with the panel's name.
		expect(screen.getByDisplayValue("Уникальное Имя 42")).toBeInTheDocument();
	});

	it("создаёт панель со всеми характеристиками", async () => {
		renderPage([]);
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		for (const label of [
			"Толщина (мм)",
			"Исполнение",
			"Система монтажа",
			"Основа",
			"Упаковка",
		]) {
			expect(screen.getByLabelText(label)).toBeInTheDocument();
		}
		fireEvent.change(screen.getByLabelText("Название"), {
			target: { value: "Форма" },
		});
		fireEvent.change(screen.getByLabelText("Slug"), {
			target: { value: "forma" },
		});
		fireEvent.change(screen.getByLabelText("Исполнение"), {
			target: { value: "Матовое" },
		});
		fireEvent.change(screen.getByLabelText("Упаковка"), {
			target: { value: "10 шт" },
		});
		fireEvent.click(screen.getByLabelText("30×30 см"));
		fireEvent.click(screen.getByRole("button", { name: /Создать/i }));
		await waitFor(() =>
			expect(mockCreateMutate.mock.calls[0][0]).toMatchObject({
				execution: "Матовое",
				packaging: "10 шт",
				thickness_mm: 3,
			}),
		);
	});

	it("загружает характеристики для редактирования и отправляет их", async () => {
		renderPage([
			makePanel({
				thickness_mm: 7,
				execution: "Матовое",
				mounting_system: "Клипсы",
				base_material: "Композит",
				packaging: "10 шт",
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		expect(screen.getByLabelText("Толщина (мм)")).toHaveValue("7");
		expect(screen.getByLabelText("Исполнение")).toHaveValue("Матовое");
		expect(screen.getByLabelText("Система монтажа")).toHaveValue("Клипсы");
		expect(screen.getByLabelText("Основа")).toHaveValue("Композит");
		expect(screen.getByLabelText("Упаковка")).toHaveValue("10 шт");
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateMutate.mock.calls[0][0].body).toMatchObject({
				thickness_mm: 7,
				execution: "Матовое",
				mounting_system: "Клипсы",
				base_material: "Композит",
				packaging: "10 шт",
			}),
		);
	});

	it("показывает оба сохранённых фото базовой панели в редакторе", () => {
		renderPage([
			makePanel({
				photo_path: "panels/main.png",
				photo_paths: ["panels/main.png", "panels/hover.png"],
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		expect(screen.getByAltText("Фото панели 1")).toBeInTheDocument();
		expect(screen.getByAltText("Фото панели 2")).toBeInTheDocument();
		expect(screen.getByText("Основное фото")).toBeInTheDocument();
		expect(screen.getByText("Фото при наведении")).toBeInTheDocument();
		expect(screen.getByText("Фото (2/2)")).toBeInTheDocument();
		expect(screen.getByTestId("admin-file-upload")).toBeDisabled();
	});

	it("сохраняет весь массив фото и синхронизирует основное фото", async () => {
		renderPage([
			makePanel({
				photo_path: "panels/main.png",
				photo_paths: ["panels/main.png", "panels/hover.png"],
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() => expect(mockUpdateMutate).toHaveBeenCalledTimes(1));
		expect(mockUpdateMutate.mock.calls[0][0]).toMatchObject({
			panelId: "p-1",
			body: {
				photo_path: "panels/main.png",
				photo_paths: ["panels/main.png", "panels/hover.png"],
			},
		});
	});

	it("кнопка добавления размера видна во всех строках формы, независимо от slug", async () => {
		renderPage([
			makePanel({
				id: "p-1",
				name: "АРКА",
				slug: "arka",
				width_mm: 300,
				height_mm: 300,
			}),
			makePanel({
				id: "p-2",
				name: "ВОЛНА КРУПНАЯ",
				slug: "volna-krupnaya-600x600",
				width_mm: 600,
				height_mm: 600,
			}),
		]);
		expect(
			screen.getAllByRole("button", { name: "Подключить размер" }),
		).toHaveLength(2);
	});

	it("подключает недостающий размер через существующую размерную панель", async () => {
		renderPage([makePanel({ name: "КРУГ", slug: "krug-300x300" })]);
		fireEvent.click(screen.getByRole("button", { name: "Подключить размер" }));
		expect(screen.getByLabelText("Название")).toHaveValue("КРУГ");
		expect(screen.getByLabelText("Slug")).toHaveValue("krug");
		fireEvent.click(screen.getByLabelText("30×60 см"));
		fireEvent.click(screen.getByRole("button", { name: /Создать/i }));
		await waitFor(() =>
			expect(mockCreateMutate.mock.calls[0][0]).toMatchObject({
				name: "КРУГ",
				slug: "krug",
				sizes: ["300x600"],
			}),
		);
	});

	it("создаёт только выбранные размерные панели одним запросом", async () => {
		renderPage([]);
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		fireEvent.change(screen.getByLabelText("Название"), {
			target: { value: "КРУГ" },
		});
		fireEvent.change(screen.getByLabelText("Slug"), {
			target: { value: "krug" },
		});
		fireEvent.click(screen.getByLabelText("30×30 см"));
		fireEvent.click(screen.getByLabelText("60×60 см"));
		fireEvent.click(screen.getByRole("button", { name: /Создать/i }));
		await waitFor(() => expect(mockCreateMutate).toHaveBeenCalledTimes(1));
		expect(mockCreateMutate.mock.calls[0][0]).toMatchObject({
			name: "КРУГ",
			slug: "krug",
			sizes: ["300x300", "600x600"],
		});
	});

	// ─── N-test-7B follow-ups (post-audit) ──────────────────────────────

	it("renders inline slug error on panel_slug_conflict 409 (N-test-7B)", async () => {
		renderPage([]);
		// Make the create-panel mutation reject with the API error envelope
		// shape the page branches on (`code: panel_slug_conflict`).
		mockCreateMutate.mockImplementation((_payload, opts) => {
			opts?.onError?.(
				new ApiError(409, "Slug taken", { code: "panel_slug_conflict" }),
			);
		});
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		fireEvent.change(screen.getByLabelText("Название"), {
			target: { value: "Test" },
		});
		fireEvent.change(screen.getByLabelText("Slug"), {
			target: { value: "taken" },
		});
		// Drawer's primary button is «Сохранить» in edit mode; «Создать»
		// in create mode. Match by exact text inside the drawer.
		fireEvent.click(screen.getByLabelText("30×30 см"));
		fireEvent.click(screen.getByRole("button", { name: /Создать/i }));
		expect(await screen.findByText("Slug уже занят")).toBeInTheDocument();
	});

	it("блокирует выбор уже созданного размера при создании формы", () => {
		renderPage([
			makePanel({
				id: "p-300",
				name: "ПИРАМИДА",
				slug: "piramida",
				width_mm: 300,
				height_mm: 300,
			}),
		]);
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		fireEvent.change(screen.getByLabelText("Название"), {
			target: { value: "ПИРАМИДА" },
		});
		const existing = screen.getByLabelText("30×30 см — уже есть");
		expect(existing).toBeDisabled();
		expect(screen.getByLabelText("30×60 см")).not.toBeDisabled();
	});

	it("показывает ошибку 409 panel_size_conflict у выбранных размеров", async () => {
		renderPage([makePanel({ id: "p-1", name: "ПИРАМИДА" })]);
		mockCreateMutate.mockImplementation((_payload, opts) => {
			opts?.onError?.(
				new ApiError(
					409,
					"Форма 'ПИРАМИДА' уже существует в размере 30×30 см",
					{
						code: "panel_size_conflict",
						detail: "Форма 'ПИРАМИДА' уже существует в размере 30×30 см",
					},
				),
			);
		});
		fireEvent.click(screen.getByRole("button", { name: /Добавить панель/i }));
		fireEvent.change(screen.getByLabelText("Название"), {
			target: { value: "ДРУГАЯ" },
		});
		fireEvent.click(screen.getByLabelText("30×60 см"));
		fireEvent.click(screen.getByRole("button", { name: /Создать/i }));
		expect(
			await screen.findByText(/уже существует в размере/),
		).toBeInTheDocument();
	});

	it("фильтрует формы по размеру", async () => {
		renderPage([
			makePanel({
				id: "p-a",
				name: "АРКА",
				slug: "arka",
				width_mm: 300,
				height_mm: 300,
			}),
			makePanel({
				id: "p-b",
				name: "АРКА",
				slug: "arka-600x600",
				width_mm: 600,
				height_mm: 600,
				size_label: "60×60 см",
			}),
			makePanel({
				id: "p-c",
				name: "РЕЙКА",
				slug: "reyka",
				width_mm: 300,
				height_mm: 300,
			}),
		]);
		const filter = screen.getByRole("combobox", { name: "Фильтр по размеру" });
		fireEvent.mouseDown(filter);
		fireEvent.click(await screen.findByTitle("60×60 см"));
		await waitFor(() => {
			expect(screen.getByText("АРКА")).toBeInTheDocument();
			expect(screen.queryByText("РЕЙКА")).not.toBeInTheDocument();
		});
	});

	it("delete Popconfirm: confirm fires useDeletePanel with row id (N-test-7B)", async () => {
		renderPage([makePanel({ id: "p-del" })]);
		// Trigger: row's icon-only «Удалить» button (aria-label).
		fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
		// Popover OK: a NEW button with name «Удалить» appears inside the
		// `.ant-popover` overlay. We disambiguate from the trigger by
		// requiring the parent `.ant-popconfirm-buttons` container.
		const popconfirmOk = await waitFor(() => {
			const candidates = screen.getAllByRole("button", { name: "Удалить" });
			const inPopover = candidates.find(
				(b) => b.closest(".ant-popconfirm-buttons") !== null,
			);
			expect(inPopover).toBeDefined();
			return inPopover!;
		});
		fireEvent.click(popconfirmOk);
		await waitFor(() => {
			expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
		});
		expect(mockDeleteMutate.mock.calls[0][0]).toBe("p-del");
	});

	it("delete Popconfirm: cancel does NOT fire delete (N-test-7B)", async () => {
		renderPage([makePanel({ id: "p-del" })]);
		fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
		const cancelBtn = await screen.findByRole("button", { name: "Отмена" });
		fireEvent.click(cancelBtn);
		// Allow microtask flush so an erroneous mutate call would land.
		await waitFor(() => {
			expect(mockDeleteMutate).not.toHaveBeenCalled();
		});
	});
});
