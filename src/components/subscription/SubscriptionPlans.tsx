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
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Subscription Plans</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the perfect plan for your {userType} needs. All plans include our core features with varying levels of advanced capabilities.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {filteredPlans.map((plan) => {
        const isCurrentPlan = subscriptionData?.plan_type === plan.plan_type;
        const isEnterprise = plan.plan_type.includes('enterprise');
        const features = getFeatureList(plan.features);

        return (
          <Card key={plan.id} className={`relative border-border shadow-sm hover:shadow-md transition-shadow ${isCurrentPlan ? 'ring-2 ring-primary shadow-md' : ''} ${isEnterprise ? 'border-primary/20' : ''}`}>
            {isCurrentPlan && (
              <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground px-3 py-1">
                Current Plan
              </Badge>
            )}
            {isEnterprise && !isCurrentPlan && (
              <Badge className="absolute -top-3 right-4 bg-slate-900 text-white px-3 py-1">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="pb-6">
              <CardTitle className="text-xl font-semibold">{plan.plan_name}</CardTitle>
              <CardDescription className="space-y-1">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold text-foreground">{formatPrice(plan.monthly_price_cents)}</span>
                  <span className="text-muted-foreground ml-2">/month</span>
                </div>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Monthly Credits</p>
                <p className="text-2xl font-semibold text-foreground">
                  {plan.monthly_credits === 999999 ? 'Unlimited' : plan.monthly_credits.toLocaleString()}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Features</p>
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="h-4 w-4 text-emerald-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="pt-6">
              <Button 
                className="w-full h-11" 
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