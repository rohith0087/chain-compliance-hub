import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';
import { Coins } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Simplified credit packages - show only 3 options
const CREDIT_PACKAGES = [
  {
    credits: 50,
    price_cents: 2500,
    name: 'Starter',
    priceId: 'price_1S9wEnAKCMksc2ZO0LGUCbEO'
  },
  {
    credits: 100,
    price_cents: 4500,
    name: 'Booster',
    priceId: 'price_1S9wEwAKCMksc2ZOvyXzj4Is'
  },
  {
    credits: 500,
    price_cents: 20000,
    name: 'Power',
    priceId: 'price_1S9wHMAKCMksc2ZOzphl59cV'
  }
];

export const CreditPackages: React.FC = () => {
  const { createCreditPurchase, subscriptionData, loading } = useSubscription();

  const handlePurchase = async (priceId: string, credits: number) => {
    const result = await createCreditPurchase(priceId, 1);
    if (result?.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(0)}`;
  };

  const getPricePerCredit = (cents: number, credits: number) => {
    return `$${(cents / 100 / credits).toFixed(2)}/credit`;
  };

  if (loading) {
    return (
      <div id="credits-section" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="flex-1">
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Don't show credit packages for enterprise users
  if (subscriptionData?.plan_type === 'enterprise') {
    return null;
  }

  return (
    <div id="credits-section" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Need More Credits?</h2>
        <p className="text-muted-foreground">
          Quick add-ons to boost your credit balance this month
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.priceId} className="relative">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">{pkg.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {pkg.credits.toLocaleString()} credits
                  </p>
                </div>
                <Coins className="h-8 w-8 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-3xl font-extrabold">
                  {formatPrice(pkg.price_cents)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {getPricePerCredit(pkg.price_cents, pkg.credits)}
                </p>
              </div>
              
              <Button 
                onClick={() => handlePurchase(pkg.priceId, pkg.credits)}
                className="w-full"
                disabled={loading}
              >
                Add {pkg.credits} Credits
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};