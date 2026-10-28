import { useState } from 'react';
import { Alert, Checkbox, Modal, Select, Space, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../shared/api';
import { useAdminTextures } from '../api/texturesAdminApi';
import { panelTextureAssignmentKeys } from '../api/panelTextureAssignmentsAdminApi';

export default function BatchTextureAssignmentsModal({ panelIds, onClose }: { panelIds: string[]; onClose: () => void }) {
  const textures = useAdminTextures();
  const client = useQueryClient();
  const [ids, setIds] = useState<string[]>([]);
  const [mode, setMode] = useState('add');
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: () => api.post<{ updated_panels: number }>('/admin/panel-texture-assignments/batch', { panel_ids: panelIds, texture_ids: ids, mode }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: panelTextureAssignmentKeys.all }); message.success('Назначения выбранных панелей сохранены'); onClose(); },
    onError: () => message.error('Операция не подтверждена. Проверьте назначения перед повтором.'),
  });
  return <Modal open title={`Текстуры для ${panelIds.length} панелей`} onCancel={() => { if (!mutation.isPending) onClose(); }} onOk={() => mutation.mutate()} okText="Применить" cancelText="Отмена" confirmLoading={mutation.isPending} maskClosable={!mutation.isPending} cancelButtonProps={{ disabled: mutation.isPending }} okButtonProps={{ disabled: textures.isLoading || textures.isError || !confirmed || (mode !== 'replace' && ids.length === 0) }}>
    <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
      <Alert showIcon type="info" message="Изменяются только связи. Товары и фотографии не создаются и не удаляются." />
      <Select aria-label="Режим назначения" value={mode} onChange={(value) => { setMode(value); setConfirmed(false); }} disabled={mutation.isPending} style={{ width: '100%' }} options={[{ value: 'add', label: 'Добавить к существующему набору' }, { value: 'remove', label: 'Отключить выбранные текстуры' }, { value: 'replace', label: 'Заменить весь набор текстур' }]} />
      {textures.isError ? <Alert type="error" message="Не удалось загрузить справочник" /> : <Select mode="multiple" aria-label="Текстуры для назначения" placeholder="Выберите текстуры" value={ids} onChange={(value) => { setIds(value); setConfirmed(false); }} optionFilterProp="label" loading={textures.isLoading} disabled={mutation.isPending} options={textures.data?.map((texture) => ({ value: texture.id, label: texture.name }))} style={{ width: '100%' }} />}
      {mode === 'replace' && <Alert type="warning" showIcon message="Все невыбранные текстуры будут отключены у выбранных панелей. Пустой набор отключит все текстуры." />}
      <Checkbox checked={confirmed} disabled={mutation.isPending} onChange={(event) => setConfirmed(event.target.checked)}>Подтверждаю применение к {panelIds.length} выбранным панелям</Checkbox>
    </Space>
  </Modal>;
}
