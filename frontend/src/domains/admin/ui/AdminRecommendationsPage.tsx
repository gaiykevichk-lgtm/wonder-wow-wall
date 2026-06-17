/**
 * Phase 10 — admin «с этим покупают» curation page.
 *
 * Two-pane UX:
 *   ┌────────────────────────────── header ─────────────────────────────┐
 *   │  ┌─ source_type ─┬─ has_manual ─┬─ + Новая подборка ─┐            │
 *   │  └───────────────┴──────────────┴──────────────────────┘           │
 *   │                                                                    │
 *   │  ┌──── AntD <Table> — Источник, Тип, Кол-во, Обновлён ─────────┐   │
 *   │  └──────────────────────────────────────────────────────────────┘   │
 *   │                                                                    │
 *   │  ┌──── <Drawer> editor (opens on row click) ──────────────────┐    │
 *   │  │  Список целей: tag list with ↑ ↓ ✕                           │    │
 *   │  │  + Добавить: тип + id picker                                 │    │
 *   │  │  Сохранить / Сбросить / Удалить подборку                     │    │
 *   │  └──────────────────────────────────────────────────────────────┘    │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth for filters and pagination (DoD § "переживают
 * F5"). The drawer state (which source is being edited) is intentionally
 * NOT persisted to the URL — it's a transient editor, and a deep-link to
 * "open edit modal for X" would conflict with the table's own selection
 * model. If we need shareable editor URLs later, we can promote it then.
 *
 * Mirrors `AdminUsersPage.tsx` for the table chrome, filters, and motion.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Button,
  Drawer,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  type ApiRecommendation,
  type ApiRecommendationTarget,
  type RecommendationsAdminQuery,
  type RecommendationSourceTypeKey,
  type RecommendationTargetTypeKey,
  useCopyRecommendations,
  useDeleteRecommendation,
  useRecommendationDetail,
  useRecommendationsAdminList,
  useUpsertRecommendation,
} from '../api/recommendationsAdminApi';
import {
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  HAS_MANUAL_OPTIONS,
  queryFromSearchParams,
  searchParamsFromQuery,
  SOURCE_TYPE_OPTIONS,
} from '../model/recommendationsAdminStore';
import { useDesigns } from '../../catalog/api/catalogApi';

const { Title, Text } = Typography;

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

const SOURCE_TAG_COLOR: Record<RecommendationSourceTypeKey, string> = {
  design: 'geekblue',
  panel: 'purple',
};

const TYPE_LABEL: Record<RecommendationSourceTypeKey, string> = {
  design: 'Дизайн',
  panel: 'Панель',
};

function formatTs(iso: string): string {
  return iso ? dayjs(iso).format('DD.MM.YYYY HH:mm') : '—';
}

// ────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────

export default function AdminRecommendationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: RecommendationsAdminQuery = useMemo(
    () => queryFromSearchParams(searchParams),
    [searchParams],
  );

  const { data, isFetching, error } = useRecommendationsAdminList(query);

  // Drawer editor key — the natural pair (source_type, source_id). `null`
  // means the drawer is closed. Kept in component state, not URL — see
  // module docstring for the rationale.
  const [editing, setEditing] = useState<{
    sourceType: RecommendationSourceTypeKey;
    sourceId: string;
  } | null>(null);

  // "Create new" modal — collects the source pair before opening the
  // editor, since a brand-new curation needs both fields up-front and the
  // table only lists existing rows.
  const [creating, setCreating] = useState(false);

  // Phase 10 LOW-6 — local draft mirrors `?search=` so typing doesn't
  // fire a request per keystroke; debounced by Enter or the AntD search
  // icon (same UX as `AdminCatalogPage`).
  const [searchDraft, setSearchDraft] = useState<string>(query.search ?? '');
  useEffect(() => {
    setSearchDraft(query.search ?? '');
  }, [query.search]);

  function updateUrl(next: RecommendationsAdminQuery): void {
    setSearchParams(searchParamsFromQuery(next), { replace: false });
  }

  function onSourceTypeChange(
    value: RecommendationSourceTypeKey | null | undefined,
  ): void {
    updateUrl(applyFilterPatch(query, { sourceType: value ?? null }));
  }

  function onHasManualChange(value: 'true' | 'false' | null | undefined): void {
    const hasManual = value === 'true' ? true : value === 'false' ? false : null;
    updateUrl(applyFilterPatch(query, { hasManual }));
  }

  function onSearchSubmit(value: string): void {
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

  const columns: TableProps<ApiRecommendation>['columns'] = [
    {
      title: 'Источник',
      dataIndex: 'source_id',
      key: 'source_id',
      render: (sourceId: string) => (
        <Text style={{ fontFamily: 'monospace' }}>{sourceId}</Text>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'source_type',
      key: 'source_type',
      width: 120,
      render: (t: RecommendationSourceTypeKey) => (
        <Tag color={SOURCE_TAG_COLOR[t]} style={{ margin: 0 }}>
          {TYPE_LABEL[t]}
        </Tag>
      ),
    },
    {
      title: 'Целей',
      dataIndex: 'targets',
      key: 'targets_count',
      width: 100,
      render: (targets: ApiRecommendationTarget[]) => (
        <Text>{targets.length}</Text>
      ),
    },
    {
      title: 'Обновлено',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: formatTs,
    },
  ];

  const hasActiveFilters =
    query.sourceType !== null || query.hasManual !== null || !!query.search;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Title level={3} style={{ marginBottom: 24 }}>
          Рекомендации
        </Title>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select<RecommendationSourceTypeKey | null>
            placeholder="Тип источника"
            allowClear
            style={{ minWidth: 180 }}
            value={query.sourceType}
            onChange={onSourceTypeChange}
            options={SOURCE_TYPE_OPTIONS}
          />
          <Select<'true' | 'false' | null>
            placeholder="Подборка"
            allowClear
            style={{ minWidth: 180 }}
            value={
              query.hasManual === null
                ? undefined
                : query.hasManual
                  ? 'true'
                  : 'false'
            }
            onChange={onHasManualChange}
            options={HAS_MANUAL_OPTIONS}
          />
          <Input.Search
            placeholder="Поиск по source_id"
            allowClear
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={onSearchSubmit}
            style={{ width: 280 }}
          />
          {hasActiveFilters && (
            <Button onClick={onResetFilters}>Сбросить</Button>
          )}
          <Button type="primary" onClick={() => setCreating(true)}>
            + Новая подборка
          </Button>
        </Space>
      </motion.div>

      {error && (
        <motion.div variants={fadeUpVariants} custom={2}>
          <Alert
            type="error"
            showIcon
            message="Не удалось загрузить рекомендации"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={2}>
        <Table<ApiRecommendation>
          rowKey={(row) => `${row.source_type}:${row.source_id}`}
          dataSource={data?.items ?? []}
          columns={columns}
          loading={isFetching}
          onChange={onTableChange}
          pagination={{
            current: query.page,
            pageSize: query.size,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100, 200],
            showTotal: (total) => `Всего: ${total}`,
          }}
          onRow={(row) => ({
            onClick: () =>
              setEditing({
                sourceType: row.source_type,
                sourceId: row.source_id,
              }),
            style: { cursor: 'pointer' },
          })}
        />
      </motion.div>

      <CreateRecommendationModal
        open={creating}
        onCancel={() => setCreating(false)}
        onSubmit={(pair) => {
          setCreating(false);
          setEditing(pair);
        }}
      />

      <RecommendationEditorDrawer
        open={editing !== null}
        sourceType={editing?.sourceType}
        sourceId={editing?.sourceId}
        onClose={() => setEditing(null)}
      />
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Create-new modal
// ────────────────────────────────────────────────────────────────────────

interface CreateRecommendationModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (pair: {
    sourceType: RecommendationSourceTypeKey;
    sourceId: string;
  }) => void;
}

function CreateRecommendationModal({
  open,
  onCancel,
  onSubmit,
}: CreateRecommendationModalProps) {
  const [sourceType, setSourceType] =
    useState<RecommendationSourceTypeKey>('design');
  const [sourceId, setSourceId] = useState<string>('');

  // Design picker — re-uses the public list (no admin-only API exists).
  // `limit: 200` matches what `ProductPage` requests so the cache hit
  // rate is high when an admin alternates between the two screens.
  const { data: designsData } = useDesigns({ limit: 200 });
  const designOptions = useMemo(
    () =>
      (designsData?.items ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} · ${d.id}`,
      })),
    [designsData],
  );

  // Reset on close so the next "Новая подборка" starts blank.
  useEffect(() => {
    if (!open) {
      setSourceType('design');
      setSourceId('');
    }
  }, [open]);

  const canSubmit = sourceId.trim().length > 0;

  return (
    <Modal
      title="Новая подборка"
      open={open}
      onCancel={onCancel}
      onOk={() =>
        canSubmit && onSubmit({ sourceType, sourceId: sourceId.trim() })
      }
      okText="Открыть редактор"
      okButtonProps={{ disabled: !canSubmit }}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">Тип источника</Text>
          <Select<RecommendationSourceTypeKey>
            value={sourceType}
            onChange={(v) => {
              setSourceType(v);
              setSourceId('');
            }}
            options={SOURCE_TYPE_OPTIONS}
            style={{ width: '100%', marginTop: 4 }}
          />
        </div>
        <div>
          <Text type="secondary">ID источника</Text>
          {sourceType === 'design' ? (
            <Select<string>
              showSearch
              placeholder="Найти дизайн…"
              value={sourceId || undefined}
              onChange={setSourceId}
              options={designOptions}
              filterOption={(input, opt) =>
                (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ width: '100%', marginTop: 4 }}
            />
          ) : (
            // Panel picker is intentionally a free-text input — there is
            // no admin panel-list API yet, and admins reach this screen
            // from a panel detail page where they have the ID in hand.
            <Input
              placeholder="ID панели"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              style={{ marginTop: 4 }}
            />
          )}
        </div>
      </Space>
    </Modal>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Editor drawer
// ────────────────────────────────────────────────────────────────────────

interface RecommendationEditorDrawerProps {
  open: boolean;
  sourceType: RecommendationSourceTypeKey | undefined;
  sourceId: string | undefined;
  onClose: () => void;
}

function RecommendationEditorDrawer({
  open,
  sourceType,
  sourceId,
  onClose,
}: RecommendationEditorDrawerProps) {
  const { data: detail, isFetching } = useRecommendationDetail(
    sourceType,
    sourceId,
  );
  const upsert = useUpsertRecommendation();
  const remove = useDeleteRecommendation();
  const copyMutation = useCopyRecommendations();
  const [copyOpen, setCopyOpen] = useState<boolean>(false);

  // Local draft mirrors the fetched targets — keeps the save flow as a
  // single PUT (matches the backend's idempotent upsert semantics) and
  // lets us add «Сбросить» without a network round-trip.
  const [draft, setDraft] = useState<ApiRecommendationTarget[]>([]);
  // Phase 10 REC-N5 audit fix — track whether a re-seed is the FIRST
  // for the currently-open source pair vs a subsequent refetch (15s
  // staleTime expiry, parallel admin save, etc.). The first seed
  // unconditionally writes the server state; any subsequent refetch
  // that resolves to a different `updated_at` triggers a conflict
  // banner instead of silently clobbering local edits. The user
  // chooses to "discard local & accept server" via the banner's
  // «Загрузить с сервера» button (`onAcceptServer` below).
  const seededFor = useRef<string | null>(null);
  const [serverConflict, setServerConflict] = useState(false);

  function pairKey(): string | null {
    return detail ? `${detail.source_type}:${detail.source_id}:${detail.updated_at}` : null;
  }

  useEffect(() => {
    if (!detail) return;
    const key = `${detail.source_type}:${detail.source_id}`;
    const fullKey = `${key}:${detail.updated_at}`;
    if (seededFor.current === null || !seededFor.current.startsWith(key)) {
      // First open of this source pair — unconditional seed.
      setDraft(detail.targets ?? []);
      seededFor.current = fullKey;
      setServerConflict(false);
      return;
    }
    if (seededFor.current === fullKey) {
      // Same `updated_at` — just a re-render, no action.
      return;
    }
    // Same source pair, different `updated_at` → an external save
    // happened (or our own PUT bumped it). If our local draft already
    // matches the new server state (typical post-save flow:
    // useUpsertRecommendation primes the cache with the server
    // response which equals our PUT body), seed silently.
    const draftMatchesServer =
      JSON.stringify(draft) === JSON.stringify(detail.targets ?? []);
    if (draftMatchesServer) {
      seededFor.current = fullKey;
      setServerConflict(false);
      return;
    }
    // Real conflict — admin had unsaved local edits AND the server
    // state changed underneath them. Surface it instead of clobbering.
    setServerConflict(true);
  }, [detail, draft]);

  function onAcceptServer(): void {
    if (!detail) return;
    setDraft(detail.targets ?? []);
    seededFor.current = `${detail.source_type}:${detail.source_id}:${detail.updated_at}`;
    setServerConflict(false);
  }

  // Reset the seed marker when the drawer closes / switches source so
  // the next open re-runs the first-time seed.
  useEffect(() => {
    if (!open) {
      seededFor.current = null;
      setServerConflict(false);
    }
  }, [open]);
  void pairKey;  // helper available for future telemetry — referenced to silence unused-var.

  // Add-target form local state.
  const [newType, setNewType] =
    useState<RecommendationTargetTypeKey>('design');
  const [newId, setNewId] = useState<string>('');

  const { data: designsData } = useDesigns({ limit: 200 });
  const designLookup = useMemo(
    () => new Map((designsData?.items ?? []).map((d) => [d.id, d.name])),
    [designsData],
  );
  const designOptions = useMemo(
    () =>
      (designsData?.items ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} · ${d.id}`,
      })),
    [designsData],
  );

  // Phase 10 REC-N4 audit fix — compare trimmed `newId` so a stray
  // leading/trailing space in the input doesn't bypass the self-
  // reference / dup guards (`onAdd` already uses `newId.trim()` for
  // the actual push, so the visual state stayed consistent — but the
  // validation banner would not fire and the add button stayed
  // enabled until the server returned 422).
  const trimmedNewId = newId.trim();
  const isSelfReference =
    sourceType !== undefined &&
    sourceId !== undefined &&
    newType === sourceType &&
    trimmedNewId === sourceId;
  const isDup = draft.some(
    (t) => t.target_type === newType && t.target_id === trimmedNewId,
  );
  const canAdd = trimmedNewId.length > 0 && !isSelfReference && !isDup;

  function onAdd(): void {
    if (!canAdd) return;
    setDraft((prev) => [
      ...prev,
      { target_type: newType, target_id: trimmedNewId },
    ]);
    setNewId('');
  }

  function onRemove(idx: number): void {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function onMove(idx: number, dir: -1 | 1): void {
    setDraft((prev) => {
      const next = [...prev];
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function onReset(): void {
    setDraft(detail?.targets ?? []);
  }

  async function onSave(): Promise<void> {
    if (!sourceType || !sourceId) return;
    try {
      await upsert.mutateAsync({ sourceType, sourceId, targets: draft });
      message.success('Подборка сохранена');
    } catch (e) {
      message.error(`Не удалось сохранить: ${(e as Error).message}`);
    }
  }

  async function onDelete(): Promise<void> {
    if (!sourceType || !sourceId) return;
    try {
      await remove.mutateAsync({ sourceType, sourceId });
      message.success('Подборка удалена');
      onClose();
    } catch (e) {
      message.error(`Не удалось удалить: ${(e as Error).message}`);
    }
  }

  const hasUnsaved =
    JSON.stringify(draft) !== JSON.stringify(detail?.targets ?? []);
  const isExisting = !!detail?.id;

  return (
    <Drawer
      title={
        sourceType && sourceId
          ? `Подборка: ${TYPE_LABEL[sourceType]} ${sourceId}`
          : 'Подборка'
      }
      open={open}
      onClose={onClose}
      styles={{ wrapper: { width: 520 } }}
      destroyOnHidden
      extra={
        <Space>
          {isExisting && (
            <Popconfirm
              title="Удалить подборку?"
              description="Публичная витрина переключится на эвристику."
              okText="Удалить"
              okButtonProps={{ danger: true }}
              cancelText="Отмена"
              onConfirm={onDelete}
            >
              <Button danger loading={remove.isPending}>
                Удалить
              </Button>
            </Popconfirm>
          )}
          <Button onClick={onReset} disabled={!hasUnsaved}>
            Сбросить
          </Button>
          <Button
            type="primary"
            onClick={onSave}
            loading={upsert.isPending}
            disabled={!hasUnsaved}
          >
            Сохранить
          </Button>
        </Space>
      }
    >
      {isFetching && <Text type="secondary">Загрузка…</Text>}

      {serverConflict && (
        <Alert
          type="warning"
          showIcon
          message="Подборка изменилась на сервере"
          description="Локальные изменения сохранены. Загрузить серверную версию (локальные правки будут потеряны)?"
          action={
            <Button size="small" onClick={onAcceptServer}>
              Загрузить с сервера
            </Button>
          }
          style={{ marginBottom: 12 }}
        />
      )}

      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Text strong>Цели ({draft.length})</Text>
          {draft.length === 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                Подборка пуста — публичная витрина покажет эвристический фолбэк.
              </Text>
            </div>
          )}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {draft.map((t, idx) => {
              const label =
                t.target_type === 'design'
                  ? designLookup.get(t.target_id) ?? t.target_id
                  : t.target_id;
              return (
                <div
                  key={`${t.target_type}:${t.target_id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    border: '1px solid #f0f0f0',
                    borderRadius: 6,
                  }}
                >
                  <Tag color={SOURCE_TAG_COLOR[t.target_type]} style={{ margin: 0 }}>
                    {TYPE_LABEL[t.target_type]}
                  </Tag>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{label}</div>
                    {t.target_type === 'design' && designLookup.has(t.target_id) && (
                      <div style={{ fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>
                        {t.target_id}
                      </div>
                    )}
                  </div>
                  <Button
                    size="small"
                    onClick={() => onMove(idx, -1)}
                    disabled={idx === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    size="small"
                    onClick={() => onMove(idx, 1)}
                    disabled={idx === draft.length - 1}
                  >
                    ↓
                  </Button>
                  <Button size="small" danger onClick={() => onRemove(idx)}>
                    ✕
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <Text strong>Добавить цель</Text>
          <Space.Compact style={{ width: '100%', marginTop: 8 }}>
            <Select<RecommendationTargetTypeKey>
              value={newType}
              onChange={(v) => {
                setNewType(v);
                setNewId('');
              }}
              options={SOURCE_TYPE_OPTIONS}
              style={{ width: 140 }}
            />
            {newType === 'design' ? (
              <Select<string>
                showSearch
                placeholder="Найти дизайн…"
                value={newId || undefined}
                onChange={setNewId}
                options={designOptions}
                filterOption={(input, opt) =>
                  (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ flex: 1 }}
              />
            ) : (
              <Input
                placeholder="ID панели"
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
              />
            )}
            <Button type="primary" onClick={onAdd} disabled={!canAdd}>
              Добавить
            </Button>
          </Space.Compact>
          {isSelfReference && (
            <div style={{ marginTop: 6 }}>
              <Text type="danger">Источник не может рекомендовать сам себя.</Text>
            </div>
          )}
          {isDup && newId.trim() && (
            <div style={{ marginTop: 6 }}>
              <Text type="danger">Эта цель уже добавлена.</Text>
            </div>
          )}
        </div>

        {/* Phase 10 LOW-7 — fallback suggestions one-click pickers. */}
        {(detail?.fallback_suggestions ?? []).length > 0 && (
          <div>
            <Text strong>Авто-предложения</Text>
            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Эвристика «с этим покупают». Уже добавленные цели исключены.
              </Text>
            </div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(detail?.fallback_suggestions ?? []).map((s) => {
                const alreadyInDraft = draft.some(
                  (t) => t.target_type === s.target_type && t.target_id === s.target_id,
                );
                const label =
                  s.target_type === 'design'
                    ? designLookup.get(s.target_id) ?? s.target_id
                    : s.target_id;
                return (
                  <div
                    key={`fb:${s.target_type}:${s.target_id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      border: '1px dashed #f0f0f0',
                      borderRadius: 6,
                      background: '#FAFAFA',
                    }}
                  >
                    <Tag color={SOURCE_TAG_COLOR[s.target_type]} style={{ margin: 0 }}>
                      {TYPE_LABEL[s.target_type]}
                    </Tag>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{label}</div>
                    </div>
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      disabled={alreadyInDraft}
                      onClick={() =>
                        setDraft((prev) => [
                          ...prev,
                          { target_type: s.target_type, target_id: s.target_id },
                        ])
                      }
                    >
                      {alreadyInDraft ? 'Уже добавлен' : 'Принять'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 10 follow-up — bulk copy from another source. */}
        <div>
          <Button onClick={() => setCopyOpen(true)} block>
            Скопировать рекомендации с другого товара
          </Button>
        </div>
      </Space>

      <CopyRecommendationsModal
        open={copyOpen}
        onCancel={() => setCopyOpen(false)}
        loading={copyMutation.isPending}
        onSubmit={async (vars) => {
          if (!sourceType || !sourceId) return;
          try {
            await copyMutation.mutateAsync({
              sourceType,
              sourceId,
              fromSourceType: vars.fromSourceType,
              fromSourceId: vars.fromSourceId,
              mode: vars.mode,
            });
            setCopyOpen(false);
            message.success('Рекомендации скопированы');
          } catch (e) {
            message.error(`Не удалось скопировать: ${(e as Error).message}`);
          }
        }}
      />
    </Drawer>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Phase 10 follow-up — bulk-copy modal
// ────────────────────────────────────────────────────────────────────────

interface CopyModalSubmit {
  fromSourceType: RecommendationSourceTypeKey;
  fromSourceId: string;
  mode: 'replace' | 'append';
}

interface CopyRecommendationsModalProps {
  open: boolean;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (vars: CopyModalSubmit) => void;
}

function CopyRecommendationsModal({
  open,
  loading,
  onCancel,
  onSubmit,
}: CopyRecommendationsModalProps) {
  const [fromType, setFromType] =
    useState<RecommendationSourceTypeKey>('design');
  const [fromId, setFromId] = useState<string>('');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const { data: designsData } = useDesigns({ limit: 200 });
  const designOptions = useMemo(
    () =>
      (designsData?.items ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} · ${d.id}`,
      })),
    [designsData],
  );
  // Reset on close so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setFromType('design');
      setFromId('');
      setMode('replace');
    }
  }, [open]);
  const canSubmit = fromId.trim().length > 0;
  return (
    <Modal
      title="Скопировать рекомендации"
      open={open}
      onCancel={onCancel}
      okText="Скопировать"
      cancelText="Отмена"
      okButtonProps={{ disabled: !canSubmit, loading }}
      onOk={() =>
        canSubmit &&
        onSubmit({
          fromSourceType: fromType,
          fromSourceId: fromId.trim(),
          mode,
        })
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <div>
          <Text type="secondary">
            Источник, с которого скопировать существующую подборку.
          </Text>
        </div>
        <Space.Compact style={{ width: '100%' }}>
          <Select<RecommendationSourceTypeKey>
            value={fromType}
            onChange={(v) => {
              setFromType(v);
              setFromId('');
            }}
            options={SOURCE_TYPE_OPTIONS}
            style={{ width: 140 }}
          />
          {fromType === 'design' ? (
            <Select<string>
              showSearch
              placeholder="Найти дизайн…"
              value={fromId || undefined}
              onChange={setFromId}
              options={designOptions}
              filterOption={(input, opt) =>
                (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              style={{ flex: 1 }}
            />
          ) : (
            <Input
              placeholder="ID панели"
              value={fromId}
              onChange={(e) => setFromId(e.target.value)}
            />
          )}
        </Space.Compact>
        <div>
          <Text strong>Режим</Text>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="radio"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
              />
              <div>
                <div>Заменить</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Текущая подборка целевого товара будет полностью перезаписана.
                </div>
              </div>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                type="radio"
                checked={mode === 'append'}
                onChange={() => setMode('append')}
              />
              <div>
                <div>Дополнить</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Добавить недостающие цели из источника без перезаписи существующих (с дедупликацией).
                </div>
              </div>
            </label>
          </div>
        </div>
      </Space>
    </Modal>
  );
}
