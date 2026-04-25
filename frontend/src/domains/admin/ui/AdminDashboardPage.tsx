/**
 * Phase 3 — admin dashboard landing.
 *
 * Layout:
 *   ┌─────────────────────────── header: title + range segmented ───┐
 *   │                                                                │
 *   │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                              │
 *   │  │ rev │ │ ord │ │ new │ │ avg │   ← 4 metric cards            │
 *   │  └─────┘ └─────┘ └─────┘ └─────┘                              │
 *   │                                                                │
 *   │  ┌─────────── revenue line ───────────┐                        │
 *   │  └────────────────────────────────────┘                        │
 *   │                                                                │
 *   │  ┌──── by status pie ─────┬── top designs ────┐                │
 *   │  └─────────────────────────┴──────────────────┘                │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * Charts use `recharts` (added in Phase 3). The whole page uses the
 * project's `fadeUpVariants` stagger so sections appear progressively —
 * consistent with HomePage / AccountLayout.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Card,
  Col,
  Empty,
  List,
  Row,
  Segmented,
  Skeleton,
  Typography,
} from 'antd';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  type ApiDashboardSnapshot,
  useDashboardSnapshot,
} from '../api/analyticsApi';
import {
  DASHBOARD_RANGE_OPTIONS,
  useDashboardStore,
} from '../model/dashboardStore';

const { Title, Text } = Typography;

// Palette — the canonical dark/green, extended with sequential greens and
// warm accents for status slices (never pure reds; they read as errors
// and this dashboard is informational).
const DARK = '#2D2D2D';
const GREEN = '#4CAF50';
const GRAY_TEXT = '#6B7280';
const STATUS_COLORS = ['#4CAF50', '#81C784', '#FFB74D', '#64B5F6', '#9575CD'];

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.08 },
  }),
};

// Mirrors `OrderStatus.label_ru` on the backend
// (app/domain/order/value_objects.py). Kept in sync manually — Phase 4
// will introduce a single shared label map under domains/order/model
// when the orders admin page lands and needs the same dictionary.
const STATUS_LABELS: Record<string, string> = {
  placed: 'Оформлен',
  confirmed: 'Подтверждён',
  in_progress: 'В работе',
  delivered: 'Доставлен',
  installed: 'Установлен',
};

// ─── Formatters ─────────────────────────────────────────────────────────

function formatMetricValue(value: number, unit?: string): string {
  // Whole numbers with thousands separator — the backend never emits
  // fractional values for revenue/orders/users, so no decimal handling.
  const rounded = Math.round(value);
  const withSeparators = rounded.toLocaleString('ru-RU');
  return unit ? `${withSeparators} ${unit}` : withSeparators;
}

function formatDayShort(iso: string): string {
  // "2026-04-24" → "24.04" — the XAxis is dense at 30/90 days, so we
  // strip the year. `Intl.DateTimeFormat` would localise for us but
  // "dd.MM" is shorter and matches the orders list format.
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

// ─── Components ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  loading,
}: {
  label: string;
  value: number;
  unit?: string;
  loading: boolean;
}) {
  return (
    <Card
      bodyStyle={{ padding: '18px 20px' }}
      style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <Text style={{ fontSize: 13, color: GRAY_TEXT, letterSpacing: 0.2 }}>
        {label}
      </Text>
      {loading ? (
        <Skeleton.Input
          active
          size="small"
          style={{ marginTop: 8, height: 28 }}
        />
      ) : (
        <div
          style={{
            marginTop: 6,
            fontSize: 28,
            fontWeight: 700,
            color: DARK,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatMetricValue(value, unit)}
        </div>
      )}
    </Card>
  );
}

function RevenueChart({
  data,
  loading,
}: {
  data: ApiDashboardSnapshot['revenue_series']['points'];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }
  // Transform once per render; the array is small (≤90 points).
  const rows = data.map((p) => ({ day: formatDayShort(p.day), value: p.value }));
  const total = data.reduce((acc, p) => acc + p.value, 0);
  if (total === 0) {
    return (
      <Empty
        description="За выбранный период заказов на сумму пока нет"
        style={{ padding: '32px 0' }}
      />
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: GRAY_TEXT }} />
        <YAxis
          tick={{ fontSize: 11, fill: GRAY_TEXT }}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}к` : String(v))}
        />
        <Tooltip
          formatter={(v) => [formatMetricValue(Number(v), '₽'), 'Выручка']}
          labelStyle={{ color: DARK }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={GREEN}
          strokeWidth={2}
          dot={{ r: 3, fill: GREEN }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function StatusPie({
  data,
  loading,
}: {
  data: ApiDashboardSnapshot['orders_by_status'];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton.Avatar active size={200} shape="circle" />;
  }
  if (data.length === 0) {
    return <Empty description="Нет заказов" style={{ padding: '32px 0' }} />;
  }
  const rows = data.map((b) => ({
    name: STATUS_LABELS[b.status] ?? b.status,
    value: b.count,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={rows}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          paddingAngle={2}
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TopDesignsList({
  data,
  loading,
}: {
  data: ApiDashboardSnapshot['top_designs'];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (data.length === 0) {
    return <Empty description="Нет продаж" style={{ padding: '32px 0' }} />;
  }
  return (
    <List
      dataSource={data}
      renderItem={(item, idx) => (
        <List.Item style={{ padding: '10px 4px' }}>
          <div
            style={{
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: 'rgba(76,175,80,0.12)',
                  color: GREEN,
                  fontWeight: 600,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {idx + 1}
              </div>
              <Text style={{ color: DARK, fontSize: 14 }}>{item.design_name}</Text>
            </div>
            <Text
              style={{
                color: GRAY_TEXT,
                fontSize: 13,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {item.orders_count} шт.
            </Text>
          </div>
        </List.Item>
      )}
    />
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const range = useDashboardStore((s) => s.range);
  const setRange = useDashboardStore((s) => s.setRange);
  const { data, isLoading, error } = useDashboardSnapshot(range);

  const metricsByKey: Record<string, ApiDashboardSnapshot['metrics'][number]> = {};
  if (data) {
    for (const m of data.metrics) metricsByKey[m.key] = m;
  }

  const metricOrder: { key: string; fallbackLabel: string }[] = [
    { key: 'revenue', fallbackLabel: 'Выручка' },
    { key: 'orders', fallbackLabel: 'Заказы' },
    { key: 'new_users', fallbackLabel: 'Новые клиенты' },
    { key: 'avg_order_value', fallbackLabel: 'Средний чек' },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      style={{ maxWidth: 1280 }}
    >
      <motion.div
        variants={fadeUpVariants}
        custom={0}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: DARK, fontWeight: 700 }}>
            Дашборд
          </Title>
          <Text type="secondary" style={{ color: GRAY_TEXT, fontSize: 13 }}>
            Сводка магазина за выбранный период.
          </Text>
        </div>
        <Segmented
          value={range}
          options={DASHBOARD_RANGE_OPTIONS.map((o) => ({
            label: o.label,
            value: o.value,
          }))}
          onChange={(v) => setRange(v as 7 | 30 | 90)}
        />
      </motion.div>

      {error && (
        <motion.div variants={fadeUpVariants} custom={0.5}>
          <Alert
            type="error"
            showIcon
            message="Не удалось загрузить данные"
            description="Попробуйте обновить страницу или выбрать другой период."
            style={{ marginBottom: 16 }}
          />
        </motion.div>
      )}

      <motion.div variants={fadeUpVariants} custom={1}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {metricOrder.map(({ key, fallbackLabel }) => {
            const m = metricsByKey[key];
            return (
              <Col xs={24} sm={12} lg={6} key={key}>
                <MetricCard
                  label={m?.label ?? fallbackLabel}
                  value={m?.value ?? 0}
                  unit={m?.unit}
                  loading={isLoading}
                />
              </Col>
            );
          })}
        </Row>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={2}>
        <Card
          title="Выручка по дням"
          styles={{ header: { borderBottom: 'none' } }}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.06)',
            marginBottom: 20,
          }}
        >
          <RevenueChart data={data?.revenue_series.points ?? []} loading={isLoading} />
        </Card>
      </motion.div>

      <motion.div variants={fadeUpVariants} custom={3}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title="Заказы по статусам"
              styles={{ header: { borderBottom: 'none' } }}
              style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <StatusPie data={data?.orders_by_status ?? []} loading={isLoading} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Топ дизайнов"
              styles={{ header: { borderBottom: 'none' } }}
              style={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' }}
            >
              <TopDesignsList data={data?.top_designs ?? []} loading={isLoading} />
            </Card>
          </Col>
        </Row>
      </motion.div>
    </motion.div>
  );
}
