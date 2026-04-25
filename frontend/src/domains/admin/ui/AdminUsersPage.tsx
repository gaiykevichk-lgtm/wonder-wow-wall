/**
 * Phase 5 — admin users list with filters and URL-driven pagination.
 *
 * Layout:
 *   ┌────────────────────────── header: title ──────────────────────────┐
 *   │  ┌─ Role ─┬─ Status ─┬─ Search (email/name/phone) ─┐              │
 *   │  └────────┴──────────┴───────────────────────────────┘             │
 *   │                                                                    │
 *   │  ┌──── AntD <Table> — Имя, Email, Телефон, Роль, Статус, Дата ─┐  │
 *   │  └────────────────────────────────────────────────────────────────┘ │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * URL is the source of truth for filters and pagination — F5 preserves
 * everything (Definition of Done § "переживают F5"). The store helpers in
 * `model/usersAdminStore.ts` round-trip URL ↔ DTO.
 *
 * Mirrors `AdminOrdersPage.tsx` so the admin sees a consistent UX between
 * the two list screens.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { TablePaginationConfig, TableProps } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  type ApiUserListItem,
  type UserRoleKey,
  type UsersAdminQuery,
  useUsersAdminList,
} from '../api/usersAdminApi';
import {
  applyFilterPatch,
  BLOCKED_OPTIONS,
  DEFAULT_PAGE,
  DEFAULT_SIZE,
  queryFromSearchParams,
  ROLE_OPTIONS,
  searchParamsFromQuery,
} from '../model/usersAdminStore';

const { Title } = Typography;

// Keep the colour map close to AntD's semantic tokens used elsewhere in
// the panel (orders page uses the same vocabulary).
const ROLE_TAG_COLOR: Record<UserRoleKey, string> = {
  CUSTOMER: 'default',
  ADMIN: 'gold',
};

const ROLE_TAG_LABEL: Record<UserRoleKey, string> = {
  CUSTOMER: 'Покупатель',
  ADMIN: 'Админ',
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
  return dayjs(iso).format('DD.MM.YYYY');
}

export default function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query: UsersAdminQuery = useMemo(
    () => queryFromSearchParams(searchParams),
    [searchParams],
  );

  const { data, isFetching, error } = useUsersAdminList(query);

  // Local mirror — same pattern as AdminOrdersPage so typing doesn't
  // fire a request per keystroke.
  const [searchDraft, setSearchDraft] = useState<string>(query.search ?? '');
  useEffect(() => {
    setSearchDraft(query.search ?? '');
  }, [query.search]);

  function updateUrl(next: UsersAdminQuery): void {
    setSearchParams(searchParamsFromQuery(next), { replace: false });
  }

  function onRoleChange(value: UserRoleKey | null | undefined): void {
    updateUrl(applyFilterPatch(query, { role: value ?? null }));
  }

  function onBlockedChange(value: 'true' | 'false' | null | undefined): void {
    // Translate the dropdown's string value back to the bool|null DTO
    // shape the store expects. AntD `<Select allowClear>` returns
    // `undefined` on clear; normalise to `null`.
    const isBlocked = value === 'true' ? true : value === 'false' ? false : null;
    updateUrl(applyFilterPatch(query, { isBlocked }));
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

  const columns: TableProps<ApiUserListItem>['columns'] = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => name || <span style={{ color: '#9CA3AF' }}>—</span>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'Телефон',
      dataIndex: 'phone',
      key: 'phone',
      width: 180,
      render: (phone: string) =>
        phone ? phone : <span style={{ color: '#9CA3AF' }}>—</span>,
    },
    {
      title: 'Роль',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: UserRoleKey) => (
        <Tag color={ROLE_TAG_COLOR[role]} style={{ margin: 0 }}>
          {ROLE_TAG_LABEL[role]}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'is_blocked',
      key: 'is_blocked',
      width: 130,
      render: (isBlocked: boolean) =>
        isBlocked ? (
          <Tag color="red" style={{ margin: 0 }}>Заблокирован</Tag>
        ) : (
          <Tag color="green" style={{ margin: 0 }}>Активен</Tag>
        ),
    },
    {
      title: 'Регистрация',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: formatDate,
    },
  ];

  const hasActiveFilters =
    query.role !== null || query.isBlocked !== null || query.search !== null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Title level={3} style={{ marginBottom: 24 }}>
          Пользователи
        </Title>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1}>
        <Space wrap style={{ marginBottom: 16 }}>
          <Select<UserRoleKey | null>
            placeholder="Роль"
            allowClear
            style={{ minWidth: 180 }}
            value={query.role}
            onChange={onRoleChange}
            options={ROLE_OPTIONS}
          />
          <Select<'true' | 'false' | null>
            placeholder="Статус"
            allowClear
            style={{ minWidth: 180 }}
            // Convert tri-state bool|null back to the string the dropdown
            // works with. `null` (all) maps to `undefined` so AntD shows
            // the placeholder rather than rendering an option as selected.
            value={
              query.isBlocked === null
                ? undefined
                : query.isBlocked
                  ? 'true'
                  : 'false'
            }
            onChange={onBlockedChange}
            options={BLOCKED_OPTIONS}
          />
          <Input.Search
            placeholder="Поиск: email, имя, телефон"
            allowClear
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
            message="Не удалось загрузить пользователей"
            description={(error as Error).message}
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={2}>
        <Table<ApiUserListItem>
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
            onClick: () => navigate(`/admin/users/${row.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </motion.div>
    </motion.div>
  );
}
