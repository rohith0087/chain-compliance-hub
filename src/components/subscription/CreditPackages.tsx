import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Zap } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

const CREDIT_PACKAGES = [
  {
    priceId: 'price_1S9wEnAKCMksc2ZO0LGUCbEO',
    credits: 50,
    price: 2500, // in cents
    name: '50 Credits',
    description: 'Perfect for small teams',
    value: 'Standard'
  },
  {
    priceId: 'price_1S9wEwAKCMksc2ZOvyXzj4Is',
    credits: 100,
    price: 4500, // in cents
    name: '100 Credits',
    description: 'Great for growing businesses',
    value: 'Best Value',
    popular: true
  },
  {
    priceId: 'price_1S9wHMAKCMksc2ZOzphl59cV',
    credits: 500,
    price: 20000, // in cents
    name: '500 Credits',
    description: 'Ideal for large organizations',
    value: 'Enterprise'
  }
];

export const CreditPackages: React.FC = () => {
  const { createCreditPurchase, subscriptionData, loading } = useSubscription();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-bold mb-2">Loading Credit Packages...</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show credit packages even without full subscription data
  const currentCredits = subscriptionData?.credits || 0;

  const handlePurchase = async (priceId: string, credits: number) => {
    const result = await createCreditPurchase(priceId, 1);
    
    if (result?.url) {
      window.open(result.url, '_blank');
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getPricePerCredit = (price: number, credits: number) => {
    return ((price / 100) / credits).toFixed(2);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight">Purchase Additional Credits</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Buy extra credits for report generation. Current balance: <span className="font-semibold text-foreground">{currentCredits.toLocaleString()} credits</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.priceId} className={`relative border-border shadow-sm hover:shadow-md transition-shadow ${pkg.popular ? 'ring-2 ring-primary border-primary/20' : ''}`}>
            {pkg.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white px-3 py-1">
                {pkg.value}
              </Badge>
            )}
            
            <CardHeader className="text-center pb-6">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-slate-100 rounded-full">
                  <Coins className="h-8 w-8 text-slate-600" />
                </div>
              </div>
              <CardTitle className="text-xl font-semibold">{pkg.name}</CardTitle>
              <CardDescription className="text-base">{pkg.description}</CardDescription>
            </CardHeader>

            <CardContent className="text-center space-y-6">
              <div className="space-y-1">
                <p className="text-4xl font-bold text-foreground">{formatPrice(pkg.price)}</p>
                <p className="text-sm text-muted-foreground">
                  ${getPricePerCredit(pkg.price, pkg.credits)} per credit
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 py-2 px-4 bg-muted/30 rounded-md">
                <Zap className="h-4 w-4 text-slate-600" />
                <span className="font-medium">{pkg.credits.toLocaleString()} credits</span>
              </div>

              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-medium">Generate approximately:</p>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Standard reports:</span>
                    <span className="font-medium">{Math.floor(pkg.credits / 5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Detailed reports:</span>
                    <span className="font-medium">{Math.floor(pkg.credits / 10)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Comparison reports:</span>
                    <span className="font-medium">{Math.floor(pkg.credits / 15)}</span>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-6">
              <Button 
                className="w-full h-11" 
                onClick={() => handlePurchase(pkg.priceId, pkg.credits)}
                variant={pkg.popular ? 'default' : 'outline'}
              >
                Purchase Now
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="max-w-4xl mx-auto border-border">
        <CardHeader>
          <CardTitle className="text-lg">Credit Usage Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-md">
              <p className="font-semibold text-foreground">Standard Report</p>
              <p className="text-sm text-muted-foreground">5 credits</p>
              <p className="text-xs text-muted-foreground mt-1">Basic compliance summary</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-md">
              <p className="font-semibold text-foreground">Detailed Report</p>
              <p className="text-sm text-muted-foreground">10 credits</p>
              <p className="text-xs text-muted-foreground mt-1">Advanced analytics</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-md">
              <p className="font-semibold text-foreground">Comparison Report</p>
              <p className="text-sm text-muted-foreground">15 credits</p>
              <p className="text-xs text-muted-foreground mt-1">Multi-supplier analysis</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-md">
              <p className="font-semibold text-foreground">AI-Enhanced Report</p>
              <p className="text-sm text-muted-foreground">20 credits</p>
              <p className="text-xs text-muted-foreground mt-1">AI insights & recommendations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};