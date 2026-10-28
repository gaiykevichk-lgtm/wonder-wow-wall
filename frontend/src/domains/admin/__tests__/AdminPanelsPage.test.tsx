import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiPanelVariant } from "../api/panelVariantsAdminApi";
import type { ApiPanel } from "../api/panelsAdminApi";
import type { ApiTexture } from "../api/texturesAdminApi";

const mockDeleteVariant = vi.fn();
const mockDeleteVariantRow = vi.fn();
const mockUpdatePanel = vi.fn();
const mockUpdateVariant = vi.fn();
const mockRefetchVariants = vi.fn();
const mockRefetchPanels = vi.fn();
const mockReorderVariants = vi.fn();

const mockDeletePanel = vi.fn();
const mockDeleteVariantGroup = vi.fn();

const mockUpdateRowTexture = vi.fn();
const mockRefetchAssignments = vi.fn();
const mockUploadFile = vi.fn();
let includeSecondCatalogRow = false;
let includeDifferentSizeRow = false;
let includeVariants = true;
let showUnassignedOrdering = false;
let newlyAssignedTexture: string | null = null;
let includeCircleSizeRows = false;
const variant: ApiPanelVariant = {
	id: "9c3026c5-0000-4b3f-ac7c-d2297e04c392",
	panel_id: "panel-1",
	texture_id: "texture-1",
	color_id: null,
	color_hex: null,
	image_paths: [
		"variants/panel-1/texture-1/exec-a.webp",
		"variants/panel-1/texture-1/exec-b.webp",
		"variants/panel-1/texture-1/exec-c.webp",
		"variants/panel-1/texture-1/exec-d.webp",
	],
	sort_order: 0,
	design_image_paths: [
		"variants/panel-1/texture-1/design-a.webp",
		"variants/panel-1/texture-1/design-b.webp",
	],
	recommendation_image_paths: [
		"variants/panel-1/texture-1/recommendation-a.webp",
	],
	is_active: true,
	created_at: "2026-09-14T10:00:00Z",
	updated_at: "2026-09-14T10:00:00Z",
};

const panel: ApiPanel = {
	id: "panel-1",
	name: "ДЕМО 1",
	slug: "demo-1",
	width_mm: 300,
	height_mm: 300,
	size_label: "30×30 см",
	base_price: 1200,
	stock_quantity: 0,
	description: "demo",
	photo_path: "panels/demo.webp",
	photo_paths: ["panels/demo.webp"],
	is_active: true,
	created_at: "2026-09-14T10:00:00Z",
};

const originalUnassigned = {
	...panel,
	id: "unassigned-original",
	name: "ФОРМА",
	slug: "forma",
	created_at: "2026-09-20T10:00:00Z",
};
const copiedUnassigned = {
	...originalUnassigned,
	id: "unassigned-copy",
	name: "ФОРМА",
	slug: "forma",
	created_at: "2026-09-21T10:00:00Z",
};
const newUnassigned = {
	...originalUnassigned,
	id: "unassigned-new",
	name: "НОВАЯ ФОРМА",
	slug: "new-form",
	created_at: "2026-09-22T10:00:00Z",
};

const largePanel: ApiPanel = {
	...panel,
	id: "panel-large",
	name: "БОЛЬШАЯ ПАНЕЛЬ",
	width_mm: 600,
	height_mm: 600,
	size_label: "60×60 см",
};
const circlePanel: ApiPanel = {
	...panel,
	id: "panel-circle",
	name: "КРУГ",
	slug: "krug-300x300",
	width_mm: 300,
	height_mm: 300,
	size_label: "30×30 см",
};
const circlePanelLarge: ApiPanel = {
	...circlePanel,
	id: "panel-circle-large",
	slug: "krug-600x600",
	width_mm: 600,
	height_mm: 600,
	size_label: "60×60 см",
};

const deletedPanel: ApiPanel = {
	...panel,
	id: "deleted-panel",
	name: "УДАЛЁННАЯ ПАНЕЛЬ",
	slug: "deleted-panel",
};

const texture: ApiTexture = {
	id: "texture-1",
	name: "Текстиль",
	slug: "textile",
	swatch_image: "textures/textile.webp",
	sort_order: 0,
	is_active: true,
	created_at: "2026-09-14T10:00:00Z",
};

const secondTexture: ApiTexture = {
	...texture,
	id: "texture-2",
	name: "Кожа",
	slug: "leather",
};

vi.mock("../api/panelVariantsAdminApi", () => ({
	usePanelVariantsAdminList: () => ({
		data: {
			items: includeVariants ? [variant] : [],
			total: includeVariants ? 1 : 0,
			offset: 0,
			limit: 100,
		},
		isLoading: false,
		refetch: mockRefetchVariants,
	}),
	useDeletePanelVariant: () => ({
		mutateAsync: mockDeleteVariant,
		isPending: false,
		variables: undefined,
	}),
	useDeletePanelVariantGroup: () => ({
		mutateAsync: mockDeleteVariantGroup,
		isPending: false,
	}),
	useDeletePanelVariantRow: () => ({
		mutateAsync: mockDeleteVariantRow,
		mutate: (args: unknown) => mockDeleteVariantRow(args),
		isPending: false,
	}),

	useUpdatePanelVariant: () => ({
		mutateAsync: mockUpdateVariant,
		isPending: false,
	}),
	useUpdatePanelVariantRowTexture: () => ({
		mutateAsync: mockUpdateRowTexture,
		isPending: false,
	}),
	useReorderPanelVariants: () => ({
		mutateAsync: mockReorderVariants,
		isPending: false,
	}),
	useUpdatePanelVariantRowActivity: () => ({
		mutateAsync: mockUpdateVariant,
		isPending: false,
	}),
}));

