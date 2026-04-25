/**
 * Phase 8D — admin Shop management page.
 *
 * Three tabs (`?tab=settings|banners|plans`):
 *   1. Settings — singleton form (design overlay price, install fee,
 *      min order, recommendations limit). Save → PATCH `/api/admin/shop/settings`.
 *   2. Banners — table + Drawer CRUD (`/api/admin/shop/banners`).
 *      Inline `<Switch>` for active toggle, AdminFileUpload for image.
 *   3. Plans — table + Drawer CRUD (`/api/admin/subscription-plans`).
 *      `<Switch>` for active toggle, delete refused at 409 if active
 *      subscriptions reference the plan (server-side guard).
 *
 * URL is the source of truth for `?tab` so a deep-link survives F5.
 */

import { useEffect, useMemo, useState } from 'react';
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
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TableProps } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../shared/api';
import { imageSrc } from '../../../shared/lib/imageSrc';
import { AdminFileUpload } from '../../../shared/ui/AdminFileUpload';
import {
  type ApiAdminBanner,
  type ApiAdminPlan,
  type ApiAdminShopSettings,
  type BannerCreatePayload,
  type BannerUpdatePayload,
  type PlanCreatePayload,
  type PlanUpdatePayload,
  type ShopSettingsUpdatePayload,
  useAdminBanners,
  useAdminPlans,
  useAdminShopSettings,
  useCreateBanner,
  useCreatePlan,
  useDeleteBanner,
  useDeletePlan,
  useUpdateBanner,
  useUpdatePlan,
  useUpdateShopSettings,
} from '../api/shopAdminApi';

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

type ShopTab = 'settings' | 'banners' | 'plans';
const DEFAULT_TAB: ShopTab = 'settings';

function parseTab(raw: string | null): ShopTab {
  return raw === 'banners' || raw === 'plans' ? raw : DEFAULT_TAB;
}

const POSITION_OPTIONS = [
  { value: 'homepage_hero', label: 'Главная — hero' },
  { value: 'catalog_top', label: 'Каталог — верх' },
  { value: 'footer', label: 'Футер' },
];

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function formatDate(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY');
}

// ─── Settings tab ──────────────────────────────────────────────────────

interface SettingsFormValues {
  design_overlay_price: number;
  installation_price: number;
  min_order_amount: number;
  recommendations_limit_per_source: number;
}

