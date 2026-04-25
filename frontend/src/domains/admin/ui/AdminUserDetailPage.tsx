/**
 * Phase 5 — admin user detail page.
 *
 * Layout:
 *   ┌────────────────────────────── header ──────────────────────────────┐
 *   │  ← Back   Имя   [Tag: Роль] [Tag: Активен/Заблокирован]            │
 *   │  [Сделать админом] [Снять админа] [Заблокировать] [Разблокировать] │
 *   ├──────────────────────────── two-column ─────────────────────────────┤
 *   │  ┌── Профиль ──────────────────┐ ┌── Адреса ─────────────────────┐ │
 *   │  │ email · телефон · роль      │ │ адрес 1 (default)             │ │
 *   │  │ дата регистрации · is_block │ │ адрес 2 ...                   │ │
 *   │  └─────────────────────────────┘ └───────────────────────────────┘ │
 *   │  ┌── Последние заказы (5) ─────────────────────────────────────┐   │
 *   │  │ № · дата · статус · сумма         (клик → /admin/orders/:id) │   │
 *   │  └─────────────────────────────────────────────────────────────┘   │
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Each action wrapped in `<Popconfirm>` (Definition of Done § "каждое
 * действие через Popconfirm"). 409 + `code: "last_admin"` shows a toast
 * — handler reused from the existing backend mapping (no new toast spec).
 *
 * The detail endpoint returns `recent_orders` inline; mutations re-prime
 * the detail cache via `setQueryData`, so block/unblock toggles are
 * round-trip-free for the user.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  List,
  message,
  Popconfirm,
  Skeleton,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../../../shared/api';
import {
  type ApiRecentOrder,
  type ApiUserDetail,
  type UserRoleKey,
  useBlockUser,
  useGrantAdmin,
  useRevokeAdmin,
  useUnblockUser,
  useUserDetail,
} from '../api/usersAdminApi';
import type { OrderStatusKey } from '../api/ordersAdminApi';

const { Title, Text } = Typography;

// Same colour map as orders pages so the status pill is consistent.
const ORDER_STATUS_COLOR: Record<OrderStatusKey, string> = {
  placed: 'default',
  confirmed: 'blue',
  in_progress: 'orange',
  delivered: 'green',
  installed: 'success',
  cancelled: 'red',
  refunded: 'volcano',
};

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

function formatDateTime(iso: string): string {
  return dayjs(iso).format('DD.MM.YYYY HH:mm');
}

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}

function formatAddress(a: ApiUserDetail['addresses'][number]): string {
  const parts = [
    a.city,
    a.street && `${a.street}${a.building ? `, ${a.building}` : ''}`,
    a.apartment && `кв. ${a.apartment}`,
    a.postal_code,
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useUserDetail(id);

  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const grantMutation = useGrantAdmin();
  const revokeMutation = useRevokeAdmin();

  const anyMutationPending =
    blockMutation.isPending ||
    unblockMutation.isPending ||
    grantMutation.isPending ||
    revokeMutation.isPending;

  function runAction(
    mutation: typeof blockMutation,
    successText: string,
  ): void {
    if (!id) return;
    mutation.mutate(id, {
      onSuccess: () => message.success(successText),
      onError: (err) => {
        // 409 + last_admin = backend refused because the operation would
        // brick the panel. Show a dedicated toast so the admin doesn't
        // mistake it for a generic failure. All other errors fall back
        // to the API-provided message.
        if (err instanceof ApiError && err.body?.code === 'last_admin') {
          message.error('Нельзя — это последний активный администратор');
          return;
        }
        if (err instanceof ApiError && err.body?.code === 'not_authorized') {
          message.error('Недостаточно прав');
          return;
        }
        message.error(err instanceof Error ? err.message : 'Ошибка');
      },
    });
  }

  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    const isNotFound = error instanceof ApiError && error.status === 404;
    return (
      <div style={{ padding: 32 }}>
        <Alert
          type="error"
          showIcon
          message={isNotFound ? 'Пользователь не найден' : 'Не удалось загрузить пользователя'}
          description={!isNotFound && error instanceof Error ? error.message : undefined}
        />
        <Button
          icon={<ArrowLeftOutlined />}
          style={{ marginTop: 16 }}
          onClick={() => navigate('/admin/users')}
        >
          К списку пользователей
        </Button>
      </div>
    );
  }

  if (!data) {
    return <Skeleton active />;
  }

  const user: ApiUserDetail = data;
  const isAdmin = user.role === 'ADMIN';

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUpVariants}
      style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}
    >
      <motion.div variants={fadeUpVariants} custom={0}>
        <Space size="middle" align="center" style={{ marginBottom: 8 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/users')}
          >
            К списку
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            {user.name || user.email}
          </Title>
          <Tag color={ROLE_TAG_COLOR[user.role]} style={{ marginLeft: 8 }}>
            {ROLE_TAG_LABEL[user.role]}
          </Tag>
          {user.is_blocked ? (
            <Tag color="red">Заблокирован</Tag>
          ) : (
            <Tag color="green">Активен</Tag>
          )}
        </Space>
        <div>
          <Text type="secondary">Зарегистрирован {formatDate(user.created_at)}</Text>
        </div>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1} style={{ marginTop: 16 }}>
        <Space wrap>
          {/* Role actions — show only the relevant verb so the button
              row doesn't grow to two lines for every user. */}
          {!isAdmin && (
            <Popconfirm
              title="Сделать пользователя администратором?"
              description="Он получит доступ к панели администратора."
              okText="Сделать админом"
              cancelText="Отмена"
              onConfirm={() => runAction(grantMutation, 'Роль обновлена')}
              disabled={anyMutationPending}
            >
              <Button type="primary" disabled={anyMutationPending}>
                Сделать админом
              </Button>
            </Popconfirm>
          )}
          {isAdmin && (
            <Popconfirm
              title="Снять права администратора?"
              description="Пользователь станет обычным покупателем."
              okText="Снять"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={() => runAction(revokeMutation, 'Роль обновлена')}
              disabled={anyMutationPending}
            >
              <Button danger disabled={anyMutationPending}>
                Снять админа
              </Button>
            </Popconfirm>
          )}
          {!user.is_blocked && (
            <Popconfirm
              title="Заблокировать аккаунт?"
              description="Пользователь не сможет войти в систему."
              okText="Заблокировать"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
              onConfirm={() => runAction(blockMutation, 'Аккаунт заблокирован')}
              disabled={anyMutationPending}
            >
              <Button danger disabled={anyMutationPending}>
                Заблокировать
              </Button>
            </Popconfirm>
          )}
          {user.is_blocked && (
            <Popconfirm
              title="Разблокировать аккаунт?"
              description="Пользователь снова сможет войти в систему."
              okText="Разблокировать"
              cancelText="Отмена"
              onConfirm={() => runAction(unblockMutation, 'Аккаунт разблокирован')}
              disabled={anyMutationPending}
            >
              <Button type="primary" disabled={anyMutationPending}>
                Разблокировать
              </Button>
            </Popconfirm>
          )}
        </Space>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 24,
          marginTop: 24,
        }}
      >
        <motion.div variants={fadeUpVariants} custom={2}>
          <Card title="Профиль">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
              <Descriptions.Item label="Имя">{user.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Телефон">{user.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Роль">{ROLE_TAG_LABEL[user.role]}</Descriptions.Item>
              <Descriptions.Item label="Статус">
                {user.is_blocked ? 'Заблокирован' : 'Активен'}
              </Descriptions.Item>
              <Descriptions.Item label="Регистрация">
                {formatDate(user.created_at)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </motion.div>

        <motion.div variants={fadeUpVariants} custom={3}>
          <Card title="Адреса">
            <List
              size="small"
              dataSource={user.addresses}
              locale={{ emptyText: 'Нет сохранённых адресов' }}
              renderItem={(a) => (
                <List.Item key={a.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{a.label || 'Без названия'}</Text>
                        {a.is_default && <Tag color="blue">по умолчанию</Tag>}
                      </Space>
                    }
                    description={formatAddress(a)}
                  />
                </List.Item>
              )}
            />
          </Card>
        </motion.div>
      </div>

      <motion.div variants={fadeUpVariants} custom={4} style={{ marginTop: 24 }}>
        <Card
          title="Последние заказы"
          extra={
            <Button
              type="link"
              onClick={() => navigate(`/admin/orders?user_id=${user.id}`)}
            >
              Все заказы пользователя
            </Button>
          }
        >
          <List
            size="small"
            dataSource={user.recent_orders}
            locale={{ emptyText: 'Заказов пока нет' }}
            renderItem={(o: ApiRecentOrder) => (
              <List.Item
                key={o.id}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/admin/orders/${o.id}`)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{o.number}</Text>
                      <Tag color={ORDER_STATUS_COLOR[o.status]}>{o.status_label}</Tag>
                    </Space>
                  }
                  description={formatDateTime(o.created_at)}
                />
                <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatRub(o.total)}
                </Text>
              </List.Item>
            )}
          />
        </Card>
      </motion.div>
    </motion.div>
  );
}
