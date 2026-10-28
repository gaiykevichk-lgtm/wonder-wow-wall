import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiPanel } from "../api/panelsAdminApi";
import PanelTextureAssignmentsModal from "../ui/PanelTextureAssignmentsModal";

const state = vi.hoisted(() => ({
	error: false,
	loading: false,
	save: vi.fn(),
}));
vi.mock("../api/panelTextureAssignmentsAdminApi", () => ({
	usePanelTextureAssignments: () => ({
		data: [{ texture_id: "t1" }],
		isLoading: state.loading,
		isError: state.error,
	}),
	useReplacePanelTextureAssignments: () => ({
		mutateAsync: state.save,
		isPending: false,
	}),
}));
vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({
		data: [
			{ id: "t1", name: "Текстура A", slug: "a" },
			{ id: "t2", name: "Текстура B", slug: "b" },
		],
		isLoading: false,
		isError: false,
	}),
}));
const panel = { id: "isolated-test-panel", name: "Панель теста" } as ApiPanel;
describe("Назначение текстур — изолированные компонентные проверки", () => {
	beforeEach(() => {
		state.error = false;
		state.loading = false;
		state.save.mockReset();
		state.save.mockResolvedValue([]);
	});
	it("сохраняет явный выбор только для выбранной панели", async () => {
		render(
			<PanelTextureAssignmentsModal open panel={panel} onClose={vi.fn()} />,
		);
		expect(screen.getByRole("checkbox", { name: "Текстура A" })).toBeChecked();
		fireEvent.click(screen.getByRole("checkbox", { name: "Текстура B" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Сохранить назначения" }),
		);
		await waitFor(() =>
			expect(state.save).toHaveBeenCalledWith({
				panelId: panel.id,
				textureIds: ["t1", "t2"],
				expectedTextureIds: ["t1"],
			}),
		);
	});
	it("отмена не отправляет изменения", () => {
		render(
			<PanelTextureAssignmentsModal open panel={panel} onClose={vi.fn()} />,
		);
		fireEvent.click(screen.getByRole("checkbox", { name: "Текстура A" }));
		fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
		expect(state.save).not.toHaveBeenCalled();
	});
	it("ошибка загрузки блокирует сохранение пустого набора", () => {
		state.error = true;
		render(
			<PanelTextureAssignmentsModal open panel={panel} onClose={vi.fn()} />,
		);
		expect(
			screen.getByRole("button", { name: "Сохранить назначения" }),
		).toBeDisabled();
		expect(state.save).not.toHaveBeenCalled();
	});
	it("не сохраняет до завершения загрузки", () => {
		state.loading = true;
		render(
			<PanelTextureAssignmentsModal open panel={panel} onClose={vi.fn()} />,
		);
		expect(
			screen.getByRole("button", { name: "Сохранить назначения" }),
		).toBeDisabled();
	});
});
