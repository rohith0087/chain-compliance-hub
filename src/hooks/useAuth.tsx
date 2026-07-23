
import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import logger from '@/utils/logger';
import { shouldPreserveWorkspaceState } from '@/utils/authState';

export const ACCOUNT_DISABLED_MESSAGE =
  "There's a problem with your account and you can't sign in right now. Please contact support@tracer2c.com for help.";

// Get client IP address using public API
const getClientIP = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return null;
  }
};

// Log auth events to audit table
const logAuthEvent = async (
  action: 'login' | 'logout' | 'signup' | 'password_reset',
  userId: string | null,
  userEmail: string,
  userName?: string | null
) => {
  try {
    const ipAddress = await getClientIP();
    await supabase.from('auth_audit_logs').insert({
      user_id: userId,
      user_email: userEmail,
      user_name: userName,
      action,
      user_agent: navigator.userAgent,
      ip_address: ipAddress,
      metadata: { source: 'web_app', timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Failed to log auth event:', error);
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, roles?: ('buyer' | 'supplier')[], companyName?: string, captchaToken?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, captchaToken?: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  // Set when a session is rejected because the profile has account_disabled === true
  // (e.g. OAuth / passkey / restored session). Mirrors the password-flow error.
  accountDisabledError: string | null;
  clearAccountDisabledError: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountDisabledError, setAccountDisabledError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  const clearAccountDisabledError = () => setAccountDisabledError(null);

  const createMissingProfile = async (user: User) => {
    logger.debug('Creating missing profile for user:', user.id);
    try {
      const userRoles = user.user_metadata?.roles || ['buyer'];
      
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email || 'User',
          company_name: user.user_metadata?.company_name || null
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        throw error;
      }

      logger.debug('Profile created successfully');
      
      for (const role of userRoles) {
        const { error: roleError } = await supabase.rpc('grant_role', {
          _target_user_id: user.id,
          _role: role
        });
        
        if (roleError) {
          console.error('Error granting role:', role, roleError);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error in createMissingProfile:', error);
      throw error;
    }
  };

  const fetchUserProfile = async (userId: string) => {
    try {
      logger.debug('Fetching profile for user:', userId);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (!profile) {
        logger.debug('No profile found, creating one...');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const newProfile = await createMissingProfile(user);
          setProfile(newProfile);
          return;
        }
      }

      logger.debug('Profile fetched successfully');

      // Disabled-account gate (covers OAuth, passkey, and restored sessions).
      // Only an explicit account_disabled === true signs out — profile fetch
      // failures above never reach this branch and must not sign users out.
      if (profile?.account_disabled === true) {
        // Only act if a session is still active. If the password flow already
        // detected the disabled account and signed out, there is no session and
        // we must not raise a duplicate error signal.
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        if (!activeSession) return;
        logger.debug('Account is disabled; signing out');
        setAccountDisabledError(ACCOUNT_DISABLED_MESSAGE);
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }

      setProfile(profile);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.debug('Auth state changed:', event);

        if (shouldPreserveWorkspaceState({
          event,
          initialized: isInitializedRef.current,
          currentUserId: currentUserIdRef.current,
          nextUserId: session?.user.id ?? null,
        })) {
          // Keep the existing User object stable. Hooks key off its identity,
          // so replacing it on tab-focus SIGNED_IN/TOKEN_REFRESHED events
          // unnecessarily reloads contexts and unmounts open dashboard forms.
          setSession(session);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          isInitializedRef.current = false;
          currentUserIdRef.current = null;
          return;
        }

        currentUserIdRef.current = session?.user.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            await fetchUserProfile(session.user.id);
            isInitializedRef.current = true;
          }, 100);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      logger.debug('Initial session check');
      currentUserIdRef.current = session?.user.id ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          await fetchUserProfile(session.user.id);
          isInitializedRef.current = true;
        }, 100);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });

    // A GoTrue-banned account errors on sign-in — surface the friendly message.
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      if (e?.code === 'user_banned' || /banned/i.test(error.message ?? '')) {
        return { error: { message: ACCOUNT_DISABLED_MESSAGE, code: 'account_disabled' } };
      }
      return { error };
    }

    if (data.user) {
      // Disabled-account gate: block login and sign out immediately.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('account_disabled')
        .eq('id', data.user.id)
        .maybeSingle();
      if (prof?.account_disabled) {
        // This flow surfaces the error via its return value; if the delayed
        // onAuthStateChange profile fetch already raised the signal, clear it
        // so the user doesn't see the message twice.
        setAccountDisabledError(null);
        await supabase.auth.signOut();
        return { error: { message: ACCOUNT_DISABLED_MESSAGE, code: 'account_disabled' } };
      }
      logAuthEvent('login', data.user.id, data.user.email || email, data.user.user_metadata?.full_name);
    }

    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, roles: ('buyer' | 'supplier')[] = ['buyer'], companyName?: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://compliance.tracer2c.com/',
        captchaToken: captchaToken,
        data: { 
          full_name: fullName,
          company_name: companyName,
          roles: roles
        }
      }
    });

    // Don't reveal whether an account exists -- always return success
    // (Supabase returns an empty identities array for existing emails)
    if (data?.user && data.user.identities?.length === 0) {
      return { error: null };
    }

    return { error };
  };

  const signOut = async () => {
    try {
      logger.debug('Signing out user...');
      
      if (user) {
        await logAuthEvent('logout', user.id, user.email || '', profile?.full_name);
      }
      
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
      } else {
        logger.debug('Successfully signed out');
      }
      
      window.location.href = '/';
    } catch (error) {
      console.error('Error in signOut:', error);
      setUser(null);
      setSession(null);
      setProfile(null);
      currentUserIdRef.current = null;
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://compliance.tracer2c.com/reset-password',
      captchaToken,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password
    });
    return { error };
  };

  const value = {
    user,
    session,
    profile,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    accountDisabledError,
    clearAccountDisabledError,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
