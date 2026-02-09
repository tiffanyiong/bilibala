import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../shared/context/AuthContext';
import { useSubscription } from '../../../shared/context/SubscriptionContext';

interface ProfilePageProps {
  onOpenSubscription: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onOpenSubscription }) => {
  const { userProfile, user, updatePassword, updateName, isOAuthOnly } = useAuth();
  const {
    tier,
    status,
    billingInterval,
    subscription,
    usage,
    videosLimit,
    practiceSessionsLimit,
    aiTutorMinutesLimit,
    aiTutorCreditMinutes,
    practiceSessionCredits,
    videoCredits,
    createPortal,
    isLoading,
  } = useSubscription();

  const hasAnyCredits = videoCredits > 0 || practiceSessionCredits > 0 || aiTutorCreditMinutes > 0;

  const [profileUsageTab, setProfileUsageTab] = useState<'monthly' | 'credits'>('monthly');

  // Name editing state
  const [firstName, setFirstName] = useState(userProfile?.firstName || '');
  const [lastName, setLastName] = useState(userProfile?.lastName || '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  useEffect(() => {
    setFirstName(userProfile?.firstName || '');
    setLastName(userProfile?.lastName || '');
  }, [userProfile?.firstName, userProfile?.lastName]);

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

  const handleNameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);
    setNameSuccess(false);

    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      setNameError('First name cannot be empty');
      return;
    }

    setIsUpdatingName(true);
    const { error } = await updateName(trimmedFirst, lastName.trim());
    setIsUpdatingName(false);

    if (error) {
      setNameError(error);
    } else {
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
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
    <div className="min-h-screen pt-20 pb-12 px-4 bg-stone-100/60">
      <div className="max-w-md mx-auto">
        {/* Header with avatar */}
        <div className="text-center mb-6">
          {userProfile?.avatarUrl ? (
            <img
              src={userProfile.avatarUrl}
              alt={userProfile.name || 'Profile'}
              className="w-20 h-20 rounded-full mx-auto mb-3 object-cover shadow-sm"
            />
          ) : (
            <div className="w-20 h-20 rounded-full mx-auto mb-3 bg-gradient-to-br from-stone-300 to-stone-400 flex items-center justify-center text-white text-2xl font-medium shadow-sm">
              {userProfile?.initials || '?'}
            </div>
          )}
          <h1 className="text-lg font-semibold text-stone-900">
            {userProfile?.name || 'User'}
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">
            {userProfile?.email || user?.email || 'No email'}
          </p>
        </div>

        {/* Subscription & Usage */}
        <div className="mb-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-stone-200/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                Subscription
              </p>
            </div>
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-stone-500">Loading...</div>
            ) : (
              <>
                {/* Plan row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-900">
                      {tier === 'pro'
                        ? (billingInterval === 'year' ? 'Pro Annual' : 'Pro')
                        : 'Free'}
                    </span>
                    {tier === 'pro' && status && (
                      <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${getStatusColor(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    )}
                  </div>
                  {tier === 'pro' ? (
                    <button
                      onClick={handleManageBilling}
                      className="text-sm text-blue-500 font-medium hover:text-blue-600 transition-colors"
                    >
                      Manage
                    </button>
                  ) : (
                    <button
                      onClick={onOpenSubscription}
                      className="text-sm text-blue-500 font-medium hover:text-blue-600 transition-colors"
                    >
                      Upgrade
                    </button>
                  )}
                </div>

                {/* Renewal date row */}
                {tier === 'pro' && subscription?.current_period_end && (
                  <>
                    <div className="h-px bg-stone-100 ml-4" />
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-stone-500">
                        {status === 'canceled' ? 'Access until' : 'Renews'}
                      </span>
                      <span className="text-sm text-stone-900">
                        {formatDate(subscription.current_period_end)}
                      </span>
                    </div>
                  </>
                )}

                {/* Usage tabs */}
                {hasAnyCredits && (
                  <div className="px-4 pt-3">
                    <ProfileUsageTabs activeTab={profileUsageTab} onTabChange={setProfileUsageTab} />
                  </div>
                )}

                {/* Monthly usage rows */}
                {profileUsageTab === 'monthly' && (
                  <>
                    <UsageRow
                      label="Videos"
                      used={usage.videosUsed}
                      limit={videosLimit}
                    />
                    <UsageRow
                      label="AI Tutor"
                      used={usage.aiTutorMinutesUsed}
                      limit={aiTutorMinutesLimit}
                      unit="min"
                    />
                    <UsageRow
                      label="AI Report"
                      used={usage.practiceSessionsUsed}
                      limit={practiceSessionsLimit}
                    />
                  </>
                )}

                {/* Remaining credits rows */}
                {profileUsageTab === 'credits' && hasAnyCredits && (
                  <>
                    <CreditRow label="Video Credits" remaining={videoCredits} />
                    <CreditRow label="AI Tutor Credits" remaining={aiTutorCreditMinutes} unit="min" />
                    <CreditRow label="AI Report Credits" remaining={practiceSessionCredits} />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Personal Info */}
        <div className="mb-6">
          <form onSubmit={handleNameChange}>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-stone-200/60 px-4 py-2.5">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Personal Info
                </p>
              </div>
              {/* First Name row */}
              <div className="flex items-center px-4 py-3">
                <label className="text-sm text-stone-900 w-28 shrink-0">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="flex-1 text-sm text-stone-600 text-right bg-transparent outline-none placeholder:text-stone-300"
                />
              </div>
              <div className="h-px bg-stone-100 ml-4" />
              {/* Last Name row */}
              <div className="flex items-center px-4 py-3">
                <label className="text-sm text-stone-900 w-28 shrink-0">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="flex-1 text-sm text-stone-600 text-right bg-transparent outline-none placeholder:text-stone-300"
                />
              </div>
            </div>

            {(nameError || nameSuccess) && (
              <div className="px-4 mt-2">
                {nameError && <p className="text-xs text-red-500">{nameError}</p>}
                {nameSuccess && <p className="text-xs text-green-500">Name updated successfully!</p>}
              </div>
            )}

            <div className="flex justify-end mt-3 px-1">
              <button
                type="submit"
                disabled={isUpdatingName || (firstName.trim() === (userProfile?.firstName || '') && lastName.trim() === (userProfile?.lastName || ''))}
                className="text-sm text-blue-500 font-medium hover:text-blue-600 transition-colors disabled:text-stone-300 disabled:cursor-not-allowed"
              >
                {isUpdatingName ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>

        {/* Security */}
        <div className="mb-6">
          <form onSubmit={handlePasswordChange}>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-stone-200/60 px-4 py-2.5">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Security
                </p>
              </div>

              {isOAuthOnly && (
                <div className="px-4 pt-3">
                  <p className="text-xs text-stone-400">
                    You signed in with Google. Set a password to also enable email/password login.
                  </p>
                </div>
              )}

              {/* New Password row */}
              <div className="flex items-center px-4 py-3">
                <label className="text-sm text-stone-900 w-28 shrink-0">
                  {isOAuthOnly ? 'Password' : 'New Password'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter password"
                  className="flex-1 text-sm text-stone-600 text-right bg-transparent outline-none placeholder:text-stone-300"
                />
              </div>
              <div className="h-px bg-stone-100 ml-4" />
              {/* Confirm Password row */}
              <div className="flex items-center px-4 py-3">
                <label className="text-sm text-stone-900 w-28 shrink-0">Confirm</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="flex-1 text-sm text-stone-600 text-right bg-transparent outline-none placeholder:text-stone-300"
                />
              </div>
            </div>

            {(passwordError || passwordSuccess) && (
              <div className="px-4 mt-2">
                {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
                {passwordSuccess && <p className="text-xs text-green-500">Password updated successfully!</p>}
              </div>
            )}

            <div className="flex justify-end mt-3 px-1">
              <button
                type="submit"
                disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                className="text-sm text-blue-500 font-medium hover:text-blue-600 transition-colors disabled:text-stone-300 disabled:cursor-not-allowed"
              >
                {isUpdatingPassword ? 'Updating...' : isOAuthOnly ? 'Set Password' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Tabs for switching between monthly usage and credits
const ProfileUsageTabs: React.FC<{
  activeTab: 'monthly' | 'credits';
  onTabChange: (tab: 'monthly' | 'credits') => void;
}> = ({ activeTab, onTabChange }) => (
  <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
    <button
      onClick={() => onTabChange('monthly')}
      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
        activeTab === 'monthly'
          ? 'bg-white text-stone-800 shadow-sm'
          : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      Monthly Allowance
    </button>
    <button
      onClick={() => onTabChange('credits')}
      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
        activeTab === 'credits'
          ? 'bg-white text-stone-800 shadow-sm'
          : 'text-stone-500 hover:text-stone-700'
      }`}
    >
      Remaining Credits
    </button>
  </div>
);

// Inline usage row component
const UsageRow: React.FC<{
  label: string;
  used: number;
  limit: number;
  unit?: string;
}> = ({ label, used, limit, unit = '' }) => {
  const isUnlimited = limit === Infinity;
  // Cap monthly usage at the limit — any overflow was consumed from credits
  const monthlyUsed = isUnlimited ? used : Math.min(used, limit);
  const remaining = Math.max(limit - monthlyUsed, 0);
  const isNearLimit = !isUnlimited && limit > 0 && (monthlyUsed / limit) >= 0.8;

  const valueText = limit === 0
    ? 'Pro only'
    : isUnlimited
      ? `${used}${unit} used`
      : remaining === 0
        ? `${limit}${unit} / ${limit}${unit}`
        : `${monthlyUsed}${unit} / ${limit}${unit}`;

  const valueColor = limit === 0
    ? 'text-stone-400'
    : isNearLimit
      ? 'text-amber-500'
      : 'text-stone-900';

  const percentage = !isUnlimited && limit > 0 ? Math.min((monthlyUsed / limit) * 100, 100) : 0;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-stone-500">{label}</span>
        <span className={`text-sm font-medium ${valueColor}`}>{valueText}</span>
      </div>
      {!isUnlimited && limit > 0 && (
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isNearLimit ? 'bg-amber-400' : 'bg-stone-400'}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};

// Credit row component
const CreditRow: React.FC<{
  label: string;
  remaining: number;
  unit?: string;
}> = ({ label, remaining, unit = '' }) => (
  <div className="px-4 py-3">
    <div className="flex items-center justify-between">
      <span className="text-sm text-stone-500">{label}</span>
      <span className="text-sm font-medium text-green-600">
        {remaining}{unit && ` ${unit}`} remaining
      </span>
    </div>
  </div>
);

export default ProfilePage;
