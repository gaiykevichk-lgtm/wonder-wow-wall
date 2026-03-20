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
