import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi } from "vitest";
import AdminConfiguratorPage from "../AdminConfiguratorPage";
import { api } from "../../../../shared/api";
vi.mock("../../../../shared/api", () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
describe("AdminConfiguratorPage", () => {
  it("загружает, редактирует и сохраняет реальную настройку через API", async () => {
    vi.mocked(api.get).mockResolvedValue({ system_prompt: "Исходный промпт", updated_at: "2026-10-05" });
    vi.mocked(api.patch).mockResolvedValue({ system_prompt: "Новая инструкция", updated_at: "2026-10-05" });
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdminConfiguratorPage /></QueryClientProvider>);
    const input = await screen.findByLabelText("Инструкция для генерации изображения");
    expect(input).toHaveValue("Исходный промпт");
    expect(screen.getByRole("button", { name: "Сохранить промпт" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Сохранить промпт" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "Новая инструкция" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить промпт" }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith("/admin/configurator/settings", { system_prompt: "Новая инструкция" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Сохранить промпт" })).toBeDisabled());
  });
});
