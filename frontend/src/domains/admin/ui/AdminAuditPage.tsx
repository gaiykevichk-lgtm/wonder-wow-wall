/**
 * Phase 9 — admin audit-log page.
 *
 * Layout:
 *   ┌──────────────── header: title ────────────────┐
 *   │  ┌─ Action ─┬─ Target type ─┬─ Actor id ─┬─ Target id ─┬─ Date range ─┐
 *   │  └──────────┴───────────────┴────────────┴─────────────┴──────────────┘
 *   │
 *   │  ┌──── AntD <Table> — Время, Действие, Актор, Цель, Payload ─┐
 *   │  └────────────────────────────────────────────────────────────┘
 *   └────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth (same convention as Users / Orders pages).
 * The page is read-only — there's no "create entry" path because audit
 * entries are produced as a side effect of the retrofitted admin use
 * cases (`BlockUserAdmin`, `UpdateOrderStatusAdmin`, etc.).
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  type ApiAuditEntry,
  type AuditActionKey,
  type AuditQuery,
  type AuditTargetTypeKey,
  useAuditList,
} from '../api/auditApi';
import {
  ACTION_OPTIONS,
  AUDIT_ACTION_LABELS,
  AUDIT_TARGET_LABELS,
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  queryFromSearchParams,
  searchParamsFromQuery,
  TARGET_OPTIONS,
  targetDeepLink,
} from '../model/auditStore';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Colour map per action — destructive actions in red, role grants in
// gold (matches `AdminUsersPage` admin-tag colour), informational in
// default.
const ACTION_TAG_COLOR: Record<AuditActionKey, string> = {
  user_block: 'red',
  user_unblock: 'green',
  role_grant: 'gold',
  role_revoke: 'orange',
  order_status_change: 'blue',
  order_refund: 'volcano',
  order_note_add: 'default',
  design_delete: 'red',
  panel_delete: 'red',
  settings_update: 'cyan',
  media_upload_suspicious: 'magenta',
};

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

function formatDateTime(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY HH:mm:ss');
}

/**
 * Render the per-action payload as a compact human summary. Falls back
 * to a JSON one-liner for unknown shapes — keeps the table dense rather
 * than blowing up rows with multi-line objects.
 */
function renderPayloadSummary(entry: ApiAuditEntry): string {
  const p = entry.payload;
  switch (entry.action) {
    case 'user_block':
    case 'user_unblock':
    case 'role_grant':
    case 'role_revoke':
      return typeof p.email === 'string' ? p.email : '';
    case 'order_status_change':
    case 'order_refund': {
      const num = typeof p.number === 'string' ? p.number : '';
      const from = typeof p.from === 'string' ? p.from : '?';
      const to = typeof p.to === 'string' ? p.to : '?';
      const reason = typeof p.reason === 'string' ? ` — «${p.reason}»` : '';
      return `${num}: ${from} → ${to}${reason}`;
    }
    case 'order_note_add': {
      const num = typeof p.number === 'string' ? p.number : '';
      const preview = typeof p.text_preview === 'string' ? p.text_preview : '';
      return `${num}: ${preview}`;
    }
    case 'settings_update': {
      const changes = (p.changes ?? {}) as Record<
        string,
        { from: unknown; to: unknown }
      >;
      const keys = Object.keys(changes);
      if (keys.length === 0) return '';
      return keys
        .map((k) => `${k}: ${changes[k].from} → ${changes[k].to}`)
        .join('; ');
    }
    default:
      return JSON.stringify(p);
  }
}