function SettingsTab({ data }: { data: ApiAdminShopSettings | undefined }) {
  const [form] = Form.useForm<SettingsFormValues>();
  const update = useUpdateShopSettings();

  // Re-seed form when fresh settings arrive (e.g., from another tab edit).
  useEffect(() => {
    if (data) {
      form.setFieldsValue({
        design_overlay_price: data.design_overlay_price,
        installation_price: data.installation_price,
        min_order_amount: data.min_order_amount,
        recommendations_limit_per_source: data.recommendations_limit_per_source,
      });
    }
  }, [data, form]);

  function onSave(): void {
    form
      .validateFields()
      .then((values) => {
        const payload: ShopSettingsUpdatePayload = values;
        update.mutate(payload, {
          onSuccess: () => message.success('Настройки сохранены'),
          onError: (err) =>
            message.error(
              err instanceof Error ? err.message : 'Не удалось сохранить',
            ),
        });
      })
      .catch(() => {
        /* form shows inline errors */
      });
  }

  return (
    <Form<SettingsFormValues>
      form={form}
      layout="vertical"
      style={{ maxWidth: 480 }}
      initialValues={{
        design_overlay_price: 1200,
        installation_price: 0,
        min_order_amount: 0,
        recommendations_limit_per_source: 12,
      }}
    >
      <Form.Item
        label="Цена накладки (₽)"
        name="design_overlay_price"
        rules={[{ required: true, message: 'Укажите цену' }]}
        tooltip="Стоимость одного дизайнерского overlay; видна в каталоге через ≤5 минут (TTL)."
      >
        <InputNumber min={0} max={1_000_000} step={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label="Цена установки (₽)"
        name="installation_price"
        rules={[{ required: true, message: 'Укажите цену' }]}
        tooltip="0 — установка не предлагается клиенту."
      >
        <InputNumber min={0} max={1_000_000} step={100} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label="Минимальная сумма заказа (₽)"
        name="min_order_amount"
        rules={[{ required: true, message: 'Укажите сумму' }]}
        tooltip="0 — без минимума."
      >
        <InputNumber min={0} max={10_000_000} step={500} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        label="Лимит рекомендаций на источник"
        name="recommendations_limit_per_source"
        rules={[{ required: true, message: 'Укажите лимит' }]}
        tooltip="Максимальное число подборок «с этим покупают» для одного товара."
      >
        <InputNumber min={1} max={50} style={{ width: '100%' }} />
      </Form.Item>
      <Button
        type="primary"
        icon={<SaveOutlined />}
        onClick={onSave}
        loading={update.isPending}
      >
        Сохранить
      </Button>
    </Form>
  );
}

// ─── Banners tab ───────────────────────────────────────────────────────

interface BannerFormValues {
  title: string;
  subtitle: string;
  image_path: string;
  cta_label: string;
  cta_url: string;
  position: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_BANNER_FORM: BannerFormValues = {
  title: '',
  subtitle: '',
  image_path: '',
  cta_label: '',
  cta_url: '',
  position: 'homepage_hero',
  priority: 0,
  is_active: true,
};

function bannerToForm(b: ApiAdminBanner): BannerFormValues {
  return {
    title: b.title,
    subtitle: b.subtitle,
    image_path: b.image_path,
    cta_label: b.cta_label,
    cta_url: b.cta_url,
    position: b.position,
    priority: b.priority,
    is_active: b.is_active,
  };
}

function BannersTab() {
  const { data, error, isFetching } = useAdminBanners();
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const remove = useDeleteBanner();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<BannerFormValues>();

  function openCreate(): void {
    setEditingId(null);
    form.setFieldsValue(EMPTY_BANNER_FORM);
    setDrawerOpen(true);
  }

  function openEdit(b: ApiAdminBanner): void {
    setEditingId(b.id);
    form.setFieldsValue(bannerToForm(b));
    setDrawerOpen(true);
  }

  function close(): void {
    setDrawerOpen(false);
    setEditingId(null);
    form.resetFields();
  }

  function handleApiError(err: unknown, fallback: string): void {
    if (err instanceof ApiError && err.body?.code === 'banner_not_found') {
      message.error('Баннер не найден — возможно, удалён');
      return;
    }
    message.error(err instanceof Error ? err.message : fallback);
  }

  function onSave(): void {
    form
      .validateFields()
      .then((values) => {
        const payload: BannerCreatePayload = {
          title: values.title.trim(),
          subtitle: values.subtitle.trim(),
          image_path: values.image_path.trim(),
          cta_label: values.cta_label.trim(),
          cta_url: values.cta_url.trim(),
          position: values.position,
          priority: values.priority,
          is_active: values.is_active,
        };
        if (editingId === null) {
          create.mutate(payload, {
            onSuccess: () => {
              message.success('Баннер создан');
              close();
            },
            onError: (err) => handleApiError(err, 'Не удалось создать'),
          });
        } else {
          update.mutate(
            { bannerId: editingId, body: payload as BannerUpdatePayload },
            {
              onSuccess: () => {
                message.success('Баннер сохранён');
                close();
              },
              onError: (err) => handleApiError(err, 'Не удалось сохранить'),
            },
          );
        }
      })
      .catch(() => {});
  }

  function onToggleActive(b: ApiAdminBanner, next: boolean): void {
    update.mutate(
      { bannerId: b.id, body: { is_active: next } },
      {
        onError: (err) => handleApiError(err, 'Не удалось переключить'),
      },
    );
  }

  function onDelete(b: ApiAdminBanner): void {
    remove.mutate(b.id, {
      onSuccess: () => message.success('Баннер удалён'),
      onError: (err) => handleApiError(err, 'Не удалось удалить'),
    });
  }

  const columns: TableProps<ApiAdminBanner>['columns'] = [
    {
      title: 'Превью',
      dataIndex: 'image_path',
      key: 'image',
      width: 90,
      render: (path: string) =>
        path ? (
          <img
            src={imageSrc(path)}
            alt=""
            style={{
              width: 56, height: 56, objectFit: 'cover',
              borderRadius: 6, background: '#F5F5F5',
            }}
          />
        ) : (
          <div
            style={{
              width: 56, height: 56, borderRadius: 6,
              background: '#F5F5F5', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#9CA3AF', fontSize: 11,
            }}
          >
            нет
          </div>
        ),
    },
    {
      title: 'Заголовок',
      dataIndex: 'title',
      key: 'title',
      render: (t: string, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{t}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{row.subtitle}</div>
        </div>
      ),
    },
    {
      title: 'Позиция',
      dataIndex: 'position',
      key: 'position',
      width: 160,
      render: (p: string) => {
        const opt = POSITION_OPTIONS.find((o) => o.value === p);
        return <Tag>{opt?.label ?? p}</Tag>;
      },
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 110,
      align: 'right',
    },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (active: boolean, row) => (
        <Switch
          checked={active}
          loading={update.isPending && update.variables?.bannerId === row.id}
          onChange={(next) => onToggleActive(row, next)}
        />
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
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
            onClick={() => openEdit(row)}
            aria-label="Редактировать баннер"
          />
          <Popconfirm
            title="Удалить баннер?"
            description="Действие необратимо."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDelete(row)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={remove.isPending && remove.variables === row.id}
              aria-label="Удалить баннер"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Добавить баннер
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить баннеры"
          description={(error as Error).message}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<ApiAdminBanner>
        rowKey="id"
        dataSource={data?.items ?? []}
        columns={columns}
        loading={isFetching}
        pagination={false}
      />

      <Drawer
        title={editingId === null ? 'Новый баннер' : 'Редактировать баннер'}
        width={520}
        open={drawerOpen}
        onClose={close}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={close} disabled={create.isPending || update.isPending}>
              Отмена
            </Button>
            <Button
              type="primary"
              onClick={onSave}
              loading={create.isPending || update.isPending}
            >
              {editingId === null ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
      >
        <Form<BannerFormValues>
          form={form}
          layout="vertical"
          initialValues={EMPTY_BANNER_FORM}
        >
          <Form.Item
            label="Заголовок"
            name="title"
            rules={[
              { required: true, message: 'Укажите заголовок' },
              { max: 255, message: 'Максимум 255 символов' },
            ]}
          >
            <Input placeholder="Скидка 20% на летнюю коллекцию" />
          </Form.Item>
          <Form.Item label="Подзаголовок" name="subtitle" rules={[{ max: 500 }]}>
            <Input placeholder="До 31 июля включительно" />
          </Form.Item>
          <Form.Item label="Текст кнопки" name="cta_label" rules={[{ max: 100 }]}>
            <Input placeholder="Подробнее" />
          </Form.Item>
          <Form.Item label="Ссылка кнопки" name="cta_url" rules={[{ max: 500 }]}>
            <Input placeholder="/catalog?promo=summer" />
          </Form.Item>
          <Form.Item
            label="Позиция"
            name="position"
            rules={[{ required: true }]}
          >
            <Select options={POSITION_OPTIONS} />
          </Form.Item>
          <Form.Item
            label="Приоритет"
            name="priority"
            tooltip="Меньше = выше в списке."
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Изображение" name="image_path" rules={[{ max: 500 }]}>
            <Input placeholder="Путь к загруженному файлу" />
          </Form.Item>
          <AdminFileUpload
            purpose="BANNER"
            hint="JPG/PNG до 10 МБ"
            onUploaded={(asset) => {
              form.setFieldsValue({ image_path: asset.path });
              message.success('Изображение загружено');
            }}
          />
          <Form.Item
            label="Активен"
            name="is_active"
            valuePropName="checked"
            tooltip="Только активные баннеры видны в публичной выдаче."
            style={{ marginTop: 16 }}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}

// ─── Plans tab ─────────────────────────────────────────────────────────

interface PlanFormValues {
  id: string;
  name: string;
  price: number;
  period: string;
  area_limit_m2: number;
  popular: boolean;
  is_active: boolean;
  sort_order: number;
  features: string;  // textarea — split on save
}

const EMPTY_PLAN_FORM: PlanFormValues = {
  id: '',
  name: '',
  price: 0,
  period: 'мес',
  area_limit_m2: 0,
  popular: false,
  is_active: true,
  sort_order: 0,
  features: '',
};

function planToForm(p: ApiAdminPlan): PlanFormValues {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    period: p.period,
    area_limit_m2: p.area_limit_m2,
    popular: p.popular,
    is_active: p.is_active,
    sort_order: p.sort_order,
    features: p.features.join('\n'),
  };
}

function PlansTab() {
  const { data, error, isFetching } = useAdminPlans();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const remove = useDeletePlan();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm<PlanFormValues>();

  function openCreate(): void {
    setEditingId(null);
    form.setFieldsValue(EMPTY_PLAN_FORM);
    setDrawerOpen(true);
  }

  function openEdit(p: ApiAdminPlan): void {
    setEditingId(p.id);
    form.setFieldsValue(planToForm(p));
    setDrawerOpen(true);
  }

  function close(): void {
    setDrawerOpen(false);
    setEditingId(null);
    form.resetFields();
  }

  function handleApiError(err: unknown, fallback: string): void {
    if (err instanceof ApiError) {
      const code = err.body?.code;
      if (code === 'subscription_plan_id_conflict') {
        form.setFields([{ name: 'id', errors: ['ID уже занят'] }]);
        return;
      }
      if (code === 'subscription_plan_in_use') {
        message.error('Нельзя удалить тариф с активными подписками');
        return;
      }
      if (code === 'subscription_plan_not_found') {
        message.error('Тариф не найден');
        return;
      }
    }
    message.error(err instanceof Error ? err.message : fallback);
  }

  function onSave(): void {
    form
      .validateFields()
      .then((values) => {
        const featuresList = values.features
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const payload: PlanCreatePayload = {
          id: values.id.trim(),
          name: values.name.trim(),
          price: values.price,
          period: values.period.trim(),
          area_limit_m2: values.area_limit_m2,
          popular: values.popular,
          is_active: values.is_active,
          sort_order: values.sort_order,
          features: featuresList,
        };
        if (editingId === null) {
          create.mutate(payload, {
            onSuccess: () => {
              message.success('Тариф создан');
              close();
            },
            onError: (err) => handleApiError(err, 'Не удалось создать'),
          });
        } else {
          // PATCH — `id` is PK; backend ignores it in body.
          const update_payload: PlanUpdatePayload = {
            name: payload.name,
            price: payload.price,
            period: payload.period,
            area_limit_m2: payload.area_limit_m2,
            popular: payload.popular,
            is_active: payload.is_active,
            sort_order: payload.sort_order,
            features: payload.features,
          };
          update.mutate(
            { planId: editingId, body: update_payload },
            {
              onSuccess: () => {
                message.success('Тариф сохранён');
                close();
              },
              onError: (err) => handleApiError(err, 'Не удалось сохранить'),
            },
          );
        }
      })
      .catch(() => {});
  }

  function onTogglePopular(p: ApiAdminPlan, next: boolean): void {
    update.mutate(
      { planId: p.id, body: { popular: next } },
      {
        onError: (err) => handleApiError(err, 'Не удалось обновить'),
      },
    );
  }

  function onToggleActive(p: ApiAdminPlan, next: boolean): void {
    update.mutate(
      { planId: p.id, body: { is_active: next } },
      {
        onError: (err) => handleApiError(err, 'Не удалось обновить'),
      },
    );
  }

  function onDelete(p: ApiAdminPlan): void {
    remove.mutate(p.id, {
      onSuccess: () => message.success('Тариф удалён'),
      onError: (err) => handleApiError(err, 'Не удалось удалить'),
    });
  }

  const columns: TableProps<ApiAdminPlan>['columns'] = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 130,
      render: (id: string) => <code>{id}</code>,
    },
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (n: string, row) => (
        <div>
          <div style={{ fontWeight: 500 }}>{n}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            {row.area_limit_m2 > 0 ? `до ${row.area_limit_m2} м²` : 'безлимит'}
          </div>
        </div>
      ),
    },
    {
      title: 'Цена',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (p: number, row) => `${formatRub(p)}/${row.period}`,
    },
    {
      title: 'Hit',
      dataIndex: 'popular',
      key: 'popular',
      width: 90,
      align: 'center',
      render: (pop: boolean, row) => (
        <Switch
          checked={pop}
          loading={
            update.isPending &&
            update.variables?.planId === row.id &&
            'popular' in (update.variables?.body ?? {})
          }
          onChange={(next) => onTogglePopular(row, next)}
        />
      ),
    },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (active: boolean, row) => (
        <Switch
          checked={active}
          loading={
            update.isPending &&
            update.variables?.planId === row.id &&
            'is_active' in (update.variables?.body ?? {})
          }
          onChange={(next) => onToggleActive(row, next)}
        />
      ),
    },
    {
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 90,
      align: 'right',
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
            onClick={() => openEdit(row)}
            aria-label="Редактировать тариф"
          />
          <Popconfirm
            title="Удалить тариф?"
            description="Будет отказано, если есть активные подписки."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDelete(row)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={remove.isPending && remove.variables === row.id}
              aria-label="Удалить тариф"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Добавить тариф
        </Button>
      </Space>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Не удалось загрузить тарифы"
          description={(error as Error).message}
          style={{ marginBottom: 16 }}
        />
      )}

      <Table<ApiAdminPlan>
        rowKey="id"
        dataSource={data?.items ?? []}
        columns={columns}
        loading={isFetching}
        pagination={false}
      />

      <Drawer
        title={editingId === null ? 'Новый тариф' : 'Редактировать тариф'}
        width={520}
        open={drawerOpen}
        onClose={close}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={close} disabled={create.isPending || update.isPending}>
              Отмена
            </Button>
            <Button
              type="primary"
              onClick={onSave}
              loading={create.isPending || update.isPending}
            >
              {editingId === null ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
      >
        <Form<PlanFormValues>
          form={form}
          layout="vertical"
          initialValues={EMPTY_PLAN_FORM}
        >
          <Form.Item
            label="ID (slug)"
            name="id"
            rules={[
              { required: true, message: 'Укажите id' },
              { max: 64, message: 'Максимум 64 символа' },
              {
                pattern: /^[a-z0-9-]+$/,
                message: 'Только латинские буквы, цифры и дефис',
              },
            ]}
            tooltip="Уникальный идентификатор; нельзя изменить после создания."
          >
            <Input
              placeholder="vip"
              disabled={editingId !== null}
            />
          </Form.Item>
          <Form.Item
            label="Название"
            name="name"
            rules={[
              { required: true, message: 'Укажите название' },
              { max: 255, message: 'Максимум 255 символов' },
            ]}
          >
            <Input placeholder="VIP" />
          </Form.Item>
          <Form.Item
            label="Цена (₽)"
            name="price"
            rules={[{ required: true, message: 'Укажите цену' }]}
          >
            <InputNumber min={0} max={10_000_000} step={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Период" name="period" rules={[{ required: true }]}>
            <Input placeholder="мес" />
          </Form.Item>
          <Form.Item
            label="Лимит м²"
            name="area_limit_m2"
            tooltip="0 — безлимит."
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={1_000_000} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Порядок"
            name="sort_order"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Особенности (по строке на пункт)" name="features">
            <TextArea rows={5} placeholder="Бесплатная доставка по РФ" />
          </Form.Item>
          <Space size="large">
            <Form.Item name="popular" label="Hit" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="is_active" label="Активен" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Drawer>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────

export default function AdminShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: ShopTab = parseTab(searchParams.get('tab'));

  const settings = useAdminShopSettings();

  function setTab(next: ShopTab): void {
    const params = new URLSearchParams();
    if (next !== DEFAULT_TAB) params.set('tab', next);
    setSearchParams(params, { replace: false });
  }

  const tabItems = useMemo(
    () => [
      {
        key: 'settings',
        label: 'Настройки',
        children: (
          <>
            {settings.error && (
              <Alert
                type="error"
                showIcon
                message="Не удалось загрузить настройки"
                description={(settings.error as Error).message}
                style={{ marginBottom: 16 }}
              />
            )}
            <SettingsTab data={settings.data} />
          </>
        ),
      },
      {
        key: 'banners',
        label: 'Баннеры',
        children: <BannersTab />,
      },
      {
        key: 'plans',
        label: 'Тарифы',
        children: <PlansTab />,
      },
    ],
    [settings.data, settings.error],
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Title level={3} style={{ marginBottom: 24 }}>
          Магазин
        </Title>
      </motion.div>
      <motion.div variants={fadeUpVariants} custom={1}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as ShopTab)}
          items={tabItems}
        />
      </motion.div>
    </motion.div>
  );
}
