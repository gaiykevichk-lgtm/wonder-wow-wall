import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Table, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { api } from '../../../shared/api';
import { imageSrc } from '../../../shared/lib/imageSrc';
import { uploadFile } from '../../admin/lib/uploadFile';
import { usePanels, usePanelVariants, useTextures } from '../../catalog/api/catalogApi';
import { invalidateSpacesCache, type SpacesPageSettings } from '../../content/model/spacesApi';
import { SPACES_TEXTURES, type SpaceInterior } from '../../content/model/spacesData';

const { Title, Text } = Typography;

/**
 * Модалка «Фото интерьера» — только загрузка фото под текстуры, ничего лишнего.
 * Одна карточка фото: переключатель Моно/Комбо → выбор 1 или 2 фактур
 * (совмещение) → поле загрузки изображения → вывод вариантов из выбранных фактур.
 */
interface PhotoCard {
  kind: 'mono' | 'combined';
  familyKeys: string[];
  outputIds: string[];
  image: string;
}

interface CatalogTexture {
  id: string;
  name: string;
}

type RenderElement = NonNullable<SpaceInterior['renders']>[number];
const asRenderElement = (card: PhotoCard) => card as unknown as RenderElement;

const familyKeyOf = (textures: CatalogTexture[] | undefined, textureId: string) =>
  SPACES_TEXTURES.find(t => t.label.toLowerCase() === textures?.find(x => x.id === textureId)?.name.toLowerCase())?.key;
const familyLabel = (key: string) => SPACES_TEXTURES.find(t => t.key === key)?.label || key;

