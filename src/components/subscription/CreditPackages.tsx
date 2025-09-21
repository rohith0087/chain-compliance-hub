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
  const { createCreditPurchase, subscriptionData } = useSubscription();

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
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold mb-2">Purchase Additional Credits</h3>
        <p className="text-muted-foreground">
          Buy extra credits for report generation. Current balance: <span className="font-semibold">{subscriptionData?.credits || 0} credits</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {CREDIT_PACKAGES.map((pkg) => (
          <Card key={pkg.priceId} className={`relative ${pkg.popular ? 'ring-2 ring-primary' : ''}`}>
            {pkg.popular && (
              <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
                {pkg.value}
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Coins className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
              <CardDescription>{pkg.description}</CardDescription>
            </CardHeader>

            <CardContent className="text-center space-y-4">
              <div>
                <p className="text-3xl font-bold">{formatPrice(pkg.price)}</p>
                <p className="text-sm text-muted-foreground">
                  ${getPricePerCredit(pkg.price, pkg.credits)} per credit
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>{pkg.credits} credits</span>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>Generate approximately:</p>
                <ul className="mt-1 space-y-1">
                  <li>• {Math.floor(pkg.credits / 5)} standard reports</li>
                  <li>• {Math.floor(pkg.credits / 10)} detailed reports</li>
                  <li>• {Math.floor(pkg.credits / 15)} comparison reports</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handlePurchase(pkg.priceId, pkg.credits)}
                variant={pkg.popular ? 'default' : 'outline'}
              >
                Purchase Now
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="bg-muted/50 rounded-lg p-4">
        <h4 className="font-semibold mb-2">Credit Usage Guide:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium">Standard Report:</span>
            <span className="text-muted-foreground ml-1">5 credits</span>
          </div>
          <div>
            <span className="font-medium">Detailed Report:</span>
            <span className="text-muted-foreground ml-1">10 credits</span>
          </div>
          <div>
            <span className="font-medium">Comparison Report:</span>
            <span className="text-muted-foreground ml-1">15 credits</span>
          </div>
          <div>
            <span className="font-medium">AI-Enhanced Report:</span>
            <span className="text-muted-foreground ml-1">20 credits</span>
          </div>
        </div>
      </div>
    </div>
  );
};