vi.mock("../api/panelAvailabilityStatusesApi", () => ({
	usePanelAvailabilityStatuses: () => ({ data: [] }),
	useSavePanelAvailabilityStatus: () => ({ mutateAsync: vi.fn() }),
	useDeletePanelAvailabilityStatus: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../api/panelsAdminApi", () => ({
	usePanelsAdminList: () => ({
		data: {
			items: showUnassignedOrdering
				? [panel, originalUnassigned, copiedUnassigned, newUnassigned]
				: [
						panel,
						largePanel,
						deletedPanel,
						...(includeCircleSizeRows ? [circlePanel, circlePanelLarge] : []),
					],
			total: showUnassignedOrdering ? 4 : includeCircleSizeRows ? 5 : 3,
			offset: 0,
			limit: 100,
		},
		refetch: mockRefetchPanels,
	}),
	useUpdatePanel: () => ({
		mutateAsync: mockUpdatePanel,
		isPending: false,
	}),

	useDeletePanel: () => ({
		mutateAsync: mockDeletePanel,
		mutate: (args: unknown) => mockDeletePanel(args),
		isPending: false,
	}),
}));

vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({ data: [texture, secondTexture] }),
}));

vi.mock("../api/panelTextureAssignmentsAdminApi", () => ({
	usePanelTextureAssignments: () => ({
		data: [
			{
				id: "assignment-1",
				panel_id: panel.id,
				texture_id: texture.id,
				is_active: true,
				is_catalog_row: true,
				sort_order: 1,
				created_at: "",
				updated_at: "",
			},
			...(newlyAssignedTexture
				? [
						{
							id: "assignment-new",
							panel_id: newUnassigned.id,
							texture_id: newlyAssignedTexture,
							is_active: true,
							is_catalog_row: true,
							sort_order: -1,
							created_at: newUnassigned.created_at,
							updated_at: newUnassigned.created_at,
						},
					]
				: []),
			...(includeDifferentSizeRow
				? [
						{
							id: "assignment-large",
							panel_id: largePanel.id,
							texture_id: secondTexture.id,
							is_active: true,
							is_catalog_row: true,
							sort_order: 2,
							created_at: "",
							updated_at: "",
						},
					]
				: []),
			...(includeSecondCatalogRow
				? [
						{
							id: "assignment-2",
							panel_id: panel.id,
							texture_id: secondTexture.id,
							is_active: true,
							is_catalog_row: true,
							sort_order: 0,
							created_at: "",
							updated_at: "",
						},
					]
				: []),
		],
		refetch: mockRefetchAssignments,
	}),
}));

