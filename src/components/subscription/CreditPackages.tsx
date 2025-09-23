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
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
          Purchase Additional Credits
        </h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Buy extra credits for report generation and unlock advanced features. 
        </p>
        <div className="inline-flex items-center gap-2 bg-gradient-card px-6 py-3 rounded-xl border border-border/50 shadow-subtle">
          <Zap className="h-5 w-5 text-blue-accent" />
          <span className="text-base">Current balance: <span className="font-bold text-foreground">{currentCredits.toLocaleString()} credits</span></span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.priceId} className={`relative overflow-hidden border-0 bg-gradient-card shadow-elegant hover:shadow-modern transition-all duration-300 ${pkg.popular ? 'ring-2 ring-primary/30 shadow-modern scale-105' : ''}`}>
            <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
            
            {pkg.popular && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-primary text-white px-4 py-1.5 shadow-elegant">
                {pkg.value}
              </Badge>
            )}
            
            <CardHeader className="relative text-center pb-6 bg-gradient-subtle/30">
              <div className="flex justify-center mb-4">
                <div className="p-5 bg-gradient-card rounded-2xl shadow-subtle border border-border/30">
                  <Coins className="h-10 w-10 text-blue-accent" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">{pkg.name}</CardTitle>
              <CardDescription className="text-base text-foreground/80">{pkg.description}</CardDescription>
            </CardHeader>

            <CardContent className="relative text-center space-y-6">
              <div className="space-y-2">
                <p className="text-5xl font-bold bg-gradient-primary bg-clip-text text-transparent">{formatPrice(pkg.price)}</p>
                <p className="text-sm text-foreground/70 font-medium">
                  ${getPricePerCredit(pkg.price, pkg.credits)} per credit
                </p>
              </div>

              <div className="flex items-center justify-center space-x-3 py-3 px-5 bg-accent/10 rounded-xl border border-accent/20">
                <Zap className="h-5 w-5 text-blue-accent" />
                <span className="font-bold text-foreground text-lg">{pkg.credits.toLocaleString()} credits</span>
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

            <CardFooter className="relative pt-6">
              <Button 
                className={`w-full h-12 text-sm font-semibold transition-all duration-200 ${
                  pkg.popular 
                    ? 'bg-gradient-primary hover:shadow-elegant text-white' 
                    : 'border-accent/30 hover:bg-accent/10 hover:border-accent/50'
                }`}
                onClick={() => handlePurchase(pkg.priceId, pkg.credits)}
                variant={pkg.popular ? 'default' : 'outline'}
              >
                Purchase Now
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card className="max-w-5xl mx-auto border-0 bg-gradient-card shadow-elegant overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5"></div>
        <CardHeader className="relative bg-gradient-subtle/30">
          <CardTitle className="text-2xl font-bold text-foreground">Credit Usage Guide</CardTitle>
          <CardDescription className="text-foreground/80">Understand how credits are consumed for different report types</CardDescription>
        </CardHeader>
        <CardContent className="relative p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-gradient-subtle rounded-xl border border-border/50 shadow-subtle">
              <p className="font-bold text-foreground text-lg">Standard Report</p>
              <p className="text-blue-accent font-bold text-xl mt-2">5 credits</p>
              <p className="text-sm text-foreground/70 mt-2">Basic compliance summary</p>
            </div>
            <div className="text-center p-6 bg-gradient-subtle rounded-xl border border-border/50 shadow-subtle">
              <p className="font-bold text-foreground text-lg">Detailed Report</p>
              <p className="text-green-accent font-bold text-xl mt-2">10 credits</p>
              <p className="text-sm text-foreground/70 mt-2">Advanced analytics</p>
            </div>
            <div className="text-center p-6 bg-gradient-subtle rounded-xl border border-border/50 shadow-subtle">
              <p className="font-bold text-foreground text-lg">Comparison Report</p>
              <p className="text-orange-accent font-bold text-xl mt-2">15 credits</p>
              <p className="text-sm text-foreground/70 mt-2">Multi-supplier analysis</p>
            </div>
            <div className="text-center p-6 bg-gradient-subtle rounded-xl border border-border/50 shadow-subtle">
              <p className="font-bold text-foreground text-lg">AI-Enhanced Report</p>
              <p className="text-pink-accent font-bold text-xl mt-2">20 credits</p>
              <p className="text-sm text-foreground/70 mt-2">AI insights & recommendations</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};