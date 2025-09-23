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
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto py-8 space-y-8">
        {/* Page Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-primary opacity-5 rounded-xl"></div>
          <div className="relative px-8 py-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
                  Subscription & Billing
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  Manage your subscription plan, monitor credit usage, and unlock powerful features for your {userType} account
                </p>
              </div>
              <Badge 
                variant="secondary" 
                className="px-4 py-2 text-sm font-medium bg-gradient-card border-0 shadow-subtle"
              >
                {userType === 'buyer' ? 'Buyer Account' : 'Supplier Account'}
              </Badge>
            </div>
          </div>
        </div>

      {/* Current Subscription Status */}
      <SubscriptionStatus />

        {/* Subscription Management Tabs */}
        <Tabs defaultValue="plans" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-14 p-1.5 bg-card border border-border shadow-modern rounded-xl">
              <TabsTrigger 
                value="plans" 
                className="flex items-center gap-3 h-11 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-elegant transition-all duration-200"
              >
                <Crown className="h-4 w-4" />
                Subscription Plans
              </TabsTrigger>
              <TabsTrigger 
                value="credits" 
                className="flex items-center gap-3 h-11 text-sm font-medium rounded-lg data-[state=active]:bg-gradient-primary data-[state=active]:text-white data-[state=active]:shadow-elegant transition-all duration-200"
              >
                <CreditCard className="h-4 w-4" />
                Credit Packages
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="plans" className="space-y-8">
            <SubscriptionPlans userType={userType} />
          </TabsContent>

          <TabsContent value="credits" className="space-y-8">
            <CreditPackages />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}