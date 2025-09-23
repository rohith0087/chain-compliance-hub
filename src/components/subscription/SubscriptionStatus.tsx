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
    if (isEnterprise) return <Crown className="h-5 w-5 text-slate-600" />;
    if (isProfessional) return <TrendingUp className="h-5 w-5 text-slate-600" />;
    return <Zap className="h-5 w-5 text-slate-600" />;
  };

  const getPlanBadgeVariant = () => {
    if (subscriptionData.subscribed) return 'default';
    return 'secondary';
  };

  const getCreditUsagePercentage = () => {
    if (isEnterprise) return 0; // Enterprise has unlimited
    const totalUsed = subscriptionData.total_consumed_credits;
    const totalPurchased = subscriptionData.total_purchased_credits + 10; // Include initial free credits
    return totalPurchased > 0 ? Math.min((totalUsed / totalPurchased) * 100, 100) : 0;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Current Plan Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-card shadow-elegant">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <CardHeader className="relative pb-4">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center space-x-3">
              {getPlanIcon()}
              <span className="text-foreground">Current Plan</span>
            </div>
            <Badge 
              variant={getPlanBadgeVariant()} 
              className={`px-3 py-1.5 text-xs font-medium ${
                subscriptionData.subscribed 
                  ? 'bg-green-accent/15 text-green-accent border-green-accent/20' 
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {subscriptionData.subscribed ? 'Active' : 'Free Plan'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-base text-foreground/80">
            {getPlanDisplayName(subscriptionData.plan_type)}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-4">
          {subscriptionData.subscribed && subscriptionData.subscription_end && (
            <div className="flex items-center space-x-2 text-sm text-foreground/70 bg-accent/10 rounded-lg p-3">
              <Calendar className="h-4 w-4 text-accent" />
              <span>Renews on {format(new Date(subscriptionData.subscription_end), 'MMM dd, yyyy')}</span>
            </div>
          )}
          
          {subscriptionData.stripe_customer_exists && (
            <Button 
              variant="outline" 
              size="default"
              onClick={handleManageSubscription}
              className="w-full border-accent/20 hover:bg-accent/10 hover:border-accent/30 transition-all duration-200"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Credits Card */}
      <Card className="relative overflow-hidden border-0 bg-gradient-card shadow-elegant">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <CardHeader className="relative pb-4">
          <CardTitle className="flex items-center space-x-3 text-lg">
            <Zap className="h-5 w-5 text-blue-accent" />
            <span className="text-foreground">Credit Balance</span>
          </CardTitle>
          <CardDescription className="text-base text-foreground/80">
            Available credits for report generation
          </CardDescription>
        </CardHeader>
        <CardContent className="relative space-y-6">
          <div className="text-center py-4">
            <div className="relative inline-block">
              <p className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                {isEnterprise ? '∞' : subscriptionData.credits.toLocaleString()}
              </p>
              {!isEnterprise && subscriptionData.credits < 10 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-accent rounded-full animate-pulse"></div>
              )}
            </div>
            <p className="text-sm text-foreground/70 mt-2 font-medium">
              {isEnterprise ? 'Unlimited credits' : 'Available credits'}
            </p>
          </div>

          {!isEnterprise && (
            <>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm bg-accent/5 rounded-lg p-3">
                  <span className="text-foreground/80">Credits Used</span>
                  <span className="font-semibold text-foreground">{subscriptionData.total_consumed_credits.toLocaleString()}</span>
                </div>
                <Progress 
                  value={getCreditUsagePercentage()} 
                  className="h-3 bg-muted/50" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="text-center p-4 bg-gradient-subtle rounded-xl border border-border/50">
                  <p className="text-xs text-foreground/60 uppercase tracking-wide font-medium">Total Purchased</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{subscriptionData.total_purchased_credits.toLocaleString()}</p>
                </div>
                <div className="text-center p-4 bg-gradient-subtle rounded-xl border border-border/50">
                  <p className="text-xs text-foreground/60 uppercase tracking-wide font-medium">Total Consumed</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{subscriptionData.total_consumed_credits.toLocaleString()}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};