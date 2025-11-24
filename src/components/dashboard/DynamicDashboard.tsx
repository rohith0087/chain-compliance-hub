
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

const DynamicDashboard = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { hasRole, roles } = useUserRoles();
  const { getSupplierProfile, getBuyerProfile } = useCompanySetup();
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('buyer');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [isTeamMember, setIsTeamMember] = useState<boolean>(false);

  useEffect(() => {
    if (user && roles.length > 0) {
      console.log('User profile loaded with roles:', roles);
      // Set default role to the first role the user has
      setCurrentRole(hasRole('buyer') ? 'buyer' : 'supplier');
      loadProfiles();
      checkTeamMembership();
    }
  }, [user, roles]);

  const checkTeamMembership = async () => {
    if (!user) return;
    
    try {
      // Check if user has any active company_users records (indicating they're a team member)
      const { data, error } = await supabase
        .from('company_users')
        .select('id')
        .eq('profile_id', user.id)
        .eq('status', 'active')
        .limit(1);

      if (error) {
        console.error('Error checking team membership:', error);
        return;
      }

      const isMember = data && data.length > 0;
      console.log('Team membership check:', isMember);
      setIsTeamMember(isMember);
    } catch (error) {
      console.error('Error in checkTeamMembership:', error);
    }
  };

  const loadProfiles = async () => {
    console.log('Loading profiles...');
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

  // Check if buyer profile is properly set up (not just auto-created with defaults)
  const isBuyerProfileComplete = (buyer: any) => {
    if (!buyer) return false;
    
    // Check if it's an auto-created profile with default values
    const hasDefaultCompanyName = buyer.company_name === "James's Company" || 
                                  buyer.company_name === `${profile?.full_name}'s Company`;
    const hasDefaultIndustry = buyer.industry === 'General Business';
    
    // If both company name and industry are defaults, consider it incomplete
    if (hasDefaultCompanyName && hasDefaultIndustry) {
      return false;
    }
    
    // Also check if essential fields are missing
    return !!(buyer.company_name && buyer.industry && 
             buyer.company_name.trim() !== '' && 
             buyer.industry !== 'General Business');
  };

  // Check if supplier profile is properly set up
  const isSupplierProfileComplete = (supplier: any) => {
    if (!supplier) return false;
    
    // Check if it's an auto-created profile with default values
    const hasDefaultCompanyName = supplier.company_name === "James's Company" || 
                                  supplier.company_name === `${profile?.full_name}'s Company`;
    const hasDefaultIndustry = supplier.industry === 'General Business';
    
    // If both are defaults, consider it incomplete
    if (hasDefaultCompanyName && hasDefaultIndustry) {
      return false;
    }
    
    return !!(supplier.company_name && supplier.industry && 
             supplier.company_name.trim() !== '' && 
             supplier.industry !== 'General Business');
  };

  // Show loading while auth is loading or we don't have user/profile yet
  if (authLoading || !user || !profile) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-gray-600">Loading your profile...</p>
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <p className="text-gray-600">Setting up your dashboard...</p>
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
