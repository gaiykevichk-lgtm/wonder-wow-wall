import { describe, it, expect, beforeEach } from 'vitest';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from './subscriptionStore';

const reset = () =>
  useSubscriptionStore.setState({
    activePlanId: null,
    subscribedAt: null,
    areaUsedThisMonthM2: 0,
    isModalOpen: false,
    selectedPlanId: null,
    modalStep: 'select',
  });

describe('subscriptionStore', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  describe('plans data', () => {
    it('has 3 subscription plans', () => {
      expect(SUBSCRIPTION_PLANS).toHaveLength(3);
    });

    it('plans have correct ids', () => {
      const ids = SUBSCRIPTION_PLANS.map((p) => p.id);
      expect(ids).toEqual(['starter', 'popular', 'business']);
    });

    it('plans have correct prices (ТЗ)', () => {
      const prices = SUBSCRIPTION_PLANS.map((p) => p.price);
      expect(prices).toEqual([7000, 12000, 18000]);
    });

    it('plans have correct area limits (ТЗ)', () => {
      const limits = SUBSCRIPTION_PLANS.map((p) => p.areaLimitM2);
      expect(limits).toEqual([15, 30, 0]);
    });

    it('popular plan is marked as popular', () => {
      const popular = SUBSCRIPTION_PLANS.find((p) => p.id === 'popular');
      expect(popular?.popular).toBe(true);
    });

    it('business plan has unlimited area (0)', () => {
      const biz = SUBSCRIPTION_PLANS.find((p) => p.id === 'business');
      expect(biz?.areaLimitM2).toBe(0);
    });
  });

  describe('subscription lifecycle', () => {
    it('starts with no subscription', () => {
      const s = useSubscriptionStore.getState();
      expect(s.hasSubscription()).toBe(false);
      expect(s.getActivePlan()).toBeNull();
      expect(s.activePlanId).toBeNull();
    });

    it('subscribe activates plan', () => {
      useSubscriptionStore.getState().subscribe('popular');
      const s = useSubscriptionStore.getState();
      expect(s.activePlanId).toBe('popular');
      expect(s.subscribedAt).toBeTruthy();
      expect(s.hasSubscription()).toBe(true);
      expect(s.getActivePlan()?.name).toBe('Популярный');
    });

    it('cancelSubscription resets state', () => {
      useSubscriptionStore.getState().subscribe('starter');
      useSubscriptionStore.getState().cancelSubscription();
      const s = useSubscriptionStore.getState();
      expect(s.activePlanId).toBeNull();
      expect(s.subscribedAt).toBeNull();
      expect(s.areaUsedThisMonthM2).toBe(0);
      expect(s.hasSubscription()).toBe(false);
    });
  });

  describe('area usage', () => {
    it('useArea returns false without subscription', () => {
      expect(useSubscriptionStore.getState().useArea(1)).toBe(false);
    });

    it('useArea tracks usage for starter plan', () => {
      useSubscriptionStore.getState().subscribe('starter'); // 15 m²
      const ok = useSubscriptionStore.getState().useArea(3.5);
      expect(ok).toBe(true);
      expect(useSubscriptionStore.getState().areaUsedThisMonthM2).toBe(3.5);
    });

    it('useArea rejects when exceeding limit', () => {
      useSubscriptionStore.getState().subscribe('starter'); // 15 m²
      useSubscriptionStore.getState().useArea(12);
      const ok = useSubscriptionStore.getState().useArea(5); // 12+5 > 15
      expect(ok).toBe(false);
      expect(useSubscriptionStore.getState().areaUsedThisMonthM2).toBe(12); // unchanged
    });

    it('business plan allows unlimited area', () => {
      useSubscriptionStore.getState().subscribe('business'); // areaLimitM2 = 0
      const ok = useSubscriptionStore.getState().useArea(100);
      expect(ok).toBe(true);
      expect(useSubscriptionStore.getState().areaUsedThisMonthM2).toBe(100);
    });

    it('getRemainingAreaM2 returns correct value', () => {
      useSubscriptionStore.getState().subscribe('starter'); // 15 m²
      useSubscriptionStore.getState().useArea(3);
      expect(useSubscriptionStore.getState().getRemainingAreaM2()).toBe(12);
    });

    it('getRemainingAreaM2 returns Infinity for business', () => {
      useSubscriptionStore.getState().subscribe('business');
      expect(useSubscriptionStore.getState().getRemainingAreaM2()).toBe(Infinity);
    });

    it('getRemainingAreaM2 returns 0 without subscription', () => {
      expect(useSubscriptionStore.getState().getRemainingAreaM2()).toBe(0);
    });
  });

  describe('overlay discount', () => {
    it('returns 0 without subscription', () => {
      expect(useSubscriptionStore.getState().getOverlayDiscount()).toBe(0);
    });

    it('returns 1 (100%) with any subscription', () => {
      useSubscriptionStore.getState().subscribe('starter');
      expect(useSubscriptionStore.getState().getOverlayDiscount()).toBe(1);
    });
  });

  describe('modal state', () => {
    it('starts with modal closed', () => {
      const s = useSubscriptionStore.getState();
      expect(s.isModalOpen).toBe(false);
      expect(s.modalStep).toBe('select');
    });

    it('openModal without planId shows select step', () => {
      useSubscriptionStore.getState().openModal();
      const s = useSubscriptionStore.getState();
      expect(s.isModalOpen).toBe(true);
      expect(s.modalStep).toBe('select');
      expect(s.selectedPlanId).toBeNull();
    });

    it('openModal with planId skips to form step', () => {
      useSubscriptionStore.getState().openModal('popular');
      const s = useSubscriptionStore.getState();
      expect(s.isModalOpen).toBe(true);
      expect(s.modalStep).toBe('form');
      expect(s.selectedPlanId).toBe('popular');
    });

    it('closeModal resets modal state', () => {
      useSubscriptionStore.getState().openModal('popular');
      useSubscriptionStore.getState().closeModal();
      const s = useSubscriptionStore.getState();
      expect(s.isModalOpen).toBe(false);
      expect(s.selectedPlanId).toBeNull();
      expect(s.modalStep).toBe('select');
    });

    it('selectPlan sets planId and advances to form', () => {
      useSubscriptionStore.getState().openModal();
      useSubscriptionStore.getState().selectPlan('business');
      const s = useSubscriptionStore.getState();
      expect(s.selectedPlanId).toBe('business');
      expect(s.modalStep).toBe('form');
    });

    it('subscribe moves modal to success step', () => {
      useSubscriptionStore.getState().openModal('starter');
      useSubscriptionStore.getState().subscribe('starter');
      expect(useSubscriptionStore.getState().modalStep).toBe('success');
    });
  });
});
