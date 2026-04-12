import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BannerManager } from './pages/BannerManager';
import { BannersBySize } from './pages/BannersBySize';
import { TemplateGallery } from './pages/TemplateGallery';
import { TemplatesBySize } from './pages/TemplatesBySize';
import { BannerEditor } from './pages/BannerEditor';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { AuthPage } from './pages/AuthPage';
import { AuthCallback } from './pages/AuthCallback';
import { Tokushoho } from './pages/legal/Tokushoho';
import { PrivacyPolicy } from './pages/legal/PrivacyPolicy';
import { TermsOfService } from './pages/legal/TermsOfService';
import { SecurityPolicy } from './pages/legal/SecurityPolicy';
import { AboutUs } from './pages/AboutUs';
import { Contact } from './pages/Contact';
import { MyPage } from './pages/MyPage';
import { UpgradePage } from './pages/UpgradePage';
import { AdminDashboard } from './pages/AdminDashboard';
import { AuthProvider } from './contexts/AuthContext';
import { CookieConsent } from './components/CookieConsent';
import { ScrollToTop } from './components/ScrollToTop';
import { queryClient } from './lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<TemplateGallery />} />
            <Route path="/templates/:sizeKey" element={<TemplatesBySize />} />
            <Route path="/mydesign" element={<BannerManager />} />
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
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
          <CookieConsent />
        </BrowserRouter>
      </AuthProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
