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

  const getFeatureList = (features: any) => {
    return Object.entries(features)
      .filter(([_, value]) => value === true)
      .map(([key, _]) => {
        // Convert feature keys to readable text
        const featureNames: { [key: string]: string } = {
          ai_insights: 'AI-Powered Insights',
          advanced_reports: 'Advanced Reports',
          comparison_reports: 'Comparison Reports',
          priority_support: 'Priority Support',
          unlimited_reports: 'Unlimited Reports',
          document_templates: 'Document Templates',
          basic_reports: 'Basic Reports',
          email_support: 'Email Support'
        };
        return featureNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Subscription Plans</h3>
        <p className="text-muted-foreground">Choose the perfect plan for your {userType} needs</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {filteredPlans.map((plan) => {
        const isCurrentPlan = subscriptionData?.plan_type === plan.plan_type;
        const isEnterprise = plan.plan_type.includes('enterprise');
        const features = getFeatureList(plan.features);

        return (
          <Card key={plan.id} className={`relative ${isCurrentPlan ? 'ring-2 ring-primary' : ''}`}>
            {isCurrentPlan && (
              <Badge className="absolute -top-2 left-4 bg-primary">
                Current Plan
              </Badge>
            )}
            {isEnterprise && (
              <Badge className="absolute -top-2 right-4 bg-gradient-to-r from-purple-500 to-pink-500">
                Most Popular
              </Badge>
            )}
            
            <CardHeader>
              <CardTitle className="text-xl">{plan.plan_name}</CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold">{formatPrice(plan.monthly_price_cents)}</span>
                <span className="text-muted-foreground">/month</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Monthly Credits:</p>
                <p className="text-lg font-semibold">
                  {plan.monthly_credits === 999999 ? 'Unlimited' : plan.monthly_credits}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Features:</p>
                <ul className="space-y-2">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handleSubscribe(plan)}
                disabled={isCurrentPlan}
                variant={isEnterprise ? 'default' : 'outline'}
              >
                {isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
      </div>
    </div>
  );
};