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
  colorId: string;
  textureName: string;
  textureId: string;
  sizeKey: string;
  size: string;
}

export type CartItemInput = Omit<CartItem, 'quantity' | 'colorId' | 'textureName' | 'textureId' | 'sizeKey'> & {
  colorId?: string;
  textureName?: string;
  textureId?: string;
  sizeKey?: string;
};
