import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useSubscription, SubscriptionPlan } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface SubscriptionPlansProps {
  userType: 'buyer' | 'supplier';
}

export const SubscriptionPlans: React.FC<SubscriptionPlansProps> = ({ userType }) => {
  const { subscriptionPlans, subscriptionData, createSubscriptionCheckout, loading } = useSubscription();

  const filteredPlans = subscriptionPlans.filter(plan => 
    plan.target_audience === userType
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">Subscription Plans</h3>
          <p className="text-muted-foreground">Loading available plans...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!subscriptionPlans || subscriptionPlans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">Subscription Plans</h3>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No subscription plans are currently available. 
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Plans are being configured. Please check back later or contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (filteredPlans.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">Subscription Plans</h3>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No subscription plans available for {userType}s at the moment.</p>
            <p className="text-sm text-muted-foreground mt-2">Check back later or contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    const result = await createSubscriptionCheckout(plan.stripe_price_id, plan.plan_type);
    
    if (result?.url) {
      window.open(result.url, '_blank');
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  // Simplified feature mapping - max 4 features
  const getSimplifiedFeatures = (plan: SubscriptionPlan): string[] => {
    const creditsText = plan.monthly_credits === 999999 
      ? 'Unlimited credits' 
      : `${plan.monthly_credits.toLocaleString()} credits/mo`;
    
    const featureMap: Record<string, string[]> = {
      'free': [
        'Basic features',
        'Email support',
        'Standard reports'
      ],
      'basic': [
        creditsText,
        'Email support',
        'Basic reports',
        'Document tools'
      ],
      'professional': [
        creditsText,
        'Priority support',
        'Advanced analytics',
        'AI insights'
      ],
      'enterprise': [
        'Unlimited credits',
        'Dedicated support',
        'Custom features',
        'White-label option'
      ]
    };
    
    return featureMap[plan.plan_type] || [creditsText, 'Email support', 'Basic reports'];
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Available Plans</h2>
        <p className="text-muted-foreground">
          All plans include core features. Choose what fits your needs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredPlans.map((plan) => {
          const isCurrentPlan = subscriptionData?.plan_type === plan.plan_type;
          const isRecommended = plan.plan_type === 'professional';
          const features = getSimplifiedFeatures(plan);

          return (
            <Card 
              key={plan.id}
              className={`relative transition-all ${
                isCurrentPlan ? 'border-primary ring-2 ring-primary/20' : ''
              } ${isRecommended && !isCurrentPlan ? 'border-blue-500/50' : ''}`}
            >
              {isRecommended && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-3 py-1 text-xs font-semibold rounded-full">
                  Recommended
                </div>
              )}
              
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-full">
                  Current Plan
                </div>
              )}

              <CardHeader className="space-y-4 pt-8">
                <CardTitle className="text-2xl capitalize">{plan.plan_type}</CardTitle>
                
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">
                    {formatPrice(plan.monthly_price_cents)}
                  </span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <ul className="space-y-2.5">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan)}
                  disabled={isCurrentPlan || loading}
                  className="w-full"
                  variant={isCurrentPlan ? "secondary" : "default"}
                >
                  {isCurrentPlan ? 'Current Plan' : plan.plan_type === 'enterprise' ? 'Contact Sales' : 'Select Plan'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};