export default function AdminAuditPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query: AuditQuery = useMemo(
    () => queryFromSearchParams(searchParams),
    [searchParams],
  );

  const { data, isFetching, error } = useAuditList(query);

  // Local mirrors for the free-text filters — same pattern as Users/Orders
  // pages so typing doesn't fire a request per keystroke.
  const [actorDraft, setActorDraft] = useState<string>(query.actorId ?? '');
  const [targetIdDraft, setTargetIdDraft] = useState<string>(query.targetId ?? '');
  useEffect(() => {
    setActorDraft(query.actorId ?? '');
  }, [query.actorId]);
  useEffect(() => {
    setTargetIdDraft(query.targetId ?? '');
  }, [query.targetId]);

  function updateUrl(next: AuditQuery): void {
    setSearchParams(searchParamsFromQuery(next), { replace: false });
  }

  function onActionChange(value: AuditActionKey | null | undefined): void {
    updateUrl(applyFilterPatch(query, { action: value ?? null }));
  }

  function onTargetTypeChange(
    value: AuditTargetTypeKey | null | undefined,
  ): void {
    updateUrl(applyFilterPatch(query, { targetType: value ?? null }));
  }

  function onActorSearch(value: string): void {
    const cleaned = value.trim();
    updateUrl(applyFilterPatch(query, { actorId: cleaned || null }));
  }

  function onTargetIdSearch(value: string): void {
    const cleaned = value.trim();
    updateUrl(applyFilterPatch(query, { targetId: cleaned || null }));
  }

  function onDateRangeChange(
    range: [Dayjs | null, Dayjs | null] | null,
  ): void {
    const from = range?.[0] ? range[0].format('YYYY-MM-DD') : null;
    const to = range?.[1] ? range[1].format('YYYY-MM-DD') : null;
    updateUrl(applyFilterPatch(query, { dateFrom: from, dateTo: to }));
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

  const columns: TableProps<ApiAuditEntry>['columns'] = [
    {
      title: 'Время',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: formatDateTime,
    },
    {
      title: 'Действие',
      dataIndex: 'action',
      key: 'action',
      width: 240,
      render: (action: AuditActionKey) => (
        <Tag color={ACTION_TAG_COLOR[action]} style={{ margin: 0 }}>
          {AUDIT_ACTION_LABELS[action]}
        </Tag>
      ),
    },
    {
      title: 'Актор',
      dataIndex: 'actor_id',
      key: 'actor_id',
      width: 220,
      ellipsis: true,
      render: (actorId: string) => (
        <Tooltip title={actorId}>
          <Text code style={{ fontSize: 12 }}>{actorId}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Цель',
      key: 'target',
      width: 280,
      render: (_value, row) => {
        if (!row.target_type || !row.target_id) {
          return <span style={{ color: '#9CA3AF' }}>—</span>;
        }
        const typeLabel = AUDIT_TARGET_LABELS[row.target_type];
        const link = targetDeepLink(row.target_type, row.target_id);
        const idNode = link ? (
          <Link to={link}>
            <Text code style={{ fontSize: 12 }}>{row.target_id}</Text>
          </Link>
        ) : (
          <Text code style={{ fontSize: 12 }}>{row.target_id}</Text>
        );
        return (
          <Space size={6}>
            <Tag style={{ margin: 0 }}>{typeLabel}</Tag>
            {idNode}
          </Space>
        );
      },
    },
    {
      title: 'Подробности',
      key: 'payload',
      ellipsis: true,
      render: (_value, row) => {
        const summary = renderPayloadSummary(row);
        return summary ? (
          <Tooltip title={JSON.stringify(row.payload, null, 2)}>
            <span>{summary}</span>
          </Tooltip>
        ) : (
          <span style={{ color: '#9CA3AF' }}>—</span>
        );
      },
    },
    {
      // Phase 9 follow-up — surface the originating IP so admins can
      // cross-reference an audit entry with access logs / abuse reports.
      // Backend already returns it; was hidden from the table on the
      // first cut.
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string | null) =>
        ip ? (
          <Text code style={{ fontSize: 12 }}>{ip}</Text>
        ) : (
          <span style={{ color: '#9CA3AF' }}>—</span>
        ),
    },
  ];

  const hasActiveFilters =
    query.action !== null
    || query.actorId !== null
    || query.targetType !== null
    || query.targetId !== null
    || query.dateFrom !== null
    || query.dateTo !== null;

  const dateRangeValue: [Dayjs | null, Dayjs | null] | null =
    query.dateFrom || query.dateTo
      ? [
          query.dateFrom ? dayjs(query.dateFrom) : null,
          query.dateTo ? dayjs(query.dateTo) : null,
        ]
      : null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Title level={3} style={{ marginBottom: 24 }}>
          Аудит
        </Title>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select<AuditActionKey | null>
            placeholder="Действие"
            allowClear
            style={{ minWidth: 240 }}
            value={query.action}
            onChange={onActionChange}
            options={ACTION_OPTIONS}
          />
          <Select<AuditTargetTypeKey | null>
            placeholder="Тип цели"
            allowClear
            style={{ minWidth: 180 }}
            value={query.targetType}
            onChange={onTargetTypeChange}
            options={TARGET_OPTIONS}
          />
          <Input.Search
            placeholder="ID актора"
            allowClear
            value={actorDraft}
            onChange={(e) => setActorDraft(e.target.value)}
            onSearch={onActorSearch}
            style={{ width: 220 }}
          />
          <Input.Search
            placeholder="ID цели"
            allowClear
            value={targetIdDraft}
            onChange={(e) => setTargetIdDraft(e.target.value)}
            onSearch={onTargetIdSearch}
            style={{ width: 220 }}
          />
          <RangePicker
            value={dateRangeValue}
            onChange={onDateRangeChange}
            allowEmpty={[true, true]}
            placeholder={['От', 'До']}
          />
          {hasActiveFilters && (
            <Button onClick={onResetFilters}>Сбросить</Button>
          )}
        </Space>
      </motion.div>

      {error && (
        <motion.div variants={fadeUpVariants} custom={2}>
          <Alert
            type="error"
            showIcon
            message="Не удалось загрузить журнал аудита"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={2}>
        <Table<ApiAuditEntry>
          rowKey="id"
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
        />
      </motion.div>
    </motion.div>
  );
}
