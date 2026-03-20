import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { ShopLayout } from './ui/ShopLayout';

// ─── Domain: Catalog ────────────────────────────────────────────────────────
const CatalogPage = lazy(() => import('../domains/catalog/ui/CatalogPage'));
const ProductPage = lazy(() => import('../domains/catalog/ui/ProductPage'));

// ─── Domain: Order ──────────────────────────────────────────────────────────
const CheckoutPage = lazy(() => import('../domains/order/ui/CheckoutPage'));

// ─── Domain: Subscription ───────────────────────────────────────────────────
const PricingPage = lazy(() => import('../domains/subscription/ui/PricingPage'));

// ─── Domain: Constructor ────────────────────────────────────────────────────
const ConstructorPage = lazy(() => import('../domains/constructor/ui/ConstructorPage'));

// ─── Domain: Content ────────────────────────────────────────────────────────
const HomePage = lazy(() => import('../domains/content/ui/HomePage'));
const AboutPage = lazy(() => import('../domains/content/ui/AboutPage'));
const ContactsPage = lazy(() => import('../domains/content/ui/ContactsPage'));
const HowItWorksPage = lazy(() => import('../domains/content/ui/HowItWorksPage'));
const PortfolioPage = lazy(() => import('../domains/content/ui/PortfolioPage'));
const FaqPage = lazy(() => import('../domains/content/ui/FaqPage'));

const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" />
  </div>
);

export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<ShopLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/constructor" element={<ConstructorPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/faq" element={<FaqPage />} />
        </Route>
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  );
}
