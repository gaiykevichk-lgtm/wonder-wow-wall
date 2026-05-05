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

// ─── Domain: Admin (Phase 2 layout + section placeholders) ─────────────────
const AdminLayout = lazy(() => import('../domains/admin/ui/AdminLayout'));
const AdminDashboardPage = lazy(() => import('../domains/admin/ui/AdminDashboardPage'));
const AdminOrdersPage = lazy(() => import('../domains/admin/ui/AdminOrdersPage'));
const AdminOrderDetailPage = lazy(
  () => import('../domains/admin/ui/AdminOrderDetailPage'),
);
const AdminUsersPage = lazy(() => import('../domains/admin/ui/AdminUsersPage'));
const AdminUserDetailPage = lazy(
  () => import('../domains/admin/ui/AdminUserDetailPage'),
);
const AdminCatalogPage = lazy(() => import('../domains/admin/ui/AdminCatalogPage'));
const AdminShopPage = lazy(() => import('../domains/admin/ui/AdminShopPage'));
const AdminUploadPage = lazy(() => import('../domains/admin/ui/AdminUploadPage'));
const AdminTexturesPage = lazy(() => import('../domains/admin/ui/AdminTexturesPage'));
const AdminRecommendationsPage = lazy(() => import('../domains/admin/ui/AdminRecommendationsPage'));
const AdminAuditPage = lazy(() => import('../domains/admin/ui/AdminAuditPage'));

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

        {/* Admin — own layout (not inside <ShopLayout>). `<RequireAdmin>`
            wraps the layout; nested routes render inside <Outlet>. */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="catalog" element={<AdminCatalogPage />} />
          <Route path="textures" element={<AdminTexturesPage />} />
          <Route path="shop" element={<AdminShopPage />} />
          <Route path="upload" element={<AdminUploadPage />} />
          <Route path="recommendations" element={<AdminRecommendationsPage />} />
          <Route path="audit" element={<AdminAuditPage />} />
        </Route>

        <Route path="*" element={<HomePage />} />
      </Routes>
    </Suspense>
  );
}
