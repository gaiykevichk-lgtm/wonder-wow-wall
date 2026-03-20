export interface PanelProduct {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  style: string;
  material: string;
  price: number;
  priceUnit: string;
  image: string;
  gallery: string[];
  description: string;
  specs: Record<string, string>;
  colors: { hex: string; name: string }[];
  sizes: { width: number; height: number; label: string }[];
  rating: number;
  reviews: number;
  badge?: string;
  inStock: boolean;
  room: string[];
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  area: number;
  color: string;
  colorName: string;
  size: string;
}

export interface Category {
  key: string;
  label: string;
  image: string;
  count: number;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  avatar?: string;
}

export interface ConstructorPanel {
  id: string;
  productId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  name: string;
  price: number;
  image: string;
}
