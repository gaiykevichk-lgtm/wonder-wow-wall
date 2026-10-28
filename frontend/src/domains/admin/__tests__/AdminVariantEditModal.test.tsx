import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiPanelVariant } from "../api/panelVariantsAdminApi";

const mockUpdateVariant = vi.fn();
const mockCreateVariant = vi.fn();
const mockUploadFileToS3 = vi.fn();
const mockAddImage = vi.fn();
const mockRemoveImage = vi.fn();
const mockReorderImages = vi.fn();

const variant: ApiPanelVariant = {
	id: "variant-1",
	name: "Исполнение 1",
	panel_id: "panel-1",
	texture_id: "texture-1",
	color_id: null,
	color_hex: null,
	image_paths: ["variants/panel-1/texture-1/execution.webp"],
	design_image_paths: [],
	recommendation_image_paths: [],
	sort_order: 0,
	is_active: true,
	created_at: "2026-09-14T10:00:00Z",
	updated_at: "2026-09-14T10:00:00Z",
};

vi.mock("../api/texturesAdminApi", () => ({
	useAdminTextures: () => ({
		data: [
			{ id: "texture-1", name: "Текстиль" },
			{ id: "texture-2", name: "Дерево" },
		],
		isLoading: false,
	}),
}));

vi.mock("../api/panelVariantsAdminApi", () => ({
	useCreatePanelVariant: () => ({
		mutateAsync: mockCreateVariant,
		isPending: false,
	}),
	useUpdatePanelVariant: () => ({
		mutateAsync: mockUpdateVariant,
		isPending: false,
	}),
	useAddVariantImage: () => ({
		mutateAsync: mockAddImage,
		isPending: false,
	}),
	useRemoveVariantImage: () => ({
		mutateAsync: mockRemoveImage,
		isPending: false,
	}),
	useReorderVariantImages: () => ({
		mutateAsync: mockReorderImages,
		isPending: false,
	}),
	uploadFileToS3: (...args: unknown[]) => mockUploadFileToS3(...args),
}));

import AdminVariantEditModal, { type VariantPhotoDraft } from "../ui/AdminVariantEditModal";

