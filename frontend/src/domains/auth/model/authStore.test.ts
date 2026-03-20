import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

const reset = () => useAuthStore.setState({ user: null, token: null, isAuth: false });

describe('authStore', () => {
  beforeEach(() => {
    reset();
    localStorage.clear();
  });

  it('starts unauthenticated', () => {
    const s = useAuthStore.getState();
    expect(s.isAuth).toBe(false);
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
  });

  it('login sets user, token, isAuth', async () => {
    const ok = await useAuthStore.getState().login({ email: 'test@mail.ru', password: '123456' });
    expect(ok).toBe(true);

    const s = useAuthStore.getState();
    expect(s.isAuth).toBe(true);
    expect(s.token).toBe('mock-jwt-token');
    expect(s.user).not.toBeNull();
    expect(s.user!.email).toBe('test@mail.ru');
    expect(s.user!.name).toBe('test');
  });

  it('register sets user with name and phone', async () => {
    const ok = await useAuthStore.getState().register({
      name: 'Иван',
      email: 'ivan@mail.ru',
      phone: '+7 (999) 123-45-67',
      password: 'secret',
    });
    expect(ok).toBe(true);

    const s = useAuthStore.getState();
    expect(s.isAuth).toBe(true);
    expect(s.user!.name).toBe('Иван');
    expect(s.user!.phone).toBe('+7 (999) 123-45-67');
    expect(s.user!.email).toBe('ivan@mail.ru');
  });

  it('logout clears all auth state', async () => {
    await useAuthStore.getState().login({ email: 'a@b.com', password: 'x' });
    expect(useAuthStore.getState().isAuth).toBe(true);

    useAuthStore.getState().logout();

    const s = useAuthStore.getState();
    expect(s.isAuth).toBe(false);
    expect(s.user).toBeNull();
    expect(s.token).toBeNull();
  });

  it('updateProfile merges partial user data', async () => {
    await useAuthStore.getState().login({ email: 'a@b.com', password: 'x' });
    useAuthStore.getState().updateProfile({ name: 'Новое Имя', phone: '+7 (111) 000-00-00' });

    const u = useAuthStore.getState().user!;
    expect(u.name).toBe('Новое Имя');
    expect(u.phone).toBe('+7 (111) 000-00-00');
    expect(u.email).toBe('a@b.com'); // unchanged
  });

  it('updateProfile does nothing when not logged in', () => {
    useAuthStore.getState().updateProfile({ name: 'Test' });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('addAddress appends a new address', async () => {
    await useAuthStore.getState().login({ email: 'a@b.com', password: 'x' });
    useAuthStore.getState().addAddress({
      label: 'Дом',
      city: 'Москва',
      street: 'Тверская',
      building: '1',
      apartment: '10',
      postalCode: '101000',
      isDefault: true,
    });

    const addrs = useAuthStore.getState().user!.addresses;
    expect(addrs).toHaveLength(1);
    expect(addrs[0].label).toBe('Дом');
    expect(addrs[0].isDefault).toBe(true);
    expect(addrs[0].id).toMatch(/^addr-/);
  });

  it('removeAddress removes by id', async () => {
    await useAuthStore.getState().login({ email: 'a@b.com', password: 'x' });
    useAuthStore.getState().addAddress({
      label: 'A', city: 'M', street: 'S', building: '1', postalCode: '100', isDefault: false,
    });
    useAuthStore.getState().addAddress({
      label: 'B', city: 'M', street: 'S', building: '2', postalCode: '200', isDefault: false,
    });

    const addrs = useAuthStore.getState().user!.addresses;
    expect(addrs).toHaveLength(2);

    useAuthStore.getState().removeAddress(addrs[0].id);
    expect(useAuthStore.getState().user!.addresses).toHaveLength(1);
    expect(useAuthStore.getState().user!.addresses[0].label).toBe('B');
  });

  it('setDefaultAddress sets only one as default', async () => {
    await useAuthStore.getState().login({ email: 'a@b.com', password: 'x' });
    useAuthStore.getState().addAddress({
      label: 'A', city: 'M', street: 'S', building: '1', postalCode: '100', isDefault: true,
    });
    useAuthStore.getState().addAddress({
      label: 'B', city: 'M', street: 'S', building: '2', postalCode: '200', isDefault: false,
    });

    const addrs = useAuthStore.getState().user!.addresses;
    useAuthStore.getState().setDefaultAddress(addrs[1].id);

    const updated = useAuthStore.getState().user!.addresses;
    expect(updated[0].isDefault).toBe(false);
    expect(updated[1].isDefault).toBe(true);
  });
});
