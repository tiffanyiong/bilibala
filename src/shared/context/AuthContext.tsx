import { Session, User } from '@supabase/supabase-js';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { getFingerprint } from '../services/fingerprint';
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

/**
 * Extract session_id from Supabase JWT token
 * Instead of storing the full JWT (1,398+ chars), we extract the session_id UUID (36 chars)
 * This provides 97% storage savings while maintaining the same behavior
 */
const extractSessionId = (accessToken: string): string => {
  try {
    // JWT structure: header.payload.signature
    const payloadBase64 = accessToken.split('.')[1];
    if (!payloadBase64) {
      console.warn('[Session] Invalid JWT format, using access_token as fallback');
      return accessToken;
    }

    // Decode base64 payload
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson);

    // Return Supabase's session_id from the JWT payload
    if (payload.session_id) {
      return payload.session_id;
    }

    console.warn('[Session] No session_id found in JWT, using access_token as fallback');
    return accessToken;
  } catch (error) {
    console.error('[Session] Failed to extract session_id from JWT:', error);
    // Fallback to full access_token if decoding fails
    return accessToken;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track the last known session for cleanup on logout
  // This is needed because when SIGNED_OUT event fires, newSession is null
  const previousSessionRef = useRef<Session | null>(null);

  // Register session and send heartbeats
  const registerSession = async (session: Session) => {
    try {
      const deviceFingerprint = await getFingerprint();
      const userAgent = navigator.userAgent;
      const sessionId = extractSessionId(session.access_token);

      const response = await fetch('/api/sessions/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
          deviceFingerprint,
          userAgent,
          deviceInfo: {
            language: navigator.language,
            userAgentData: (navigator as any).userAgentData || null,
          },
          expiresAt: new Date(session.expires_at! * 1000).toISOString(),
        }),
      });

      const data = await response.json();

      if (data.loggedOutCount && data.loggedOutCount > 0) {
       //  console.log(`[Session] ${data.loggedOutCount} older session(s) were automatically logged out due to device limit (${data.sessionLimit})`);
      }
    } catch (error) {
      console.error('[Session] Failed to register session:', error);
    }
  };

  // Check if current session is still valid
  const checkSessionValidity = async (session: Session) => {
    try {
      const sessionId = extractSessionId(session.access_token);

      const response = await fetch('/api/sessions/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      const data = await response.json();

      if (!data.valid) {
        console.log('[Session] Invalidated:', { sessionId, reason: data.reason });
        // Auto-logout this device silently (no alert for any reason)
        await supabase.auth.signOut({ scope: 'local' });
      } 

    } catch (error) {
      console.error('[Session] Failed to check session validity:', error);
    }
  };

  // Send heartbeat to keep session active
  const sendHeartbeat = async (session: Session) => {
    try {
      const sessionId = extractSessionId(session.access_token);

      await fetch('/api/sessions/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

    
    } catch (error) {
      console.error('[Session] Failed to send heartbeat:', error);
    }
  };

  // Remove session on logout
  const removeSession = async (session: Session) => {
    try {
      const sessionId = extractSessionId(session.access_token);

      const response = await fetch('/api/sessions/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      if (response.ok) {
        // console.log('[Session] Removed:', { sessionId });
      } else {
        // 401 is expected when token is already invalidated (e.g., kicked out by device limit)
        // In this case, the session was already removed from database by register_session()
        if (response.status === 401) {
         // console.log('[Session] Session already invalidated (expected on device limit logout):', { sessionId });
        } else {
         // console.warn('[Session] Failed to remove session:', response.status, { sessionId });
        }
      }
    } catch (error) {
      console.error('[Session] Failed to remove session:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener - this handles OAuth callbacks AND automatic token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setUserProfile(getUserProfile(newSession?.user ?? null));
      setLoading(false);

      // Clear OAuth params from URL after successful sign in
      if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Handle TOKEN_REFRESHED event - update registered session with new token
      if (event === 'TOKEN_REFRESHED' && newSession) {
        await registerSession(newSession);
        previousSessionRef.current = newSession; // Update session reference
      }

      // Handle session registration and monitoring
      if (event === 'SIGNED_IN' && newSession) {
        // Register this session (may auto-logout older sessions)
        await registerSession(newSession);
        previousSessionRef.current = newSession; // Store session reference

        // Start checking session validity every 30 seconds
        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
        }
        sessionCheckIntervalRef.current = setInterval(() => {
          supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            if (currentSession) {
              checkSessionValidity(currentSession);
            }
          });
        }, 30000); // Check every 30 seconds

        // Send heartbeat every 5 minutes to keep session active
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            if (currentSession) {
              sendHeartbeat(currentSession);
            }
          });
        }, 5 * 60 * 1000); // Every 5 minutes
      }

      // Clear intervals on logout AND remove session from database
      if (event === 'SIGNED_OUT') {
        // Use previousSessionRef if newSession is null (which it will be on logout)
        const sessionToRemove = newSession || previousSessionRef.current;
        if (sessionToRemove) {
          await removeSession(sessionToRemove);
          previousSessionRef.current = null; // Clear reference
        }

        if (sessionCheckIntervalRef.current) {
          clearInterval(sessionCheckIntervalRef.current);
          sessionCheckIntervalRef.current = null;
        }
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
      }
    });

    // Check for existing session and set up automatic refresh
    supabase.auth.getSession().then(async ({ data: { session: existingSession } , error }) => {
      if (error) {
        // Session is invalid/expired — clear local state so user can sign in again
        supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setUser(null);
        setUserProfile(null);
      } else {
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        setUserProfile(getUserProfile(existingSession?.user ?? null));

        // Register existing session
        if (existingSession) {
          await registerSession(existingSession);
          previousSessionRef.current = existingSession; // Store session reference for cleanup

          // Start monitoring - use getSession() to always get fresh token
          if (sessionCheckIntervalRef.current) {
            clearInterval(sessionCheckIntervalRef.current);
          }
          sessionCheckIntervalRef.current = setInterval(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
              if (currentSession) {
                checkSessionValidity(currentSession);
              }
            });
          }, 30000);

          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          heartbeatIntervalRef.current = setInterval(() => {
            supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
              if (currentSession) {
                sendHeartbeat(currentSession);
              }
            });
          }, 5 * 60 * 1000);
        }
      }
      setLoading(false);
    });

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  const signOut = async () => {
    // Don't manually call removeSession here anymore
    // The SIGNED_OUT event handler will take care of it
    // This prevents duplicate removeSession calls
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Session already gone server-side — clear local state instead
      await supabase.auth.signOut({ scope: 'local' });
    }
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
