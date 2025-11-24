
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import { supabase } from '@/integrations/supabase/client';
import BuyerDashboard from '@/components/BuyerDashboard';
import SupplierDashboard from '@/components/SupplierDashboard';
import SupplierProfileSetup from '@/components/supplier/SupplierProfileSetup';
import BuyerProfileSetup from '@/components/buyer/BuyerProfileSetup';
import RoleSwitcher from '@/components/RoleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

const DynamicDashboard = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { hasRole, roles } = useUserRoles();
  const { getSupplierProfile, getBuyerProfile } = useCompanySetup();
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('buyer');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [isTeamMember, setIsTeamMember] = useState<boolean>(false);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Timeout detection for infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((authLoading || profilesLoading) && !sessionError) {
        console.error('Session timeout: Loading took too long');
        setLoadingTimeout(true);
        setSessionError('Session initialization is taking longer than expected. Your profile data may be missing.');
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timer);
  }, [authLoading, profilesLoading, sessionError]);

  // Effect 1: Check team membership when user and roles are available
  useEffect(() => {
    if (user && roles.length > 0) {
      console.log('User profile loaded with roles:', roles);
      setLoadingTimeout(false);
      setSessionError(null);
      checkTeamMembership(); // Just check membership, don't chain
    }
  }, [user, roles]);

  // Effect 2: Load profiles AFTER membership check completes
  useEffect(() => {
    // Wait for membership check to complete
    if (membershipLoading) {
      return;
    }
    
    // Skip if no user or no roles
    if (!user || roles.length === 0) {
      return;
    }
    
    console.log('Membership check complete, isTeamMember:', isTeamMember);
    loadProfiles();
  }, [membershipLoading, user, roles, isTeamMember]);

  const checkTeamMembership = async () => {
    if (!user) {
      setMembershipLoading(false);
      return;
    }
    
    try {
      setMembershipLoading(true);
      
      // Check if user has any company_users records (active OR pending)
      const { data, error } = await supabase
        .from('company_users')
        .select('id, company_type, status')
        .eq('profile_id', user.id)
        .in('status', ['active', 'pending'])
        .limit(1)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Ignore "no rows" error
          console.error('Error checking team membership:', error);
        }
        setIsTeamMember(false);
        return;
      }

      const isMember = !!data;
      console.log('Team membership check:', isMember, 'status:', data?.status, 'company_type:', data?.company_type);
      setIsTeamMember(isMember);
      
      // If user is a team member, set their role based on company_type (overrides profiles.roles)
      if (isMember && data?.company_type) {
        const teamRole = data.company_type === 'buyer' ? 'buyer' : 'supplier';
        console.log('Setting team member role to:', teamRole);
        setCurrentRole(teamRole);
      }
    } catch (error) {
      console.error('Error in checkTeamMembership:', error);
      setIsTeamMember(false);
    } finally {
      setMembershipLoading(false);
    }
  };

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
    
    // Company owners need these fields filled
    return !!(buyer.company_name && buyer.industry && 
             buyer.company_name.trim() !== '' && 
             buyer.industry !== 'General Business');
  };

  // Check if supplier profile is properly set up
  const isSupplierProfileComplete = (supplier: any) => {
    // Team members don't need their own supplier profiles
    if (isTeamMember) return true;
    
    if (!supplier) return false;
    
    // Company owners need these fields filled
    return !!(supplier.company_name && supplier.industry && 
             supplier.company_name.trim() !== '' && 
             supplier.industry !== 'General Business');
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

  // Show loading while checking team membership
  if (membershipLoading) {
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

  // Check if user has multiple roles
  const hasMultipleRoles = profile.roles?.length > 1;

  // Check if current role needs profile setup
  // Team members (users with company_users records) should NOT see profile setup
  // Only company owners who don't have a complete profile should see setup
  const needsSupplierSetup = currentRole === 'supplier' && 
                            profile.roles?.includes('supplier') && 
                            !isTeamMember && 
                            !isSupplierProfileComplete(supplierProfile);
                            
  const needsBuyerSetup = currentRole === 'buyer' && 
                         profile.roles?.includes('buyer') && 
                         !isTeamMember && 
                         !isBuyerProfileComplete(buyerProfile);

  console.log('Dashboard state:', {
    currentRole,
    supplierProfile: !!supplierProfile,
    buyerProfile: !!buyerProfile,
    supplierProfileComplete: isSupplierProfileComplete(supplierProfile),
    buyerProfileComplete: isBuyerProfileComplete(buyerProfile),
    isTeamMember,
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
    name: profile.full_name || 'User',
    currentRole: currentRole
  };

  // Show the appropriate dashboard based on current role
  return (
    <div className="space-y-6">
      {currentRole === 'supplier' ? (
        <SupplierDashboard 
          user={dashboardUser} 
          onLogout={handleLogout} 
          onRoleSwitch={handleRoleSwitch} 
        />
      ) : (
        <BuyerDashboard 
          user={dashboardUser} 
          onLogout={handleLogout} 
          onRoleSwitch={handleRoleSwitch} 
        />
      )}
    </div>
  );
};

export default DynamicDashboard;
