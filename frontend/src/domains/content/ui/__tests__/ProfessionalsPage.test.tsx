import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProfessionalsPage from "../ProfessionalsPage";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigate };
});

describe("ProfessionalsPage", () => {
  it("использует фоновые видео главной и сохраняет первый экран", () => {
    const { container } = render(<MemoryRouter><ProfessionalsPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /Создавайте пространства/ })).toBeInTheDocument();
    expect(screen.getByText("B2B-сегмент")).toBeInTheDocument();
    const sources = Array.from(container.querySelectorAll("video source"), element => element.getAttribute("src"));
    expect(sources).toEqual(["/herovideo/hero1-720.mp4", "/herovideo/IMG_6429.MP4"]);
  });

  it("показывает три отдельных тезиса, а приглашение и кнопки — в собственной секции", () => {
    const { container } = render(<MemoryRouter><ProfessionalsPage /></MemoryRouter>);
    const cards = container.querySelectorAll(".professional-pillar-card");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Мы создаём среду, где технологии снимают рутину с профессионалов.");
    expect(cards[1]).toHaveTextContent("Мы формируем профессиональное сообщество вокруг новой категории интерьерных решений.");
    expect(cards[2]).toHaveTextContent("Мы создаём инфраструктуру для специалистов, которые проектируют интерьеры нового поколения.");
    const cta = screen.getByRole("region", { name: "Стать частью сообщества" });
    expect(within(cta).getByRole("heading", { name: /Станьте частью профессионального сообщества WONDER WOW WALL/ })).toBeInTheDocument();
    fireEvent.click(within(cta).getByRole("button", { name: "Стать партнёром" }));
    expect(navigate).toHaveBeenCalledWith("/contacts");
    fireEvent.click(within(cta).getByRole("button", { name: "Изучить решения" }));
    expect(navigate).toHaveBeenCalledWith("/catalog");
  });
});
