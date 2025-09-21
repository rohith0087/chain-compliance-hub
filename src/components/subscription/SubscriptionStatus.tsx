import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Calendar, 
  Zap, 
  TrendingUp, 
  Settings,
  Crown
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { format } from 'date-fns';

export const SubscriptionStatus: React.FC = () => {
  const { subscriptionData, manageSubscription, loading } = useSubscription();

  const handleManageSubscription = async () => {
    const result = await manageSubscription();
    if (result?.url) {
      window.open(result.url, '_blank');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Subscription Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Subscription Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Unable to load subscription information.</p>
        </CardContent>
      </Card>
    );
  }

  const isEnterprise = subscriptionData.plan_type?.includes('enterprise');
  const isProfessional = subscriptionData.plan_type?.includes('professional');
  const isBasic = subscriptionData.plan_type?.includes('basic') || subscriptionData.plan_type?.includes('starter');

  const getPlanDisplayName = (planType: string | null) => {
    if (!planType) return 'Free Plan';
    
    const planNames: { [key: string]: string } = {
      'buyer_basic': 'Buyer Basic',
      'buyer_professional': 'Buyer Professional',
      'buyer_enterprise': 'Buyer Enterprise',
      'supplier_starter': 'Supplier Starter',
      'supplier_professional': 'Supplier Professional',
      'supplier_enterprise': 'Supplier Enterprise'
    };
    
    return planNames[planType] || planType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getPlanIcon = () => {
    if (isEnterprise) return <Crown className="h-5 w-5 text-purple-500" />;
    if (isProfessional) return <TrendingUp className="h-5 w-5 text-blue-500" />;
    return <Zap className="h-5 w-5 text-green-500" />;
  };

  const getPlanBadgeVariant = () => {
    if (isEnterprise) return 'default';
    if (isProfessional) return 'secondary';
    return 'outline';
  };

  const getCreditUsagePercentage = () => {
    if (isEnterprise) return 0; // Enterprise has unlimited
    const totalUsed = subscriptionData.total_consumed_credits;
    const totalPurchased = subscriptionData.total_purchased_credits + 10; // Include initial free credits
    return totalPurchased > 0 ? Math.min((totalUsed / totalPurchased) * 100, 100) : 0;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getPlanIcon()}
              <span>Current Plan</span>
            </div>
            <Badge variant={getPlanBadgeVariant()}>
              {subscriptionData.subscribed ? 'Active' : 'Free'}
            </Badge>
          </CardTitle>
          <CardDescription>
            {getPlanDisplayName(subscriptionData.plan_type)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscriptionData.subscribed && subscriptionData.subscription_end && (
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Renews on {format(new Date(subscriptionData.subscription_end), 'MMM dd, yyyy')}</span>
            </div>
          )}
          
          {subscriptionData.stripe_customer_exists && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleManageSubscription}
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Credits Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Credit Balance</span>
          </CardTitle>
          <CardDescription>
            Available credits for report generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold">
              {isEnterprise ? '∞' : subscriptionData.credits}
            </p>
            <p className="text-sm text-muted-foreground">
              {isEnterprise ? 'Unlimited credits' : 'Available credits'}
            </p>
          </div>

          {!isEnterprise && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Usage</span>
                  <span>{subscriptionData.total_consumed_credits} used</span>
                </div>
                <Progress value={getCreditUsagePercentage()} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Purchased</p>
                  <p className="font-semibold">{subscriptionData.total_purchased_credits}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Consumed</p>
                  <p className="font-semibold">{subscriptionData.total_consumed_credits}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};