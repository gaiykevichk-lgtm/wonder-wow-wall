/**
 * Phase 4B — pure state-machine helpers for the admin detail page.
 *
 * Encodes which transitions are LEGAL from a given current status. The
 * detail page uses this to disable buttons for forbidden transitions
 * (`PLACED → DELIVERED` is impossible) — server still validates, but
 * client-side disabling avoids round-trip 409s for predictable cases.
 *
 * The list mirrors the backend domain (`Order.confirm/start_work/...`):
 *   PLACED      → CONFIRMED, CANCELLED
 *   CONFIRMED   → IN_PROGRESS, CANCELLED
 *   IN_PROGRESS → DELIVERED, CANCELLED
 *   DELIVERED   → INSTALLED, REFUNDED, CANCELLED
 *   INSTALLED   → REFUNDED                (no further cancellation)
 *   CANCELLED   → ∅                       (terminal)
 *   REFUNDED    → ∅                       (terminal)
 *
 * Why a separate file: the detail page is already large; isolating the
 * matrix here keeps it cheap to unit-test in `__tests__/orderTransitions.test.ts`.
 */
import type {
  OrderStatusKey,
  OrderStatusUpdateKey,
} from '../api/ordersAdminApi';

export const TRANSITIONS: Record<OrderStatusKey, OrderStatusUpdateKey[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['delivered', 'cancelled'],
  delivered: ['installed', 'refunded', 'cancelled'],
  installed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(
  from: OrderStatusKey,
  to: OrderStatusUpdateKey,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatusKey): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Russian label for the action button (verb form, NOT the status label). */
export const TRANSITION_LABEL: Record<OrderStatusUpdateKey, string> = {
  confirmed: 'Подтвердить',
  in_progress: 'Взять в работу',
  delivered: 'Отметить доставленным',
  installed: 'Отметить установленным',
  cancelled: 'Отменить',
  refunded: 'Оформить возврат',
};

/** Statuses whose transition requires a free-text reason from the admin. */
export const REQUIRES_REASON: ReadonlySet<OrderStatusUpdateKey> = new Set([
  'cancelled',
  'refunded',
]);
