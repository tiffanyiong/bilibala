import React, { useState } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';

interface ProfilePageProps {
  onOpenSubscription: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenSubscription }) => {
  const { userProfile, user, updatePassword, isOAuthOnly } = useAuth();
  const {
    tier,
    status,
    subscription,
    usage,
    videosLimit,
    practiceSessionsLimit,
    aiTutorMinutesLimit,
    createPortal,
    isLoading,
  } = useSubscription();

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleManageBilling = async () => {
    const url = await createPortal();
    if (url) {
      window.location.href = url;
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    const { error } = await updatePassword(newPassword);
    setIsUpdatingPassword(false);

    if (error) {
      setPasswordError(error);
    } else {
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    }
  };

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'canceled':
        return 'text-amber-600 bg-amber-50';
      case 'past_due':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-stone-600 bg-stone-50';
    }
  };

  const getStatusLabel = (s: string) => {
    switch (s) {
      case 'active':
        return 'Active';
      case 'canceled':
        return 'Canceled';
      case 'past_due':
        return 'Past Due';
      default:
        return s;
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif text-stone-800">Profile</h1>
        </div>

        {/* User info card */}
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6 mb-6 text-center">
          {/* Avatar */}
          {userProfile?.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name || 'Profile'}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-stone-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-stone-200 flex items-center justify-center text-stone-600 text-xl font-medium">
              {userProfile?.initials || '?'}
            </div>
          )}

          {/* Name */}
          <h2 className="text-lg font-medium text-stone-800">
            {userProfile?.name || 'User'}
          </h2>

          {/* Email */}
          <p className="text-sm text-stone-500 mt-1">
            {userProfile?.email || user?.email || 'No email'}
          </p>
        </div>

        {/* Subscription card */}
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">
            Subscription
          </h3>

          {isLoading ? (
            <div className="text-sm text-stone-500">Loading...</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-lg font-medium text-stone-800">
                    {tier === 'pro' ? 'Pro Plan' : 'Free Plan'}
                  </span>
                </div>
                {tier === 'pro' && status && (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(status)}`}>
                    {getStatusLabel(status)}
                  </span>
                )}
              </div>

              {/* Expiration date for Pro users */}
              {tier === 'pro' && subscription?.current_period_end && (
                <p className="text-xs text-stone-500 mb-4">
                  {status === 'canceled' ? 'Access until: ' : 'Renews on: '}
                  {formatDate(subscription.current_period_end)}
                </p>
              )}

              {tier === 'pro' ? (
                <button
                  onClick={handleManageBilling}
                  className="w-full bg-stone-200 text-stone-700 py-2.5 rounded-lg text-sm font-medium hover:bg-stone-300 transition-all"
                >
                  Manage Billing
                </button>
              ) : (
                <button
                  onClick={onOpenSubscription}
                  className="w-full bg-stone-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-all"
                >
                  Upgrade to Pro
                </button>
              )}
            </>
          )}
        </div>

        {/* Usage card */}
        {!isLoading && (
          <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6 mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">
              Monthly Usage
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <UsageMeter
                label="Videos"
                used={usage.videosUsed}
                limit={videosLimit}
              />
              <UsageMeter
                label="Practice"
                used={usage.practiceSessionsUsed}
                limit={practiceSessionsLimit}
              />
              <UsageMeter
                label="AI Tutor"
                used={usage.aiTutorMinutesUsed}
                limit={aiTutorMinutesLimit}
                unit="min"
              />
              <UsageMeter
                label="PDF Export"
                used={usage.pdfExportsUsed}
                limit={tier === 'pro' ? Infinity : 0}
                showAsEnabled
              />
            </div>
          </div>
        )}

        {/* Security / Password card */}
        <div className="bg-[#FAF9F6] border border-stone-200 rounded-xl p-6 mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 mb-4">
            Security
          </h3>

          {isOAuthOnly && (
            <p className="text-xs text-stone-500 mb-4">
              You signed in with Google. Set a password below to also enable email/password login.
            </p>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-stone-600 mb-1">
                {isOAuthOnly ? 'Set Password' : 'New Password'}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
              />
            </div>

            <div>
              <label className="block text-sm text-stone-600 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-200"
              />
            </div>

            {passwordError && (
              <p className="text-xs text-red-600">{passwordError}</p>
            )}

            {passwordSuccess && (
              <p className="text-xs text-green-600">Password updated successfully!</p>
            )}

            <button
              type="submit"
              disabled={isUpdatingPassword || !newPassword || !confirmPassword}
              className="w-full bg-stone-800 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-stone-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingPassword ? 'Updating...' : isOAuthOnly ? 'Set Password' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// UsageMeter component
const UsageMeter: React.FC<{
  label: string;
  used: number;
  limit: number;
  unit?: string;
  showAsEnabled?: boolean;
}> = ({ label, used, limit, unit = '', showAsEnabled }) => {
  if (showAsEnabled) {
    const enabled = limit > 0 || limit === Infinity;
    return (
      <div>
        <div className="text-xs text-stone-500 mb-1">{label}</div>
        {enabled ? (
          <div className="text-sm font-medium text-green-600">Enabled</div>
        ) : (
          <span className="inline-block text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
            Pro only
          </span>
        )}
      </div>
    );
  }

  const isUnlimited = limit === Infinity;
  const percentage = isUnlimited ? 0 : limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isNearLimit = !isUnlimited && limit > 0 && percentage >= 80;

  return (
    <div>
      <div className="text-xs text-stone-500 mb-1">{label}</div>
      {limit === 0 ? (
        <span className="inline-block text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
          Pro only
        </span>
      ) : (
        <div className={`text-sm font-medium ${isNearLimit ? 'text-amber-600' : 'text-stone-700'}`}>
          {isUnlimited ? `${used}${unit} used` : `${used}${unit} / ${limit}${unit}`}
        </div>
      )}
      {!isUnlimited && limit > 0 && (
        <div className="mt-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? 'bg-amber-500' : 'bg-stone-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
