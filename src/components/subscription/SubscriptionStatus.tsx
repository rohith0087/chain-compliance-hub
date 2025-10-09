import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Zap, Building2, CreditCard, Coins } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

export const SubscriptionStatus: React.FC = () => {
  const { 
    subscriptionData, 
    loading, 
    error,
    manageSubscription 
  } = useSubscription();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !subscriptionData) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Can't load your plan right now. Try refreshing!</p>
        </CardContent>
      </Card>
    );
  }

  const handleManageSubscription = async () => {
    const { url } = await manageSubscription();
    if (url) {
      window.open(url, '_blank');
    }
  };

  // Helper functions
  const isEnterprise = subscriptionData.plan_type === 'enterprise';
  const isProfessional = subscriptionData.plan_type === 'professional';
  const isBasic = subscriptionData.plan_type === 'basic';

  const getPlanDisplayName = (planType: string | null) => {
    if (!planType) return 'Free Plan';
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  };

  const getPlanIcon = () => {
    if (isEnterprise) return <Building2 className="h-6 w-6 text-primary" />;
    if (isProfessional) return <Zap className="h-6 w-6 text-primary" />;
    if (isBasic) return <Crown className="h-6 w-6 text-primary" />;
    return <Crown className="h-6 w-6 text-muted-foreground" />;
  };

  const getPlanBadgeVariant = () => {
    if (subscriptionData.subscribed) return "default";
    return "secondary";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getPlanIcon()}
            <div>
              <CardTitle className="text-2xl">{getPlanDisplayName(subscriptionData.plan_type)}</CardTitle>
              <CardDescription>
                {subscriptionData.subscribed ? 'Active subscription' : 'Free plan'}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={getPlanBadgeVariant()}
            className="px-3 py-1 font-semibold"
          >
            {subscriptionData.subscribed ? 'Active' : 'Free'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Consolidated Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptionData.subscription_end && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Next Billing</p>
              <p className="text-lg font-semibold">
                {new Date(subscriptionData.subscription_end).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            </div>
          )}
          
          {!isEnterprise && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Credits Left</p>
              <p className="text-lg font-semibold">
                {subscriptionData.credits?.toLocaleString() || 0}
              </p>
            </div>
          )}
          
          {isEnterprise && (
            <div className="p-4 bg-gradient-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Credits</p>
              <p className="text-lg font-semibold">Unlimited</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={handleManageSubscription}
            variant="outline"
            className="flex-1"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Billing
          </Button>
          {!isEnterprise && (
            <Button 
              onClick={() => {
                const creditsSection = document.getElementById('credits-section');
                if (creditsSection) {
                  creditsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex-1"
            >
              <Coins className="mr-2 h-4 w-4" />
              Buy Credits
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};