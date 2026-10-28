import {
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPanelMatrix from "../ui/AdminPanelMatrix";

const state = vi.hoisted(() => ({
	query: vi.fn(),
	refetch: vi.fn(),
	textureRefetch: vi.fn(),
	assignmentsRefetch: vi.fn(),
	variantsRefetch: vi.fn(),
}));

vi.mock("../api/panelsAdminApi", () => ({
	usePanelsAdminList: (query: unknown) => {
		state.query(query);
		return {
			data: {
				items: [
					{
						id: "test-panel",
						name: "Панель без вариантов",
						slug: "test",
						size_label: "300 × 300",
						base_price: 1,
						is_active: true,
					},
					{
						id: "demo-panel",
						name: "САТИН 30×30",
						slug: "satin",
						size_label: "30×30 см",
						base_price: 1,
						is_active: true,
					},
				],
				total: 2,
			},
			isFetching: false,
			error: null,
			refetch: state.refetch,
		};
	},
	useDeletePanel: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({
		data: [
			{
				id: "tex-1",
				name: "Текстиль",
				slug: "textile",
				swatch_image: "",
				sort_order: 0,
				is_active: true,
				created_at: "",
			},
		],
		isFetching: false,
		error: null,
		refetch: state.textureRefetch,
	}),
}));

vi.mock("../api/panelTextureAssignmentsAdminApi", () => ({
	usePanelTextureAssignments: () => ({
		data: [
			{
				id: "a-1",
				panel_id: "demo-panel",
				texture_id: "tex-1",
				is_active: true,
				created_at: "",
				updated_at: "",
			},
		],
		isFetching: false,
		error: null,
		refetch: state.assignmentsRefetch,
	}),
}));

vi.mock("../api/panelVariantsAdminApi", () => ({
	usePanelVariantsAdminList: () => ({
		data: {
			items: [
				{
					id: "v-1",
					panel_id: "demo-panel",
					texture_id: "tex-1",
					color_id: null,
					color_hex: null,
					image_paths: ["/uploads/x.jpg"],
					design_image_paths: [],
					is_active: true,
					created_at: "",
					updated_at: "",
				},
			],
			total: 1,
			offset: 0,
			limit: 200,
		},
		isFetching: false,
		refetch: state.variantsRefetch,
	}),
}));

vi.mock("../ui/PanelTextureAssignmentsModal", () => ({
	default: ({ panel }: { panel: { id: string } }) => (
		<div role="dialog">Назначения {panel.id}</div>
	),
}));

function renderMatrix(): void {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={client}>
			<AdminPanelMatrix />
		</QueryClientProvider>,
	);
}

describe("Товарная матрица", () => {
	beforeEach(() => vi.clearAllMocks());

	it("строит плоские строки Панель × Текстура", () => {
		renderMatrix();
		expect(screen.getByText("Панель без вариантов")).toBeInTheDocument();
		expect(screen.getByText("САТИН 30×30")).toBeInTheDocument();
		expect(screen.getByText("Текстиль")).toBeInTheDocument();
	});

	it("показывает фото исполнений и пометку «Нет» для пустых", () => {
		renderMatrix();
		expect(screen.getAllByText("Нет").length).toBeGreaterThan(0);
		expect(screen.getAllByAltText("").length).toBeGreaterThan(0);
	});

	it("открывает назначения нужной панели", async () => {
		renderMatrix();
		const buttons = screen.getAllByRole("button", {
			name: /Редактировать панель/i,
		});
		fireEvent.click(buttons[0]);
		await waitFor(() =>
			expect(screen.getByRole("dialog")).toHaveTextContent("test-panel"),
		);
	});

	it("передаёт поисковый запрос серверу", async () => {
		renderMatrix();
		const input = screen.getByPlaceholderText("Поиск панели");
		fireEvent.change(input, { target: { value: "сатин" } });
		fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });
		await waitFor(() =>
			expect(state.query).toHaveBeenLastCalledWith({
				page: 1,
				size: 200,
				search: "сатин",
				isActive: null,
			}),
		);
	});
});
