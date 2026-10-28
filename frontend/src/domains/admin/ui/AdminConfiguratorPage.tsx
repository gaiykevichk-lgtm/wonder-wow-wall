import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Space, Spin, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../shared/api";

interface Settings { system_prompt: string; updated_at: string }
export default function AdminConfiguratorPage() {
  const [prompt, setPrompt] = useState("");
  const [saved, setSaved] = useState("");
  const query = useQuery({ queryKey: ["admin", "configurator-settings"], queryFn: () => api.get<Settings>("/admin/configurator/settings"), refetchOnWindowFocus: false });
  useEffect(() => { if (query.data) { setPrompt(query.data.system_prompt); setSaved(query.data.system_prompt); } }, [query.data]);
  const mutation = useMutation({ mutationFn: (value: string) => api.patch<Settings>("/admin/configurator/settings", { system_prompt: value }), onSuccess: (data) => { setPrompt(data.system_prompt); setSaved(data.system_prompt); message.success("Промпт сохранён. Будет применён к новым генерациям."); } });
  if (query.isPending) return <Spin />;
  if (query.isError) return <Alert type="error" showIcon message="Не удалось загрузить промпт" description="Попробуйте повторить загрузку." action={<Button onClick={() => query.refetch()}>Повторить</Button>} />;
  return <div style={{ maxWidth: 1100 }}>
    <Typography.Title level={2}>Конфигуратор</Typography.Title>
    <Typography.Paragraph type="secondary">Управление инструкцией для генерации изображений в конфигураторе.</Typography.Paragraph>
    <Card title="Системный промпт">
      <Alert type="info" showIcon style={{ marginBottom: 24 }} message="Изменения применяются к новым генерациям" description="Этот текст передаётся генератору вместе с фотографией, фактурой и параметрами проекта. Существующие изображения не изменяются. Стиль, покрытие и пожелания пользователя добавляются автоматически." />
      <label htmlFor="configurator-system-prompt" style={{ display: "block", marginBottom: 10, fontWeight: 600 }}>Инструкция для генерации изображения</label>
      <Input.TextArea id="configurator-system-prompt" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={mutation.isPending} autoSize={{ minRows: 14, maxRows: 28 }} maxLength={20000} showCount style={{ fontSize: 15, lineHeight: 1.7 }} />
      {mutation.isError && <Alert style={{ marginTop: 24 }} type="error" message="Не удалось сохранить промпт. Текст сохранён в поле — попробуйте ещё раз." />}
      <Space wrap style={{ marginTop: 32 }}>
        <Button type="primary" loading={mutation.isPending} disabled={!prompt.trim() || prompt.trim() === saved} onClick={() => mutation.mutate(prompt.trim())}>Сохранить промпт</Button>
        <Button disabled={mutation.isPending || prompt === saved} onClick={() => setPrompt(saved)}>Отменить изменения</Button>
        <Typography.Text type="secondary">{prompt.trim() !== saved ? "Есть несохранённые изменения" : "Сохранённая инструкция"}</Typography.Text>
      </Space>
    </Card>
  </div>;
}
