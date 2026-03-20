import { Card, Typography, Empty, Button, Rate, Tag } from 'antd';
import { HeartFilled, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAccountStore } from '../model/accountStore';
import { products } from '../../catalog/model/data';
import { useCartStore } from '../../order/model/cartStore';

const { Title, Text } = Typography;
const GREEN = '#4CAF50';

export default function FavoritesSection() {
  const favoriteIds = useAccountStore((s) => s.favoriteIds);
  const toggleFavorite = useAccountStore((s) => s.toggleFavorite);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();

  const favoriteProducts = products.filter((p) => favoriteIds.includes(p.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={3} style={{ margin: 0 }}>Избранное</Title>

      {favoriteProducts.length === 0 ? (
        <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40 }}>
          <Empty
            description={
              <div>
                <Text type="secondary" style={{ fontSize: 15 }}>Нет избранных дизайнов</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Нажмите ❤ на карточке товара, чтобы добавить в избранное
                </Text>
              </div>
            }
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              onClick={() => navigate('/catalog')}
              style={{ background: GREEN, borderColor: GREEN, borderRadius: 8, marginTop: 8 }}
            >
              Перейти в каталог
            </Button>
          </Empty>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {favoriteProducts.map((product) => (
            <Card
              key={product.id}
              hoverable
              style={{ borderRadius: 12, overflow: 'hidden' }}
              cover={
                <div style={{ position: 'relative', height: 180, background: '#F5F5F5' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: `linear-gradient(135deg, ${product.colors[0]?.hex || '#ccc'} 0%, ${product.colors[1]?.hex || '#eee'} 100%)`,
                    }}
                  />
                  <Button
                    type="text"
                    icon={<HeartFilled style={{ color: '#ff4d4f', fontSize: 20 }} />}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(product.id); }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', borderRadius: '50%' }}
                  />
                  {product.badge && (
                    <Tag color="green" style={{ position: 'absolute', top: 8, left: 8 }}>{product.badge}</Tag>
                  )}
                </div>
              }
              onClick={() => navigate(`/product/${product.id}`)}
            >
              <Title level={5} style={{ margin: '0 0 4px', fontSize: 14 }}>{product.name}</Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Rate disabled value={product.rating} style={{ fontSize: 12 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>({product.reviews})</Text>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 16, color: GREEN }}>
                  {product.price.toLocaleString('ru-RU')} ₽
                </Text>
                <Button
                  type="primary"
                  size="small"
                  icon={<ShoppingCartOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem({
                      id: product.id,
                      productId: product.id,
                      name: product.name,
                      image: product.image,
                      price: product.price,
                      area: 0,
                      color: product.colors[0]?.hex || '',
                      colorName: product.colors[0]?.name || '',
                      size: product.sizes[0]?.label || '',
                    });
                  }}
                  style={{ background: GREEN, borderColor: GREEN }}
                >
                  В корзину
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
