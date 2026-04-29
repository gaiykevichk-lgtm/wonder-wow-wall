/**
 * Phase 4B — admin order detail page.
 *
 * Layout:
 *   ┌────────────────────────────── header ──────────────────────────────┐
 *   │  ← Back   №WW-123  [Tag: Status]                                   │
 *   │  [Подтвердить] [Взять в работу] ... [Отменить]                     │
 *   ├──────────────────────────── two-column ─────────────────────────────┤
 *   │  ┌── Items (List) ─────────────┐ ┌── Sidebar ─────────────────────┐│
 *   │  │ design name × qty   subtotal│ │ Customer (email/name)          ││
 *   │  │ ...                         │ │ Address (full)                 ││
 *   │  │                             │ │ Installation date              ││
 *   │  │                             │ │ Cancel reason (if terminated)  ││
 *   │  │                             │ │ ── Notes ──                    ││
 *   │  │                             │ │ - "Позвонил клиенту" ...       ││
 *   │  │                             │ │ [textarea] [Добавить заметку]  ││
 *   │  └─────────────────────────────┘ └────────────────────────────────┘│
 *   └────────────────────────────────────────────────────────────────────┘
 *
 * Flow:
 *   * Action buttons are disabled per the `TRANSITIONS` table — server
 *     re-validates anyway, but disabling avoids predictable 409s.
 *   * Cancel/refund open a `Modal` requiring a `reason`; backend rejects
 *     blank reasons with 422 (see api/admin/orders.py).
 *   * 409 with `code: "invalid_transition"` is shown as a toast (the
 *     order has moved on in another tab) — page also refetches.
 *   * Notes are admin-internal; appended to detail cache on success
 *     without a refetch.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  List,
  message,
  Modal,
  Skeleton,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../../../shared/api';
import {
  type ApiOrderDetail,
  type OrderStatusKey,
  type OrderStatusUpdateKey,
  useAddOrderNote,
  useOrderDetail,
  useUpdateOrderStatus,
} from '../api/ordersAdminApi';
import {
  canTransition,
  isTerminal,
  REQUIRES_REASON,
  TRANSITION_LABEL,
} from '../model/orderTransitions';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// Same colour map as the list page so the status pill is consistent.
const STATUS_TAG_COLOR: Record<OrderStatusKey, string> = {
  placed: 'default',
  confirmed: 'blue',
  in_progress: 'orange',
  delivered: 'green',
  installed: 'success',
  cancelled: 'red',
  refunded: 'volcano',
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
  return dayjs(iso).format('DD.MM.YYYY HH:mm');
}

function formatRub(value: number): string {
  return `${value.toLocaleString('ru-RU')} ₽`;
}


export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useOrderDetail(id);
  const updateStatus = useUpdateOrderStatus();
  const addNote = useAddOrderNote();

  // Cancel/refund modal — single piece of state; the `pendingTarget`
  // tells us which verb is being applied (changes the modal title).
  const [pendingTarget, setPendingTarget] = useState<OrderStatusUpdateKey | null>(null);
  const [reasonForm] = Form.useForm<{ reason: string }>();

  // Notes input is local until the user clicks "Добавить" — same
  // pattern as the search box on the list page (no per-keystroke noise).
  const [noteText, setNoteText] = useState('');

  function handleQuickAction(target: OrderStatusUpdateKey): void {
    if (REQUIRES_REASON.has(target)) {
      // Cancel/refund — open modal to collect the reason.
      reasonForm.resetFields();
      setPendingTarget(target);
      return;
    }
    runStatusUpdate(target);
  }

  function runStatusUpdate(target: OrderStatusUpdateKey, reason?: string): void {
    if (!id) return;
    updateStatus.mutate(
      { orderId: id, status: target, reason },
      {
        onSuccess: () => {
          message.success(`Статус обновлён: ${TRANSITION_LABEL[target]}`);
          setPendingTarget(null);
        },
        onError: (err) => {
          // 409 invalid_transition = state changed elsewhere; refetch so
          // the disabled-buttons matrix reflects the truth and show a
          // toast that points the admin at the new reality.
          if (err instanceof ApiError && err.body?.code === 'invalid_transition') {
            message.error('Переход недоступен — заказ изменился');
            refetch();
            setPendingTarget(null);
            return;
          }
          message.error(err instanceof Error ? err.message : 'Ошибка');
        },
      },
    );
  }

  function handleConfirmReason(): void {
    reasonForm
      .validateFields()
      .then(({ reason }) => {
        if (pendingTarget) runStatusUpdate(pendingTarget, reason);
      })
      .catch(() => {
        /* Form shows inline errors */
      });
  }

  function handleAddNote(): void {
    if (!id) return;
    const text = noteText.trim();
    if (!text) return;
    addNote.mutate(
      { orderId: id, text },
      {
        onSuccess: () => {
          setNoteText('');
          message.success('Заметка добавлена');
        },
        onError: (err) => {
          message.error(err instanceof Error ? err.message : 'Ошибка');
        },
      },
    );
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
          message={isNotFound ? 'Заказ не найден' : 'Не удалось загрузить заказ'}
          description={!isNotFound && error instanceof Error ? error.message : undefined}
        />
        <Button
          icon={<ArrowLeftOutlined />}
          style={{ marginTop: 16 }}
          onClick={() => navigate('/admin/orders')}
        >
          К списку заказов
        </Button>
      </div>
    );
  }

  if (!data) {
    return <Skeleton active />;
  }

  const order: ApiOrderDetail = data;

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
            onClick={() => navigate('/admin/orders')}
          >
            К списку
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            Заказ {order.number}
          </Title>
          <Tag color={STATUS_TAG_COLOR[order.status]} style={{ marginLeft: 8 }}>
            {order.status_label}
          </Tag>
        </Space>
        <Text type="secondary">Создан {formatDateTime(order.created_at)}</Text>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={1} style={{ marginTop: 16 }}>
        <Space wrap>
          {/* Iterate the action map directly — its key set IS the set of
              admin-settable target statuses (PLACED is excluded by type).
              Using `Object.keys(TRANSITIONS)` here would mistype 'placed'
              as a target and require a runtime filter. */}
          {(Object.keys(TRANSITION_LABEL) as OrderStatusUpdateKey[]).map((target) => {
            const enabled = canTransition(order.status, target);
            return (
              <Button
                key={target}
                type={target === 'cancelled' ? 'default' : 'primary'}
                danger={target === 'cancelled' || target === 'refunded'}
                disabled={!enabled || updateStatus.isPending}
                onClick={() => handleQuickAction(target)}
              >
                {TRANSITION_LABEL[target]}
              </Button>
            );
          })}
        </Space>
        {isTerminal(order.status) && (
          <Paragraph type="secondary" style={{ marginTop: 12 }}>
            Заказ в финальном статусе — переходы недоступны.
          </Paragraph>
        )}
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 24,
          marginTop: 24,
        }}
      >
        <motion.div variants={fadeUpVariants} custom={2}>
          <Card title="Состав заказа">
            <List
              dataSource={order.items}
              renderItem={(it) => (
                <List.Item>
                  <List.Item.Meta
                    title={it.design_name}
                    description={`${it.size_key || '—'} · ${it.color || '—'} · ×${it.quantity}`}
                  />
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {formatRub(it.subtotal)}
                  </div>
                </List.Item>
              )}
              footer={
                <div style={{ textAlign: 'right' }}>
                  <Text strong>Итого: {formatRub(order.total)}</Text>
                </div>
              }
            />
          </Card>
        </motion.div>

        <motion.div variants={fadeUpVariants} custom={3}>
          <Card title="Клиент и доставка" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="Имя">
                {order.user_name || '—'}
              </Descriptions.Item>
              {/* Phase 4A follow-up — phone is the primary contact
                  channel for support; placed above email so it's the
                  first thing a manager sees. `tel:` link triggers the
                  default dialer on mobile. */}
              <Descriptions.Item label="Телефон">
                {order.user_phone ? (
                  <a href={`tel:${order.user_phone.replace(/\s+/g, '')}`}>
                    {order.user_phone}
                  </a>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {order.user_email ? (
                  <a href={`mailto:${order.user_email}`}>{order.user_email}</a>
                ) : (
                  order.user_id
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Адрес">{order.address}</Descriptions.Item>
              <Descriptions.Item label="Дата установки">
                {order.installation_date ? formatDateTime(order.installation_date) : '—'}
              </Descriptions.Item>
              {order.cancel_reason && (
                <Descriptions.Item label="Причина">
                  {order.cancel_reason}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          <Card title="Внутренние заметки">
            <List
              size="small"
              dataSource={order.notes}
              locale={{ emptyText: 'Заметок пока нет' }}
              renderItem={(n) => (
                <List.Item key={n.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>{n.author_name || n.author_id}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDateTime(n.created_at)}
                        </Text>
                      </Space>
                    }
                    description={n.text}
                  />
                </List.Item>
              )}
            />
            <div style={{ marginTop: 12 }}>
              <TextArea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Добавить заметку (видна только админам)"
                maxLength={2000}
              />
              <Button
                type="primary"
                style={{ marginTop: 8 }}
                disabled={!noteText.trim() || addNote.isPending}
                onClick={handleAddNote}
                loading={addNote.isPending}
              >
                Добавить заметку
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>

      <Modal
        title={
          pendingTarget === 'cancelled'
            ? 'Отменить заказ'
            : pendingTarget === 'refunded'
              ? 'Оформить возврат'
              : ''
        }
        open={pendingTarget !== null}
        onCancel={() => setPendingTarget(null)}
        onOk={handleConfirmReason}
        confirmLoading={updateStatus.isPending}
        okText="Подтвердить"
        cancelText="Отмена"
        okButtonProps={{ danger: true }}
      >
        <Form form={reasonForm} layout="vertical">
          <Form.Item
            name="reason"
            label="Причина"
            rules={[
              { required: true, message: 'Введите причину' },
              {
                validator: (_, value) =>
                  value && value.trim().length > 0
                    ? Promise.resolve()
                    : Promise.reject(new Error('Причина не может быть пустой')),
              },
            ]}
          >
            <TextArea rows={3} maxLength={500} placeholder="Например: клиент передумал" />
          </Form.Item>
        </Form>
      </Modal>
    </motion.div>
  );
}
