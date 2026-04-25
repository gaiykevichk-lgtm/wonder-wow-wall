/**
 * Phase 4A — admin orders list with filters & URL-driven pagination.
 *
 * Layout:
 *   ┌────────────────────────── header: title ──────────────────────────┐
 *   │  ┌─ Status ─┬─ DateRange ─┬─ Search (number/email) ─┐              │
 *   │  └──────────┴─────────────┴──────────────────────────┘              │
 *   │                                                                    │
 *   │  ┌──── AntD <Table> — №, Дата, Клиент, Сумма, Статус ────┐         │
 *   │  └─────────────────────────────────────────────────────────┘        │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth for filters and pagination — F5 preserves
 * everything (Definition of Done § "переживают F5"). The store helpers in
 * `model/ordersAdminStore.ts` round-trip URL ↔ DTO; this page is the only
 * caller because it also owns the click → navigate behaviour.
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
  Typography,
} from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  type ApiOrderListItem,
  type OrderStatusKey,
  type OrdersAdminQuery,
  useOrdersAdminList,
} from '../api/ordersAdminApi';
import {
  applyFilterPatch,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  queryFromSearchParams,
  searchParamsFromQuery,
  STATUS_OPTIONS,
} from '../model/ordersAdminStore';

const { Title } = Typography;
const { RangePicker } = DatePicker;

// Status → AntD Tag color. `delivered`/`installed` are terminal happy
// states (green); `placed` is informational (default); `confirmed` is
// in-flight (blue); `in_progress` is active work (orange).
const STATUS_TAG_COLOR: Record<OrderStatusKey, string> = {
  placed: 'default',
  confirmed: 'blue',
  in_progress: 'orange',
  delivered: 'green',
  installed: 'success',
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

function formatDate(iso: string): string {
  // "2026-04-25T13:45:00" → "25.04.2026 13:45". Same format used by the
  // dashboard so admins read consistent timestamps across the panel.
  return dayjs(iso).format('DD.MM.YYYY HH:mm');
}

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Query DTO derived from URL on every render — cheap (a dozen string
  // ops) and avoids a duplicate source of truth. React Query then uses
  // this DTO as its cache key, so switching back to a previously-visited
  // filter combination shows instant results from cache.
  const query: OrdersAdminQuery = useMemo(
    () => queryFromSearchParams(searchParams),
    [searchParams],
  );

  const { data, isFetching, error } = useOrdersAdminList(query);

  // Local mirror of `query.search` so typing doesn't fire a request on
  // every keystroke (URL — and therefore React Query key — only updates
  // on explicit submit). The effect re-syncs whenever the URL changes
  // externally (Reset button, browser back/forward, deep link).
  const [searchDraft, setSearchDraft] = useState<string>(query.search ?? '');
  useEffect(() => {
    setSearchDraft(query.search ?? '');
  }, [query.search]);

  function updateUrl(next: OrdersAdminQuery): void {
    setSearchParams(searchParamsFromQuery(next), { replace: false });
  }

  // AntD `<Select allowClear>` passes `undefined` (not `null`) on clear, so
  // the signature must accept it. Normalise to `null` for the URL helper
  // so the contract `OrdersAdminFilters.status: OrderStatusKey | null`
  // stays honest.
  function onStatusChange(value: OrderStatusKey | null | undefined): void {
    updateUrl(applyFilterPatch(query, { status: value ?? null }));
  }

  function onSearchChange(value: string): void {
    const cleaned = value.trim();
    updateUrl(applyFilterPatch(query, { search: cleaned || null }));
  }

  function onDateRangeChange(range: [Dayjs | null, Dayjs | null] | null): void {
    if (!range) {
      updateUrl(applyFilterPatch(query, { dateFrom: null, dateTo: null }));
      return;
    }
    const [from, to] = range;
    updateUrl(
      applyFilterPatch(query, {
        // Backend uses half-open `[from, to)` — when the user picks day
        // "25.04", they expect the whole day included, so `to` is the
        // start of the NEXT day. dayjs `endOf('day')` would give us
        // 23:59:59.999 which is inclusive; we shift by one day to keep
        // consistent with `OrderFilters` semantics.
        dateFrom: from ? from.startOf('day').toISOString() : null,
        dateTo: to ? to.add(1, 'day').startOf('day').toISOString() : null,
      }),
    );
  }

  function onResetFilters(): void {
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  function onTableChange(
    pagination: TablePaginationConfig,
  ): void {
    updateUrl({
      ...query,
      page: pagination.current ?? DEFAULT_PAGE,
      size: pagination.pageSize ?? DEFAULT_SIZE,
    });
  }

  const columns: TableProps<ApiOrderListItem>['columns'] = [
    {
      title: '№',
      dataIndex: 'number',
      key: 'number',
      width: 140,
      render: (number: string) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {number}
        </span>
      ),
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: formatDate,
    },
    {
      title: 'Клиент',
      dataIndex: 'user_id',
      key: 'user_id',
      ellipsis: true,
      render: (userId: string) => (
        <span style={{ color: '#6B7280', fontSize: 13 }}>{userId}</span>
      ),
    },
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      ellipsis: true,
    },
    {
      title: 'Позиций',
      dataIndex: 'items_count',
      key: 'items_count',
      width: 100,
      align: 'right',
    },
    {
      title: 'Сумма',
      dataIndex: 'total',
      key: 'total',
      width: 140,
      align: 'right',
      render: (value: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {formatRub(value)}
        </span>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: OrderStatusKey, row) => (
        <Tag color={STATUS_TAG_COLOR[status]} style={{ margin: 0 }}>
          {row.status_label}
        </Tag>
      ),
    },
  ];

  const dateRangeValue: [Dayjs | null, Dayjs | null] | null =
    query.dateFrom || query.dateTo
      ? [
          query.dateFrom ? dayjs(query.dateFrom) : null,
          // `to` is exclusive (next day @ 00:00). Shift back to the
          // previous day for display so the picker shows what the user
          // actually selected.
          query.dateTo ? dayjs(query.dateTo).subtract(1, 'day') : null,
        ]
      : null;

  const hasActiveFilters =
    query.status !== null ||
    query.search !== null ||
    query.dateFrom !== null ||
    query.dateTo !== null ||
    query.userId !== null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Title level={3} style={{ marginBottom: 24 }}>
          Заказы
        </Title>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select<OrderStatusKey | null>
            placeholder="Статус"
            allowClear
            style={{ minWidth: 180 }}
            value={query.status}
            onChange={onStatusChange}
            options={STATUS_OPTIONS}
          />
          <RangePicker
            value={dateRangeValue}
            onChange={onDateRangeChange}
            format="DD.MM.YYYY"
            placeholder={['Дата от', 'Дата до']}
          />
          <Input.Search
            placeholder="Поиск: № заказа, email, имя"
            allowClear
            // Controlled by local draft state — URL (and the request) only
            // updates on explicit submit (Enter / search button / clear).
            // The useEffect above syncs draft ← URL so external URL
            // changes (Reset, back/forward) clear the textbox correctly.
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onSearch={onSearchChange}
            style={{ width: 280 }}
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
            message="Не удалось загрузить заказы"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={2}>
        <Table<ApiOrderListItem>
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
          onRow={(row) => ({
            onClick: () => navigate(`/admin/orders/${row.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </motion.div>
    </motion.div>
  );
}
