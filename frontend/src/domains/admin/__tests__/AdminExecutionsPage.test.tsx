import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminExecutionsPage from "../ui/AdminExecutionsPage";
const refetch = vi.fn();
vi.mock("../api/panelVariantsAdminApi", () => ({
	usePanelVariantsAdminList: () => ({
		data: {
			items: [
				{
					id: "execution-1",
					panel_id: "form-1",
					texture_id: "texture-1",
					name: "Первое",
					image_paths: ["product.webp"],
					design_image_paths: ["interior.webp"],
					recommendation_image_paths: ["recommendation.webp"],
					is_active: true,
				},
			],
		},
		refetch,
	}),
	useDeletePanelVariant: () => ({ mutateAsync: vi.fn() }),
	useUpdatePanelVariant: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../api/panelsAdminApi", () => ({
	usePanelsAdminList: () => ({
		data: { items: [{ id: "form-1", name: "Форма" }] },
	}),
}));
vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({ data: [{ id: "texture-1", name: "Текстура" }] }),
}));
vi.mock("../ui/AdminVariantEditModal", () => ({
	default: ({
		variant,
		initialFocus,
	}: {
		variant: { id: string };
		initialFocus: string;
	}) => (
		<div data-testid="editor">
			{variant.id}:{initialFocus}
		</div>
	),
}));
vi.mock("../ui/AddExecutionModal", () => ({ default: () => null }));
afterEach(cleanup);
describe("Вкладки исполнений и фото дизайна", () => {
	it("показывает исполнение одной миниатюрой без дублирующей колонки и UUID", () => {
		const { container } = render(<AdminExecutionsPage mode="executions" />);
		expect(container.querySelector('img[src$="product.webp"]')).not.toBeNull();
		expect(container.querySelector('img[src$="interior.webp"]')).toBeNull();
		expect(
			container.querySelectorAll("th").length,
		).toBe(5);
		expect(screen.queryByText("execution-1")).toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Открыть исполнение Первое" }),
		);
		expect(screen.getByTestId("editor")).toHaveTextContent(
			"execution-1:executions",
		);
	});
	it("показывает миниатюру исполнения и design_image_paths того же ID", () => {
		const { container } = render(<AdminExecutionsPage mode="designs" />);
		expect(container.querySelector('img[src$="interior.webp"]')).not.toBeNull();
		expect(container.querySelector('img[src$="product.webp"]')).not.toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Добавить фото в дизайне" }),
		);
		expect(screen.getByTestId("editor")).toHaveTextContent(
			"execution-1:designs",
		);
		expect(
			screen.queryByRole("button", { name: "Удалить исполнение" }),
		).toBeNull();
	});
	it("показывает привязанные рекомендации и открывает их редактор", () => {
		const { container } = render(
			<AdminExecutionsPage mode="recommendations" />,
		);
		expect(
			container.querySelector('img[src$="recommendation.webp"]'),
		).not.toBeNull();
		fireEvent.click(
			screen.getByRole("button", { name: "Добавить рекомендацию" }),
		);
		expect(screen.getByTestId("editor")).toHaveTextContent(
			"execution-1:recommendations",
		);
	});

	it("поиск фильтрует записи и сбрасывается", () => {
		render(<AdminExecutionsPage />);
		fireEvent.change(screen.getByLabelText("Поиск исполнений"), {
			target: { value: "Несуществующее" },
		});
		expect(screen.queryByText("Первое")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Сбросить" }));
		expect(screen.getByText("Первое")).toBeInTheDocument();
	});
});
