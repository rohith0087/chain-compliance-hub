import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { useUserContexts } from '@/hooks/useUserContexts';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { supabase } from '@/integrations/supabase/client';
import BuyerDashboard from '@/components/BuyerDashboard';
import SupplierDashboard from '@/components/SupplierDashboard';
import SupplierProfileSetup from '@/components/supplier/SupplierProfileSetup';
import BuyerProfileSetup from '@/components/buyer/BuyerProfileSetup';
import RoleSwitcher from '@/components/RoleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const DUAL_ROLE_INFO_KEY = 'dual_role_info_shown';

const DynamicDashboard = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { hasRole, roles } = useUserRoles();
  const { getSupplierProfile, getBuyerProfile } = useCompanySetup();
  const { 
    contexts, 
    currentContext, 
    switchContext, 
    loading: contextsLoading, 
    isDualRole, 
    needsPasswordReset,
    buyerContexts,
    supplierContexts 
  } = useUserContexts();
  const { isImpersonating, impersonatedCompany, impersonatedUser } = useImpersonation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('buyer');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [impersonatedProfiles, setImpersonatedProfiles] = useState<{ buyer: any; supplier: any }>({ buyer: null, supplier: null });

  // Determine if user is a team member (has company_users records)
  const isTeamMember = contexts.length > 0;

  // Load impersonated company profile when impersonating
  useEffect(() => {
    if (!isImpersonating || !impersonatedCompany) {
      setImpersonatedProfiles({ buyer: null, supplier: null });
      return;
    }

    const loadImpersonatedProfile = async () => {
      if (impersonatedCompany.type === 'buyer') {
        const { data } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', impersonatedCompany.id)
          .single();
        setImpersonatedProfiles({ buyer: data, supplier: null });
        setCurrentRole('buyer');
      } else {
        const { data } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', impersonatedCompany.id)
          .single();
        setImpersonatedProfiles({ buyer: null, supplier: data });
        setCurrentRole('supplier');
      }
      setProfilesLoading(false);
    };

    loadImpersonatedProfile();
  }, [isImpersonating, impersonatedCompany]);

  // Timeout detection for infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((authLoading || profilesLoading) && !sessionError) {
        console.error('Session timeout: Loading took too long');
        setLoadingTimeout(true);
        setSessionError('Session initialization is taking longer than expected. Your profile data may be missing.');
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [authLoading, profilesLoading, sessionError]);

  // Handle password reset requirement
  useEffect(() => {
    if (needsPasswordReset) {
      toast.info('Please set your password before continuing');
      navigate('/reset-password');
    }
  }, [needsPasswordReset, navigate]);

  // Set current role based on URL query param, context (for team members), or roles (for owners)
  useEffect(() => {
    if (contextsLoading) return;

    // Check URL for explicit role switch request
    const urlRole = searchParams.get('role') as 'buyer' | 'supplier' | null;
    if (urlRole && (urlRole === 'buyer' || urlRole === 'supplier')) {
      console.log('Setting role from URL param:', urlRole);
      setCurrentRole(urlRole);
      // Also switch context for team members
      if (isTeamMember) {
        switchContext(urlRole);
      }
      return;
    }

    if (currentContext) {
      // Team member: use context
      setCurrentRole(currentContext.companyType);
      console.log('Set role from context:', currentContext.companyType);
    } else if (roles.length > 0) {
      // Company owner: use roles array
      if (roles.includes('supplier' as any)) {
        setCurrentRole('supplier');
      } else if (roles.includes('buyer' as any)) {
        setCurrentRole('buyer');
      }
      console.log('Set role from roles array:', currentRole);
    }
  }, [currentContext, contextsLoading, roles, searchParams, isTeamMember]);

  // Show dual-role info toast once
  useEffect(() => {
    if (isDualRole && !localStorage.getItem(DUAL_ROLE_INFO_KEY)) {
      toast.info(
        'You have access to both buyer and supplier dashboards. Use the switcher in the header to toggle.',
        { duration: 8000 }
      );
      localStorage.setItem(DUAL_ROLE_INFO_KEY, 'true');
    }
  }, [isDualRole]);

  // Load profiles for company owners
  useEffect(() => {
    if (contextsLoading || !user || roles.length === 0) {
      return;
    }

    // Skip profile loading for team members
    if (isTeamMember) {
      console.log('User is a team member, skipping profile loading');
      setProfilesLoading(false);
      return;
    }

    loadProfiles();
  }, [contextsLoading, user, roles, isTeamMember]);

  const loadProfiles = async () => {
    console.log('Loading profiles...', { isTeamMember });
    
    // Skip profile loading for team members - they don't need supplier/buyer records
    if (isTeamMember) {
      console.log('User is a team member, skipping profile loading');
      setProfilesLoading(false);
      return;
    }
    
    setProfilesLoading(true);
    try {
      if (hasRole('supplier')) {
        console.log('Loading supplier profile...');
        const supplier = await getSupplierProfile();
        console.log('Loaded supplier profile:', supplier);
        setSupplierProfile(supplier);
      }
      
      if (hasRole('buyer')) {
        console.log('Loading buyer profile...');
        const buyer = await getBuyerProfile();
        console.log('Loaded buyer profile:', buyer);
        setBuyerProfile(buyer);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleRoleSwitch = (newRole: 'buyer' | 'supplier') => {
    console.log('Switching to role:', newRole);
    setCurrentRole(newRole);
    // Also switch context for team members
    if (isTeamMember) {
      switchContext(newRole);
    }
  };

  const handleProfileCreated = async () => {
    console.log('Profile created, reloading profiles...');
    // Add a small delay to ensure database has updated
    setTimeout(async () => {
      await loadProfiles();
    }, 500);
  };

  const handleLogout = async () => {
    try {
      console.log('Logout button clicked');
      await signOut();
    } catch (error) {
      console.error('Error during logout:', error);
      // Force redirect even if there's an error
      window.location.href = '/';
    }
  };

  const handleResetSession = async () => {
    console.log('Resetting session...');
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error resetting session:', error);
      // Force redirect anyway
      window.location.href = '/';
    }
  };

  // Check if buyer profile is properly set up
  const isBuyerProfileComplete = (buyer: any) => {
    // Team members don't need their own buyer profiles
    if (isTeamMember) return true;
    
    if (!buyer) return false;
    
    // Company owners need these fields filled (removed 'General Business' check since we don't auto-create anymore)
    return !!(buyer.company_name && buyer.industry);
  };

  // Check if supplier profile is properly set up
  const isSupplierProfileComplete = (supplier: any) => {
    // Team members don't need their own supplier profiles
    if (isTeamMember) return true;
    
    if (!supplier) return false;
    
    // Company owners need these fields filled (removed 'General Business' check since we don't auto-create anymore)
    return !!(supplier.company_name && supplier.industry);
  };

  // Show error state if loading timeout or session error occurs
  if (loadingTimeout || sessionError) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Session Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            {sessionError || 'Unable to load your profile. This usually happens when your user profile data is missing from the database.'}
          </p>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Try resetting your session by signing out and signing back in. If the problem persists, you may need to create a new account.
            </p>
            <Button onClick={handleResetSession} className="w-full">
              Reset Session & Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading while auth is loading or we don't have user/profile yet
  if (authLoading || !user || !profile) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <p className="text-muted-foreground">Loading your profile...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading while checking user contexts (team membership)
  if (contextsLoading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <p className="text-muted-foreground">Checking your account type...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (profilesLoading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
            <p className="text-muted-foreground">Setting up your dashboard...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Check if user has multiple roles/contexts
  // For owners: check roles array, for team members: check isDualRole from contexts
  const hasMultipleRoles = roles.length > 1 || isDualRole;

  // Graceful fallback: if current role context is gone but other remains
  if (isTeamMember) {
    if (currentRole === 'buyer' && buyerContexts.length === 0 && supplierContexts.length > 0) {
      console.log('Buyer context removed, falling back to supplier');
      setCurrentRole('supplier');
      toast.info('Your buyer access has been removed. Switched to supplier view.');
    } else if (currentRole === 'supplier' && supplierContexts.length === 0 && buyerContexts.length > 0) {
      console.log('Supplier context removed, falling back to buyer');
      setCurrentRole('buyer');
      toast.info('Your supplier access has been removed. Switched to buyer view.');
    }
  }

  // HARD BLOCK: Team members (invited users) NEVER see profile setup forms
  // This prevents race conditions where profile forms show during state transitions
  if (isTeamMember) {
    console.log('User is a team member - bypassing ALL profile setup checks');
    // Skip to dashboard rendering below
  }
  
  // Check if current role needs profile setup
  // Only company owners who don't have a complete profile should see setup
  // Use hasRole() from useUserRoles (authoritative table) instead of profile.roles (legacy)
  const needsSupplierSetup = !isTeamMember &&
                            currentRole === 'supplier' && 
                            hasRole('supplier') && 
                            !isSupplierProfileComplete(supplierProfile);
                            
  const needsBuyerSetup = !isTeamMember &&
                         currentRole === 'buyer' && 
                         hasRole('buyer') && 
                         !isBuyerProfileComplete(buyerProfile);

  console.log('Dashboard state:', {
    currentRole,
    supplierProfile: !!supplierProfile,
    buyerProfile: !!buyerProfile,
    supplierProfileComplete: isSupplierProfileComplete(supplierProfile),
    buyerProfileComplete: isBuyerProfileComplete(buyerProfile),
    isTeamMember,
    isDualRole,
    contexts: contexts.length,
    needsSupplierSetup,
    needsBuyerSetup,
    hasMultipleRoles,
    userRoles: profile.roles
  });

  if (needsSupplierSetup) {
    return (
      <div className="space-y-6">
        {hasMultipleRoles && (
          <RoleSwitcher currentRole={currentRole} onRoleChange={handleRoleSwitch} />
        )}
        <SupplierProfileSetup onProfileCreated={handleProfileCreated} />
      </div>
    );
  }

  if (needsBuyerSetup) {
    return (
      <div className="space-y-6">
        {hasMultipleRoles && (
          <RoleSwitcher currentRole={currentRole} onRoleChange={handleRoleSwitch} />
        )}
        <BuyerProfileSetup onProfileCreated={handleProfileCreated} />
      </div>
    );
  }

  // Create user object with expected structure for dashboard components
  const dashboardUser = {
    roles: profile.roles as ('buyer' | 'supplier')[],
    name: isImpersonating && impersonatedUser ? impersonatedUser.fullName : (profile.full_name || 'User'),
    currentRole: currentRole
  };

  // When impersonating, use the impersonated company's profile
  const effectiveBuyerProfile = isImpersonating ? impersonatedProfiles.buyer : buyerProfile;
  const effectiveSupplierProfile = isImpersonating ? impersonatedProfiles.supplier : supplierProfile;

  // Show the appropriate dashboard based on current role
  return (
    <div className={`space-y-6 ${isImpersonating ? 'pt-12' : ''}`}>
      {currentRole === 'supplier' ? (
        <SupplierDashboard 
          user={dashboardUser} 
          onLogout={handleLogout} 
          onRoleSwitch={handleRoleSwitch}
          impersonatedSupplierId={isImpersonating ? impersonatedCompany?.id : undefined}
        />
      ) : (
        <BuyerDashboard 
          user={dashboardUser} 
          onLogout={handleLogout} 
          onRoleSwitch={handleRoleSwitch}
          impersonatedBuyerId={isImpersonating ? impersonatedCompany?.id : undefined}
        />
      )}
    </div>
  );
};

export default DynamicDashboard;
