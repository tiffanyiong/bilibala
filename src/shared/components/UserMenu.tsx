import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';

interface UserMenuProps {
  onOpenAuthModal: () => void;
  onOpenVideoLibrary?: () => void;
  onOpenSubscription?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
}

const UserMenu: React.FC<UserMenuProps> = ({ onOpenAuthModal, onOpenVideoLibrary, onOpenSubscription, onOpenProfile, onOpenSettings }) => {
  const { user, userProfile, loading, signOut } = useAuth();
  const { tier } = useSubscription();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const menuItems = [
    { label: 'Profile', icon: ProfileIcon, onClick: () => onOpenProfile?.() },
    { label: 'Video Library', icon: VideoIcon, onClick: () => onOpenVideoLibrary?.() },
    // { label: 'Vocabulary', icon: VocabularyIcon, onClick: () => console.log('Vocabulary clicked') }, // Hidden for now
    { label: 'Subscription Plan', icon: SubscriptionIcon, onClick: () => onOpenSubscription?.() },
    { label: 'Settings', icon: SettingsIcon, onClick: () => onOpenSettings?.() },
  ];

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-stone-200 animate-pulse" />
    );
  }

  // Not logged in - show sign in button
  if (!user || !userProfile) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="flex items-center gap-1.5 bg-stone-800 text-white px-4 py-1.5 rounded-md shadow-sm text-xs font-medium hover:bg-stone-900 hover:shadow-md transition-all"
      >
  
        Sign in
      </button>
    );
  }

  // Logged in - show avatar with dropdown
  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-full overflow-hidden border-2 border-stone-200 hover:border-stone-300 transition-all focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2"
        aria-label="User menu"
      >
        {userProfile.avatarUrl ? (
          <img
            src={userProfile.avatarUrl}
            alt={userProfile.name || 'User avatar'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full bg-stone-700 flex items-center justify-center text-white text-sm font-medium">
            {userProfile.initials}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-[#FAF9F6] rounded-xl border border-stone-200 shadow-lg py-2 z-[300]">
          {/* User Info */}
          <div className="px-4 py-3">
            <p className="text-sm font-medium text-stone-900 truncate">
              {userProfile.name || 'User'}
            </p>
            <p className="text-xs text-stone-500 truncate">
              {userProfile.email}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-stone-200 mx-2" />

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                className="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100 flex items-center gap-3 transition-colors"
              >
                <item.icon />
                <span className="flex items-center gap-2">
                  {item.label}
                  {item.label === 'Profile' && (
                    tier === 'pro'
                      ? <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">Pro</span>
                      : <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full">Free</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-stone-200 mx-2" />

          {/* Log out */}
          <div className="py-1">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
            >
              <LogoutIcon />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Icons
const ProfileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const VideoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7"></polygon>
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
  </svg>
);

// Hidden for now - uncomment when Vocabulary feature is implemented
// const VocabularyIcon = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
//     <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
//   </svg>
// );

const SubscriptionIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
    <line x1="1" y1="10" x2="23" y2="10"></line>
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

export default UserMenu;
