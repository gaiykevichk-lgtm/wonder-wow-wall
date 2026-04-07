import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubscriptionPlan } from './types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Стартовый',
    desc: 'До 15 м² в месяц',
    price: 7000,
    period: 'мес',
    areaLimitM2: 15,
    popular: false,
    features: [
      'До 15 м² накладок в месяц',
      'Все дизайны из каталога',
      'Бесплатная доставка по Москве',
      'Замена повреждённых накладок',
      'Поддержка 9:00–18:00',
    ],
  },
  {
    id: 'popular',
    name: 'Популярный',
    desc: 'До 30 м² в месяц',
    price: 12000,
    period: 'мес',
    areaLimitM2: 30,
    popular: true,
    features: [
      'До 30 м² накладок в месяц',
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
    desc: 'Безлимитная площадь',
    price: 18000,
    period: 'мес',
    areaLimitM2: 0,
    popular: false,
    features: [
      'Безлимитная площадь накладок',
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
  activePlanId: string | null;
  subscribedAt: string | null;
  areaUsedThisMonthM2: number;

  isModalOpen: boolean;
  selectedPlanId: string | null;
  modalStep: 'select' | 'form' | 'success';

  openModal: (planId?: string) => void;
  closeModal: () => void;
  setModalStep: (step: 'select' | 'form' | 'success') => void;
  selectPlan: (planId: string) => void;
  subscribe: (planId: string) => void;
  cancelSubscription: () => void;
  useArea: (areaM2: number) => boolean;

  getActivePlan: () => SubscriptionPlan | null;
  getRemainingAreaM2: () => number;
  hasSubscription: () => boolean;
  getOverlayDiscount: () => number;
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      activePlanId: null,
      subscribedAt: null,
      areaUsedThisMonthM2: 0,

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
          areaUsedThisMonthM2: 0,
          modalStep: 'success',
        }),

      cancelSubscription: () =>
        set({
          activePlanId: null,
          subscribedAt: null,
          areaUsedThisMonthM2: 0,
        }),

      useArea: (areaM2) => {
        const state = get();
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === state.activePlanId);
        if (!plan) return false;
        if (plan.areaLimitM2 > 0 && state.areaUsedThisMonthM2 + areaM2 > plan.areaLimitM2) {
          return false;
        }
        set({ areaUsedThisMonthM2: state.areaUsedThisMonthM2 + areaM2 });
        return true;
      },

      getActivePlan: () => {
        const { activePlanId } = get();
        return SUBSCRIPTION_PLANS.find((p) => p.id === activePlanId) || null;
      },

      getRemainingAreaM2: () => {
        const state = get();
        const plan = SUBSCRIPTION_PLANS.find((p) => p.id === state.activePlanId);
        if (!plan) return 0;
        if (plan.areaLimitM2 === 0) return Infinity;
        return Math.max(0, plan.areaLimitM2 - state.areaUsedThisMonthM2);
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
