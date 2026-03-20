import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SubscriptionPlan {
  id: string;
  name: string;
  desc: string;
  price: number;
  period: string;
  overlaysPerMonth: number; // 0 = unlimited
  features: string[];
  popular: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Стартовый',
    desc: 'До 10 накладок в месяц',
    price: 4900,
    period: 'мес',
    overlaysPerMonth: 10,
    popular: false,
    features: [
      'До 10 накладок в месяц (любой размер)',
      'Все дизайны из каталога',
      'Бесплатная доставка по Москве',
      'Замена повреждённых накладок',
      'Поддержка 9:00–18:00',
    ],
  },
  {
    id: 'popular',
    name: 'Популярный',
    desc: 'До 25 накладок в месяц',
    price: 9900,
    period: 'мес',
    overlaysPerMonth: 25,
    popular: true,
    features: [
      'До 25 накладок в месяц (любой размер)',
      'Все дизайны + эксклюзивные коллекции',
      'Бесплатная доставка по РФ',
      'Приоритетная замена повреждённых',
      'Поддержка 8:00–22:00',
      'Персональный дизайнер',
      'Сохранение до 5 проектов',
    ],
  },
  {
    id: 'business',
    name: 'Бизнес',
    desc: 'Безлимитные обновления',
    price: 19900,
    period: 'мес',
    overlaysPerMonth: 0,
    popular: false,
    features: [
      'Безлимитные накладки (любой размер)',
      'Эксклюзивные и кастомные дизайны',
      'VIP-доставка по всей РФ',
      'Замена в течение 24 часов',
      'Поддержка 24/7',
      'Персональный менеджер',
      'Безлимитные проекты',
      'Скидка 20% на базовые панели',
    ],
  },
];

interface SubscriptionState {
  // Active subscription
  activePlanId: string | null;
  subscribedAt: string | null;
  overlaysUsedThisMonth: number;

  // Modal
  isModalOpen: boolean;
  selectedPlanId: string | null;
  modalStep: 'select' | 'form' | 'success';

  // Actions
  openModal: (planId?: string) => void;
  closeModal: () => void;
  setModalStep: (step: 'select' | 'form' | 'success') => void;
  selectPlan: (planId: string) => void;
  subscribe: (planId: string) => void;
  cancelSubscription: () => void;
  useOverlay: (count: number) => boolean;

  // Getters
  getActivePlan: () => SubscriptionPlan | null;
  getRemainingOverlays: () => number;
  hasSubscription: () => boolean;
  getOverlayDiscount: () => number; // 0 to 1
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      activePlanId: null,
      subscribedAt: null,
      overlaysUsedThisMonth: 0,

      isModalOpen: false,
      selectedPlanId: null,
      modalStep: 'select',

      openModal: (planId) =>
        set({
          isModalOpen: true,
          selectedPlanId: planId || null,
          modalStep: planId ? 'form' : 'select',
        }),

      closeModal: () =>
        set({ isModalOpen: false, selectedPlanId: null, modalStep: 'select' }),

      setModalStep: (step) => set({ modalStep: step }),

      selectPlan: (planId) => set({ selectedPlanId: planId, modalStep: 'form' }),

      subscribe: (planId) =>
        set({
          activePlanId: planId,
          subscribedAt: new Date().toISOString(),
          overlaysUsedThisMonth: 0,
          modalStep: 'success',
        }),

      cancelSubscription: () =>
        set({
          activePlanId: null,
          subscribedAt: null,
          overlaysUsedThisMonth: 0,
        }),

      useOverlay: (count) => {
        const state = get();
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === state.activePlanId);
        if (!plan) return false;
        if (plan.overlaysPerMonth > 0 && state.overlaysUsedThisMonth + count > plan.overlaysPerMonth) {
          return false;
        }
        set({ overlaysUsedThisMonth: state.overlaysUsedThisMonth + count });
        return true;
      },

      getActivePlan: () => {
        const { activePlanId } = get();
        return SUBSCRIPTION_PLANS.find((p) => p.id === activePlanId) || null;
      },

      getRemainingOverlays: () => {
        const state = get();
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === state.activePlanId);
        if (!plan) return 0;
        if (plan.overlaysPerMonth === 0) return Infinity;
        return Math.max(0, plan.overlaysPerMonth - state.overlaysUsedThisMonth);
      },

      hasSubscription: () => get().activePlanId !== null,

      getOverlayDiscount: () => {
        const plan = get().getActivePlan();
        if (!plan) return 0;
        return 1; // subscribers get overlays included in plan price
      },
    }),
    { name: 'wow-wall-subscription' }
  )
);
