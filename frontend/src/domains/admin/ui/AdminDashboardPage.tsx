/**
 * Phase 3 — admin dashboard landing.
 *
 * Phase 11 expansion adds 8 widgets that close the gaps in the original
 * MVP dashboard:
 *
 *   1. Подписки                — active count, MRR, churn, by-plan
 *   2. Воронка заказов         — placed → confirmed → … → installed
 *   3. Брошенные корзины       — saved constructor projects w/o order
 *   4. Заказы — внимание       — orders past their per-status SLA
 *   5. Использование            — constructor + visualizer + conversion
 *   6. Размеры панелей         — bar by size_key
 *   7. География                — top cities by revenue
 *   8. Регистрации vs заказы   — daily series overlay
 *
 * Layout (responsive 24-col grid, breakpoint at lg):
 *   ┌── Header + range switcher ──────────────────────────────────────┐
 *   ├── 4 base metric cards (revenue / orders / new users / avg) ─────┤
 *   ├── 4 subscription metric cards (active / MRR / new / churn) ─────┤
 *   ├── Revenue line chart (full width) ─────────────────────────────┤
 *   ├── Воронка ┊ Регистрации vs заказы (50/50) ─────────────────────┤
 *   ├── Заказы по статусам ┊ Топ дизайнов (50/50) ───────────────────┤
 *   ├── Размеры панелей ┊ Топ городов (50/50) ───────────────────────┤
 *   ├── Использование инструментов ┊ Брошенные корзины (50/50) ──────┤
 *   └── Заказы, требующие внимания (full width) ─────────────────────┘
 *
 * All widgets share the same loading skeleton + empty-state convention.
 * Charts use `recharts`; lists/tables use Ant Design.
 */

import { motion } from 'framer-motion';
import {
  Alert,
  Card,
  Col,
  Empty,
  List,
  Progress,
  Row,
  Segmented,
  Skeleton,
  Table,
  Tag,
  Tooltip as AntTooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Bar,
  BarChart,
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
  type ApiAbandonedCart,
  type ApiCityBucket,
  type ApiDashboardSnapshot,
  type ApiFunnelStage,
  type ApiOrderAttention,
  type ApiRegistrationsCompare,
  type ApiSizeBucket,
  type ApiSubscriptionsSummary,
  type ApiToolUsage,
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
const GREEN_SOFT = 'rgba(76,175,80,0.12)';
const GRAY_TEXT = '#6B7280';
const GRAY_BORDER = 'rgba(0,0,0,0.06)';
const STATUS_COLORS = ['#4CAF50', '#81C784', '#FFB74D', '#64B5F6', '#9575CD'];
// 5-step sequential green ramp for funnel & size widgets — keeps the
// palette tight without bringing in a chart-library theming dep.
const GREEN_RAMP = ['#1B5E20', '#2E7D32', '#43A047', '#66BB6A', '#A5D6A7'];
const ACCENT_BLUE = '#1976D2';   // for the "registrations" comparison line
const ATTENTION_AMBER = '#FFA000'; // for SLA-violation reasons

const APPLE_EASE: [number, number, number, number] = [0.25, 0.1, 0.25, 1.0];
const fadeUpVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: APPLE_EASE, delay: i * 0.06 },
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
  cancelled: 'Отменён',
  refunded: 'Возврат',
};

// ─── Formatters ─────────────────────────────────────────────────────────

function formatMetricValue(value: number, unit?: string): string {
  // Whole numbers with thousands separator — the backend never emits
  // fractional values for revenue/orders/users, so no decimal handling.
  const rounded = Math.round(value);
  const withSeparators = rounded.toLocaleString('ru-RU');
  return unit ? `${withSeparators} ${unit}` : withSeparators;
}

function formatMoney(value: number): string {
  return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
}

