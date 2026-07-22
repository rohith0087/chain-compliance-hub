import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';
import { SubscriptionPlans } from '@/components/subscription/SubscriptionPlans';
import { CreditPackages } from '@/components/subscription/CreditPackages';
import { Badge } from '@/components/ui/badge';
import UnauthorizedAccess from '@/components/auth/UnauthorizedAccess';
import { supabase } from '@/integrations/supabase/client';

export default function SubscriptionPage({ embedded = false }: { embedded?: boolean }) {
  const { profile, user } = useAuth();
  const { hasRole } = useUserRoles();
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [companyIdLoading, setCompanyIdLoading] = useState(true);
  
  // Determine user type based on roles
  const userType = hasRole('buyer') ? 'buyer' : 'supplier';
  
  // Resolve the actual company_id from company_users table
  useEffect(() => {
    const resolveCompanyId = async () => {
      if (!user) {
        setCompanyIdLoading(false);
        return;
      }
      
      try {
        // Check company_users for user's company_id
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('profile_id', user.id)
          .eq('company_type', userType)
          .eq('status', 'active')
          .maybeSingle();
        
        if (companyUser?.company_id) {
          setResolvedCompanyId(companyUser.company_id);
        } else {
          setResolvedCompanyId(profile?.id || null);
        }
      } catch (error) {
        console.error('Error resolving company ID:', error);
        setResolvedCompanyId(profile?.id || null);
      } finally {
        setCompanyIdLoading(false);
      }
    };
    
    resolveCompanyId();
  }, [user, userType, profile]);
  
  const { canViewSubscription, role, isOwner, loading } = useCompanyPermissions(resolvedCompanyId || undefined, userType);

  // Show loading while resolving company ID or permissions
  if (loading || companyIdLoading) {
    return (
      <div className={`flex items-center justify-center ${embedded ? 'py-24' : 'min-h-screen'}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check permission - only company owner can access
  if (!canViewSubscription()) {
    return <UnauthorizedAccess requiredRoles={['company_owner']} currentRole={isOwner ? 'company_owner' : role} />;
  }

  return (
    // embedded: rendered inside the buyer Settings > Plan & billing page — the
    // page supplies the header and there is no full-screen canvas to claim.
    <div className={embedded ? '' : 'min-h-screen bg-gradient-subtle'}>
      <div className={embedded ? 'space-y-8' : 'container mx-auto py-8 px-4 space-y-8 max-w-7xl'}>
        {/* Simplified Header */}
        {!embedded && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">
                Subscription & Billing
              </h1>
              <Badge variant="secondary" className="px-3 py-1 text-sm">
                {userType === 'buyer' ? 'Buyer' : 'Supplier'}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Simple, transparent pricing. Upgrade or downgrade anytime.
            </p>
          </div>
        )}

        {/* Current Status */}
        <SubscriptionStatus />

        {/* Available Plans */}
        <SubscriptionPlans userType={userType} />

        {/* Quick Credit Add-ons */}
        <CreditPackages />
      </div>
    </div>
  );
}
