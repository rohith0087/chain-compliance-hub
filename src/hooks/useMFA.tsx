import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface MFAState {
  mfaEnrolled: boolean | null;
  mfaVerified: boolean;
  gracePeriodExpired: boolean;
  daysRemaining: number;
  loading: boolean;
  factors: any[];
  remainingRecoveryCodes: number | null;
  gracePeriodEndsAt: Date | null;
}

export const useMFA = () => {
  const { user, session } = useAuth();
  const [state, setState] = useState<MFAState>({
    mfaEnrolled: null,
    mfaVerified: false,
    gracePeriodExpired: false,
    daysRemaining: 7,
    loading: true,
    factors: [],
    remainingRecoveryCodes: null,
    gracePeriodEndsAt: null,
  });

  const checkMFAStatus = useCallback(async () => {
    if (!user || !session) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      // 1. Check if user has TOTP factors enrolled
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        console.error('Error listing MFA factors:', factorsError);
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const totpFactors = factorsData?.totp || [];
      const verifiedFactors = totpFactors.filter((f: any) => f.status === 'verified');
      const hasEnrolledMFA = verifiedFactors.length > 0;

      // 2. Check AAL level (aal1 = password only, aal2 = MFA verified)
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalError) {
        console.error('Error getting AAL:', aalError);
      }

      const currentLevel = aalData?.currentLevel || 'aal1';
      const isMFAVerified = currentLevel === 'aal2';

      // 3. Check grace period from profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('first_login_at, mfa_grace_period_expires_at, mfa_enabled')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile for MFA:', profileError);
      }

      let gracePeriodExpired = false;
      let daysRemaining = 7;

      if (profile) {
        // If first login hasn't been set, set it now
        if (!profile.first_login_at) {
          const now = new Date();
          const gracePeriodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          
          await supabase
            .from('profiles')
            .update({
              first_login_at: now.toISOString(),
              mfa_grace_period_expires_at: gracePeriodEnd.toISOString()
            })
            .eq('id', user.id);

          daysRemaining = 7;
        } else if (profile.mfa_grace_period_expires_at) {
          const expiresAt = new Date(profile.mfa_grace_period_expires_at);
          const now = new Date();
          
          if (now > expiresAt) {
            gracePeriodExpired = true;
            daysRemaining = 0;
          } else {
            const msRemaining = expiresAt.getTime() - now.getTime();
            daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
          }
        }
      }

      // 4. Check remaining recovery codes
      let remainingRecoveryCodes: number | null = null;
      const { count } = await supabase
        .from('mfa_recovery_codes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('used_at', null);
      
      remainingRecoveryCodes = count;

      setState({
        mfaEnrolled: hasEnrolledMFA,
        mfaVerified: isMFAVerified,
        gracePeriodExpired,
        daysRemaining,
        loading: false,
        factors: verifiedFactors,
        remainingRecoveryCodes,
        gracePeriodEndsAt: profile?.mfa_grace_period_expires_at ? new Date(profile.mfa_grace_period_expires_at) : null,
      });

    } catch (error) {
      console.error('Error checking MFA status:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user, session]);

  useEffect(() => {
    checkMFAStatus();
  }, [checkMFAStatus]);

  const cleanupExistingFactors = async (retries = 3, delayMs = 800): Promise<{ success: boolean; cleaned: number }> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const allTotpFactors = factorsData?.totp || [];
        
        if (allTotpFactors.length === 0) {
          return { success: true, cleaned: 0 };
        }
        
        // Unenroll ALL TOTP factors (both verified and unverified)
        for (const factor of allTotpFactors) {
          try {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          } catch (err) {
            // Continue with other factors even if one fails
          }
        }
        
        // Wait for Supabase to process the deletions
        await new Promise(resolve => setTimeout(resolve, delayMs));
        
        // Verify cleanup was successful
        const { data: verifyData } = await supabase.auth.mfa.listFactors();
        if ((verifyData?.totp?.length || 0) === 0) {
          return { success: true, cleaned: allTotpFactors.length };
        }
        
        // If factors still exist and we have retries left, continue
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        if (attempt === retries) {
          return { success: false, cleaned: 0 };
        }
      }
    }
    return { success: false, cleaned: 0 };
  };

  const enrollMFA = async (forceCleanup = false): Promise<{ data: any; error: any; isFactorExistsError?: boolean }> => {
    const maxAttempts = 2;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Cleanup with longer delay on retry or if forced
        const cleanupDelay = attempt > 1 || forceCleanup ? 1500 : 1000;
        await cleanupExistingFactors(3, cleanupDelay);
        
        // Additional delay before enrollment
        await new Promise(resolve => setTimeout(resolve, cleanupDelay));
        
        // Now enroll fresh
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Authenticator App'
        });

        if (error) {
          // Check if it's the "factor already exists" error
          const isFactorExistsError = error.message?.toLowerCase().includes('factor') && 
                                       error.message?.toLowerCase().includes('already exists');
          
          if (isFactorExistsError && attempt < maxAttempts) {
            // Wait longer and retry
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          return { data: null, error, isFactorExistsError };
        }

        return { data, error: null };
      } catch (error: any) {
        const isFactorExistsError = error.message?.toLowerCase().includes('factor') && 
                                     error.message?.toLowerCase().includes('already exists');
        
        if (attempt === maxAttempts) {
          return { data: null, error, isFactorExistsError };
        }
      }
    }
    
    return { data: null, error: new Error('Failed to enroll MFA after multiple attempts') };
  };

  const verifyMFA = async (factorId: string, code: string) => {
    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the code
      const { data, error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code
      });

      if (error) {
        throw error;
      }

      // Update profile to mark MFA as enabled
      await supabase
        .from('profiles')
        .update({ mfa_enabled: true })
        .eq('id', user?.id);

      // Refresh MFA status
      await checkMFAStatus();

      return { data, error: null };
    } catch (error: any) {
      console.error('Error verifying MFA:', error);
      return { data: null, error };
    }
  };

  const challengeAndVerify = async (code: string) => {
    try {
      // Get the first verified factor
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp?.find((f: any) => f.status === 'verified');

      if (!factor) {
        throw new Error('No verified MFA factor found');
      }

      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factor.id
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the code
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: factor.id,
        challengeId: challengeData.id,
        code
      });

      if (error) {
        throw error;
      }

      // Refresh MFA status
      await checkMFAStatus();

      return { data, error: null };
    } catch (error: any) {
      console.error('Error in challengeAndVerify:', error);
      return { data: null, error };
    }
  };

  const unenrollMFA = async (factorId: string) => {
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });

      if (error) {
        throw error;
      }

      // Update profile
      await supabase
        .from('profiles')
        .update({ mfa_enabled: false })
        .eq('id', user?.id);

      // Refresh MFA status
      await checkMFAStatus();

      return { error: null };
    } catch (error: any) {
      console.error('Error unenrolling MFA:', error);
      return { error };
    }
  };

  return {
    ...state,
    checkMFAStatus,
    enrollMFA,
    verifyMFA,
    challengeAndVerify,
    unenrollMFA,
    cleanupExistingFactors,
  };
};