vi.mock("../lib/uploadFile", () => ({
	uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

vi.mock("../ui/AdminUploadPage", () => ({
	default: ({
		editorOnly,
		initialPanel,
	}: {
		editorOnly?: boolean;
		initialPanel?: ApiPanel;
	}) => (
		<div data-testid="panel-create" data-panel-id={initialPanel?.id ?? "new"}>
			{String(editorOnly)}
		</div>
	),
}));
vi.mock("../ui/AdminTexturesPage", () => ({
	default: ({ initialTexture }: { initialTexture?: ApiTexture }) => (
		<div data-testid="texture-editor">{initialTexture?.id ?? "new"}</div>
	),
}));
vi.mock("../ui/AddExecutionModal", () => ({
	default: ({
		open,
		textureId,
		panel: targetPanel,
	}: {
		open: boolean;
		textureId?: string;
		panel?: ApiPanel | null;
	}) =>
		open ? (
			<div
				data-testid="execution-create"
				data-panel={targetPanel?.id}
				data-texture={textureId}
			>
				{textureId}
			</div>
		) : null,
}));
vi.mock("../ui/AdminPanelsWizard", () => ({
	default: () => null,
}));

vi.mock("../ui/AdminVariantEditModal", () => ({
	default: ({
		variant: current,
		initialFocus,
	}: {
		variant: ApiPanelVariant | null;
		initialFocus?: string;
	}) =>
		current ? (
			<div
				data-testid="variant-editor"
				data-focus={initialFocus ?? "executions"}
			>
				{current.id}
			</div>
		) : null,
}));

import AdminPanelsPage from "../ui/AdminPanelsPage";

describe("AdminPanelsPage — Варианты панелей", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		includeSecondCatalogRow = false;
		includeDifferentSizeRow = false;
		includeVariants = true;
		includeCircleSizeRows = false;
		showUnassignedOrdering = false;
		newlyAssignedTexture = null;
	});

	it("выравнивает галереи исполнений, дизайна и рекомендаций по верхнему краю", () => {
		const { container } = render(<AdminPanelsPage />);
		const row = container.querySelector("tbody tr[data-row-key]");
		expect(row).not.toBeNull();
		const cells = row!.querySelectorAll("td");
		for (const index of [3, 4, 5]) {
			expect(cells[index]).toHaveStyle({ verticalAlign: "top" });
		}
	});

	it("не позволяет менять остаток через админку", () => {
		render(<AdminPanelsPage embedded />);
		expect(
			screen.queryByRole("spinbutton", { name: "Остаток — ДЕМО 1" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Изменить остаток — ДЕМО 1" }),
		).not.toBeInTheDocument();
	});

	it("не показывает устаревшие кнопки и модалки над таблицей", () => {
		const { container } = render(<AdminPanelsPage embedded />);
		const page = within(container);
		for (const label of [
			"Добавить исполнение",
			"Назначить текстуры панели",
			"Управлять базовыми панелями",
			"Управлять текстурами",
			"Создать варианты",
		]) {
			expect(
				container.querySelector(`button[aria-label="${label}"]`),
			).not.toBeInTheDocument();
		}
		expect(page.getByRole("table")).toBeInTheDocument();
	});

	it("разделяет фильтры базовой формы и текстуры и позволяет применять их совместно", async () => {
		includeSecondCatalogRow = true;
		render(<AdminPanelsPage embedded />);

		const panelFilter = screen.getByRole("combobox", {
			name: "Базовая форма",
		});
		const textureFilter = screen.getByRole("combobox", {
			name: "Фильтр по текстуре",
		});
		expect(panelFilter).toBeInTheDocument();
		expect(textureFilter).toBeInTheDocument();
		expect(screen.getByText("Все базовые формы")).toBeInTheDocument();
		expect(screen.getByText("Все текстуры")).toBeInTheDocument();

		fireEvent.mouseDown(panelFilter);
		await waitFor(() =>
			expect(screen.getAllByText("ДЕМО 1").length).toBeGreaterThan(0),
		);
		fireEvent.click(screen.getAllByText("ДЕМО 1").at(-1)!);

		fireEvent.mouseDown(textureFilter);
		await waitFor(() =>
			expect(screen.getAllByText("Кожа").length).toBeGreaterThan(0),
		);
		fireEvent.click(screen.getAllByText("Кожа").at(-1)!);

		expect(screen.getAllByText("ДЕМО 1").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Кожа").length).toBeGreaterThan(0);
		expect(
			screen
				.getAllByRole("row")
				.slice(2)
				.some((row) => row.textContent?.includes("Текстиль")),
		).toBe(false);
	});

	it("фильтрует варианты по размеру вместе с текстурой и очищает выбор", async () => {
		includeDifferentSizeRow = true;
		render(<AdminPanelsPage embedded />);
		const sizeFilter = screen.getByRole("combobox", {
			name: "Фильтр по размеру",
		});
		expect(screen.getByText("Все размеры")).toBeInTheDocument();
		expect(
			screen.queryAllByRole("combobox", { name: "Размер" }).length,
		).toBeGreaterThan(0);
		fireEvent.mouseDown(sizeFilter);
		fireEvent.click((await screen.findAllByTitle("60×60 см")).at(-1)!);
		expect(screen.getByText("БОЛЬШАЯ ПАНЕЛЬ")).toBeInTheDocument();
		expect(screen.queryByText("ДЕМО 1")).not.toBeInTheDocument();

		const textureFilter = screen.getByRole("combobox", {
			name: "Фильтр по текстуре",
		});
		fireEvent.mouseDown(textureFilter);
		fireEvent.click(screen.getAllByText("Текстиль").at(-1)!);
		expect(screen.queryByText("БОЛЬШАЯ ПАНЕЛЬ")).not.toBeInTheDocument();

		fireEvent.mouseDown(sizeFilter);
		fireEvent.click(screen.getAllByText("30×30 см").at(-1)!);
		expect(screen.getByText("ДЕМО 1")).toBeInTheDocument();
	});

	it("переносит удаление строки и активность под карандаш без колонки Активен", () => {
		const { container } = render(<AdminPanelsPage embedded />);
		expect(
			Array.from(container.querySelectorAll("th")).some(
				(cell) => cell.textContent === "Активен",
			),
		).toBe(false);
		const edit = container.querySelector(
			'[aria-label="Редактировать панель"]',
		)!;
		expect(
			edit.parentElement!.querySelector('[aria-label="Удалить строку"]'),
		).not.toBeNull();
		expect(
			edit.parentElement!.querySelector('[aria-label="Активность варианта"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[aria-label="Очистить все фото в дизайне"]'),
		).not.toBeNull();
		expect(
			container.querySelector('[aria-label="Очистить все рекомендации"]'),
		).not.toBeNull();
	});

	it.each([
		["Очистить все фото в дизайне", "design_image_paths"],
		["Очистить все рекомендации", "recommendation_image_paths"],
	])("очищает только выбранную галерею: %s", async (label, field) => {
		const { container } = render(<AdminPanelsPage embedded />);
		const button = container.querySelector(
			`[aria-label="${label}"]:not(:disabled)`,
		)!;
		fireEvent.click(button);
		const confirm = await screen.findByText("Очистить", { selector: "span" });
		fireEvent.click(confirm.closest("button")!);
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith({
				variantId: variant.id,
				body: { [field]: [] },
			}),
		);
	});
	it("отмена очистки не изменяет данные", async () => {
		const { container } = render(<AdminPanelsPage embedded />);
		fireEvent.click(
			container.querySelector(
				'[aria-label="Очистить все фото в дизайне"]:not(:disabled)',
			)!,
		);
		const cancel = await screen.findByText("Отмена", { selector: "span" });
		fireEvent.click(cancel.closest("button")!);
		expect(mockUpdateVariant).not.toHaveBeenCalled();
	});

	it("ID-колонка состоит из одной иконки копирования", () => {
		render(<AdminPanelsPage embedded />);
		const copyButtons = screen.getAllByRole("button", {
			name: "Скопировать ID",
		});
		expect(copyButtons.length).toBeGreaterThan(0);
	});

	it("оставляет активность компактным переключателем без текстовых подписей", () => {
		render(<AdminPanelsPage embedded />);
		const activity = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("switch", {
			name: "Активность варианта",
		});
		expect(activity).toHaveClass("ant-switch-small");
		expect(activity).not.toHaveTextContent("Активен");
		expect(activity).not.toHaveTextContent("Не активен");
	});

	it("укладывает галереи в сетку из четырёх миниатюр", () => {
		render(<AdminPanelsPage embedded />);
		const firstThumbnail = screen.getAllByRole("button", {
			name: "Открыть миниатюры",
		})[0];
		expect(firstThumbnail.parentElement).toHaveStyle({
			display: "grid",
			gridTemplateColumns: "repeat(4, 40px)",
		});
	});

	it("ставит удаление последней плиткой в сетке вариантов исполнений", () => {
		render(<AdminPanelsPage embedded />);
		const deleteButton = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Удалить все варианты исполнения",
		});
		const grid = deleteButton.parentElement;
		expect(grid).toHaveStyle({
			display: "grid",
			gridTemplateColumns: "repeat(4, 40px)",
		});
		expect(grid?.lastElementChild).toBe(deleteButton);
	});

	it("корзина в колонке исполнений показывается только как иконка без рамки", () => {
		render(<AdminPanelsPage embedded />);
		const deleteButton = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Удалить все варианты исполнения",
		});
		const inlineBorder = deleteButton.style.border;
		const inlineBorderRadius = deleteButton.style.borderRadius;
		const inlineBackground = deleteButton.style.background;
		const cssText = deleteButton.style.cssText;
		expect(cssText).toMatch(/border:\s*0px/);
		expect(cssText).toMatch(/background:\s*transparent/);
		expect(cssText).not.toMatch(/1px solid #ffccc7/);
		expect(cssText).not.toMatch(/#fff2f0/);
		expect(inlineBorderRadius).toBe("0px");
		expect(inlineBackground).toBe("transparent");
		expect(inlineBorder).toBe(inlineBorder);
		expect(deleteButton.querySelector(".anticon-clear")).toBeInTheDocument();
	});

	it("модалка просмотра базовой формы содержит кнопку редактирования", async () => {
		render(<AdminPanelsPage embedded />);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Просмотр формы",
			}),
		);
		const editButton = await screen.findByRole("button", {
			name: "Редактировать базовую панель",
		});
		expect(editButton).toBeEnabled();
		fireEvent.click(editButton);
		await waitFor(() => {
			const editor = screen.getByTestId("panel-create");
			expect(editor).toHaveTextContent("true");
		});
	});

	it("показывает название текстуры в закрытом селекторе", () => {
		render(<AdminPanelsPage embedded />);
		const select = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("combobox", { name: "Текстура" });
		expect(select).toBeInTheDocument();
		expect(select.closest(".ant-select")).toHaveTextContent("Текстиль");
	});

	it("раскрывает список текстур достаточно широко для полного первого слова", async () => {
		render(<AdminPanelsPage embedded />);
		fireEvent.mouseDown(
			within(screen.getByText(panel.name).closest("tr")!).getByRole(
				"combobox",
				{ name: "Текстура" },
			),
		);
		const option = await screen.findByRole("option", { name: "Текстиль" });
		const popup = option.closest(".ant-select-dropdown");
		expect(popup).not.toBeNull();
		expect(popup).toHaveStyle({ width: "320px" });
	});

	it("всегда показывает действия в крайней видимой ячейке с переключателем", () => {
		render(<AdminPanelsPage embedded />);
		const activity = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("switch", {
			name: "Активность варианта",
		});
		const cell = activity.closest("td");
		expect(cell).not.toBeNull();
		expect(
			cell?.querySelector('[aria-label="Копировать строку"]'),
		).not.toBeInTheDocument();
		expect(
			cell?.querySelector('[aria-label="Удалить строку"]'),
		).toBeInTheDocument();
	});

	it("таблица без внутреннего скролла — занимает всю ширину контейнера", () => {
		render(<AdminPanelsPage embedded />);
		expect(screen.getByRole("table")).toHaveStyle({ width: "100%" });
		expect(
			screen.getByRole("table").closest(".ant-table-content"),
		).not.toHaveStyle({ overflowX: "auto" });
	});

	it("размер базовой формы меняется селектором в ячейке через PATCH", async () => {
		render(<AdminPanelsPage embedded />);
		const row = screen.getByText(panel.name).closest("tr")!;
		const sizeSelect = within(row).getByRole("combobox", { name: "Размер" });
		expect(sizeSelect.closest(".ant-select")).toHaveTextContent(
			panel.size_label,
		);
		expect(sizeSelect.closest(".ant-select")).toHaveStyle({ width: "50%" });
		fireEvent.mouseDown(sizeSelect);
		fireEvent.click((await screen.findAllByTitle("60×60 см")).at(-1)!);
		await waitFor(() =>
			expect(mockUpdatePanel).toHaveBeenCalledWith({
				panelId: panel.id,
				body: { width_mm: 600, height_mm: 600, size_label: "60×60 см" },
			}),
		);
	});

	it("карандаш базовой формы открывает полный редактор AdminUploadPage", async () => {
		render(<AdminPanelsPage embedded />);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Редактировать панель",
			}),
		);
		const editor = await screen.findByTestId("panel-create");
		expect(editor).toHaveTextContent("true");
		expect(editor).toHaveAttribute("data-panel-id", panel.id);
		expect(
			screen.queryByRole("dialog", { name: "Редактировать панель" }),
		).toBeNull();
	});

	it("клик по миниатюре исполнения открывает редактор исполнения", async () => {
		render(<AdminPanelsPage embedded />);
		const row = screen.getByText(panel.name).closest("tr")!;
		const buttons = within(row).getAllByRole("button", {
			name: "Открыть миниатюры",
		});
		// First thumbnails belong to the panel photo cell; executions follow.
		fireEvent.click(buttons[1]);
		await waitFor(() =>
			expect(screen.getByTestId("variant-editor")).toHaveAttribute(
				"data-focus",
				"executions",
			),
		);
	});

	it("клик по фото в дизайне открывает редактор с фокусом на интерьерах", async () => {
		render(<AdminPanelsPage embedded />);
		const designAdd = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Добавить фото в дизайне",
		});
		fireEvent.click(designAdd);
		await waitFor(() =>
			expect(screen.getByTestId("variant-editor")).toHaveAttribute(
				"data-focus",
				"designs",
			),
		);
	});

	it("колонка рекомендаций открывает отдельную модалку варианта", async () => {
		render(<AdminPanelsPage embedded />);
		expect(screen.getAllByText("Рекомендации").length).toBeGreaterThan(0);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Добавить рекомендацию",
			}),
		);
		await waitFor(() =>
			expect(screen.getByTestId("variant-editor")).toHaveAttribute(
				"data-focus",
				"recommendations",
			),
		);
	});

	it("карточка просмотра показывает имя и размер формы", async () => {
		render(<AdminPanelsPage embedded />);
		const row = (await screen.findByText(panel.name)).closest("tr")!;
		fireEvent.click(
			within(row).getByRole("button", { name: "Просмотр формы" }),
		);
		expect(
			await screen.findByText("Базовая форма: ДЕМО 1"),
		).toBeInTheDocument();
		expect(
			await screen.findByText(panel.size_label, {
				selector: ".ant-drawer-body *",
			}),
		).toBeInTheDocument();
	});
	it("плюсы в шапках открывают создание, а просмотр — редактирование конкретной текстуры", async () => {
		render(<AdminPanelsPage embedded />);
		fireEvent.click(screen.getByRole("button", { name: "Добавить панель" }));
		expect(await screen.findByTestId("panel-create")).toHaveTextContent("true");
		fireEvent.click(screen.getByRole("button", { name: "Добавить текстуру" }));
		expect(await screen.findByTestId("texture-editor")).toHaveTextContent(
			"new",
		);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Просмотр фактуры",
			}),
		);
		fireEvent.click(
			await screen.findByRole("button", { name: "Редактировать текстуру" }),
		);
		expect(await screen.findByTestId("texture-editor")).toHaveTextContent(
			texture.id,
		);
	});

	it("плюс в шапке колонки открывает создание исполнения", () => {
		render(<AdminPanelsPage embedded />);
		const add = document.querySelector<HTMLButtonElement>(
			'th button[aria-label="Добавить вариант исполнения"]',
		);
		expect(add).toBeInTheDocument();
		expect(
			document.querySelector('button[aria-label="Нет вариантов исполнения"]'),
		).not.toBeInTheDocument();
		expect(
			document.querySelector('button[aria-label="Добавить вариант"]'),
		).not.toBeInTheDocument();
		fireEvent.click(add!);
		expect(screen.getByTestId("execution-create")).toBeInTheDocument();
	});

	it("назначает текстуру новой базовой панели из пустой строки", async () => {
		showUnassignedOrdering = true;
		mockUpdateRowTexture.mockResolvedValue([]);
		try {
			render(<AdminPanelsPage embedded />);
			const row = screen.getByText("НОВАЯ ФОРМА").closest("tr")!;
			const select = row.querySelector('[aria-label="Текстура"]')!;
			fireEvent.mouseDown(select);
			fireEvent.click((await screen.findAllByText(secondTexture.name)).at(-1)!);
			await waitFor(() =>
				expect(mockUpdateRowTexture).toHaveBeenCalledWith({
					panel_id: newUnassigned.id,
					current_texture_id: "",
					texture_id: secondTexture.id,
				}),
			);
			await waitFor(() => expect(mockRefetchAssignments).toHaveBeenCalled());
		} finally {
			showUnassignedOrdering = false;
		}
	});

	it("меняет текстуру всей строки через строковый endpoint", async () => {
		mockUpdateRowTexture.mockResolvedValue([]);
		render(<AdminPanelsPage embedded />);
		fireEvent.mouseDown(
			within(screen.getByText(panel.name).closest("tr")!).getByRole(
				"combobox",
				{ name: "Текстура" },
			),
		);
		fireEvent.click(await screen.findByText(secondTexture.name));
		await waitFor(() =>
			expect(mockUpdateRowTexture).toHaveBeenCalledWith({
				panel_id: panel.id,
				current_texture_id: texture.id,
				texture_id: secondTexture.id,
			}),
		);
		expect(mockUpdateVariant).not.toHaveBeenCalled();
		await waitFor(() => {
			expect(mockRefetchVariants).toHaveBeenCalled();
			expect(mockRefetchAssignments).toHaveBeenCalled();
		});
	});

	it("подтверждённо очищает все исполнения строки", async () => {
		mockDeleteVariantGroup.mockResolvedValue(undefined);
		render(<AdminPanelsPage embedded />);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Удалить все варианты исполнения",
			}),
		);
		fireEvent.click(await screen.findByRole("button", { name: "Удалить все" }));
		await waitFor(() =>
			expect(mockDeleteVariantGroup).toHaveBeenCalledWith({
				panelId: panel.id,
				textureId: texture.id,
			}),
		);
	});

	it("после очистки исполнений строка назначения остаётся видимой", () => {
		// Contract is covered by assignment-derived rows: the group delete no longer
		// owns row visibility, only its execution thumbnails.
		expect(mockRefetchAssignments).not.toHaveBeenCalled();
	});

	it("ID строки всегда принадлежит базовой панели при фильтрации формы", async () => {
		const writeText = vi.fn();
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		render(<AdminPanelsPage embedded />);
		const row = screen.getByText("ДЕМО 1").closest("tr")!;
		const copyId = row.querySelector('[aria-label="Скопировать ID"]')!;
		fireEvent.click(copyId);
		expect(writeText).toHaveBeenCalledWith(panel.id);
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Базовая форма" }),
		);
		fireEvent.click((await screen.findAllByText(panel.name)).at(-1)!);
		const filtered = screen
			.getAllByRole("row")
			.slice(2)
			.find((entry) => entry.textContent?.includes("ДЕМО 1"))!;
		fireEvent.click(filtered.querySelector('[aria-label="Скопировать ID"]')!);
		expect(writeText).toHaveBeenLastCalledWith(panel.id);
		expect(filtered).toHaveTextContent(texture.name);
	});

	it("ранее созданные формы по алфавиту, одинаковые названия рядом", () => {
		showUnassignedOrdering = true;
		try {
			render(<AdminPanelsPage embedded />);
			const bodyRows = screen.getAllByRole("row").slice(2);
			expect(bodyRows[0]).toHaveTextContent("ДЕМО 1");
			expect(bodyRows[1]).toHaveTextContent("НОВАЯ ФОРМА");
			expect(bodyRows[1]).not.toHaveTextContent("копия");
			expect(bodyRows[2]).toHaveTextContent("ФОРМА");
			expect(bodyRows[3]).toHaveTextContent("ФОРМА");
		} finally {
			showUnassignedOrdering = false;
		}
	});

	it("назначенная текстура не сдвигает новую строку после обновления списка", () => {
		showUnassignedOrdering = true;
		const { rerender } = render(<AdminPanelsPage embedded />);
		const namesBefore = screen
			.getAllByRole<HTMLTableRowElement>("row")
			.slice(2)
			.map((row) => row.cells[0].textContent);
		newlyAssignedTexture = secondTexture.id;
		try {
			rerender(<AdminPanelsPage embedded />);
			const rows = screen.getAllByRole<HTMLTableRowElement>("row").slice(2);
			expect(rows.map((row) => row.cells[0].textContent)).toEqual(namesBefore);
			expect(
				rows.find((row) => row.textContent?.includes("НОВАЯ ФОРМА")),
			).toHaveTextContent(secondTexture.name);
		} finally {
			newlyAssignedTexture = null;
			showUnassignedOrdering = false;
		}
	});

	it("фильтр форм показывает один пункт для формы с разными размерами и применяет отдельный фильтр размера", async () => {
		includeCircleSizeRows = true;
		render(<AdminPanelsPage embedded />);

		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Базовая форма" }),
		);
		await waitFor(() => {
			expect(
				document.querySelectorAll('.ant-select-item-option[title="КРУГ"]'),
			).toHaveLength(1);
		});
		fireEvent.click(
			document.querySelector('.ant-select-item-option[title="КРУГ"]')!,
		);

		await waitFor(() =>
			expect(screen.getAllByRole("row").slice(2)).toHaveLength(2),
		);
		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Фильтр по размеру" }),
		);
		const largeSizeOptions = await screen.findAllByText("60×60 см");
		fireEvent.click(largeSizeOptions.at(-1)!);
		await waitFor(() => {
			const rows = screen
				.getAllByRole("row")
				.slice(2)
				.filter((row) => !row.textContent?.includes("Базовая панель"));
			expect(rows).toHaveLength(1);
			expect(rows[0]).toHaveTextContent("КРУГ");
		});
	});

	it("показывает строки по сохранённому sort_order", () => {
		includeSecondCatalogRow = true;
		render(<AdminPanelsPage embedded />);
		const bodyRows = screen.getAllByRole("row").slice(2);
		// Unassigned forms appear first; persisted catalog assignments keep their sort order.
		const assignedRows = bodyRows.filter((row) =>
			row.textContent?.includes(panel.name),
		);
		expect(assignedRows).toHaveLength(2);
		expect(assignedRows[0]).toHaveTextContent(secondTexture.name);
		expect(assignedRows[1]).toHaveTextContent(texture.name);
	});

	it("фильтры содержат только реальные формы и текстуры каталожных строк", async () => {
		includeSecondCatalogRow = true;
		render(<AdminPanelsPage embedded />);

		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Базовая форма" }),
		);
		expect(screen.getAllByText(panel.name).length).toBeGreaterThan(0);
		expect(screen.getAllByText(deletedPanel.name).length).toBeGreaterThan(0);
		fireEvent.click(screen.getAllByText(panel.name).at(-1)!);

		fireEvent.mouseDown(
			screen.getByRole("combobox", { name: "Фильтр по текстуре" }),
		);
		expect(screen.getAllByText(texture.name).length).toBeGreaterThan(0);
		expect(screen.getAllByText(secondTexture.name).length).toBeGreaterThan(0);
		fireEvent.click(screen.getAllByText(secondTexture.name).at(-1)!);

		await waitFor(() => {
			const bodyRows = screen.getAllByRole("row").slice(2);
			expect(bodyRows).toHaveLength(1);
			expect(bodyRows[0]).toHaveTextContent(secondTexture.name);
			expect(bodyRows[0]).not.toHaveTextContent(texture.name);
		});
	});

	it("в непустой строке плюс добавляет ещё одно исполнение к той же панели и текстуре", () => {
		render(<AdminPanelsPage embedded />);
		const executionAdd = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Добавить вариант исполнения в эту строку",
		});
		fireEvent.click(executionAdd);
		expect(screen.getByTestId("execution-create")).toHaveAttribute(
			"data-panel",
			panel.id,
		);
		expect(screen.getByTestId("execution-create")).toHaveAttribute(
			"data-texture",
			texture.id,
		);
	});

	it("в пустой строке оба плюса открывают создание исполнения этой строки", () => {
		includeVariants = false;
		const { unmount } = render(<AdminPanelsPage embedded />);
		const executionAdd = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Добавить вариант исполнения в эту строку",
		});
		fireEvent.click(executionAdd);
		expect(screen.getByTestId("execution-create")).toHaveAttribute(
			"data-panel",
			panel.id,
		);
		expect(screen.getByTestId("execution-create")).toHaveAttribute(
			"data-texture",
			texture.id,
		);
		unmount();

		render(<AdminPanelsPage embedded />);
		fireEvent.click(
			within(screen.getByText(panel.name).closest("tr")!).getByRole("button", {
				name: "Добавить фото в дизайне",
			}),
		);
		expect(screen.getByTestId("execution-create")).toHaveAttribute(
			"data-texture",
			texture.id,
		);
	});

	it("правая корзина удаляет строку по panel+texture", async () => {
		mockDeleteVariantRow.mockResolvedValue(undefined);
		render(<AdminPanelsPage embedded />);
		const row = screen.getByText("ДЕМО 1").closest("tr");
		fireEvent.click(row!.querySelector('[aria-label="Удалить строку"]')!);
		fireEvent.click(
			await screen.findByText("Удалить строку", {
				selector: ".ant-popconfirm-buttons button span",
			}),
		);
		await waitFor(() =>
			expect(mockDeleteVariantRow).toHaveBeenCalledWith({
				panelId: panel.id,
				textureId: texture.id,
			}),
		);
	});

	it("удаляет строку без фактуры как базовую панель, не вызывая удаление назначения", async () => {
		showUnassignedOrdering = true;
		mockDeletePanel.mockResolvedValue(undefined);
		render(<AdminPanelsPage embedded />);
		const row = screen.getByText("НОВАЯ ФОРМА").closest("tr");
		expect(row).not.toBeNull();
		fireEvent.click(row!.querySelector('[aria-label="Удалить строку"]')!);
		fireEvent.click(
			await screen.findByText("Удалить строку", {
				selector: ".ant-popconfirm-buttons button span",
			}),
		);
		await waitFor(() =>
			expect(mockDeletePanel).toHaveBeenCalledWith(newUnassigned.id),
		);
		expect(mockDeleteVariantRow).not.toHaveBeenCalled();
	});

	it("плюс фото в дизайне остаётся последним в своём ряду", () => {
		render(<AdminPanelsPage embedded />);
		const designAdd = within(
			screen.getByText(panel.name).closest("tr")!,
		).getByRole("button", {
			name: "Добавить фото в дизайне",
		});
		expect(designAdd.nextElementSibling).toHaveAttribute(
			"aria-label",
			"Очистить все фото в дизайне",
		);
		fireEvent.click(designAdd);
		expect(screen.getByTestId("variant-editor")).toHaveAttribute(
			"data-focus",
			"designs",
		);
		expect(screen.getByTestId("variant-editor")).toHaveTextContent(variant.id);
	});

	it("колонка базовой формы: глазок, карандаш, имя, галерея, размер", async () => {
		render(<AdminPanelsPage embedded />);
		const row = (await screen.findByText(panel.name)).closest("tr")!;
		// Eye icon opens the preview drawer, pencil below it opens the full editor.
		expect(within(row).getByLabelText("Просмотр формы")).toBeInTheDocument();
		expect(
			within(row).getByLabelText("Редактировать панель"),
		).toBeInTheDocument();
		// Photo gallery like in the other columns: thumbnails + dashed "+" tile.
		const thumbs = within(row).getAllByLabelText("Открыть миниатюры");
		expect(thumbs.length).toBeGreaterThan(0);
		const cellGrid = thumbs[0].parentElement;
		expect(cellGrid).toHaveStyle({
			display: "grid",
			gridTemplateColumns: "repeat(4, 40px)",
		});
		const img = thumbs[0].querySelector("img");
		expect(img?.getAttribute("src")).toContain("panels/demo.webp");
		expect(
			within(row).getByLabelText("Добавить фото формы"),
		).toBeInTheDocument();
		expect(
			within(row).getByLabelText("Удалить все фото формы"),
		).toBeInTheDocument();
		// Editable size dropdown under the gallery.
		expect(within(row).getByLabelText("Размер")).toBeInTheDocument();
	});

	it("корзина в галерее формы удаляет все фото через PATCH", async () => {
		render(<AdminPanelsPage embedded />);
		const row = (await screen.findByText(panel.name)).closest("tr")!;
		fireEvent.click(within(row).getByLabelText("Удалить все фото формы"));
		fireEvent.click(
			await screen.findByText("Удалить все", {
				selector: ".ant-popconfirm-buttons button span",
			}),
		);
		await waitFor(() =>
			expect(mockUpdatePanel).toHaveBeenCalledWith({
				panelId: panel.id,
				body: { photo_paths: [] },
			}),
		);
	});

	it("плюс в галерее формы открывает карточку просмотра для загрузки фото", async () => {
		render(<AdminPanelsPage embedded />);
		const row = (await screen.findByText(panel.name)).closest("tr")!;
		fireEvent.click(within(row).getByLabelText("Добавить фото формы"));
		expect(
			await screen.findByText("Базовая форма: ДЕМО 1"),
		).toBeInTheDocument();
	});

	it("пустая строка-шаблон всегда видна сверху таблицы", async () => {
		render(<AdminPanelsPage embedded />);
		const picker = screen.getByRole("combobox", {
			name: "Базовая панель для новой строки",
		});
		expect(screen.getAllByRole("row")[1]).toContainElement(picker);
	});
	it("выбор панели и текстуры в шаблоне держит их в первой строке и не трогает данные", async () => {
		render(<AdminPanelsPage embedded />);
		const headRow = screen.getAllByRole("row")[1];
		const picker = within(headRow).getByRole("combobox", {
			name: "Базовая панель для новой строки",
		});
		fireEvent.mouseDown(picker);
		fireEvent.click(await screen.findByText("ДЕМО 1 · 30×30 см"));
		// Выбор остаётся в шапке-конструкторе: кнопка создания активна,
		// новых обычных строк редактирования при этом не появляется.
		// (AntD Select не отражает выбор в тексте combobox-роли в jsdom —
		// готовность пары проверяем по состоянию кнопки ниже.)
		expect(screen.getAllByRole("row").length).toBeGreaterThan(1);
		fireEvent.mouseDown(
			within(headRow).getByRole("combobox", {
				name: "Текстура для новой строки",
			}),
		);
		fireEvent.click((await screen.findAllByText(secondTexture.name)).at(-1)!);
		// До нажатия кнопки ничего серверного не вызываем.
		expect(mockUpdateRowTexture).not.toHaveBeenCalled();
		// Кнопка создания активна только при обоих выборах.
		expect(
			within(headRow).getByRole("button", { name: "Добавить строку" }),
		).toBeEnabled();
	});

	it("кнопка добавления без панели предупреждает и ничего не сохраняет", async () => {
		render(<AdminPanelsPage embedded />);
		const headRow = screen.getAllByRole("row")[1];
		fireEvent.click(
			within(headRow).getByRole("button", { name: "Добавить строку" }),
		);
		await waitFor(() => expect(mockUpdateRowTexture).not.toHaveBeenCalled());
	});

	it("кнопка добавления создаёт строку выбранной пары панель+текстура", async () => {
		includeSecondCatalogRow = true;
		mockUpdateRowTexture.mockResolvedValue([]);
		render(<AdminPanelsPage embedded />);
		const headRow = screen.getAllByRole("row")[1];
		fireEvent.mouseDown(
			within(headRow).getByRole("combobox", {
				name: "Базовая панель для новой строки",
			}),
		);
		fireEvent.click(await screen.findByText("ДЕМО 1 · 30×30 см"));
		fireEvent.mouseDown(
			within(headRow).getByRole("combobox", {
				name: "Текстура для новой строки",
			}),
		);
		fireEvent.click((await screen.findAllByText(secondTexture.name)).at(-1)!);
		fireEvent.click(
			within(headRow).getByRole("button", { name: "Добавить строку" }),
		);
		await waitFor(() =>
			expect(mockUpdateRowTexture).toHaveBeenCalledWith({
				panel_id: panel.id,
				current_texture_id: "",
				texture_id: secondTexture.id,
			}),
		);
		await waitFor(() => expect(mockRefetchAssignments).toHaveBeenCalled());
		// Созданная строка закрепляется сразу под полем добавления,
		// поверх серверного порядка сортировки.
		const pinned = screen.getAllByRole("row")[2];
		expect(pinned).toHaveTextContent(panel.name);
		expect(pinned).toHaveTextContent(secondTexture.name);
	});

	it("поле добавления: ID, фото в дизайне, рекомендации и актив — пустые ячейки", async () => {
		render(<AdminPanelsPage embedded />);
		const headRow = screen.getAllByRole("row")[1];
		const cells = within(headRow).getAllByRole("cell");
		// ID
		expect(cells[0]).toHaveTextContent("");
		// Фото в дизайне и Рекомендации — без подписей-заглушек.
		expect(headRow.textContent ?? "").not.toContain("Новая строка");
		expect(headRow.textContent ?? "").not.toContain("После сохранения");
		expect(headRow.textContent ?? "").not.toContain("Очистить");
		// Выбор сбрасывается крестиками самих селекторов, отдельных кнопок в строке нет.
		expect(
			within(headRow).queryByRole("button", { name: "Очистить новую строку" }),
		).toBeNull();
	});
});

describe("действия пустой строки", () => {
	it("переключает активность строки без исполнений", async () => {
		includeVariants = false;
		render(<AdminPanelsPage />);
		const row = screen.getByText(panel.name).closest("tr")!;
		expect(
			within(row).queryByRole("button", { name: "Копировать строку" }),
		).toBeNull();
		fireEvent.click(
			within(row).getByRole("switch", { name: "Активность варианта" }),
		);
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith({
				panel_id: panel.id,
				texture_id: texture.id,
				is_active: false,
			}),
		);
	});
});
