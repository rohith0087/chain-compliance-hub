import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ImpersonatedCompany {
  id: string;
  name: string;
  type: 'buyer' | 'supplier';
}

export interface ImpersonatedUser {
  id: string;
  email: string;
  fullName: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  impersonatedCompany: ImpersonatedCompany | null;
  impersonationLogId: string | null;
  startImpersonation: (user: ImpersonatedUser, company: ImpersonatedCompany) => Promise<void>;
  endImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [impersonatedCompany, setImpersonatedCompany] = useState<ImpersonatedCompany | null>(null);
  const [impersonationLogId, setImpersonationLogId] = useState<string | null>(null);

  // Auto-timeout after 30 minutes of impersonation
  useEffect(() => {
    if (!isImpersonating) return;

    const timeout = setTimeout(() => {
      console.log('Impersonation auto-expired after 30 minutes');
      endImpersonation();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearTimeout(timeout);
  }, [isImpersonating]);

  const startImpersonation = useCallback(async (
    targetUser: ImpersonatedUser,
    company: ImpersonatedCompany
  ) => {
    if (!user) {
      console.error('Cannot start impersonation: No super admin user logged in');
      return;
    }

    try {
      // Log impersonation start in database
      const { data: logEntry, error } = await supabase
        .from('impersonation_logs')
        .insert({
          super_admin_id: user.id,
          impersonated_user_id: targetUser.id,
          impersonated_company_id: company.id,
          impersonated_company_type: company.type,
          started_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
          metadata: {
            impersonated_user_email: targetUser.email,
            impersonated_user_name: targetUser.fullName,
            impersonated_company_name: company.name
          }
        })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to log impersonation start:', error);
        // Continue anyway - audit logging failure shouldn't block functionality
      }

      setImpersonatedUser(targetUser);
      setImpersonatedCompany(company);
      setImpersonationLogId(logEntry?.id || null);
      setIsImpersonating(true);

      console.log(`Started impersonation: ${targetUser.email} at ${company.name}`);
    } catch (err) {
      console.error('Error starting impersonation:', err);
    }
  }, [user]);

  const endImpersonation = useCallback(async () => {
    if (impersonationLogId && user) {
      try {
        // Update log with end time
        await supabase
          .from('impersonation_logs')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', impersonationLogId);
      } catch (err) {
        console.error('Failed to log impersonation end:', err);
      }
    }

    setIsImpersonating(false);
    setImpersonatedUser(null);
    setImpersonatedCompany(null);
    setImpersonationLogId(null);

    console.log('Ended impersonation session');
  }, [impersonationLogId, user]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        impersonatedCompany,
        impersonationLogId,
        startImpersonation,
        endImpersonation
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = (): ImpersonationContextType => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};
