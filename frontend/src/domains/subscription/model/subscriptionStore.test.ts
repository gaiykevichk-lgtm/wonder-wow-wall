import { describe, it, expect, beforeEach } from 'vitest';
import { useSubscriptionStore, SUBSCRIPTION_PLANS } from './subscriptionStore';

const reset = () =>
  useSubscriptionStore.setState({
    activePlanId: null,
    subscribedAt: null,
    overlaysUsedThisMonth: 0,
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

    it('plans have correct prices', () => {
      const prices = SUBSCRIPTION_PLANS.map((p) => p.price);
      expect(prices).toEqual([4900, 9900, 19900]);
    });

    it('popular plan is marked as popular', () => {
      const popular = SUBSCRIPTION_PLANS.find((p) => p.id === 'popular');
      expect(popular?.popular).toBe(true);
    });

    it('business plan has unlimited overlays (0)', () => {
      const biz = SUBSCRIPTION_PLANS.find((p) => p.id === 'business');
      expect(biz?.overlaysPerMonth).toBe(0);
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
      expect(s.overlaysUsedThisMonth).toBe(0);
      expect(s.hasSubscription()).toBe(false);
    });
  });

  describe('overlay usage', () => {
    it('useOverlay returns false without subscription', () => {
      expect(useSubscriptionStore.getState().useOverlay(1)).toBe(false);
    });

    it('useOverlay tracks usage for starter plan', () => {
      useSubscriptionStore.getState().subscribe('starter');
      const ok = useSubscriptionStore.getState().useOverlay(3);
      expect(ok).toBe(true);
      expect(useSubscriptionStore.getState().overlaysUsedThisMonth).toBe(3);
    });

    it('useOverlay rejects when exceeding limit', () => {
      useSubscriptionStore.getState().subscribe('starter'); // 10 per month
      useSubscriptionStore.getState().useOverlay(8);
      const ok = useSubscriptionStore.getState().useOverlay(5); // 8+5 > 10
      expect(ok).toBe(false);
      expect(useSubscriptionStore.getState().overlaysUsedThisMonth).toBe(8); // unchanged
    });

    it('business plan allows unlimited overlays', () => {
      useSubscriptionStore.getState().subscribe('business'); // overlaysPerMonth = 0
      const ok = useSubscriptionStore.getState().useOverlay(100);
      expect(ok).toBe(true);
      expect(useSubscriptionStore.getState().overlaysUsedThisMonth).toBe(100);
    });

    it('getRemainingOverlays returns correct value', () => {
      useSubscriptionStore.getState().subscribe('starter'); // 10
      useSubscriptionStore.getState().useOverlay(3);
      expect(useSubscriptionStore.getState().getRemainingOverlays()).toBe(7);
    });

    it('getRemainingOverlays returns Infinity for business', () => {
      useSubscriptionStore.getState().subscribe('business');
      expect(useSubscriptionStore.getState().getRemainingOverlays()).toBe(Infinity);
    });

    it('getRemainingOverlays returns 0 without subscription', () => {
      expect(useSubscriptionStore.getState().getRemainingOverlays()).toBe(0);
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
