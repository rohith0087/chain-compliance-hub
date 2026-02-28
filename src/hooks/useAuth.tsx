
import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import logger from '@/utils/logger';

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
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitializedRef = useRef(false);

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
        
        if (event === 'TOKEN_REFRESHED' && isInitializedRef.current) {
          if (session) {
            setSession(session);
            setUser(session.user);
          }
          return;
        }
        
        if (event === 'INITIAL_SESSION' && isInitializedRef.current && session?.user) {
          if (session) {
            setSession(session);
            setUser(session.user);
          }
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          isInitializedRef.current = false;
          return;
        }
        
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
    
    if (!error && data.user) {
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
      window.location.href = '/';
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://compliance.tracer2c.com/reset-password',
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
