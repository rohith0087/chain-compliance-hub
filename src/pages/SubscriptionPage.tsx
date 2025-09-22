import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus';
import { SubscriptionPlans } from '@/components/subscription/SubscriptionPlans';
import { CreditPackages } from '@/components/subscription/CreditPackages';
import { Badge } from '@/components/ui/badge';
import { Crown, CreditCard, Package } from 'lucide-react';

export default function SubscriptionPage() {
  const { profile } = useAuth();
  
  // Determine user type based on roles
  const userType = profile?.roles?.includes('buyer') ? 'buyer' : 'supplier';

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Subscription & Billing
          </h1>
          <p className="text-base text-muted-foreground">
            Manage your subscription plan and monitor your credit usage
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm font-medium">
          {userType === 'buyer' ? 'Buyer Account' : 'Supplier Account'}
        </Badge>
      </div>

      {/* Current Subscription Status */}
      <SubscriptionStatus />

      {/* Subscription Management Tabs */}
      <Tabs defaultValue="plans" className="space-y-8">
        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/30">
          <TabsTrigger value="plans" className="flex items-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Crown className="h-4 w-4" />
            Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2 h-10 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />
            Credit Packages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <SubscriptionPlans userType={userType} />
        </TabsContent>

        <TabsContent value="credits" className="space-y-6">
          <CreditPackages />
        </TabsContent>
      </Tabs>
    </div>
  );
}