function formatDayShort(iso: string): string {
  // "2026-04-24" → "24.04" — the XAxis is dense at 30/90 days, so we
  // strip the year. `Intl.DateTimeFormat` would localise for us but
  // "dd.MM" is shorter and matches the orders list format.
  const [, m, d] = iso.split('-');
  return `${d}.${m}`;
}

function formatRelativeAge(hours: number): string {
  // "3 ч", "2 дн", "1 нед". Hours are integer from the backend.
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн`;
  return `${Math.floor(days / 7)} нед`;
}

// ─── Atoms ──────────────────────────────────────────────────────────────

const SECTION_CARD_STYLE = {
  borderRadius: 12,
  border: `1px solid ${GRAY_BORDER}`,
};

const SECTION_HEADER_STYLES = { header: { borderBottom: 'none' } };

function MetricCard({
  label,
  value,
  unit,
  loading,
  hint,
}: {
  label: string;
  value: number;
  unit?: string;
  loading: boolean;
  hint?: string;
}) {
  return (
    <Card bodyStyle={{ padding: '18px 20px' }} style={SECTION_CARD_STYLE}>
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
        <>
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
          {hint ? (
            <Text style={{ fontSize: 12, color: GRAY_TEXT }}>{hint}</Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ─── Existing widgets (revenue line / status pie / top designs) ─────────

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
                  background: GREEN_SOFT,
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

// ─── Phase 11 widgets ───────────────────────────────────────────────────

// 1. Subscriptions — 4 metric cards already rendered at the top from
//    `data.subscriptions`. The per-plan stacked bar lives here.
function SubscriptionsByPlan({
  data,
  loading,
}: {
  data: ApiSubscriptionsSummary | null;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (!data || data.by_plan.every((p) => p.active_count === 0)) {
    return <Empty description="Активных подписок нет" style={{ padding: '32px 0' }} />;
  }
  const totalActive = data.by_plan.reduce((sum, p) => sum + p.active_count, 0);
  return (
    <div style={{ padding: '4px 0' }}>
      {data.by_plan.map((p, i) => {
        const pct = totalActive ? (p.active_count / totalActive) * 100 : 0;
        return (
          <div key={p.plan_id} style={{ marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <Text style={{ color: DARK, fontSize: 14, fontWeight: 500 }}>
                {p.plan_name}{' '}
                <Text style={{ color: GRAY_TEXT, fontSize: 12, fontWeight: 400 }}>
                  · {formatMetricValue(p.monthly_price, '₽/мес')}
                </Text>
              </Text>
              <Text
                style={{
                  color: DARK,
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {p.active_count}{' '}
                <span style={{ color: GRAY_TEXT }}>
                  ({pct.toFixed(0)}%)
                </span>
              </Text>
            </div>
            <Progress
              percent={pct}
              showInfo={false}
              strokeColor={GREEN_RAMP[i % GREEN_RAMP.length]}
              trailColor="#F0F0F0"
              size="small"
            />
          </div>
        );
      })}
    </div>
  );
}

// 2. Order funnel — horizontal bar with conversion %.
function FunnelChart({
  data,
  loading,
}: {
  data: ApiFunnelStage[];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  const top = data[0]?.count ?? 0;
  if (top === 0) {
    return <Empty description="В этом периоде нет заказов" style={{ padding: '32px 0' }} />;
  }
  return (
    <div style={{ padding: '4px 0' }}>
      {data.map((s, i) => {
        const widthPct = (s.count / top) * 100;
        return (
          <div key={s.key} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <Text style={{ color: DARK, fontSize: 13 }}>{s.label}</Text>
              <Text
                style={{
                  color: GRAY_TEXT,
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.count}
                {s.conversion_pct !== null
                  ? ` · ${s.conversion_pct.toFixed(0)}%`
                  : ''}
              </Text>
            </div>
            <div
              style={{
                height: 8,
                background: '#F0F0F0',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${widthPct}%`,
                  background: GREEN_RAMP[i % GREEN_RAMP.length],
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 8. Registrations vs orders — overlaid line chart.
function RegistrationsCompareChart({
  data,
  loading,
}: {
  data: ApiRegistrationsCompare | null;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }
  if (!data || (data.total_users === 0 && data.total_orders === 0)) {
    return (
      <Empty
        description="Нет регистраций и заказов за период"
        style={{ padding: '32px 0' }}
      />
    );
  }
  // Zip the two series — backend returns gap-filled, equal-length arrays.
  const rows = data.new_users.points.map((p, i) => ({
    day: formatDayShort(p.day),
    users: p.value,
    orders: data.new_orders.points[i]?.value ?? 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: GRAY_TEXT }} />
        <YAxis tick={{ fontSize: 11, fill: GRAY_TEXT }} allowDecimals={false} />
        <Tooltip />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="users"
          name="Регистрации"
          stroke={ACCENT_BLUE}
          strokeWidth={2}
          dot={{ r: 2, fill: ACCENT_BLUE }}
        />
        <Line
          type="monotone"
          dataKey="orders"
          name="Заказы"
          stroke={GREEN}
          strokeWidth={2}
          dot={{ r: 2, fill: GREEN }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// 6. Panel size breakdown — vertical bar.
function SizeBreakdownChart({
  data,
  loading,
}: {
  data: ApiSizeBucket[];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (data.length === 0) {
    return <Empty description="Нет проданных панелей" style={{ padding: '32px 0' }} />;
  }
  const rows = data.map((b) => ({
    label: b.size_label,
    items: b.items_count,
    revenue: b.revenue,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={rows}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
        barCategoryGap="20%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY_TEXT }} />
        <YAxis tick={{ fontSize: 11, fill: GRAY_TEXT }} allowDecimals={false} />
        <Tooltip
          formatter={(v, name) =>
            name === 'Выручка' ? [formatMoney(Number(v)), name] : [v, name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="items" name="Шт." fill={GREEN} radius={[6, 6, 0, 0]} />
        <Bar
          dataKey="revenue"
          name="Выручка"
          fill={GREEN_RAMP[3]}
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 7. Top cities — vertical bar (one bar = revenue).
function TopCitiesChart({
  data,
  loading,
}: {
  data: ApiCityBucket[];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (data.length === 0) {
    return <Empty description="Нет заказов с указанным городом" style={{ padding: '32px 0' }} />;
  }
  const rows = data.map((b) => ({
    city: b.city,
    revenue: b.revenue,
    orders: b.orders_count,
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 10, right: 24, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: GRAY_TEXT }}
          tickFormatter={(v) =>
            v >= 1000 ? `${Math.round(v / 1000)}к` : String(v)
          }
        />
        <YAxis
          dataKey="city"
          type="category"
          width={120}
          tick={{ fontSize: 12, fill: DARK }}
        />
        <Tooltip
          formatter={(v, name) =>
            name === 'Выручка' ? [formatMoney(Number(v)), name] : [v, name]
          }
        />
        <Bar
          dataKey="revenue"
          name="Выручка"
          fill={GREEN}
          radius={[0, 6, 6, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// 5. Tool usage — 4 mini cards with the engagement → conversion metrics.
function ToolUsageWidget({
  data,
  loading,
}: {
  data: ApiToolUsage | null;
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (
    !data ||
    (data.constructor_sessions === 0 &&
      data.visualizer_projects === 0 &&
      data.engaged_users === 0)
  ) {
    return (
      <Empty
        description="Конструктор и визуализатор пока не использовались"
        style={{ padding: '32px 0' }}
      />
    );
  }
  const items = [
    { label: 'Конструктор', value: data.constructor_sessions, hint: 'сессий' },
    { label: 'Визуализатор', value: data.visualizer_projects, hint: 'проектов' },
    { label: 'Конверсия', value: data.conversion_pct, unit: '%', hint: 'к заказу' },
    { label: 'Вовлечённых', value: data.engaged_users, hint: 'пользователей' },
  ];
  return (
    <Row gutter={[12, 12]}>
      {items.map((it) => (
        <Col xs={12} sm={12} key={it.label}>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: GREEN_SOFT,
            }}
          >
            <Text style={{ fontSize: 12, color: GRAY_TEXT }}>{it.label}</Text>
            <div
              style={{
                marginTop: 4,
                fontSize: 22,
                fontWeight: 700,
                color: DARK,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMetricValue(it.value, it.unit)}
            </div>
            <Text style={{ fontSize: 11, color: GRAY_TEXT }}>{it.hint}</Text>
          </div>
        </Col>
      ))}
    </Row>
  );
}

// 3. Abandoned carts — list with email, items count, total, last activity.
function AbandonedCartsList({
  data,
  loading,
}: {
  data: ApiAbandonedCart[];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (data.length === 0) {
    return (
      <Empty
        description="Нет брошенных корзин"
        style={{ padding: '32px 0' }}
      />
    );
  }
  return (
    <List
      dataSource={data}
      size="small"
      renderItem={(c) => (
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text
                style={{
                  display: 'block',
                  color: DARK,
                  fontSize: 13,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.user_name || c.user_email || 'Без имени'}
              </Text>
              <Text
                style={{
                  display: 'block',
                  color: GRAY_TEXT,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.project_name || 'Без названия'} · {c.panels_count} панел.
              </Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text
                style={{
                  color: DARK,
                  fontSize: 14,
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatMoney(c.total_price)}
              </Text>
              <div style={{ fontSize: 11, color: GRAY_TEXT }}>
                {formatRelativeAge(
                  Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(c.last_activity).getTime()) /
                        3_600_000,
                    ),
                  ),
                )}{' '}
                назад
              </div>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
}

// 4. Orders needing attention — table with reason + age + total.
function OrdersAttentionTable({
  data,
  loading,
}: {
  data: ApiOrderAttention[];
  loading: boolean;
}) {
  const columns: ColumnsType<ApiOrderAttention> = [
    {
      title: 'Заказ',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (v: string) => (
        <Text style={{ color: DARK, fontWeight: 500 }}>{v}</Text>
      ),
    },
    {
      title: 'Клиент',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (_v, row) => (
        <div>
          <div style={{ color: DARK, fontSize: 13 }}>
            {row.user_name || '—'}
          </div>
          <div style={{ color: GRAY_TEXT, fontSize: 11 }}>{row.user_email}</div>
        </div>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color="default">{STATUS_LABELS[s] ?? s}</Tag>
      ),
    },
    {
      title: 'Возраст',
      dataIndex: 'age_hours',
      key: 'age_hours',
      align: 'right',
      render: (h: number) => (
        <AntTooltip title={`${h} часов`}>
          <Text style={{ color: ATTENTION_AMBER, fontWeight: 600 }}>
            {formatRelativeAge(h)}
          </Text>
        </AntTooltip>
      ),
    },
    {
      title: 'Сумма',
      dataIndex: 'total',
      key: 'total',
      align: 'right',
      render: (v: number) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatMoney(v)}
        </Text>
      ),
    },
    {
      title: 'Причина',
      dataIndex: 'reason',
      key: 'reason',
      render: (r: string) => (
        <Text style={{ color: GRAY_TEXT, fontSize: 12 }}>{r}</Text>
      ),
    },
  ];
  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }
  if (data.length === 0) {
    return (
      <Empty
        description="Все заказы укладываются в SLA"
        style={{ padding: '32px 0' }}
      />
    );
  }
  return (
    <Table
      rowKey="order_id"
      columns={columns}
      dataSource={data}
      pagination={false}
      size="small"
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

  const subs = data?.subscriptions ?? null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
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

      {/* ─── Row 1: 4 base metric cards ──────────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={1}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
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

      {/* ─── Row 2: 4 subscription metric cards (Widget 1 — top) ──── */}
      <motion.div variants={fadeUpVariants} custom={2}>
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              label="Активные подписки"
              value={subs?.active_count ?? 0}
              loading={isLoading}
              hint="всего сейчас"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              label="MRR"
              value={subs?.mrr ?? 0}
              unit="₽/мес"
              loading={isLoading}
              hint="recurring revenue"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              label="Новые подписки"
              value={subs?.new_in_period ?? 0}
              loading={isLoading}
              hint="за период"
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <MetricCard
              label="Отток"
              value={subs?.churn_pct ?? 0}
              unit="%"
              loading={isLoading}
              hint="churn за период"
            />
          </Col>
        </Row>
      </motion.div>

      {/* ─── Revenue chart ──────────────────────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={3}>
        <Card
          title="Выручка по дням"
          styles={SECTION_HEADER_STYLES}
          style={{ ...SECTION_CARD_STYLE, marginBottom: 16 }}
        >
          <RevenueChart data={data?.revenue_series.points ?? []} loading={isLoading} />
        </Card>
      </motion.div>

      {/* ─── Row 3: Funnel + Registrations vs orders ────────────── */}
      <motion.div variants={fadeUpVariants} custom={4}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title="Воронка заказов"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <FunnelChart data={data?.funnel ?? []} loading={isLoading} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Регистрации vs заказы"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
              extra={
                data?.registrations_compare ? (
                  <Text style={{ fontSize: 12, color: GRAY_TEXT }}>
                    {data.registrations_compare.total_users} рег. ·{' '}
                    {data.registrations_compare.total_orders} зак.
                  </Text>
                ) : null
              }
            >
              <RegistrationsCompareChart
                data={data?.registrations_compare ?? null}
                loading={isLoading}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Row 4: Status pie + Top designs ────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={5}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title="Заказы по статусам"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <StatusPie data={data?.orders_by_status ?? []} loading={isLoading} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Топ дизайнов"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <TopDesignsList data={data?.top_designs ?? []} loading={isLoading} />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Row 5: Sizes + Cities ──────────────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={6}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title="Размеры панелей"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <SizeBreakdownChart
                data={data?.size_breakdown ?? []}
                loading={isLoading}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Топ городов"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <TopCitiesChart
                data={data?.top_cities ?? []}
                loading={isLoading}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Row 6: Subs by plan + Tool usage ───────────────────── */}
      <motion.div variants={fadeUpVariants} custom={7}>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title="Подписки по планам"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <SubscriptionsByPlan data={subs} loading={isLoading} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title="Использование инструментов"
              styles={SECTION_HEADER_STYLES}
              style={SECTION_CARD_STYLE}
            >
              <ToolUsageWidget
                data={data?.tool_usage ?? null}
                loading={isLoading}
              />
            </Card>
          </Col>
        </Row>
      </motion.div>

      {/* ─── Row 7: Abandoned carts ─────────────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={8}>
        <Card
          title="Брошенные корзины"
          styles={SECTION_HEADER_STYLES}
          style={{ ...SECTION_CARD_STYLE, marginBottom: 16 }}
          extra={
            <Text style={{ fontSize: 12, color: GRAY_TEXT }}>
              Сохранённые проекты без заказа
            </Text>
          }
        >
          <AbandonedCartsList
            data={data?.abandoned_carts ?? []}
            loading={isLoading}
          />
        </Card>
      </motion.div>

      {/* ─── Row 8: Orders needing attention ────────────────────── */}
      <motion.div variants={fadeUpVariants} custom={9}>
        <Card
          title="Заказы — требуют внимания"
          styles={SECTION_HEADER_STYLES}
          style={SECTION_CARD_STYLE}
          extra={
            <Text style={{ fontSize: 12, color: ATTENTION_AMBER }}>
              SLA: оформлен&gt;24ч · подтверждён&gt;3д · в работе&gt;7д
            </Text>
          }
        >
          <OrdersAttentionTable
            data={data?.orders_attention ?? []}
            loading={isLoading}
          />
        </Card>
      </motion.div>
    </motion.div>
  );
}
