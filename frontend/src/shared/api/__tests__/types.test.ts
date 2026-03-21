import { describe, it, expect } from 'vitest';
import type {
  ApiAuthResponse,
  ApiDesignListResponse,
  ApiOrder,
  ApiPlan,
  ApiSubscription,
  ApiProject,
  ApiContactRequest,
  ApiCalculatorRequest,
} from '../types';

describe('API Types', () => {
  it('ApiAuthResponse has correct shape', () => {
    const response: ApiAuthResponse = {
      user: { id: '1', name: 'Test', email: 'test@test.com', phone: '+7900', created_at: '2024-01-01' },
      token: 'jwt-token',
    };
    expect(response.user.id).toBe('1');
    expect(response.token).toBe('jwt-token');
  });

  it('ApiDesignListResponse has items and total', () => {
    const response: ApiDesignListResponse = {
      items: [{
        id: '1', name: 'Test', slug: 'test', category_id: 'cat', style: 'Modern',
        image: 'img.jpg', description: 'desc', price: 1200,
        colors: [{ hex: '#000', name: 'Black' }],
        rating: 4.5, reviews_count: 10, is_new: true, is_popular: false,
      }],
      total: 1,
    };
    expect(response.items).toHaveLength(1);
    expect(response.total).toBe(1);
  });

  it('ApiOrder has correct shape', () => {
    const order: ApiOrder = {
      id: '1', number: 'WOW-001', status: 'placed', total: 5000,
      address: 'Москва, ул. Тестовая 1',
      items: [{ id: 'i1', design_name: 'Design', design_image: '', size_key: '30x30', color: '#fff', quantity: 2, unit_price: 2500 }],
      created_at: '2024-01-01',
    };
    expect(order.items[0].unit_price).toBe(2500);
  });

  it('ApiPlan has features array', () => {
    const plan: ApiPlan = {
      id: 'starter', name: 'Стартовый', price: 4900, period: 'месяц',
      overlays_per_month: 4, popular: false, features: ['Feature 1', 'Feature 2'],
    };
    expect(plan.features).toHaveLength(2);
  });

  it('ApiSubscription has remaining_overlays', () => {
    const sub: ApiSubscription = {
      id: '1', plan_id: 'starter', status: 'active',
      overlays_used_this_month: 2, remaining_overlays: 2,
      started_at: '2024-01-01', expires_at: '2024-02-01',
    };
    expect(sub.remaining_overlays).toBe(2);
  });

  it('ApiProject has wall dimensions', () => {
    const project: ApiProject = {
      id: '1', name: 'My Wall', wall_cols: 5, wall_rows: 3, wall_color: '#fff',
      panels: [], total_price: 0, created_at: '2024-01-01', updated_at: '2024-01-01',
    };
    expect(project.wall_cols).toBe(5);
    expect(project.wall_rows).toBe(3);
  });

  it('ApiContactRequest has required fields', () => {
    const contact: ApiContactRequest = {
      name: 'Test', email: 'test@test.com', message: 'Hello',
    };
    expect(contact.name).toBe('Test');
  });

  it('ApiCalculatorRequest has panels and subscription flag', () => {
    const calc: ApiCalculatorRequest = {
      panels: [{ size_key: '30x30', quantity: 4 }],
      has_subscription: true,
    };
    expect(calc.panels).toHaveLength(1);
    expect(calc.has_subscription).toBe(true);
  });
});
