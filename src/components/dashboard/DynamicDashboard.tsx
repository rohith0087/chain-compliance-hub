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
  const { user, profile, signOut } = useAuth();
  const { getSupplierProfile, getBuyerProfile } = useCompanySetup();
  const [currentRole, setCurrentRole] = useState<'buyer' | 'supplier'>('supplier');
  const [supplierProfile, setSupplierProfile] = useState<any>(null);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    if (user && profile && profile.roles?.length > 0) {
      // Set default role to the first role the user has
      setCurrentRole(profile.roles.includes('supplier') ? 'supplier' : 'buyer');
      loadProfiles();
    }
  }, [user, profile]);

  const loadProfiles = async () => {
    setProfilesLoading(true);
    try {
      if (profile?.roles?.includes('supplier')) {
        const supplier = await getSupplierProfile();
        setSupplierProfile(supplier);
      }
      
      if (profile?.roles?.includes('buyer')) {
        const buyer = await getBuyerProfile();
        setBuyerProfile(buyer);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleRoleSwitch = (newRole: 'buyer' | 'supplier') => {
    setCurrentRole(newRole);
  };

  const handleProfileCreated = () => {
    console.log('Profile created, reloading profiles...');
    loadProfiles();
  };

  if (!user || !profile) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">Loading your profile...</p>
        </CardContent>
      </Card>
    );
  }

  if (profilesLoading) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="pt-6">
          <p className="text-center text-gray-600">Setting up your dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  // If user has both roles, show role switcher
  const hasMultipleRoles = profile.roles?.length > 1;

  // Check if current role needs profile setup
  const needsSupplierSetup = currentRole === 'supplier' && profile.roles?.includes('supplier') && !supplierProfile;
  const needsBuyerSetup = currentRole === 'buyer' && profile.roles?.includes('buyer') && !buyerProfile;

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
        <BuyerProfileSetup />
      </div>
    );
  }

  // Create user object with expected structure for dashboard components
  const dashboardUser = {
    roles: profile.roles as ('buyer' | 'supplier')[],
    name: profile.full_name || 'User',
    currentRole: currentRole
  };

  return (
    <div className="space-y-6">
      {hasMultipleRoles && (
        <RoleSwitcher currentRole={currentRole} onRoleChange={handleRoleSwitch} />
      )}
      
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
