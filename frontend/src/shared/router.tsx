import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { ShopLayout } from './ui/ShopLayout';

const HomePage = lazy(() => import('../pages/home/HomePage'));
const CatalogPage = lazy(() => import('../pages/catalog/CatalogPage'));
const ProductPage = lazy(() => import('../pages/product/ProductPage'));
const ConstructorPage = lazy(() => import('../pages/constructor/ConstructorPage'));
const CheckoutPage = lazy(() => import('../pages/checkout/CheckoutPage'));
const AboutPage = lazy(() => import('../pages/about/AboutPage'));
const ContactsPage = lazy(() => import('../pages/contacts/ContactsPage'));
const HowItWorksPage = lazy(() => import('../pages/how-it-works/HowItWorksPage'));
const PortfolioPage = lazy(() => import('../pages/portfolio/PortfolioPage'));
const PricingPage = lazy(() => import('../pages/pricing/PricingPage'));
const FaqPage = lazy(() => import('../pages/faq/FaqPage'));

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
