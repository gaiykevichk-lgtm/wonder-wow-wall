import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  ColorPicker,
  Drawer,
  Empty,
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
  CheckCircleFilled,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';

import { ApiError } from '../../../shared/api';
import { imageSrc } from '../../../shared/lib/imageSrc';
import { slugify } from '../../../shared/lib/slugify';
import { AdminFileUpload } from '../../../shared/ui/AdminFileUpload';
import {
  type ApiTexture,
  type ApiTextureColor,
  type ApiVariantImage,
  type TextureCreatePayload,
  type TextureUpdatePayload,
  type TextureColorCreatePayload,
  type TextureColorUpdatePayload,
  type VariantImageCreatePayload,
  useAdminTextures,
  useCreateTexture,
  useUpdateTexture,
  useDeleteTexture,
  useAdminTextureColors,
  useCreateTextureColor,
  useUpdateTextureColor,
  useDeleteTextureColor,
  useAdminVariantImages,
  useCreateVariantImage,
  useDeleteVariantImage,
} from '../api/texturesAdminApi';
import {
  type ApiAdminDesign,
  useAdminDesigns,
  type DesignsAdminQuery,
} from '../api/catalogAdminApi';

const { Title } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

type TexturesTab = 'textures' | 'colors' | 'images';

function parseTab(raw: string | null): TexturesTab {
  if (raw === 'colors' || raw === 'images') return raw;
  return 'textures';
}

function formatDate(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY');
}

// ─── Texture Form ───────────────────────────────────────────────────────

