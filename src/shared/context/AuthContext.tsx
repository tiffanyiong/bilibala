import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

interface UserProfile {
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  initials: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateName: (firstName: string, lastName: string) => Promise<{ error: string | null }>;
  isOAuthOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Extract user profile info from Supabase user
const getUserProfile = (user: User | null): UserProfile | null => {
  if (!user) return null;

  const metadata = user.user_metadata || {};
  const email = user.email || null;
  const avatarUrl = metadata.avatar_url || metadata.picture || null;

  // Parse first/last name from metadata
  // Prefer explicit first_name/last_name, fall back to splitting full_name
  let firstName: string | null = metadata.first_name || null;
  let lastName: string | null = metadata.last_name || null;

  if (!firstName && !lastName) {
    const fullName = metadata.full_name || metadata.name || '';
    const parts = fullName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    } else if (parts.length === 1) {
      firstName = parts[0];
    }
  }

  const name = [firstName, lastName].filter(Boolean).join(' ') || null;

  // Generate initials from name or email
  let initials = '?';
  if (firstName && lastName) {
    initials = `${firstName[0]}${lastName[0]}`.toUpperCase();
  } else if (firstName) {
    initials = firstName.substring(0, 2).toUpperCase();
  } else if (email) {
    initials = email.substring(0, 2).toUpperCase();
  }

  return { name, firstName, lastName, email, avatarUrl, initials };
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener - this handles OAuth callbacks automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setUserProfile(getUserProfile(session?.user ?? null));
      setLoading(false);

      // Clear OAuth params from URL after successful sign in
      if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setUserProfile(getUserProfile(session?.user ?? null));
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  };

  const updateName = async (firstName: string, lastName: string): Promise<{ error: string | null }> => {
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const { data, error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, full_name: fullName },
    });
    if (error) {
      return { error: error.message };
    }
    if (data.user) {
      setUser(data.user);
      setUserProfile(getUserProfile(data.user));
    }
    return { error: null };
  };

  // Check if user signed up with OAuth only (no password set)
  // Users with 'email' provider have a password, OAuth providers don't
  const isOAuthOnly = user?.app_metadata?.provider !== 'email' &&
    !user?.identities?.some(id => id.provider === 'email');

  return (
    <AuthContext.Provider value={{ session, user, userProfile, loading, signOut, updatePassword, updateName, isOAuthOnly }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
