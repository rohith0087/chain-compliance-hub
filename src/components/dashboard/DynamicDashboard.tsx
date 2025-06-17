
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySetup } from '@/hooks/useCompanySetup';
import BuyerDashboard from '@/components/BuyerDashboard';
import SupplierDashboard from '@/components/SupplierDashboard';
import SupplierProfileSetup from '@/components/supplier/SupplierProfileSetup';
import BuyerProfileSetup from '@/components/buyer/BuyerProfileSetup';
import RoleSwitcher from '@/components/RoleSwitcher';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DynamicDashboard = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const { getSupplierProfile, getBuyerProfile } = useCompanySetup();
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('buyer');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    if (user && profile && profile.roles?.length > 0) {
      console.log('User profile loaded with roles:', profile.roles);
      // Set default role to the first role the user has
      setCurrentRole(profile.roles.includes('buyer') ? 'buyer' : 'supplier');
      loadProfiles();
    }
  }, [user, profile]);

  const loadProfiles = async () => {
    console.log('Loading profiles...');
    setProfilesLoading(true);
    try {
      if (profile?.roles?.includes('supplier')) {
        console.log('Loading supplier profile...');
        const supplier = await getSupplierProfile();
        console.log('Loaded supplier profile:', supplier);
        setSupplierProfile(supplier);
      }
      
      if (profile?.roles?.includes('buyer')) {
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
  const needsSupplierSetup = currentRole === 'supplier' && profile.roles?.includes('supplier') && !supplierProfile;
  const needsBuyerSetup = currentRole === 'buyer' && profile.roles?.includes('buyer') && !buyerProfile;

  console.log('Dashboard state:', {
    currentRole,
    supplierProfile: !!supplierProfile,
    buyerProfile: !!buyerProfile,
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

  // Don't show role switcher in the dashboard components since we handle it here
  return (
    <div className="space-y-6">
      {currentRole === 'supplier' ? (
        <SupplierDashboard 
          user={dashboardUser} 
          onLogout={signOut} 
          onRoleSwitch={handleRoleSwitch} 
        />
      ) : (
        <BuyerDashboard 
          user={dashboardUser} 
          onLogout={signOut} 
          onRoleSwitch={handleRoleSwitch} 
        />
      )}
    </div>
  );
};

export default DynamicDashboard;