interface TextureFormValues {
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_TEXTURE_FORM: TextureFormValues = {
  name: '',
  slug: '',
  sort_order: 0,
  is_active: true,
};

function textureToForm(t: ApiTexture): TextureFormValues {
  return {
    name: t.name,
    slug: t.slug,
    sort_order: t.sort_order,
    is_active: t.is_active,
  };
}

// ─── Color Form ─────────────────────────────────────────────────────────

interface ColorFormValues {
  name: string;
  hex: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_COLOR_FORM: ColorFormValues = {
  name: '',
  hex: '',
  sort_order: 0,
  is_active: true,
};

function colorToForm(c: ApiTextureColor): ColorFormValues {
  return {
    name: c.name,
    hex: c.hex,
    sort_order: c.sort_order,
    is_active: c.is_active,
  };
}

// ─── Designs query for variant images tab ───────────────────────────────

const ALL_DESIGNS_QUERY: DesignsAdminQuery = {
  page: 1,
  size: 200,
  sort: 'name',
  categoryId: null,
  search: null,
};

// ═════════════════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════════════════

export default function AdminTexturesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));

  function setTab(next: TexturesTab): void {
    const params = new URLSearchParams();
    if (next !== 'textures') params.set('tab', next);
    setSearchParams(params, { replace: false });
  }

  // ─── Textures data ──────────────────────────────────────────────────
  const texturesQuery = useAdminTextures();
  const textures = texturesQuery.data ?? [];

  const createTexture = useCreateTexture();
  const updateTexture = useUpdateTexture();
  const deleteTexture = useDeleteTexture();

  // ─── Texture drawer ─────────────────────────────────────────────────
  const [textureDrawer, setTextureDrawer] = useState(false);
  const [editingTextureId, setEditingTextureId] = useState<string | null>(null);
  const [textureForm] = Form.useForm<TextureFormValues>();
  const [textureSwatchPath, setTextureSwatchPath] = useState('');
  const lastTextureSlugRef = useRef('');

  function openCreateTexture(): void {
    setEditingTextureId(null);
    setTextureSwatchPath('');
    lastTextureSlugRef.current = '';
    textureForm.resetFields();
    textureForm.setFieldsValue(EMPTY_TEXTURE_FORM);
    setTextureDrawer(true);
  }

  function openEditTexture(t: ApiTexture): void {
    setEditingTextureId(t.id);
    setTextureSwatchPath(t.swatch_image);
    lastTextureSlugRef.current = '';
    textureForm.resetFields();
    textureForm.setFieldsValue(textureToForm(t));
    setTextureDrawer(true);
  }

  function closeTextureDrawer(): void {
    setTextureDrawer(false);
    setEditingTextureId(null);
    textureForm.resetFields();
    setTextureSwatchPath('');
    lastTextureSlugRef.current = '';
  }

  function handleTextureError(err: unknown, fallback: string): void {
    if (err instanceof ApiError && err.body?.code === 'texture_slug_conflict') {
      textureForm.setFields([{ name: 'slug', errors: ['Slug уже занят'] }]);
      return;
    }
    if (err instanceof ApiError && err.body?.code === 'texture_has_variants') {
      message.error('Нельзя удалить: есть изображения комбинаций');
      return;
    }
    if (err instanceof ApiError && err.body?.code === 'texture_not_found') {
      message.error('Текстура не найдена — возможно, удалена');
      return;
    }
    message.error(err instanceof Error ? err.message : fallback);
  }

  function onSubmitTexture(): void {
    textureForm
      .validateFields()
      .then((values) => {
        const payload: TextureCreatePayload = {
          name: values.name.trim(),
          slug: values.slug.trim(),
          swatch_image: textureSwatchPath.trim(),
          sort_order: values.sort_order,
          is_active: values.is_active,
        };

        if (editingTextureId === null) {
          createTexture.mutate(payload, {
            onSuccess: () => {
              message.success('Текстура добавлена');
              closeTextureDrawer();
            },
            onError: (err) => handleTextureError(err, 'Не удалось создать текстуру'),
          });
        } else {
          updateTexture.mutate(
            { textureId: editingTextureId, body: payload as TextureUpdatePayload },
            {
              onSuccess: () => {
                message.success('Изменения сохранены');
                closeTextureDrawer();
              },
              onError: (err) => handleTextureError(err, 'Не удалось сохранить'),
            },
          );
        }
      })
      .catch(() => {});
  }

  function onToggleTextureActive(t: ApiTexture, next: boolean): void {
    updateTexture.mutate(
      { textureId: t.id, body: { is_active: next } },
      {
        onSuccess: () =>
          message.success(next ? 'Текстура активирована' : 'Текстура скрыта'),
        onError: (err) =>
          handleTextureError(err, 'Не удалось переключить'),
      },
    );
  }

  function onDeleteTexture(t: ApiTexture): void {
    deleteTexture.mutate(t.id, {
      onSuccess: () => message.success('Текстура удалена'),
      onError: (err) => handleTextureError(err, 'Не удалось удалить'),
    });
  }

  const textureColumns: TableProps<ApiTexture>['columns'] = [
    {
      title: 'Swatch',
      dataIndex: 'swatch_image',
      key: 'swatch',
      width: 80,
      render: (path: string) =>
        path ? (
          <img
            src={imageSrc(path)}
            alt=""
            style={{
              width: 48,
              height: 48,
              objectFit: 'cover',
              borderRadius: 6,
              background: '#F5F5F5',
            }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 6,
              background: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: 10,
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
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
      align: 'center',
    },
    {
      title: 'Активна',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (isActive: boolean, row) => (
        <Switch
          checked={isActive}
          loading={
            updateTexture.isPending &&
            updateTexture.variables?.textureId === row.id
          }
          onChange={(next) => onToggleTextureActive(row, next)}
        />
      ),
    },
    {
      title: 'Создана',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: formatDate,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      render: (_v, row) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditTexture(row)}
            aria-label="Редактировать"
          />
          <Popconfirm
            title="Удалить текстуру?"
            description="Действие необратимо."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDeleteTexture(row)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={
                deleteTexture.isPending && deleteTexture.variables === row.id
              }
              aria-label="Удалить"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isTextureSubmitting = createTexture.isPending || updateTexture.isPending;

  // ─── Colors data ────────────────────────────────────────────────────
  const [selectedTextureId, setSelectedTextureId] = useState<string | undefined>(
    undefined,
  );
  const colorsQuery = useAdminTextureColors(selectedTextureId);
  const colors = colorsQuery.data ?? [];

  const createColor = useCreateTextureColor();
  const updateColor = useUpdateTextureColor();
  const deleteColor = useDeleteTextureColor();

  // ─── Color drawer ──────────────────────────────────────────────────
  const [colorDrawer, setColorDrawer] = useState(false);
  const [editingColorId, setEditingColorId] = useState<string | null>(null);
  const [colorForm] = Form.useForm<ColorFormValues>();
  const watchedHex = Form.useWatch('hex', colorForm);
  const [colorSwatchPath, setColorSwatchPath] = useState('');

  function openCreateColor(): void {
    if (!selectedTextureId) {
      message.warning('Сначала выберите текстуру');
      return;
    }
    setEditingColorId(null);
    setColorSwatchPath('');
    colorForm.resetFields();
    colorForm.setFieldsValue(EMPTY_COLOR_FORM);
    setColorDrawer(true);
  }

  function openEditColor(c: ApiTextureColor): void {
    setEditingColorId(c.id);
    setColorSwatchPath(c.swatch_image);
    colorForm.resetFields();
    colorForm.setFieldsValue(colorToForm(c));
    setColorDrawer(true);
  }

  function closeColorDrawer(): void {
    setColorDrawer(false);
    setEditingColorId(null);
    colorForm.resetFields();
    setColorSwatchPath('');
  }

  function handleColorError(err: unknown, fallback: string): void {
    if (err instanceof ApiError && err.body?.code === 'texture_color_not_found') {
      message.error('Цвет не найден — возможно, удалён');
      return;
    }
    message.error(err instanceof Error ? err.message : fallback);
  }

  function onSubmitColor(): void {
    if (!selectedTextureId) return;
    colorForm
      .validateFields()
      .then((values) => {
        const payload: TextureColorCreatePayload = {
          name: values.name.trim(),
          hex: values.hex.trim(),
          swatch_image: colorSwatchPath.trim(),
          sort_order: values.sort_order,
          is_active: values.is_active,
        };

        if (editingColorId === null) {
          createColor.mutate(
            { textureId: selectedTextureId, body: payload },
            {
              onSuccess: () => {
                message.success('Цвет добавлен');
                closeColorDrawer();
              },
              onError: (err) => handleColorError(err, 'Не удалось создать цвет'),
            },
          );
        } else {
          updateColor.mutate(
            { colorId: editingColorId, body: payload as TextureColorUpdatePayload },
            {
              onSuccess: () => {
                message.success('Изменения сохранены');
                closeColorDrawer();
              },
              onError: (err) => handleColorError(err, 'Не удалось сохранить'),
            },
          );
        }
      })
      .catch(() => {});
  }

  function onToggleColorActive(c: ApiTextureColor, next: boolean): void {
    updateColor.mutate(
      { colorId: c.id, body: { is_active: next } },
      {
        onSuccess: () =>
          message.success(next ? 'Цвет активирован' : 'Цвет скрыт'),
        onError: (err) => handleColorError(err, 'Не удалось переключить'),
      },
    );
  }

  function onDeleteColor(c: ApiTextureColor): void {
    deleteColor.mutate(c.id, {
      onSuccess: () => message.success('Цвет удалён'),
      onError: (err) => handleColorError(err, 'Не удалось удалить'),
    });
  }

  const colorColumns: TableProps<ApiTextureColor>['columns'] = [
    {
      title: 'Swatch',
      dataIndex: 'swatch_image',
      key: 'swatch',
      width: 80,
      render: (path: string, row) =>
        path ? (
          <img
            src={imageSrc(path)}
            alt=""
            style={{
              width: 40,
              height: 40,
              objectFit: 'cover',
              borderRadius: 6,
              background: '#F5F5F5',
            }}
          />
        ) : row.hex ? (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              background: row.hex,
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
        ) : (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 6,
              background: '#F5F5F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9CA3AF',
              fontSize: 10,
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
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
    },
    {
      title: 'HEX',
      dataIndex: 'hex',
      key: 'hex',
      width: 120,
      render: (hex: string) =>
        hex ? (
          <Tag style={{ fontFamily: 'monospace' }}>{hex}</Tag>
        ) : (
          <span style={{ color: '#9CA3AF' }}>—</span>
        ),
    },
    {
      title: 'Порядок',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
      align: 'center',
    },
    {
      title: 'Активен',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      align: 'center',
      render: (isActive: boolean, row) => (
        <Switch
          checked={isActive}
          loading={
            updateColor.isPending &&
            updateColor.variables?.colorId === row.id
          }
          onChange={(next) => onToggleColorActive(row, next)}
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
      width: 100,
      render: (_v, row) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditColor(row)}
            aria-label="Редактировать"
          />
          <Popconfirm
            title="Удалить цвет?"
            description="Действие необратимо."
            okText="Удалить"
            okButtonProps={{ danger: true }}
            cancelText="Отмена"
            onConfirm={() => onDeleteColor(row)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={
                deleteColor.isPending && deleteColor.variables === row.id
              }
              aria-label="Удалить"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isColorSubmitting = createColor.isPending || updateColor.isPending;

  // ─── Variant Images data ────────────────────────────────────────────
  const [viDesignId, setViDesignId] = useState<string | undefined>(undefined);
  const [viTextureId, setViTextureId] = useState<string | undefined>(undefined);

  const designsQuery = useAdminDesigns(ALL_DESIGNS_QUERY);
  const designs: ApiAdminDesign[] = designsQuery.data?.items ?? [];

  const viColorsQuery = useAdminTextureColors(viTextureId);
  const viColors: ApiTextureColor[] = viColorsQuery.data ?? [];

  const viParams = useMemo(
    () => ({
      designId: viDesignId,
      textureId: viTextureId,
    }),
    [viDesignId, viTextureId],
  );
  const variantImagesQuery = useAdminVariantImages(viParams);
  const variantImages: ApiVariantImage[] = variantImagesQuery.data ?? [];

  const viMap = useMemo(() => {
    const m = new Map<string, ApiVariantImage>();
    for (const vi of variantImages) {
      m.set(vi.color_id, vi);
    }
    return m;
  }, [variantImages]);

  const createVariant = useCreateVariantImage();
  const deleteVariant = useDeleteVariantImage();

  // Track which color cell is currently uploading
  const [uploadingColorId, setUploadingColorId] = useState<string | null>(null);

  function onVariantUploaded(colorId: string, imagePath: string): void {
    if (!viDesignId || !viTextureId) return;
    setUploadingColorId(colorId);
    const payload: VariantImageCreatePayload = {
      design_id: viDesignId,
      texture_id: viTextureId,
      color_id: colorId,
      image_path: imagePath,
    };
    createVariant.mutate(payload, {
      onSuccess: () => {
        message.success('Изображение комбинации загружено');
        setUploadingColorId(null);
      },
      onError: (err) => {
        if (
          err instanceof ApiError &&
          err.body?.code === 'variant_image_combination_conflict'
        ) {
          message.error('Изображение для этой комбинации уже существует');
        } else {
          message.error(
            err instanceof Error ? err.message : 'Не удалось создать',
          );
        }
        setUploadingColorId(null);
      },
    });
  }

  function onDeleteVariant(variantId: string): void {
    deleteVariant.mutate(variantId, {
      onSuccess: () => message.success('Изображение удалено'),
      onError: (err) =>
        message.error(
          err instanceof Error ? err.message : 'Не удалось удалить',
        ),
    });
  }

  // Auto-select first texture when switching to colors tab
  useEffect(() => {
    if (tab === 'colors' && !selectedTextureId && textures.length > 0) {
      setSelectedTextureId(textures[0].id);
    }
  }, [tab, selectedTextureId, textures]);

  // ─── Render ─────────────────────────────────────────────────────────
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
        style={{ marginBottom: 24 }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Текстуры
        </Title>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Tabs
          activeKey={tab}
          onChange={(key) => setTab(key as TexturesTab)}
          items={[
            {
              key: 'textures',
              label: 'Текстуры',
              children: (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: 16,
                    }}
                  >
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreateTexture}
                    >
                      Добавить текстуру
                    </Button>
                  </div>

                  {texturesQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      message="Не удалось загрузить текстуры"
                      description={(texturesQuery.error as Error).message}
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  <Table<ApiTexture>
                    rowKey="id"
                    dataSource={textures}
                    columns={textureColumns}
                    loading={texturesQuery.isFetching}
                    pagination={false}
                  />
                </>
              ),
            },
            {
              key: 'colors',
              label: 'Цвета',
              children: (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Select
                      placeholder="Выберите текстуру"
                      style={{ minWidth: 240 }}
                      value={selectedTextureId}
                      onChange={setSelectedTextureId}
                      options={textures.map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openCreateColor}
                      disabled={!selectedTextureId}
                    >
                      Добавить цвет
                    </Button>
                  </div>

                  {colorsQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      message="Не удалось загрузить цвета"
                      description={(colorsQuery.error as Error).message}
                      style={{ marginBottom: 16 }}
                    />
                  )}

                  {!selectedTextureId ? (
                    <Empty description="Выберите текстуру для просмотра цветов" />
                  ) : (
                    <Table<ApiTextureColor>
                      rowKey="id"
                      dataSource={colors}
                      columns={colorColumns}
                      loading={colorsQuery.isFetching}
                      pagination={false}
                    />
                  )}
                </>
              ),
            },
            {
              key: 'images',
              label: 'Изображения комбинаций',
              children: (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Select
                      placeholder="Выберите форму (дизайн)"
                      style={{ minWidth: 240 }}
                      value={viDesignId}
                      onChange={(val) => {
                        setViDesignId(val);
                      }}
                      options={designs.map((d) => ({
                        value: d.id,
                        label: d.name,
                      }))}
                      loading={designsQuery.isFetching}
                      showSearch
                      optionFilterProp="label"
                    />
                    <Select
                      placeholder="Выберите текстуру"
                      style={{ minWidth: 240 }}
                      value={viTextureId}
                      onChange={setViTextureId}
                      options={textures.map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    />
                  </div>

                  {!viDesignId || !viTextureId ? (
                    <Empty description="Выберите форму и текстуру для управления изображениями" />
                  ) : viColorsQuery.isFetching ? (
                    <div style={{ textAlign: 'center', padding: 48 }}>
                      Загрузка цветов…
                    </div>
                  ) : viColors.length === 0 ? (
                    <Empty description="У выбранной текстуры нет цветов. Добавьте цвета на вкладке «Цвета»." />
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: 16,
                      }}
                    >
                      {viColors.map((color) => {
                        const existing = viMap.get(color.id);
                        const isUploading =
                          uploadingColorId === color.id &&
                          createVariant.isPending;

                        return (
                          <div
                            key={color.id}
                            style={{
                              border: existing
                                ? '2px solid #4CAF50'
                                : '2px dashed #D1D5DB',
                              borderRadius: 8,
                              padding: 12,
                              background: '#FAFAFA',
                              position: 'relative',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 8,
                              }}
                            >
                              {color.hex && (
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 4,
                                    background: color.hex,
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  fontWeight: 500,
                                  fontSize: 13,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {color.name}
                              </span>
                              {existing && (
                                <CheckCircleFilled
                                  style={{
                                    color: '#4CAF50',
                                    fontSize: 14,
                                    marginLeft: 'auto',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                            </div>

                            {existing ? (
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={imageSrc(existing.image_path)}
                                  alt={color.name}
                                  style={{
                                    width: '100%',
                                    aspectRatio: '1',
                                    objectFit: 'cover',
                                    borderRadius: 6,
                                    background: '#F0F0F0',
                                  }}
                                />
                                <Popconfirm
                                  title="Удалить изображение?"
                                  okText="Удалить"
                                  okButtonProps={{ danger: true }}
                                  cancelText="Отмена"
                                  onConfirm={() =>
                                    onDeleteVariant(existing.id)
                                  }
                                >
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      background: 'rgba(255,255,255,0.9)',
                                      borderRadius: 4,
                                    }}
                                    loading={
                                      deleteVariant.isPending &&
                                      deleteVariant.variables === existing.id
                                    }
                                    aria-label="Удалить изображение"
                                  />
                                </Popconfirm>
                              </div>
                            ) : (
                              <div>
                                <AdminFileUpload
                                  purpose="MISC"
                                  hint="JPG/PNG"
                                  disabled={isUploading}
                                  onUploaded={(asset) => {
                                    onVariantUploaded(color.id, asset.path);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ),
            },
          ]}
        />
      </motion.div>

      {/* ─── Texture Drawer ──────────────────────────────────────────── */}
      <Drawer
        title={
          editingTextureId === null
            ? 'Новая текстура'
            : 'Редактировать текстуру'
        }
        styles={{ wrapper: { width: 480 } }}
        open={textureDrawer}
        onClose={closeTextureDrawer}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={closeTextureDrawer} disabled={isTextureSubmitting}>
              Отмена
            </Button>
            <Button
              type="primary"
              onClick={onSubmitTexture}
              loading={isTextureSubmitting}
            >
              {editingTextureId === null ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
      >
        <Form<TextureFormValues>
          form={textureForm}
          layout="vertical"
          initialValues={EMPTY_TEXTURE_FORM}
          onValuesChange={(changed) => {
            if (editingTextureId !== null) return;
            if (!('name' in changed)) return;
            const currentSlug =
              (textureForm.getFieldValue('slug') as string) ?? '';
            if (
              currentSlug === '' ||
              currentSlug === lastTextureSlugRef.current
            ) {
              const next = slugify(changed.name as string);
              textureForm.setFieldsValue({ slug: next });
              lastTextureSlugRef.current = next;
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
            <Input placeholder="Бетон" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug"
            tooltip="URL-идентификатор. Заполняется из названия."
            rules={[
              { required: true, message: 'Укажите slug' },
              { max: 120, message: 'Максимум 120 символов' },
              {
                pattern: /^[a-z0-9-]+$/,
                message: 'Только латинские буквы, цифры и дефис',
              },
            ]}
          >
            <Input placeholder="concrete" />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="Порядок сортировки"
            tooltip="Меньшее число — выше в списке."
          >
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Swatch-изображение">
            <AdminFileUpload
              purpose="MISC"
              hint="JPG/PNG до 10 МБ"
              onUploaded={(asset) => {
                setTextureSwatchPath(asset.path);
                message.success('Swatch загружен');
              }}
            />
            {textureSwatchPath && (
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
                  src={imageSrc(textureSwatchPath)}
                  alt=""
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: 'cover',
                    borderRadius: 4,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6B7280',
                      wordBreak: 'break-all',
                    }}
                  >
                    {textureSwatchPath}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginTop: 4 }}
                    onClick={() => setTextureSwatchPath('')}
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
            tooltip="Неактивные текстуры скрыты в публичном каталоге."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      {/* ─── Color Drawer ────────────────────────────────────────────── */}
      <Drawer
        title={
          editingColorId === null ? 'Новый цвет' : 'Редактировать цвет'
        }
        styles={{ wrapper: { width: 480 } }}
        open={colorDrawer}
        onClose={closeColorDrawer}
        destroyOnHidden
        extra={
          <Space>
            <Button onClick={closeColorDrawer} disabled={isColorSubmitting}>
              Отмена
            </Button>
            <Button
              type="primary"
              onClick={onSubmitColor}
              loading={isColorSubmitting}
            >
              {editingColorId === null ? 'Создать' : 'Сохранить'}
            </Button>
          </Space>
        }
      >
        <Form<ColorFormValues>
          form={colorForm}
          layout="vertical"
          initialValues={EMPTY_COLOR_FORM}
        >
          <Form.Item
            name="name"
            label="Название"
            rules={[
              { required: true, message: 'Укажите название' },
              { max: 255, message: 'Максимум 255 символов' },
            ]}
          >
            <Input placeholder="Серый" />
          </Form.Item>

          <Form.Item
            name="hex"
            label="HEX-код цвета"
            tooltip="Формат: #RRGGBB. Опционально."
            rules={[
              {
                pattern: /^(#[0-9A-Fa-f]{6})?$/,
                message: 'Формат: #RRGGBB',
              },
            ]}
          >
            <Input
              placeholder="#808080"
              addonAfter={
                <ColorPicker
                  size="small"
                  value={watchedHex || '#808080'}
                  onChange={(_, hex) =>
                    colorForm.setFieldsValue({ hex })
                  }
                />
              }
            />
          </Form.Item>

          <Form.Item
            name="sort_order"
            label="Порядок сортировки"
          >
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Swatch-изображение">
            <AdminFileUpload
              purpose="MISC"
              hint="JPG/PNG до 10 МБ"
              onUploaded={(asset) => {
                setColorSwatchPath(asset.path);
                message.success('Swatch загружен');
              }}
            />
            {colorSwatchPath && (
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
                  src={imageSrc(colorSwatchPath)}
                  alt=""
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 4,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6B7280',
                      wordBreak: 'break-all',
                    }}
                  >
                    {colorSwatchPath}
                  </div>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, marginTop: 4 }}
                    onClick={() => setColorSwatchPath('')}
                  >
                    Убрать
                  </Button>
                </div>
              </div>
            )}
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Активен"
            valuePropName="checked"
            tooltip="Неактивные цвета скрыты в публичном каталоге."
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </motion.div>
  );
}
