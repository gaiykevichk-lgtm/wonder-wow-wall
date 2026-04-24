import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { ShopLayout } from './ui/ShopLayout';
import { RequireAuth } from '../domains/auth/ui/RequireAuth';
import { RequireAdmin } from '../domains/admin/ui/RequireAdmin';

// ─── Domain: Catalog ────────────────────────────────────────────────────────
const CatalogPage = lazy(() => import('../domains/catalog/ui/CatalogPage'));
const ProductPage = lazy(() => import('../domains/catalog/ui/ProductPage'));

// ─── Domain: Order ──────────────────────────────────────────────────────────
const CheckoutPage = lazy(() => import('../domains/order/ui/CheckoutPage'));

// ─── Domain: Subscription ───────────────────────────────────────────────────
const PricingPage = lazy(() => import('../domains/subscription/ui/PricingPage'));

// ─── Domain: Constructor ────────────────────────────────────────────────────
const ConstructorPage = lazy(() => import('../domains/constructor/ui/ConstructorPage'));

// ─── Domain: Visualizer ─────────────────────────────────────────────────────
const PhotoEditorPage = lazy(() => import('../domains/visualizer/ui/PhotoEditorPage'));

// ─── Domain: Content ────────────────────────────────────────────────────────
const HomePage = lazy(() => import('../domains/content/ui/HomePage'));
const AboutPage = lazy(() => import('../domains/content/ui/AboutPage'));
const ContactsPage = lazy(() => import('../domains/content/ui/ContactsPage'));
const HowItWorksPage = lazy(() => import('../domains/content/ui/HowItWorksPage'));
const PortfolioPage = lazy(() => import('../domains/content/ui/PortfolioPage'));
const FaqPage = lazy(() => import('../domains/content/ui/FaqPage'));
const BlogPage = lazy(() => import('../domains/content/ui/BlogPage'));
const BlogPostPage = lazy(() => import('../domains/content/ui/BlogPostPage'));
const PrivacyPolicyPage = lazy(() => import('../domains/content/ui/PrivacyPolicyPage'));

// ─── Domain: Auth ───────────────────────────────────────────────────────────
const LoginPage = lazy(() => import('../domains/auth/ui/LoginPage'));
const RegisterPage = lazy(() => import('../domains/auth/ui/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('../domains/auth/ui/ForgotPasswordPage'));

// ─── Domain: Admin (Phase 1 placeholder; full layout in Phase 2) ───────────
const AdminPlaceholderPage = lazy(() => import('../domains/admin/ui/AdminPlaceholderPage'));

// ─── Domain: Account ────────────────────────────────────────────────────────
const AccountLayout = lazy(() => import('../domains/account/ui/AccountLayout'));
const ProfileSection = lazy(() => import('../domains/account/ui/ProfileSection'));
const OrdersSection = lazy(() => import('../domains/account/ui/OrdersSection'));
const ProjectsSection = lazy(() => import('../domains/account/ui/ProjectsSection'));
const FavoritesSection = lazy(() => import('../domains/account/ui/FavoritesSection'));
const AccountSubscriptionSection = lazy(() => import('../domains/account/ui/AccountSubscriptionSection'));
const AccountConstructorSection = lazy(() => import('../domains/account/ui/AccountConstructorSection'));
const NotificationsSection = lazy(() => import('../domains/account/ui/NotificationsSection'));

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
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/constructor" element={<ConstructorPage />} />
          <Route path="/visualizer" element={<PhotoEditorPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/how-it-works" element={<HowItWorksPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected: Account */}
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountLayout />
              </RequireAuth>
            }
          >
            <Route index element={<ProfileSection />} />
            <Route path="orders" element={<OrdersSection />} />
            <Route path="projects" element={<ProjectsSection />} />
            <Route path="constructor" element={<AccountConstructorSection />} />
            <Route path="favorites" element={<FavoritesSection />} />
            <Route path="notifications" element={<NotificationsSection />} />
            <Route path="subscription" element={<AccountSubscriptionSection />} />
          </Route>
        </Route>

        {/* Admin — own layout (not inside <ShopLayout>). */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPlaceholderPage />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  );
}
