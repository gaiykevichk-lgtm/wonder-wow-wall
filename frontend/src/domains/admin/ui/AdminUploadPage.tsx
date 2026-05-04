/**
 * Phase 7B — admin panels (physical SKU) management page.
 *
 * Layout:
 *   ┌────────────────────── header: title + «+ Добавить панель» ──────────┐
 *   │  ┌─ Status ─┬─ Search (name/slug) ─┬─ [Сбросить] ─┐                 │
 *   │  └──────────┴───────────────────────┴──────────────┘                 │
 *   │                                                                      │
 *   │  ┌── AntD <Table> ────────────────────────────────────────────────┐ │
 *   │  │ Фото · Название · Slug · Размер · Цена · Активна (Switch) · ⋯ │ │
 *   │  └────────────────────────────────────────────────────────────────┘ │
 *   │                                                                      │
 *   │  Drawer (right) — create/edit form with AdminFileUpload for photo   │
 *   └──────────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth for filters and pagination (Phase 4A pattern).
 * Filters are applied client-side because the admin endpoint takes only
 * offset/limit — we fetch a page, then narrow it. Search/active filtering
 * is a user-experience nicety; the backend is the truth on the row set.
 *
 * Mutations:
 *   * Inline `<Switch>` toggle for `is_active` — no confirmation, change
 *     is reversible by toggling back. Optimistic UX via React Query
 *     `setQueryData` on success.
 *   * Delete is wrapped in `<Popconfirm>` (DoD § "destructive actions
 *     require confirmation").
 *   * Create/edit go through a single `<Drawer>` with the same form —
 *     the only difference is whether `panelId` is set.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../shared/api';
import { imageSrc } from '../../../shared/lib/imageSrc';
import { AdminFileUpload } from '../../../shared/ui/AdminFileUpload';
import {
  type ApiPanel,
  type PanelCreatePayload,
  type PanelUpdatePayload,
  type PanelsAdminQuery,
  useCreatePanel,
  useDeletePanel,
  usePanelsAdminList,
  useUpdatePanel,
} from '../api/panelsAdminApi';
import {
  ACTIVE_OPTIONS,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  applyFilterPatch,
  queryFromSearchParams,
  searchParamsFromQuery,
  slugify,
} from '../model/panelsAdminStore';

const { Title } = Typography;
const { TextArea } = Input;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

interface PanelFormValues {
  name: string;
  slug: string;
  width_mm: number;
  height_mm: number;
  size_label: string;
  base_price: number;
  description: string;
  photo_path: string;
  is_active: boolean;
}

const EMPTY_FORM: PanelFormValues = {
  name: '',
  slug: '',
  width_mm: 300,
  height_mm: 300,
  size_label: '',
  base_price: 0,
  description: '',
  photo_path: '',
  is_active: true,
};

function panelToForm(p: ApiPanel): PanelFormValues {
  return {
    name: p.name,
    slug: p.slug,
    width_mm: p.width_mm,
    height_mm: p.height_mm,
    size_label: p.size_label,
    base_price: p.base_price,
    description: p.description,
    photo_path: p.photo_path,
    is_active: p.is_active,
  };
}

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function formatSize(p: ApiPanel): string {
  // Prefer the human-friendly label; fall back to the raw mm pair so a
  // panel without a label still surfaces *something* readable.
  return p.size_label.trim() || `${p.width_mm}×${p.height_mm} мм`;
}

function formatDate(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY');
}

export default function AdminUploadPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: PanelsAdminQuery = useMemo(
    () => queryFromSearchParams(searchParams),
    [searchParams],
  );

  const { data, isFetching, error } = usePanelsAdminList(query);
  const createMutation = useCreatePanel();
  const updateMutation = useUpdatePanel();
  const deleteMutation = useDeletePanel();

  // Drawer state — `editingId === null` means «create new», a string is
  // «edit existing». The form is a single instance reused for both modes
  // (Phase 5/4B pattern); reset on open to drop stale values.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<PanelFormValues>();
  // Track the current photo separately from form state so the
  // AdminFileUpload's success callback can patch the form without
  // requiring a controlled <Input>. Same pattern as design upload Phase 7A
  // would use.
  const [photoPath, setPhotoPath] = useState<string>('');
  // Last auto-generated slug — lets us distinguish "user has not touched
  // the slug field" (auto-fill on every name keystroke) from "user has
  // edited the slug" (stop auto-filling so we don't clobber their edit).
  // Cleared on drawer close.
  const lastAutoSlugRef = useRef<string>('');

  // Local mirror for the search input — same UX as users page (typing
  // shouldn't fire a request per keystroke; debounce by Enter).
  const [searchDraft, setSearchDraft] = useState<string>(query.search ?? '');
  useEffect(() => {
    setSearchDraft(query.search ?? '');
  }, [query.search]);

  function updateUrl(next: PanelsAdminQuery): void {
    setSearchParams(searchParamsFromQuery(next), { replace: false });
  }

  function onActiveChange(value: 'true' | 'false' | null | undefined): void {
    const isActive = value === 'true' ? true : value === 'false' ? false : null;
    updateUrl(applyFilterPatch(query, { isActive }));
  }

  function onSearchChange(value: string): void {
    const cleaned = value.trim();
    updateUrl(applyFilterPatch(query, { search: cleaned || null }));
  }

  function onResetFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  function onTableChange(pagination: TablePaginationConfig): void {
    updateUrl({
      ...query,
      page: pagination.current ?? DEFAULT_PAGE,
      size: pagination.pageSize ?? DEFAULT_SIZE,
    });
  }

  function openCreateDrawer(): void {
    setEditingId(null);
    setPhotoPath('');
    lastAutoSlugRef.current = '';
    form.setFieldsValue(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEditDrawer(panel: ApiPanel): void {
    setEditingId(panel.id);
    setPhotoPath(panel.photo_path);
    lastAutoSlugRef.current = '';
    form.setFieldsValue(panelToForm(panel));
    setDrawerOpen(true);
  }

  function closeDrawer(): void {
    setDrawerOpen(false);
    setEditingId(null);
    form.resetFields();
    setPhotoPath('');
    lastAutoSlugRef.current = '';
  }

  function handleApiError(err: unknown, fallback: string): void {
    if (err instanceof ApiError && err.body?.code === 'panel_slug_conflict') {
      // Surface as inline form error so the admin sees it next to the field
      // they need to fix, rather than a top-toast that disappears.
      form.setFields([{ name: 'slug', errors: ['Slug уже занят'] }]);
      return;
    }
    if (err instanceof ApiError && err.body?.code === 'panel_not_found') {
      message.error('Панель не найдена — возможно, удалена в другой вкладке');
      return;
    }
    message.error(err instanceof Error ? err.message : fallback);
  }

  function onSubmitForm(): void {
    form
      .validateFields()
      .then((values) => {
        // Always push the latest uploaded photo path into the payload —
        // the form `<Input hidden>` only mirrors it for validation/state.
        const payload: PanelCreatePayload = {
          name: values.name.trim(),
          slug: values.slug.trim(),
          width_mm: values.width_mm,
          height_mm: values.height_mm,
          size_label: values.size_label.trim(),
          base_price: values.base_price,
          description: values.description.trim(),
          photo_path: photoPath.trim(),
          is_active: values.is_active,
        };

        if (editingId === null) {
          createMutation.mutate(payload, {
            onSuccess: () => {
              message.success('Панель добавлена');
              closeDrawer();
            },
            onError: (err) => handleApiError(err, 'Не удалось создать панель'),
          });
        } else {
          // PATCH — send the full form (we don't track per-field dirtiness
          // because the backend treats `null` ≠ "unset"; sending the full
          // object is simpler and behaves identically when nothing changed.
          updateMutation.mutate(
            { panelId: editingId, body: payload as PanelUpdatePayload },
            {
              onSuccess: () => {
                message.success('Изменения сохранены');
                closeDrawer();
              },
              onError: (err) => handleApiError(err, 'Не удалось сохранить'),
            },
          );
        }
      })
      .catch(() => {
        /* Form shows inline errors */
      });
  }

  function onToggleActive(panel: ApiPanel, nextActive: boolean): void {
    updateMutation.mutate(
      { panelId: panel.id, body: { is_active: nextActive } },
      {
        onSuccess: () => {
          message.success(nextActive ? 'Панель активирована' : 'Панель скрыта');
        },
        onError: (err) =>
          handleApiError(err, 'Не удалось переключить активность'),
      },
    );
  }

  function onDelete(panel: ApiPanel): void {
    deleteMutation.mutate(panel.id, {
      onSuccess: () => message.success('Панель удалена'),
      onError: (err) => handleApiError(err, 'Не удалось удалить'),
    });
  }

  // Phase 7B remediation 2 (FE-B) — filters now happen server-side.
  // `panelsAdminApi.buildListQueryString` forwards `is_active`/`search`
  // to `GET /api/admin/panels`, so the response is already narrowed and
  // `data.total` reflects the visible set. We just hand the items
  // through unchanged.
  const visibleItems: ApiPanel[] = data?.items ?? [];

  const columns: TableProps<ApiPanel>['columns'] = [
    {
      title: 'Фото',
      dataIndex: 'photo_path',
      key: 'photo',
      width: 90,
      render: (path: string) =>
        path ? (
          <img
            // Phase 7A/7B audit fix — single shared `imageSrc` helper.
            // Previously inline ternary doubled the `/uploads/` prefix
            // for legacy seed paths (`/images/...`) and dropped `data:`
            // URIs entirely. See `shared/lib/imageSrc.ts`.
            src={imageSrc(path)}
            alt=""
            style={{
              width: 56,
              height: 56,
              objectFit: 'cover',
              borderRadius: 6,
              background: '#F5F5F5',
            }}
          />
        ) : (
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 6,
              background: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: 11,
            }}
          >
            нет
          </div>
        ),
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{row.slug}</div>
        </div>
      ),
    },
    {
      title: 'Размер',
      key: 'size',
      width: 140,
      render: (_v, row) => formatSize(row),
    },
    {
      title: 'Цена',
      dataIndex: 'base_price',
      key: 'base_price',
      width: 120,
      align: 'right',
      render: formatRub,
    },
    {
      title: 'Активна',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      align: 'center',
      render: (isActive: boolean, row) => (
        <Switch
          checked={isActive}
          loading={
            updateMutation.isPending && updateMutation.variables?.panelId === row.id
          }
          onChange={(next) => onToggleActive(row, next)}
        />
      ),
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: formatDate,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      render: (_v, row) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditDrawer(row)}
            aria-label="Редактировать"
          />
          <Popconfirm
            title="Удалить панель?"
            description="Действие необратимо. Связанные рекомендации будут очищены."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDelete(row)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={
                deleteMutation.isPending && deleteMutation.variables === row.id
              }
              aria-label="Удалить"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hasActiveFilters = query.isActive !== null || query.search !== null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div
        variants={fadeUpVariants}
        custom={0}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Панели
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateDrawer}
        >
          Добавить панель
        </Button>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select<'true' | 'false' | null>
            placeholder="Статус"
            allowClear
            style={{ minWidth: 180 }}
            value={
              query.isActive === null
                ? undefined
                : query.isActive
                  ? 'true'
                  : 'false'
            }
            onChange={onActiveChange}
            options={ACTIVE_OPTIONS}
          />
          <Input.Search
            placeholder="Поиск: название, slug"
            allowClear
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={onSearchChange}
            style={{ width: 280 }}
          />
          {hasActiveFilters && <Button onClick={onResetFilters}>Сбросить</Button>}
        </Space>
      </motion.div>

      {error && (
        <motion.div variants={fadeUpVariants} custom={2}>
          <Alert
            type="error"
            showIcon
            message="Не удалось загрузить панели"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={2}>
        <Table<ApiPanel>
          rowKey="id"
          dataSource={visibleItems}
          columns={columns}
          loading={isFetching}
          onChange={onTableChange}
          pagination={{
            current: query.page,
            pageSize: query.size,
            // Server-side `total` (post-filter) — Phase 7B remediation 2
            // (FE-B) moved the `is_active`/`search` predicates to the
            // backend, so this number now accurately reflects the
            // narrowed set across all pages, not just the current one.
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100, 200],
            showTotal: (total) => `Всего: ${total}`,
          }}
        />
      </motion.div>

      <Drawer
        title={editingId === null ? 'Новая панель' : 'Редактировать панель'}
        width={520}
        open={drawerOpen}
        onClose={closeDrawer}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={closeDrawer} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button type="primary" onClick={onSubmitForm} loading={isSubmitting}>
              {editingId === null ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
      >
        <Form<PanelFormValues>
          form={form}
          layout="vertical"
          initialValues={EMPTY_FORM}
          onValuesChange={(changed) => {
            // Auto-fill slug from the name on create only — once the
            // admin has typed in the slug field manually we must NOT
            // overwrite their value on every keystroke. We track the
            // last auto-generated slug in a ref; if the current slug
            // matches it (or is empty), the user hasn't touched it.
            if (editingId !== null) return;
            if (!('name' in changed)) return;
            const currentSlug = (form.getFieldValue('slug') as string) ?? '';
            if (currentSlug === '' || currentSlug === lastAutoSlugRef.current) {
              const next = slugify(changed.name as string);
              form.setFieldsValue({ slug: next });
              lastAutoSlugRef.current = next;
            }
          }}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[
              { required: true, message: 'Укажите название' },
              { max: 255, message: 'Максимум 255 символов' },
            ]}
          >
            <Input placeholder="Панель 30×30" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug"
            tooltip="URL-идентификатор. Заполняется автоматически из названия — можно отредактировать."
            rules={[
              { required: true, message: 'Укажите slug' },
              { max: 120, message: 'Максимум 120 символов' },
              {
                pattern: /^[a-z0-9-]+$/,
                message: 'Только латинские буквы, цифры и дефис',
              },
            ]}
          >
            <Input placeholder="panel-30x30" />
          </Form.Item>

          <Space style={{ width: '100%', display: 'flex' }} size="middle">
            <Form.Item
              name="width_mm"
              label="Ширина (мм)"
              rules={[{ required: true, message: 'Укажите ширину' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} max={5000} step={10} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="height_mm"
              label="Высота (мм)"
              rules={[{ required: true, message: 'Укажите высоту' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={1} max={5000} step={10} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item
            name="size_label"
            label="Метка размера"
            tooltip="Человекочитаемое название размера, напр. «30×30 см»."
            rules={[{ max: 40, message: 'Максимум 40 символов' }]}
          >
            <Input placeholder="30×30 см" />
          </Form.Item>

          <Form.Item
            name="base_price"
            label="Базовая цена (₽)"
            rules={[{ required: true, message: 'Укажите цену' }]}
          >
            <InputNumber
              min={0}
              max={1_000_000}
              step={100}
              style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              parser={(v) => Number((v ?? '').replace(/\s/g, '')) || 0}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Описание"
            rules={[{ max: 4000, message: 'Максимум 4000 символов' }]}
          >
            <TextArea rows={3} placeholder="Материалы, особенности, монтаж…" />
          </Form.Item>

          <Form.Item label="Фото">
            <AdminFileUpload
              purpose="PANEL_PHOTO"
              hint="JPG/PNG до 10 МБ"
              onUploaded={(asset) => {
                setPhotoPath(asset.path);
                message.success('Фото загружено');
              }}
            />
            {photoPath && (
              <div
                style={{
                  marginTop: 12,
                  padding: 8,
                  background: '#F5F5F5',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <img
                  src={imageSrc(photoPath)}
                  alt=""
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#6B7280', wordBreak: 'break-all' }}>
                    {photoPath}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginTop: 4 }}
                    onClick={() => setPhotoPath('')}
                  >
                    Убрать
                  </Button>
                </div>
              </div>
            )}
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Активна"
            valuePropName="checked"
            tooltip="Неактивные панели скрыты из публичного каталога и конструктора."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </motion.div>
  );
}
