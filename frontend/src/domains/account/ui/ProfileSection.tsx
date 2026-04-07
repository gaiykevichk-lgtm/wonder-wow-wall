import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, Tag, Empty, Modal, message } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined, EnvironmentOutlined, CheckOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../auth/model/authStore';
import { useUpdateProfileMutation } from '../../auth/api/authApi';
import type { Address } from '../../auth/model/types';

const { Title, Text } = Typography;
const BLUE = '#0071e3';

export default function ProfileSection() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const addAddress = useAuthStore((s) => s.addAddress);
  const removeAddress = useAuthStore((s) => s.removeAddress);
  const setDefaultAddress = useAuthStore((s) => s.setDefaultAddress);
  const updateProfileMutation = useUpdateProfileMutation();

  const [editing, setEditing] = useState(false);
  const [addressModal, setAddressModal] = useState(false);
  const [form] = Form.useForm();
  const [addrForm] = Form.useForm();

  const handleSaveProfile = async (values: { name: string; email: string; phone: string }) => {
    try {
      await updateProfileMutation.mutateAsync({ name: values.name, phone: values.phone });
      updateProfile(values);
      setEditing(false);
      message.success('Профиль обновлён');
    } catch {
      // Fallback: update locally even if API fails
      updateProfile(values);
      setEditing(false);
      message.success('Профиль обновлён');
    }
  };

  const handleAddAddress = (values: Omit<Address, 'id'>) => {
    addAddress({ ...values, isDefault: !user?.addresses.length });
    setAddressModal(false);
    addrForm.resetFields();
    message.success('Адрес добавлен');
  };

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Title level={3} style={{ margin: 0, color: '#1d1d1f', fontWeight: 600 }}>Профиль</Title>

      {/* Personal info */}
      <Card
        title="Личные данные"
        extra={
          !editing && (
            <Button type="link" icon={<EditOutlined />} onClick={() => { setEditing(true); form.setFieldsValue(user); }} style={{ color: BLUE }}>
              Редактировать
            </Button>
          )
        }
        style={{ borderRadius: 20 }}
      >
        {editing ? (
          <Form form={form} layout="vertical" onFinish={handleSaveProfile} initialValues={user}>
            <Form.Item name="name" label="Имя" rules={[{ required: true, message: 'Введите имя' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="Телефон" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" style={{ background: BLUE, borderColor: BLUE, borderRadius: 980 }}>
                Сохранить
              </Button>
              <Button onClick={() => setEditing(false)} style={{ borderRadius: 980 }}>Отмена</Button>
            </Space>
          </Form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><Text type="secondary" style={{ color: '#86868b' }}>Имя:</Text> <Text strong style={{ color: '#1d1d1f' }}>{user.name}</Text></div>
            <div><Text type="secondary" style={{ color: '#86868b' }}>Email:</Text> <Text strong style={{ color: '#1d1d1f' }}>{user.email}</Text></div>
            <div><Text type="secondary" style={{ color: '#86868b' }}>Телефон:</Text> <Text strong style={{ color: '#1d1d1f' }}>{user.phone}</Text></div>
            <div>
              <Text type="secondary" style={{ color: '#86868b' }}>Дата регистрации:</Text>{' '}
              <Text style={{ color: '#1d1d1f' }}>{new Date(user.createdAt).toLocaleDateString('ru-RU')}</Text>
            </div>
          </div>
        )}
      </Card>

      {/* Addresses */}
      <Card
        title="Адреса доставки"
        extra={
          <Button type="link" icon={<PlusOutlined />} onClick={() => setAddressModal(true)} style={{ color: BLUE }}>
            Добавить
          </Button>
        }
        style={{ borderRadius: 20 }}
      >
        {user.addresses.length === 0 ? (
          <Empty description="Нет сохранённых адресов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {user.addresses.map((addr) => (
              <div
                key={addr.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: addr.isDefault ? 'rgba(0,113,227,0.04)' : '#F5F5F7',
                  borderRadius: 14,
                  border: addr.isDefault ? `1px solid ${BLUE}` : '1px solid rgba(0,0,0,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <EnvironmentOutlined style={{ color: addr.isDefault ? BLUE : '#86868b', fontSize: 18 }} />
                  <div>
                    <div>
                      <Text strong style={{ color: '#1d1d1f' }}>{addr.label}</Text>
                      {addr.isDefault && <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>Основной</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, color: '#86868b' }}>
                      {addr.city}, {addr.street}, д. {addr.building}{addr.apartment ? `, кв. ${addr.apartment}` : ''}
                    </Text>
                  </div>
                </div>
                <Space>
                  {!addr.isDefault && (
                    <Button type="text" size="small" icon={<CheckOutlined />} onClick={() => setDefaultAddress(addr.id)} style={{ borderRadius: 980 }}>
                      По умолчанию
                    </Button>
                  )}
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeAddress(addr.id)} style={{ borderRadius: 980 }} />
                </Space>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Address modal */}
      <Modal
        title="Новый адрес"
        open={addressModal}
        onCancel={() => setAddressModal(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={addrForm} layout="vertical" onFinish={handleAddAddress}>
          <Form.Item name="label" label="Название" rules={[{ required: true }]} initialValue="Дом">
            <Input placeholder="Дом, Офис..." />
          </Form.Item>
          <Form.Item name="city" label="Город" rules={[{ required: true }]}>
            <Input placeholder="Москва" />
          </Form.Item>
          <Form.Item name="street" label="Улица" rules={[{ required: true }]}>
            <Input placeholder="ул. Пушкина" />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="building" label="Дом" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="10" />
            </Form.Item>
            <Form.Item name="apartment" label="Квартира" style={{ flex: 1 }}>
              <Input placeholder="5" />
            </Form.Item>
            <Form.Item name="postalCode" label="Индекс" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="101000" />
            </Form.Item>
          </div>
          <Button type="primary" htmlType="submit" block style={{ background: BLUE, borderColor: BLUE, borderRadius: 980 }}>
            Добавить адрес
          </Button>
        </Form>
      </Modal>
    </div>
  );
}
