import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';
import { SubscriptionPlans } from '@/components/subscription/SubscriptionPlans';
import { CreditPackages } from '@/components/subscription/CreditPackages';
import { Badge } from '@/components/ui/badge';

export default function SubscriptionPage() {
  const { profile } = useAuth();
  
  // Determine user type based on roles
  const userType = profile?.roles?.includes('buyer') ? 'buyer' : 'supplier';

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto py-8 px-4 space-y-8 max-w-7xl">
        {/* Simplified Header */}
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