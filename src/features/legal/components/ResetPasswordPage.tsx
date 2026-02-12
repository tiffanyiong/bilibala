import React, { useEffect, useState } from 'react';
import { supabase } from '../../../shared/services/supabaseClient';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);

  // Check if user has a valid reset token
  useEffect(() => {
    const checkToken = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      console.log('[ResetPassword] Session check:', { session: !!session, error });

      if (session) {
        setIsValidToken(true);
      } else {
        setMessage({
          type: 'error',
          text: 'Invalid or expired password reset link. Password reset links expire after 1 hour. Please request a new one from the sign-in page.'
        });
      }
    };
    checkToken();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters long' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('[ResetPassword] Update password error:', error);

      // Check if it's a session expired error
      if (error.message.includes('session') || error.message.includes('expired')) {
        setMessage({
          type: 'error',
          text: 'Your password reset link has expired. Links are valid for 1 hour. Please request a new password reset.'
        });
      } else {
        setMessage({ type: 'error', text: error.message });
      }
    } else {
      console.log('[ResetPassword] Password updated successfully');
      setMessage({
        type: 'success',
        text: 'Password updated successfully! You can now sign in with your new password. Redirecting...'
      });

      // Redirect to home page after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    }
    setLoading(false);
  };

  const inputClasses = "w-full bg-white border border-stone-200 text-stone-900 text-sm rounded-lg py-2.5 px-3 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200 transition-all";
  const buttonClasses = "w-full bg-stone-800 text-white font-medium py-2.5 text-sm rounded-lg hover:bg-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-xl border border-stone-200 shadow-lg p-6 md:p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif text-stone-900 mb-2">Reset Password</h1>
          <p className="text-stone-500 text-sm">
            {isValidToken
              ? 'Enter your new password below'
              : 'Unable to reset password'}
          </p>
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

        {/* Form */}
        {isValidToken && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-stone-600 text-sm mb-1.5">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-stone-600 text-sm mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                minLength={8}
                className={inputClasses}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !password || password.length < 8 || !confirmPassword}
              className={buttonClasses}
            >
              {loading ? 'Updating password...' : 'Update Password'}
            </button>
          </form>
        )}

        {/* Back to sign in link */}
        {!isValidToken && (
          <div className="mt-4 text-center">
            <a
              href="/"
              className="text-stone-800 hover:underline text-sm"
            >
              Back to home
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
