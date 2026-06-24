import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { CookieConsent } from './components/CookieConsent';
import { ScrollToTop } from './components/ScrollToTop';
import { queryClient } from './lib/queryClient';

const TemplateGallery = lazy(() => import('./pages/TemplateGallery').then((module) => ({ default: module.TemplateGallery })));
const TemplatesBySize = lazy(() => import('./pages/TemplatesBySize').then((module) => ({ default: module.TemplatesBySize })));
const BannerManager = lazy(() => import('./pages/BannerManager').then((module) => ({ default: module.BannerManager })));
const FactoryProjectManager = lazy(() => import('./pages/FactoryProjectManager').then((module) => ({ default: module.FactoryProjectManager })));
const BannersBySize = lazy(() => import('./pages/BannersBySize').then((module) => ({ default: module.BannersBySize })));
const BannerEditor = lazy(() => import('./pages/BannerEditor').then((module) => ({ default: module.BannerEditor })));
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })));
const AuthCallback = lazy(() => import('./pages/AuthCallback').then((module) => ({ default: module.AuthCallback })));
const PaymentSuccess = lazy(() => import('./pages/PaymentSuccess').then((module) => ({ default: module.PaymentSuccess })));
const AboutUs = lazy(() => import('./pages/AboutUs').then((module) => ({ default: module.AboutUs })));
const Contact = lazy(() => import('./pages/Contact').then((module) => ({ default: module.Contact })));
const MyPage = lazy(() => import('./pages/MyPage').then((module) => ({ default: module.MyPage })));
const UpgradePage = lazy(() => import('./pages/UpgradePage').then((module) => ({ default: module.UpgradePage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ContentFactory = lazy(() => import('./pages/ContentFactory').then((module) => ({ default: module.ContentFactory })));
const CoverLab = lazy(() => import('./pages/CoverLab').then((module) => ({ default: module.CoverLab })));
const StorageCleanup = lazy(() => import('./pages/StorageCleanup').then((module) => ({ default: module.StorageCleanup })));
const Tokushoho = lazy(() => import('./pages/legal/Tokushoho').then((module) => ({ default: module.Tokushoho })));
const PrivacyPolicy = lazy(() => import('./pages/legal/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService').then((module) => ({ default: module.TermsOfService })));
const SecurityPolicy = lazy(() => import('./pages/legal/SecurityPolicy').then((module) => ({ default: module.SecurityPolicy })));

const Devtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-sm text-slate-600">
      Loading...
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<TemplateGallery />} />
              <Route path="/templates/:sizeKey" element={<TemplatesBySize />} />
              <Route path="/mydesign" element={<BannerManager />} />
              <Route path="/mydesign/factory" element={<FactoryProjectManager />} />
              <Route path="/banners" element={<BannerManager />} />
              <Route path="/banners/:sizeKey" element={<BannersBySize />} />
              <Route path="/banner/:id" element={<BannerEditor />} />
              <Route path="/banner" element={<BannerEditor />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/success" element={<PaymentSuccess />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/legal/specified-commercial-transactions-act" element={<Tokushoho />} />
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<TermsOfService />} />
              <Route path="/legal/security" element={<SecurityPolicy />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/mypage" element={<MyPage />} />
              <Route path="/plans" element={<UpgradePage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/content-factory" element={<ContentFactory />} />
              <Route path="/admin/cover-lab" element={<CoverLab />} />
              <Route path="/admin/storage-cleanup" element={<StorageCleanup />} />
            </Routes>
          </Suspense>
          <CookieConsent />
        </BrowserRouter>
      </AuthProvider>
      {Devtools ? (
        <Suspense fallback={null}>
          <Devtools initialIsOpen={false} />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}

export default App;
