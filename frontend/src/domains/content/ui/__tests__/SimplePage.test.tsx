import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SimplePage from "../SimplePage";

describe("SimplePage", () => {
	it("uses the same selected hero videos as the homepage behind the heading", () => {
		(window as Window & { __heroIdx?: number }).__heroIdx = 1;
		const { container } = render(<MemoryRouter><SimplePage /></MemoryRouter>);
		const heading = screen.getByRole("heading", { name: /Обновление пространства больше не похоже на ремонт/ });
		const hero = heading.closest("section");
		expect(hero).not.toBeNull();
		expect(hero?.querySelectorAll("video")).toHaveLength(1);
		expect(hero?.querySelector('source[src="/herovideo/IMG_6431.MP4"]')).not.toBeNull();
		expect(container.querySelectorAll("section video")).toHaveLength(2);
	});

	it("replaces the former system diagram and copy with the supplied video only", () => {
		const { container } = render(<MemoryRouter><SimplePage /></MemoryRouter>);
		const sectionVideo = container.querySelector('video source[src="/videos/simple-panel-IMG_7377-cropped.mp4"]');
		expect(sectionVideo).not.toBeNull();
		const section = sectionVideo?.closest("section");
		expect(section).not.toBeNull();
		expect(section?.querySelectorAll("video")).toHaveLength(1);
		expect((sectionVideo?.parentElement as HTMLVideoElement).style.aspectRatio).toBe("956 / 720");
		expect(section?.textContent).toBe("");
		expect(screen.queryByText("Платформа неизменна, панель меняется")).not.toBeInTheDocument();
	});
});