export default function AdminSpacesPage() {
  const [items, setItems] = useState<SpaceInterior[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<SpaceInterior | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageForm] = Form.useForm<SpacesPageSettings>();
  const [form] = Form.useForm<SpaceInterior>();
  const rendersWatch = Form.useWatch('renders', form) as unknown as PhotoCard[] | undefined;
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const panelsQuery = usePanels();
  const variantsQuery = usePanelVariants();
  const texturesQuery = useTextures();
  const panels = useMemo(() => panelsQuery.data?.items || [], [panelsQuery.data]);
  const variants = useMemo(() => (variantsQuery.data || []).filter(v => v.is_active && v.image_paths?.length), [variantsQuery.data]);
  const catalogReady = !panelsQuery.isError && !variantsQuery.isError && !texturesQuery.isError &&
    !panelsQuery.isLoading && !variantsQuery.isLoading && !texturesQuery.isLoading;
  // Фактуры берутся из всего каталога: модалка только грузит фото, шаг выбора исполнений убран.
  const familyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const v of variants) {
      const key = familyKeyOf(texturesQuery.data, v.texture_id);
      if (key && key !== 'all') keys.add(key);
    }
    return [...keys];
  }, [variants, texturesQuery.data]);
  const variantName = (id: string) => {
    const v = variants.find(x => x.id === id);
    return v ? (v.name || `${v.texture_name} · ${v.panel_name}`) : id;
  };
  const familyVariantIds = (familyKey: string) =>
    variants.filter(v => familyKeyOf(texturesQuery.data, v.texture_id) === familyKey).map(v => v.id);
  const load = async () => {
    setLoading(true);
    try { setItems(await api.get<SpaceInterior[]>('/admin/spaces')); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить интерьеры'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    api.get<SpaceInterior[]>('/admin/spaces').then(rows => { setItems(rows); setError(''); }).catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить интерьеры')).finally(() => setLoading(false));
    api.get<SpacesPageSettings>('/spaces/page').then(value => pageForm.setFieldsValue(value)).catch(e => message.error(e instanceof Error ? e.message : 'Не удалось загрузить текст страницы'));
  }, [pageForm]);
  const savePage = async (values: SpacesPageSettings) => {
    setPageSaving(true);
    try { await api.put('/admin/spaces/page', values); invalidateSpacesCache(); message.success('Текст страницы сохранён'); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Не удалось сохранить текст страницы'); }
    finally { setPageSaving(false); }
  };
  const open = (item: SpaceInterior) => {
    if (!catalogReady) { message.error('Каталог ещё загружается. Подождите и повторите.'); return; }
    setEditing(item);
    form.resetFields();
    // Старые записи приводим к формату карточек фото; остальное сохранится как было.
    const renders = (item.renders || []).map(r => {
      const ids = [...(r.textureIds || [])];
      if (r.textureId && !ids.includes(r.textureId)) ids.push(r.textureId);
      const kind = (r.mode === 'combined' || ids.length === 2) ? 'combined' : 'mono';
      const outs = ids.slice(0, kind === 'combined' ? 2 : 1);
      const fams: string[] = [];
      for (const id of outs) {
        const v = variants.find(x => x.id === id);
        const key = v ? familyKeyOf(texturesQuery.data, v.texture_id) : undefined;
        if (key && key !== 'all' && !fams.includes(key)) fams.push(key);
      }
      return asRenderElement({kind, familyKeys: fams.slice(0, kind === 'combined' ? 2 : 1), outputIds: outs, image: r.image});
    });
    form.setFieldsValue({...item, renders} as unknown as SpaceInterior);
  };
  // Одна карточка фото — горизонтальный блок: слева превью/загрузка, справа поля.
  // Все карточки лежат в сетке 2 в ряд, модалка широкая — вертикального скрола нет.
  const renderImageCard = (f: {key: React.Key; name: number}, remove: (index: number | number[]) => void) => {
    const row = (rendersWatch || [])[f.name] as unknown as PhotoCard | undefined;
    const kind = row?.kind || 'mono';
    const need = kind === 'combined' ? 2 : 1;
    const pickedFamilies = [...new Set(row?.familyKeys || [])].slice(0, need);
    const familiesReady = pickedFamilies.length === need && pickedFamilies.every(k => familyKeys.includes(k));
    const outputPool = pickedFamilies.flatMap(k => familyVariantIds(k));
    return <div key={f.key} style={{flex: '1 1 340px', minWidth: 320, maxWidth: 'calc(50% - 6px)', border: '1px solid #e5e5e5', borderRadius: 12, padding: 10, display: 'flex', gap: 10, background: '#fff'}}>
      <div style={{width: 150, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6}}>
        <div onClick={() => document.getElementById(`photo-input-${f.key}`)?.click()} style={{width: 150, height: 110, borderRadius: 8, overflow: 'hidden', background: row?.image ? undefined : '#f5f5f5', border: '1px dashed #d9d9d9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'}}>
          {row?.image ? <img src={imageSrc(row.image)} alt="" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <span style={{color: '#999', fontSize: 12, textAlign: 'center', padding: 6}}>Нажмите —<br />загрузить фото</span>}
        </div>
        <input id={`photo-input-${f.key}`} type="file" accept="image/*" hidden onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try { const asset = await uploadFile({file, purpose: 'MISC'}); form.setFieldValue(['renders', f.name, 'image'], asset.url); }
          catch { message.error('Не удалось загрузить фото'); }
        }} />
        <Form.Item name={[f.name, 'image']} hidden rules={[{required: true, message: 'Загрузите фото'}]}><input /></Form.Item>
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => remove(f.name)}>Убрать</Button>
      </div>
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6}}>
        <Form.Item name={[f.name, 'kind']} initialValue="mono" style={{marginBottom: 0}}><Segmented block options={[{value: 'mono', label: 'Моно'}, {value: 'combined', label: 'Комбо'}]} onChange={next => {
          form.setFieldValue(['renders', f.name, 'kind'], next);
          form.setFieldValue(['renders', f.name, 'familyKeys'], []);
          form.setFieldValue(['renders', f.name, 'outputIds'], []);
        }} /></Form.Item>
        <Form.Item name={[f.name, 'familyKeys']} rules={[{required: true, message: need === 2 ? 'Выберите 2 фактуры' : 'Выберите фактуру'}]} style={{marginBottom: 0}}><Select mode={need === 2 ? 'multiple' : undefined} maxCount={need} size="small" placeholder={need === 2 ? '2 фактуры' : 'Фактура'} options={familyKeys.map(k => ({value: k, label: familyLabel(k)}))} onChange={(keys: string | string[]) => {
          const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean).slice(0, need);
          form.setFieldValue(['renders', f.name, 'familyKeys'], list);
          form.setFieldValue(['renders', f.name, 'outputIds'], []);
        }} /></Form.Item>
        <Form.Item name={[f.name, 'outputIds']} rules={[{required: true, message: 'Варианты'}]} style={{marginBottom: 0}}><Select mode="multiple" maxCount={need} size="small" placeholder={familiesReady ? 'Варианты' : 'Сначала фактуру'} disabled={!familiesReady} options={outputPool.map(id => ({value: id, label: variantName(id)}))} /></Form.Item>
      </div>
    </div>;
  };
  // Массовая загрузка: выбрали N файлов → залили → разложили по горизонтальным блокам.
  const handleBulkFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBulkLoading(true);
    try {
      const current = [...((form.getFieldValue('renders') || []) as unknown as PhotoCard[])];
      for (const file of Array.from(files)) {
        try {
          const asset = await uploadFile({file, purpose: 'MISC'});
          current.push({kind: 'mono', familyKeys: [], outputIds: [], image: asset.url});
        } catch { message.error(`Не загрузилось: ${file.name}`); }
      }
      form.setFieldValue('renders', current as unknown as RenderElement[]);
    } finally { setBulkLoading(false); }
  };
  const save = async (value: SpaceInterior) => {
    if (!editing) return;
    if (!catalogReady) { message.error('Не удалось проверить каталог. Повторите после его загрузки.'); return; }
    const cards = ((value.renders || []) as unknown as PhotoCard[]);
    // Остальное (карточка, формы, исполнения) не редактируется здесь — сохраняем как было,
    // недостающие связи для новых фото достраиваем автоматически.
    const relatedPanels = [...editing.relatedPanels];
    const textures = [...editing.textures];
    const catalogBindings = [...(editing.catalogBindings || [])];
    const renders: {textureIds: string[]; mode: 'mono' | 'combined'; panelSlug: string; sceneId: string; image: string}[] = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] || {kind: 'mono' as const, familyKeys: [], outputIds: [], image: ''};
      const need = card.kind === 'combined' ? 2 : 1;
      const fams = [...new Set(card.familyKeys || [])].slice(0, need);
      const outs = [...new Set(card.outputIds || [])];
      if (!card.image) { message.error(`Фото №${i + 1}: загрузите изображение`); return; }
      if (fams.length !== need) { message.error(`Фото №${i + 1}: выберите ${need === 2 ? '2 фактуры' : 'фактуру'}`); return; }
      if (outs.length !== need) { message.error(`Фото №${i + 1}: отметьте ${need === 2 ? 'ровно 2 варианта' : 'ровно 1 вариант'}`); return; }
      for (const id of outs) {
        const v = variants.find(x => x.id === id);
        const key = v ? familyKeyOf(texturesQuery.data, v.texture_id) : undefined;
        if (!v || !key || !fams.includes(key)) { message.error(`Фото №${i + 1}: вариант не из выбранных фактур`); return; }
      }
      for (const id of outs) {
        const v = variants.find(x => x.id === id)!;
        if (!relatedPanels.some(p => p.slug === v.panel_id)) {
          const p = panels.find(p => p.id === v.panel_id);
          relatedPanels.push({slug: v.panel_id, name: p?.name || v.panel_name});
        }
        if (!textures.some(t => t.id === id)) {
          textures.push({id, name: v.name || `${v.texture_name} · ${v.panel_name}`, family: familyKeyOf(texturesQuery.data, v.texture_id) as SpaceInterior['textures'][number]['family'], image: editing.image});
        }
        if (!catalogBindings.some(b => b.panelSlug === v.panel_id && b.textureId === id)) {
          catalogBindings.push({panelSlug: v.panel_id, textureId: id, groupId: v.texture_id, finishImage: v.image_paths[0]});
        }
      }
      const firstPanel = variants.find(x => x.id === outs[0])!.panel_id;
      renders.push({textureIds: outs.slice(0, need), mode: card.kind, panelSlug: firstPanel, sceneId: editing.id, image: card.image});
    }
    const payload = {...editing, relatedPanels, textures, catalogBindings, renders};
    setSaving(true);
    try {
      await api.put(`/admin/spaces/${encodeURIComponent(editing.id)}`, payload);
      invalidateSpacesCache(); setEditing(null); message.success('Фото сохранены'); await load();
    } catch (e) { message.error(e instanceof Error ? e.message : 'Не удалось сохранить'); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/admin/spaces/${encodeURIComponent(id)}`); invalidateSpacesCache(); message.success('Интерьер удалён'); await load(); }
    catch (e) { message.error(e instanceof Error ? e.message : 'Не удалось удалить'); }
  };
  return <div style={{maxWidth: 1100, margin: 'auto'}}>
    <Space style={{justifyContent: 'space-between', width: '100%', marginBottom: 16}} wrap>
      <div><Title level={2} style={{marginBottom: 0}}>Пространства</Title><Text type="secondary">Карточки интерьеров публичного каталога</Text></div>
    </Space>
    {error && <Alert type="error" showIcon message={error} action={<Button onClick={load}>Повторить</Button>} style={{marginBottom: 16}} />}
    <Card title="Текст страницы" style={{marginBottom: 20}}>
      <Form form={pageForm} layout="vertical" onFinish={savePage}>
        <Form.Item name="heading" label="Заголовок" rules={[{required: true, whitespace: true}]}><Input maxLength={255} /></Form.Item>
        <Form.Item name="intro" label="Вступление" rules={[{required: true, whitespace: true}]}><Input.TextArea rows={3} maxLength={5000} showCount /></Form.Item>
        <Button type="primary" htmlType="submit" loading={pageSaving}>Сохранить текст страницы</Button>
      </Form>
    </Card>
    <Card><Table rowKey="id" loading={loading} dataSource={items} pagination={{pageSize: 10}} scroll={{x: 740}} columns={[
      {title: 'Фото', dataIndex: 'image', width: 90, render: (src: string) => <img src={imageSrc(src)} alt="" style={{width: 64, height: 48, objectFit: 'cover', borderRadius: 6}} />},
      {title: 'Название', dataIndex: 'title'}, {title: 'Категория', dataIndex: 'categoryLabel'}, {title: 'Тип', dataIndex: 'roomTypeLabel'},
      {title: 'Действия', key: 'actions', render: (_, row: SpaceInterior) => <Space><Button onClick={() => open(row)}>Редактировать фото</Button><Popconfirm title="Удалить интерьер?" description="Карточка исчезнет с публичной страницы." okText="Удалить" cancelText="Отмена" onConfirm={() => remove(row.id)}><Button danger>Удалить</Button></Popconfirm></Space>},
    ]} /></Card>
    <Modal title={editing ? `Фото интерьера — ${editing.title}` : 'Фото интерьера'} open={editing !== null} onCancel={() => setEditing(null)} onOk={() => form.submit()} okText="Сохранить" confirmLoading={saving} width={980} style={{top: 24}} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={save}>
        <Space wrap style={{marginBottom: 10}}>
          <Button icon={<PlusOutlined />} onClick={() => bulkInputRef.current?.click()} loading={bulkLoading}>Загрузить несколько фото</Button>
          <input ref={bulkInputRef} type="file" accept="image/*" multiple hidden onChange={e => { handleBulkFiles(e.target.files); e.target.value = ''; }} />
          <Text type="secondary">Несколько файлов сразу → разложатся по блокам, дальше только выбрать фактуры.</Text>
        </Space>
        <Form.List name="renders">{(fields, {add, remove: drop}) => <div style={{display: 'flex', flexWrap: 'wrap', gap: 12}}>{fields.map(f => renderImageCard(f, drop))}<Button dashed icon={<PlusOutlined />} style={{flex: '1 1 340px', minWidth: 320, maxWidth: 'calc(50% - 6px)', minHeight: 170}} onClick={() => add(asRenderElement({kind: 'mono', familyKeys: [], outputIds: [], image: ''}))}>Добавить блок</Button></div>}</Form.List>
      </Form>
    </Modal>
  </div>;
}
