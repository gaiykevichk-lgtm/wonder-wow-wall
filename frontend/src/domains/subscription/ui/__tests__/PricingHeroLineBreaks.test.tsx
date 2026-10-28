import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PricingPage from "../PricingPage";

vi.mock("../../../../shared/api/shopApi", () => ({
	useSubscriptionPlansList: () => [],
}));

describe("PricingPage — вступительный текст", () => {
	it("разделяет текст на три строки после предложения и запятой", () => {
		render(<MemoryRouter><PricingPage /></MemoryRouter>);
		const paragraph = screen.getByRole("heading", { name: "Свобода обновления. Стены как сервис." }).parentElement?.querySelector("p");
		expect(paragraph).toBeTruthy();
		expect(paragraph?.querySelectorAll("br")).toHaveLength(2);
		const lines: string[] = [""];
		for (const node of paragraph?.childNodes ?? []) {
			if (node.nodeName === "BR") lines.push("");
			else lines[lines.length - 1] += node.textContent ?? "";
		}
		expect(lines).toEqual([
			"WONDER WOW WALL меняет философию владения интерьером.",
			"Мы не продаём панели. Мы предоставляем доступ к интерьеру,",
			"который может меняться вместе с Вами.",
		]);
	});
});
