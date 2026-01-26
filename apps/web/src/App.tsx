import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Toaster } from '@/components/ui/toaster';

// Pages
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import SignupPage from '@/pages/auth/SignupPage';
import AppLayout from '@/layouts/AppLayout';
import TryOnPage from '@/pages/app/TryOnPage';
import WardrobePage from '@/pages/app/WardrobePage';
import AccountPage from '@/pages/app/AccountPage';
import ShopTogetherPage from '@/pages/app/ShopTogetherPage';
import PricingPage from '@/pages/PricingPage';
import PrivacyPage from '@/pages/legal/PrivacyPage';
import TermsPage from '@/pages/legal/TermsPage';
import RefundPage from '@/pages/legal/RefundPage';

// Store Mode Pages
import StoreLayout from '@/layouts/StoreLayout';
import StoreEntryPage from '@/pages/store/StoreEntryPage';
import StoreBrowsePage from '@/pages/store/StoreBrowsePage';
import StoreProductPage from '@/pages/store/StoreProductPage';
import StoreCartPage from '@/pages/store/StoreCartPage';
import StoreCheckoutPage from '@/pages/store/StoreCheckoutPage';
import StorePickupPage from '@/pages/store/StorePickupPage';

// Merchant Portal
import MerchantDashboardPage from '@/pages/merchant/MerchantDashboardPage';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route that redirects if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app/tryon" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { initializeAuth } = useAuthStore();

  // Initialize Supabase auth on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Legal pages */}
        <Route path="/legal/privacy" element={<PrivacyPage />} />
        <Route path="/legal/terms" element={<TermsPage />} />
        <Route path="/legal/refund" element={<RefundPage />} />

        {/* Protected app routes */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/tryon" replace />} />
          <Route path="tryon" element={<TryOnPage />} />
          <Route path="wardrobe" element={<WardrobePage />} />
          <Route path="feed" element={<ShopTogetherPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>

        {/* Store Mode routes (no auth required - QR scan entry) */}
        <Route path="/store" element={<StoreEntryPage />} />
        <Route path="/store/:storeSlug" element={<StoreEntryPage />} />
        <Route element={<StoreLayout />}>
          <Route path="/store/browse" element={<StoreBrowsePage />} />
          <Route path="/store/product/:productId" element={<StoreProductPage />} />
          <Route path="/store/cart" element={<StoreCartPage />} />
          <Route path="/store/checkout" element={<StoreCheckoutPage />} />
        </Route>
        <Route path="/store/pickup/:passCode" element={<StorePickupPage />} />
        <Route path="/store/pickup" element={<StorePickupPage />} />

        {/* Merchant Portal */}
        <Route path="/merchant" element={<MerchantDashboardPage />} />
        <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </>
  );
}
