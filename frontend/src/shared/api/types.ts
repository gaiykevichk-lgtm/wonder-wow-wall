// ─── API Response Types (match backend Pydantic schemas) ───────────────────

// Auth
export interface ApiUserResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface ApiAuthResponse {
  user: ApiUserResponse;
  token: string;
}

// Catalog
export interface ApiColor {
  hex: string;
  name: string;
}

export interface ApiDesign {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  style: string;
  image: string;
  description: string;
  price: number;
  colors: ApiColor[];
  rating: number;
  reviews_count: number;
  is_new: boolean;
  is_popular: boolean;
}

export interface ApiDesignListResponse {
  items: ApiDesign[];
  total: number;
}

export interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  image: string;
  count: number;
}

export interface ApiReview {
  id: string;
  design_id: string;
  user_name: string;
  rating: number;
  text: string;
  created_at: string;
}

// Orders
export interface ApiOrderItem {
  id: string;
  design_name: string;
  design_image: string;
  size_key: string;
  color: string;
  quantity: number;
  unit_price: number;
}

export interface ApiOrder {
  id: string;
  number: string;
  status: string;
  total: number;
  address: string;
  items: ApiOrderItem[];
  created_at: string;
}

export interface ApiCreateOrderRequest {
  items: {
    design_id: string;
    design_name: string;
    design_image?: string;
    size_key: string;
    color?: string;
    quantity?: number;
    unit_price?: number;
  }[];
  address: {
    city: string;
    street: string;
    building: string;
    apartment?: string;
    postal_code?: string;
  };
}

// Subscriptions
export interface ApiPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  overlays_per_month: number;
  popular: boolean;
  features: string[];
}

export interface ApiSubscription {
  id: string;
  plan_id: string;
  status: string;
  overlays_used_this_month: number;
  remaining_overlays: number;
  started_at: string;
  expires_at: string;
}

// Projects
export interface ApiProject {
  id: string;
  name: string;
  wall_cols: number;
  wall_rows: number;
  wall_color: string;
  panels: Record<string, unknown>[];
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface ApiProjectRequest {
  name: string;
  wall_cols?: number;
  wall_rows?: number;
  wall_color?: string;
  panels?: Record<string, unknown>[];
  total_price?: number;
}

// Calculator / Contacts
export interface ApiCalculatorRequest {
  panels: Record<string, unknown>[];
  has_subscription?: boolean;
}

export interface ApiContactRequest {
  name: string;
  email: string;
  phone?: string;
  message: string;
}
