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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Subscription & Billing
          </h1>
          <p className="text-muted-foreground">
            Manage your subscription plan and monitor your credit usage
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {userType === 'buyer' ? 'Buyer Account' : 'Supplier Account'}
        </Badge>
      </div>

      {/* Current Subscription Status */}
      <SubscriptionStatus />

      {/* Subscription Management Tabs */}
      <Tabs defaultValue="plans" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="plans" className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Subscription Plans
          </TabsTrigger>
          <TabsTrigger value="credits" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Credit Packages
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Available Plans
              </CardTitle>
              <CardDescription>
                Choose a subscription plan that fits your {userType} needs. 
                All plans include our core features with varying levels of advanced capabilities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionPlans userType={userType} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Credit Packages
              </CardTitle>
              <CardDescription>
                Purchase additional credits for generating detailed compliance reports and accessing premium features.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreditPackages />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Credit Usage Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm">Standard Reports</h4>
                  <p className="text-sm text-muted-foreground">5 credits per report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Basic compliance summary and document status
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm">Detailed Reports</h4>
                  <p className="text-sm text-muted-foreground">10 credits per report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Advanced analytics and performance metrics
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm">Comparison Reports</h4>
                  <p className="text-sm text-muted-foreground">15 credits per report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Multi-supplier comparison analysis
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold text-sm">AI-Enhanced Reports</h4>
                  <p className="text-sm text-muted-foreground">20 credits per report</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    AI insights and recommendations
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}