export interface Order {
  id: string;
  number: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  address: string;
}

export type OrderStatus = 'placed' | 'confirmed' | 'in_progress' | 'delivered' | 'installed';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Оформлен',
  confirmed: 'Подтверждён',
  in_progress: 'В работе',
  delivered: 'Доставлен',
  installed: 'Установлен',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  placed: 'blue',
  confirmed: 'cyan',
  in_progress: 'orange',
  delivered: 'green',
  installed: 'default',
};

export interface OrderItem {
  id: string;
  name: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

export interface SavedProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  wallCols: number;
  wallRows: number;
  wallColor: string;
  panels: SavedProjectPanel[];
  totalPrice: number;
}

export interface SavedProjectPanel {
  id: string;
  designId: string;
  designName: string;
  designImage: string;
  col: number;
  row: number;
  widthCells: number;
  heightCells: number;
  sizeMm: string;
  color: string;
  colorName: string;
}
