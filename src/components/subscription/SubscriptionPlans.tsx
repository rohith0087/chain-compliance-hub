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
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
          Subscription Plans
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Choose the perfect plan for your {userType} needs. All plans include our core features with varying levels of advanced capabilities and AI-powered insights.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
      {filteredPlans.map((plan) => {
        const isCurrentPlan = subscriptionData?.plan_type === plan.plan_type;
        const isEnterprise = plan.plan_type.includes('enterprise');
        const features = getFeatureList(plan.features);

        return (
          <Card key={plan.id} className={`relative overflow-hidden border-0 bg-gradient-card shadow-elegant hover:shadow-modern transition-all duration-300 ${isCurrentPlan ? 'ring-2 ring-primary/30 shadow-modern scale-105' : ''} ${isEnterprise ? 'bg-gradient-primary/5' : ''}`}>
            <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
            
            {isCurrentPlan && (
              <Badge className="absolute -top-3 left-4 bg-green-accent text-white px-4 py-1.5 shadow-subtle">
                Current Plan
              </Badge>
            )}
            {isEnterprise && !isCurrentPlan && (
              <Badge className="absolute -top-3 right-4 bg-gradient-primary text-white px-4 py-1.5 shadow-elegant">
                Most Popular
              </Badge>
            )}
            
            <CardHeader className="relative pb-6 bg-gradient-subtle/30">
              <CardTitle className="text-2xl font-bold text-foreground">{plan.plan_name}</CardTitle>
              <CardDescription className="space-y-2">
                <div className="flex items-baseline">
                  <span className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">{formatPrice(plan.monthly_price_cents)}</span>
                  <span className="text-foreground/70 ml-2 text-lg font-medium">/month</span>
                </div>
              </CardDescription>
            </CardHeader>

            <CardContent className="relative space-y-6">
              <div className="space-y-3 bg-accent/5 rounded-xl p-4 border border-accent/10">
                <p className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Monthly Credits</p>
                <p className="text-3xl font-bold text-foreground">
                  {plan.monthly_credits === 999999 ? (
                    <span className="bg-gradient-primary bg-clip-text text-transparent">Unlimited</span>
                  ) : (
                    plan.monthly_credits.toLocaleString()
                  )}
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Features Included</p>
                <ul className="space-y-3">
                  {features.map((feature, index) => (
                    <li key={index} className="flex items-start text-sm">
                      <Check className="h-5 w-5 text-green-accent mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-foreground/90 font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="relative pt-6">
              <Button 
                className={`w-full h-12 text-sm font-semibold transition-all duration-200 ${
                  isEnterprise 
                    ? 'bg-gradient-primary hover:shadow-elegant text-white' 
                    : 'border-accent/30 hover:bg-accent/10 hover:border-accent/50'
                } ${isCurrentPlan ? 'opacity-75 cursor-not-allowed' : ''}`}
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