describe("AdminVariantEditModal — фото в дизайне и рекомендации", () => {
	it("сохраняет черновики нескольких исполнений одним нажатием после переключения", async () => {
		const second = { ...variant, id: "variant-2", name: "Исполнение 2", sort_order: 1 };
		const drafts = new Map<string, VariantPhotoDraft>();
		function Harness() {
			const [selected, setSelected] = useState(variant);
			return <AdminVariantEditModal key={selected.id} open variant={selected} siblingVariants={[variant, second]}
				photoDrafts={drafts} initialFocus="designs" onSelectVariant={setSelected} onClose={vi.fn()} />;
		}
		mockUploadFileToS3.mockResolvedValueOnce("first.webp").mockResolvedValueOnce("second.webp");
		render(<Harness />);
		const upload = (name: string) => fireEvent.change(screen.getByRole("dialog").querySelector('input[type="file"]')!, {
			target: { files: [new File([name], name, { type: "image/webp" })] },
		});
		upload("first.webp");
		await screen.findByAltText("Дизайн 1");
		fireEvent.click(screen.getByRole("button", { name: "Вариант 2" }));
		upload("second.webp");
		await screen.findByAltText("Дизайн 1");
		fireEvent.click(screen.getByRole("button", { name: "Вариант 1" }));
		expect(screen.getByAltText("Дизайн 1")).toHaveAttribute("src", expect.stringContaining("first.webp"));
		expect(mockUpdateVariant).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() => expect(mockUpdateVariant).toHaveBeenCalledTimes(2));
		expect(mockUpdateVariant).toHaveBeenCalledWith(expect.objectContaining({variantId: "variant-1", body: expect.objectContaining({design_image_paths: ["first.webp"]})}));
		expect(mockUpdateVariant).toHaveBeenCalledWith(expect.objectContaining({variantId: "variant-2", body: expect.objectContaining({design_image_paths: ["second.webp"]})}));
	});
	beforeEach(() => {
		vi.clearAllMocks();
		mockUploadFileToS3.mockResolvedValue(
			"variants/panel-1/texture-1/interior.webp",
		);
		mockUpdateVariant.mockResolvedValue({
			...variant,
			design_image_paths: ["variants/panel-1/texture-1/interior.webp"],
		});
	});

	it("по клику из колонки сразу показывает режим фото конкретного варианта", () => {
		const withInteriors = {
			...variant,
			design_image_paths: ["interior-a.webp", "interior-b.webp"],
		};
		render(
			<AdminVariantEditModal
				open
				variant={withInteriors}
				initialFocus="designs"
				onClose={vi.fn()}
			/>,
		);
		expect(screen.getAllByRole("dialog")).toHaveLength(1);
		expect(screen.getByText("Фото варианта: Исполнение 1")).toBeInTheDocument();
		expect(screen.getByAltText("Дизайн 1")).toBeInTheDocument();
		expect(screen.getByAltText("Дизайн 2")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Загрузить фото в дизайне" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Фото")).not.toBeInTheDocument();
	});

	it("режим дизайн-фото не показывает редактор исполнения", () => {
		render(
			<AdminVariantEditModal
				open
				variant={variant}
				initialFocus="designs"
				onClose={vi.fn()}
			/>,
		);
		expect(screen.queryByText(/Название исполнения/)).not.toBeInTheDocument();
		expect(screen.getByText("Фото варианта: Исполнение 1")).toBeInTheDocument();
	});

	it("рекомендации сохраняются отдельно от фото в дизайне", async () => {
		mockUploadFileToS3.mockResolvedValueOnce("recommendation.webp");
		render(
			<AdminVariantEditModal
				open
				variant={{
					...variant,
					design_image_paths: ["interior.webp"],
				}}
				initialFocus="recommendations"
				onClose={vi.fn()}
			/>,
		);
		const file = new File(["image"], "recommendation.webp", {
			type: "image/webp",
		});
		expect(
			screen.getByRole("button", { name: "Загрузить рекомендации" }),
		).toBeInTheDocument();
		const uploadInput = document.querySelector<HTMLInputElement>(
			'input[type="file"]',
		);
		expect(uploadInput).not.toBeNull();
		fireEvent.change(uploadInput!, { target: { files: [file] } });
		await waitFor(() => expect(mockUploadFileToS3).toHaveBeenCalled());
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						design_image_paths: ["interior.webp"],
						recommendation_image_paths: ["recommendation.webp"],
					}),
				}),
			),
		);
	});

	it("по умолчанию показывает варианты слева направо по sort_order", () => {
		const first = {
			...variant,
			id: "variant-a",
			name: "Вариант 1",
			sort_order: 0,
		};
		const second = {
			...variant,
			id: "variant-b",
			name: "Вариант 2",
			sort_order: 1,
		};
		const third = {
			...variant,
			id: "variant-c",
			name: "Вариант 3",
			sort_order: 2,
		};
		render(
			<AdminVariantEditModal
				open
				variant={third}
				initialFocus="executions"
				siblingVariants={[third, first, second]}
				onClose={vi.fn()}
			/>,
		);
		const labels = screen
			.getAllByRole("button", { name: /^Вариант [123]$/ })
			.map((button) => button.getAttribute("aria-label"));
		expect(labels).toEqual(["Вариант 1", "Вариант 2", "Вариант 3"]);
	});

	it("режим вариантов не показывает дизайн-фото и сохраняет порядок", async () => {
		const second = {
			...variant,
			id: "variant-2",
			name: "Исполнение 2",
			sort_order: 1,
		};
		const onReorderVariants = vi.fn().mockResolvedValue(undefined);
		render(
			<AdminVariantEditModal
				open
				variant={variant}
				initialFocus="executions"
				siblingVariants={[variant, second]}
				onReorderVariants={onReorderVariants}
				onClose={vi.fn()}
			/>,
		);
		expect(
			screen.queryByText("Фото варианта: Исполнение 1"),
		).not.toBeInTheDocument();
		fireEvent.click(
			screen.getByRole("button", { name: "Переместить вариант 1 вправо" }),
		);
		await waitFor(() =>
			expect(onReorderVariants).toHaveBeenCalledWith([
				"variant-2",
				"variant-1",
			]),
		);
	});

	it("клик по загруженному варианту показывает его собственные фото в дизайне", () => {
		const second = {
			...variant,
			id: "variant-2",
			name: "Исполнение 2",
			image_paths: ["execution-2.webp"],
			design_image_paths: ["design-2.webp"],
		};
		const onSelectVariant = vi.fn();
		render(
			<AdminVariantEditModal
				open
				variant={variant}
				initialFocus="designs"
				siblingVariants={[variant, second]}
				onSelectVariant={onSelectVariant}
				onClose={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Вариант 2" }));
		expect(onSelectVariant).toHaveBeenCalledWith(second);
	});

	it("привязывает интерьер к ID исполнения и сохраняет обе галереи одним PATCH", async () => {
		render(
			<AdminVariantEditModal
				open
				variant={variant}
				onClose={vi.fn()}
				initialFocus="designs"
			/>,
		);
		const input = screen
			.getByRole("dialog")
			.querySelector('input[type="file"]') as HTMLInputElement;
		const file = new File(["photo"], "interior.webp", { type: "image/webp" });
		fireEvent.change(input, { target: { files: [file] } });
		await waitFor(() =>
			expect(mockUploadFileToS3).toHaveBeenCalledWith(
				file,
				"panel-1",
				"texture-1",
				"variant-1",
			),
		);
		await screen.findByAltText("Дизайн 1");
		expect(mockUpdateVariant).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith({
				variantId: variant.id,
				body: {
					name: variant.name,
					slug: "",
					texture_id: variant.texture_id,
					is_active: true,
					image_paths: variant.image_paths,
					design_image_paths: ["variants/panel-1/texture-1/interior.webp"],
				},
			}),
		);
	});

	it("удаление интерьера не удаляет товарное фото, отмена не сохраняет", async () => {
		const onClose = vi.fn();
		render(
			<AdminVariantEditModal
				open
				initialFocus="designs"
				variant={{ ...variant, design_image_paths: ["interior.webp"] }}
				onClose={onClose}
			/>,
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Удалить фото в дизайне" }),
		);
		expect(screen.queryByAltText("Дизайн 1")).not.toBeInTheDocument();
		expect(screen.queryByAltText("Фото 1")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
		expect(onClose).toHaveBeenCalled();
		expect(mockUpdateVariant).not.toHaveBeenCalled();
	});

	it("создаёт исполнение с выбранной текстурой без изменения соседнего варианта", async () => {
		render(
			<AdminVariantEditModal
				open
				creating
				variant={{ ...variant, id: "", image_paths: [] }}
				onClose={vi.fn()}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockCreateVariant).toHaveBeenCalledWith({
				name: variant.name,
				slug: "",
				panel_id: variant.panel_id,
				sort_order: variant.sort_order,
				texture_id: variant.texture_id,
				color_id: null,
				color_hex: null,
				is_active: true,
				image_paths: [],
				design_image_paths: [],
			}),
		);
		expect(mockUpdateVariant).not.toHaveBeenCalled();
	});

	it("показывает весь справочник текстур", async () => {
		render(
			<AdminVariantEditModal
				open
				creating
				variant={variant}
				onClose={vi.fn()}
			/>,
		);
		fireEvent.mouseDown(screen.getByRole("combobox"));
		expect(await screen.findByText("Дерево")).toBeInTheDocument();
	});

	it("сохраняет название и слаг исполнения, не изменяя интерьер", async () => {
		render(
			<AdminVariantEditModal
				open
				variant={{ ...variant, design_image_paths: ["interior.webp"] }}
				onClose={vi.fn()}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Название исполнения"), {
			target: { value: "Новое название" },
		});
		fireEvent.change(screen.getByLabelText("Слаг исполнения"), {
			target: { value: "new-variant" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith({
				variantId: variant.id,
				body: expect.objectContaining({
					name: "Новое название",
					slug: "new-variant",
					design_image_paths: ["interior.webp"],
				}),
			}),
		);
	});

	it("не теряет несколько последовательно загруженных фото", async () => {
		mockUploadFileToS3
			.mockResolvedValueOnce("one.webp")
			.mockResolvedValueOnce("two.webp");
		render(<AdminVariantEditModal open variant={variant} onClose={vi.fn()} />);
		const input = screen
			.getByRole("dialog")
			.querySelectorAll('input[type="file"]')[0];
		fireEvent.change(input, {
			target: { files: [new File(["1"], "one.webp", { type: "image/webp" })] },
		});
		await screen.findByAltText("Фото 2");
		fireEvent.change(
			screen.getByRole("dialog").querySelectorAll('input[type="file"]')[0],
			{
				target: {
					files: [new File(["2"], "two.webp", { type: "image/webp" })],
				},
			},
		);
		await screen.findByAltText("Фото 3");
		fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));
		await waitFor(() =>
			expect(mockUpdateVariant).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.objectContaining({
						image_paths: [...variant.image_paths, "one.webp", "two.webp"],
					}),
				}),
			),
		);
	});
});
