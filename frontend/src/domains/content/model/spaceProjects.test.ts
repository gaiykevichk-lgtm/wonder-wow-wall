import { describe, it, expect } from "vitest";
import { groupSpaceProjects } from "./spaceProjects";
import type { SpaceCardItem } from "./spacesApi";

const card = (id: string, image = id): SpaceCardItem => ({
	id,
	image,
	images: [image],
	title: "Одинаковое название",
	mode: "mono",
	subtitle: "",
	price: "",
	area: "",
	textureId1: id,
	textureId2: id,
});

describe("объекты и варианты на странице пространств", () => {
	it("объединяет записи только по явному ID объекта и сохраняет фото с исполнениями", () => {
		const rows = [
			{
				...card("row-a"),
				projectId: "project-1",
				executionVariantId: "exec-1",
			},
			{
				...card("row-b"),
				projectId: "project-1",
				executionVariantId: "exec-2",
			},
		];
		const result = groupSpaceProjects(rows);
		expect(result).toHaveLength(1);
		expect(result[0].images).toEqual(["row-a", "row-b"]);
		expect(
			result[0].configurations?.map((item) => item.executionVariantId),
		).toEqual(["exec-1", "exec-2"]);
	});

	it("объединяет панели и фотографии одного объекта по названию даже при разных projectId", () => {
		const result = groupSpaceProjects([
			{
				...card("a"),
				title: "Кафе в современном стиле",
				projectId: "project-a",
				executionVariantId: "exec-a",
			},
			{
				...card("b"),
				title: " кафе   в современном стиле ",
				projectId: "project-b",
				executionVariantId: "exec-b",
			},
		]);
		expect(result).toHaveLength(1);
		expect(result[0].images).toEqual(["a", "b"]);
		expect(
			result[0].configurations?.map((row) => row.executionVariantId),
		).toEqual(["exec-a", "exec-b"]);
	});

	it("одинаковые названия не создают дубли даже при совпавшем projectId", () => {
		expect(
			groupSpaceProjects([
				{ ...card("a"), projectId: "p" },
				{ ...card("b"), projectId: "p", title: "Другой ракурс" },
			]),
		).toHaveLength(2);
	});
});
