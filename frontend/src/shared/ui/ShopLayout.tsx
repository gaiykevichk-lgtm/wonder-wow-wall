import { Outlet } from 'react-router-dom';
import { ShopHeader } from './ShopHeader';
import { ShopFooter } from './ShopFooter';
import { CartDrawer } from './CartDrawer';
import { SubscriptionModal } from './SubscriptionModal';

export function ShopLayout() {
  return (
    <>
      <ShopHeader />
      <main style={{ minHeight: '100vh' }}>
        <Outlet />
      </main>
      <ShopFooter />
      <CartDrawer />
      <SubscriptionModal />
    </>
  );
}
