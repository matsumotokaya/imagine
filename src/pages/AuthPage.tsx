import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';

type AuthTab = 'login' | 'signup';
type AuthView = 'form' | 'reset-password' | 'email-sent' | 'reset-sent' | 'update-password' | 'password-updated';

export const AuthPage = () => {
  const { t } = useTranslation(['auth', 'common']);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword, updatePassword } = useAuth();

  const redirectTo = searchParams.get('redirect') || '/';
  const sessionExpired = searchParams.get('reason') === 'session-expired';
  const initialTab = sessionExpired ? 'login' : (searchParams.get('tab') as AuthTab) || 'login';
  const initialView = sessionExpired ? 'form' : (searchParams.get('view') as AuthView) || 'form';

  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in (skip for password update flow)
  if (user && view !== 'update-password') {
    navigate(redirectTo, { replace: true });
    return null;
  }

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError(t('auth:invalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth:passwordTooShort'));
      return;
    }

    setIsSubmitting(true);
    const result = await signInWithEmail(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(t('auth:loginError'));
    } else {
      navigate(redirectTo, { replace: true });
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError(t('auth:invalidEmail'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth:passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth:passwordsDoNotMatch'));
      return;
    }
    if (!agreeToTerms) {
      setError(t('auth:agreeToTermsRequired'));
      return;
    }

    setIsSubmitting(true);
    const result = await signUpWithEmail(email, password);
    setIsSubmitting(false);

    if (result.error) {
      setError(t('auth:signupError'));
    } else if (result.needsConfirmation) {
      setView('email-sent');
    } else {
      navigate(redirectTo, { replace: true });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError(t('auth:invalidEmail'));
      return;
    }

    setIsSubmitting(true);
    const result = await resetPassword(email);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setView('reset-sent');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t('auth:passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth:passwordsDoNotMatch'));
      return;
    }

    setIsSubmitting(true);
    const result = await updatePassword(password);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setView('password-updated');
    }
  };

  // Password updated success view
  if (view === 'password-updated') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('auth:passwordUpdated')}</h2>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              {t('auth:goToHome')}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Update password form view (after clicking reset link in email)
  if (view === 'update-password') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2 text-center">{t('auth:setNewPassword')}</h2>
            <p className="text-gray-400 text-sm mb-6 text-center">{t('auth:setNewPasswordDescription')}</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('auth:newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 pr-12 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('auth:confirmPassword')}</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 pr-12 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? '...' : t('auth:updatePassword')}
              </button>
            </form>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Email verification sent view
  if (view === 'email-sent') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('auth:emailVerificationSent')}</h2>
            <p className="text-gray-400 text-sm mb-6">{email}</p>
            <button
              onClick={() => { setView('form'); setTab('login'); }}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              {t('auth:backToLogin')}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Password reset sent view
  if (view === 'reset-sent') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{t('auth:resetPasswordSent')}</h2>
            <p className="text-gray-400 text-sm mb-6">{email}</p>
            <button
              onClick={() => { setView('form'); setTab('login'); }}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              {t('auth:backToLogin')}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Password reset form view
  if (view === 'reset-password') {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2 text-center">{t('auth:resetPassword')}</h2>
            <p className="text-gray-400 text-sm mb-6 text-center">{t('auth:resetPasswordDescription')}</p>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('auth:email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#2b2b2b] border border-[#3b3b3b] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {isSubmitting ? '...' : t('auth:sendResetLink')}
              </button>
            </form>

            <button
              onClick={() => { setView('form'); setError(null); }}
              className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium block mx-auto"
            >
              {t('auth:backToLogin')}
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Main login/signup form
  return (
    <div className="min-h-screen bg-[#111111] flex flex-col">
      <Header />
      <div className="flex-1 px-4 py-8">
        <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,480px)] lg:items-stretch">
          <section className="flex h-full flex-col rounded-[28px] border border-[#2a2a2a] bg-[#161616] p-8 sm:p-10 lg:p-12">
            <p className="text-sm font-medium tracking-[0.24em] text-gray-400">
              {t('auth:serviceEyebrow')}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-[0.08em] text-white sm:text-5xl">
              {t('auth:serviceTitle')}
            </h1>
            <div className="mt-8 space-y-4 text-sm leading-7 text-gray-300 sm:text-base">
              <p>{t('auth:serviceDescription')}</p>
              <p>{t('auth:servicePremiumDescription')}</p>
            </div>
            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl border border-[#2b2b2b] bg-[#1b1b1b] p-5">
                <h2 className="text-base font-semibold text-white">{t('auth:guestTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-300">{t('auth:guestDescription')}</p>
              </div>
              <div className="rounded-2xl border border-[#2b2b2b] bg-[#1b1b1b] p-5">
                <h2 className="text-base font-semibold text-white">{t('auth:memberTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-300">{t('auth:memberDescription')}</p>
              </div>
              <div className="rounded-2xl border border-[#3c3320] bg-[#211b10] p-5">
                <h2 className="text-base font-semibold text-[#f5d38a]">{t('auth:premiumMemberTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-200">{t('auth:premiumMemberDescription')}</p>
              </div>
            </div>
          </section>

          <div className="flex h-full w-full flex-col rounded-2xl bg-[#1a1a1a] p-8 lg:justify-center">
            {/* Tab switcher */}
            <div className="mb-6 flex rounded-lg bg-[#2b2b2b] p-1">
              <button
                onClick={() => { setTab('login'); setError(null); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === 'login'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('auth:login')}
              </button>
              <button
                onClick={() => { setTab('signup'); setError(null); }}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                  tab === 'signup'
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {t('auth:signUp')}
              </button>
            </div>

            {/* OAuth buttons */}
            <div className="mb-6 space-y-3">
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-100"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('auth:signInWithGoogle')}
              </button>

              <button
                onClick={signInWithApple}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-[#3b3b3b] bg-black px-4 py-3 font-medium text-white transition-colors hover:bg-gray-900"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                {t('auth:signInWithApple')}
              </button>
            </div>

            {/* Divider */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex-1 border-t border-[#3b3b3b]" />
              <span className="text-sm text-gray-500">{t('auth:orContinueWith')}</span>
              <div className="flex-1 border-t border-[#3b3b3b]" />
            </div>

            {/* Error message */}
            {sessionExpired && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                {t('auth:sessionExpired')}
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Email/Password form */}
            <form onSubmit={tab === 'login' ? handleEmailLogin : handleEmailSignup} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{t('auth:email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#3b3b3b] bg-[#2b2b2b] px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{t('auth:password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#3b3b3b] bg-[#2b2b2b] px-4 py-3 pr-12 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {tab === 'signup' && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-300">{t('auth:confirmPassword')}</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-[#3b3b3b] bg-[#2b2b2b] px-4 py-3 pr-12 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      checked={agreeToTerms}
                      onChange={(e) => setAgreeToTerms(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-600 bg-[#2b2b2b] text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-400">
                      {t('auth:agreeToTerms')}{' '}
                      <Link to="/legal/terms" className="text-indigo-400 hover:text-indigo-300">{t('auth:termsOfService')}</Link>
                      {' '}{t('auth:and')}{' '}
                      <Link to="/legal/privacy" className="text-indigo-400 hover:text-indigo-300">{t('auth:privacyPolicy')}</Link>
                    </span>
                  </label>
                </>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-indigo-600 py-3 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? '...' : tab === 'login' ? t('auth:login') : t('auth:createAccount')}
              </button>
            </form>

            {/* Footer links */}
            <div className="mt-4 text-center text-sm">
              {tab === 'login' ? (
                <>
                  <button
                    onClick={() => { setView('reset-password'); setError(null); }}
                    className="mx-auto mb-2 block text-gray-400 hover:text-gray-300"
                  >
                    {t('auth:forgotPassword')}
                  </button>
                  <p className="text-gray-500">
                    {t('auth:dontHaveAccount')}{' '}
                    <button onClick={() => { setTab('signup'); setError(null); }} className="font-medium text-indigo-400 hover:text-indigo-300">
                      {t('auth:signUp')}
                    </button>
                  </p>
                </>
              ) : (
                <p className="text-gray-500">
                  {t('auth:alreadyHaveAccount')}{' '}
                  <button onClick={() => { setTab('login'); setError(null); }} className="font-medium text-indigo-400 hover:text-indigo-300">
                    {t('auth:login')}
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};
