import { Drawer, Button, InputNumber, Empty } from 'antd';
import { DeleteOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useCartStore } from '../store/cartStore';
import { useNavigate } from 'react-router-dom';

export function CartDrawer() {
  const { items, isOpen, setOpen, removeItem, updateQuantity, total, clearCart } = useCartStore();
  const navigate = useNavigate();
  const cartTotal = total();

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Корзина</span>
          {items.length > 0 && (
            <Button type="text" size="small" danger onClick={clearCart}>Очистить</Button>
          )}
        </div>
      }
      open={isOpen}
      onClose={() => setOpen(false)}
      width={420}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
    >
      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Empty
            image={<ShoppingOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="Корзина пуста"
          >
            <Button
              type="primary"
              onClick={() => { setOpen(false); navigate('/catalog'); }}
              style={{ background: '#2D2D2D' }}
            >
              Перейти в каталог
            </Button>
          </Empty>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}>
                <img src={item.image} alt={item.name} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>{item.size}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, border: '1px solid #E5E7EB' }} />
                    {item.colorName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <InputNumber min={1} max={99} value={item.quantity} onChange={(v) => updateQuantity(item.id, v || 1)} size="small" style={{ width: 70 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{(item.price * item.quantity).toLocaleString('ru-RU')} &#8381;</span>
                      <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={() => removeItem(item.id)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '20px 24px', borderTop: '1px solid #f0f0f0', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>Итого:</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{cartTotal.toLocaleString('ru-RU')} &#8381;</span>
            </div>
            <Button
              type="primary"
              block
              size="large"
              onClick={() => { setOpen(false); navigate('/checkout'); }}
              style={{ background: '#2D2D2D', height: 48, fontWeight: 600, fontSize: 15, borderRadius: 10 }}
            >
              Оформить заказ
            </Button>
          </div>
        </>
      )}
    </Drawer>
  );
}
