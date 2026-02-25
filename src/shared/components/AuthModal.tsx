import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [view, setView] = useState<AuthView>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Close modal when user successfully logs in
  useEffect(() => {
    if (user && isOpen) {
      onClose();
    }
  }, [user, isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setMessage(null);
      setView('sign_in');
      setAgreedToTerms(false);
    }
  }, [isOpen]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      setMessage({ type: 'error', text: 'You must agree to the Terms of Service and Privacy Policy to sign up.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Check your email to confirm your account!' });
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    console.log('[AuthModal] Attempting password reset for:', email);
    console.log('[AuthModal] Redirect URL:', `${window.location.origin}/reset-password`);

    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    console.log('[AuthModal] Password reset response:', { data, error });

    if (error) {
      console.error('[AuthModal] Password reset error:', error);
      setMessage({ type: 'error', text: error.message });
    } else {
      console.log('[AuthModal] Password reset email sent successfully');
      setMessage({
        type: 'success',
        text: 'Password reset email sent! Check your spam folder for an email from noreply@mybilibala.com.'
      });
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    // For sign-up view, check if user has agreed to terms
    if (view === 'sign_up' && !agreedToTerms) {
      setMessage({ type: 'error', text: 'You must agree to the Terms of Service and Privacy Policy to sign up.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClasses = "w-full bg-white border border-stone-200 text-stone-900 text-sm rounded-lg py-2.5 px-3 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all";
  const buttonClasses = "w-full bg-stone-800 text-white font-medium py-2.5 text-sm rounded-lg hover:bg-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const secondaryButtonClasses = "w-full bg-white border border-stone-200 text-stone-700 font-medium py-2.5 text-sm rounded-lg hover:bg-stone-50 transition-all flex items-center justify-center gap-2";
  const linkClasses = "text-stone-500 hover:text-stone-800 text-sm transition-colors cursor-pointer";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg p-6 md:p-8 max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Header with Tabs */}
        <div className="mb-6">
          {view !== 'forgot_password' ? (
            <div className="text-center">
              <h2 className="text-2xl font-serif text-stone-900 mb-3">Bililala</h2>

              {/* Compact Tab Navigation */}
              <div className="inline-flex bg-stone-100 rounded-lg p-1 mb-3">
                <button
                  onClick={() => setView('sign_in')}
                  className={`px-6 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === 'sign_in'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setView('sign_up')}
                  className={`px-6 py-1.5 text-sm font-medium rounded-md transition-all ${
                    view === 'sign_up'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              <p className="text-stone-500 text-sm">
                {view === 'sign_in' && 'Sign in to continue your learning journey'}
                {view === 'sign_up' && 'Start your learning journey today'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl font-serif text-stone-900">Reset password</h2>
              <p className="text-stone-500 text-sm mt-1">Enter your email to reset your password</p>
            </div>
          )}
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'error'
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-green-50 text-green-600 border border-green-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Sign In View */}
        {view === 'sign_in' && (
          <>
            {/* Google Sign In */}
            <button onClick={handleGoogleSignIn} disabled={loading} className={secondaryButtonClasses}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-stone-200"></div>
              <span className="text-stone-400 text-xs">or</span>
              <div className="flex-1 h-px bg-stone-200"></div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-stone-600 text-sm mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-stone-600 text-sm mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="your password"
                  required
                  className={inputClasses}
                />
              </div>

              {/* Terms and Privacy Notice */}
              <p className="text-stone-500 text-xs text-center">
                By signing in, you agree to our{' '}
                <a
                  href="https://mybilibala.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-700 hover:underline"
                >
                  Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="https://mybilibala.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-700 hover:underline"
                >
                  Privacy Policy
                </a>
              </p>

              <button type="submit" disabled={loading || !email || password.length < 8} className={buttonClasses}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <span className={linkClasses} onClick={() => setView('forgot_password')}>
                Forgot your password?
              </span>
            </div>
          </>
        )}

        {/* Sign Up View */}
        {view === 'sign_up' && (
          <>
            <button onClick={handleGoogleSignIn} disabled={loading} className={secondaryButtonClasses}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-stone-200"></div>
              <span className="text-stone-400 text-xs">or</span>
              <div className="flex-1 h-px bg-stone-200"></div>
            </div>

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-stone-600 text-sm mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className={inputClasses}
                />
              </div>
              <div>
                <label className="block text-stone-600 text-sm mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={6}
                  className={inputClasses}
                />
              </div>

              {/* Terms and Privacy Checkbox */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-stone-800 focus:ring-stone-400 cursor-pointer"
                />
                <label htmlFor="terms-checkbox" className="text-stone-600 text-sm cursor-pointer">
                  By signing up, you agree to our{' '}
                  <a
                    href="https://mybilibala.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-800 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms of Service
                  </a>
                  {' '}and{' '}
                  <a
                    href="https://mybilibala.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-800 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Privacy Policy
                  </a>
                </label>
              </div>

              <button type="submit" disabled={loading || !email || password.length < 8 || !agreedToTerms} className={buttonClasses}>
                {loading ? 'Creating account...' : 'Sign up'}
              </button>
            </form>
          </>
        )}

        {/* Forgot Password View */}
        {view === 'forgot_password' && (
          <>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-stone-600 text-sm mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className={inputClasses}
                />
              </div>
              <button type="submit" disabled={loading} className={buttonClasses}>
                {loading ? 'Sending...' : 'Send reset instructions'}
              </button>
            </form>

            <div className="mt-4 text-center">
              <span className={linkClasses} onClick={() => setView('sign_in')}>
                Back to sign in
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthModal;
