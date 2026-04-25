/**
 * Phase 4B — `orderTransitions` matrix unit tests.
 *
 * Pin every legal/illegal cell of the state machine. The matrix mirrors
 * the backend domain (`Order.confirm/cancel/refund/...`); if either side
 * changes, this test fails fast and forces a synchronised update.
 */
import { describe, it, expect } from 'vitest';

import type {
  OrderStatusKey,
  OrderStatusUpdateKey,
} from '../api/ordersAdminApi';
import {
  canTransition,
  isTerminal,
  REQUIRES_REASON,
  TRANSITIONS,
  TRANSITION_LABEL,
} from '../model/orderTransitions';

const ALL_STATUSES: OrderStatusKey[] = [
  'placed',
  'confirmed',
  'in_progress',
  'delivered',
  'installed',
  'cancelled',
  'refunded',
];

const ALL_TARGETS: OrderStatusUpdateKey[] = [
  'confirmed',
  'in_progress',
  'delivered',
  'installed',
  'cancelled',
  'refunded',
];

describe('TRANSITIONS table', () => {
  it.each([
    ['placed', ['confirmed', 'cancelled']],
    ['confirmed', ['in_progress', 'cancelled']],
    ['in_progress', ['delivered', 'cancelled']],
    ['delivered', ['installed', 'refunded', 'cancelled']],
    ['installed', ['refunded']],
    ['cancelled', []],
    ['refunded', []],
  ] as [OrderStatusKey, OrderStatusUpdateKey[]][])('%s → %j', (from, expected) => {
    expect(TRANSITIONS[from]).toEqual(expected);
  });
});

describe('canTransition', () => {
  it('allows every legal transition listed in TRANSITIONS', () => {
    for (const from of ALL_STATUSES) {
      for (const to of TRANSITIONS[from]) {
        expect(canTransition(from, to)).toBe(true);
      }
    }
  });

  it('blocks every transition not in TRANSITIONS', () => {
    for (const from of ALL_STATUSES) {
      const allowed = new Set<OrderStatusUpdateKey>(TRANSITIONS[from]);
      for (const to of ALL_TARGETS) {
        if (allowed.has(to)) continue;
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });

  it('forbids forward jumps (placed → delivered)', () => {
    // The most user-visible illegal jump — also the canonical 409 case
    // covered by the backend integration test.
    expect(canTransition('placed', 'delivered')).toBe(false);
  });

  it('forbids transitions out of terminal states', () => {
    for (const terminal of ['cancelled', 'refunded'] as OrderStatusKey[]) {
      for (const to of ALL_TARGETS) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });
});

describe('isTerminal', () => {
  it('is true for cancelled and refunded only', () => {
    expect(isTerminal('cancelled')).toBe(true);
    expect(isTerminal('refunded')).toBe(true);
    for (const open of ['placed', 'confirmed', 'in_progress', 'delivered', 'installed'] as OrderStatusKey[]) {
      expect(isTerminal(open)).toBe(false);
    }
  });
});

describe('REQUIRES_REASON', () => {
  it('contains exactly cancelled and refunded', () => {
    expect([...REQUIRES_REASON].sort()).toEqual(['cancelled', 'refunded']);
  });
});

describe('TRANSITION_LABEL', () => {
  it('has a Russian verb for every settable target status', () => {
    for (const target of ALL_TARGETS) {
      expect(TRANSITION_LABEL[target]).toBeTruthy();
    }
  });
});
