import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, CreditCard, Lock, ArrowRight } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { FeatureCheckResult } from '@/utils/subscriptionGuards';
import { useNavigate } from 'react-router-dom';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  checkResult: FeatureCheckResult;
  featureName: string;
  description?: string;
}

export function SubscriptionGuard({ 
  children, 
  checkResult, 
  featureName, 
  description 
}: SubscriptionGuardProps) {
  const navigate = useNavigate();
  const { subscriptionData } = useSubscription();

  if (checkResult.allowed) {
    return <>{children}</>;
  }

  return (
    <Card className="border-2 border-dashed border-muted">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          {checkResult.upgradeRequired ? (
            <Crown className="h-8 w-8 text-primary" />
          ) : (
            <CreditCard className="h-8 w-8 text-warning" />
          )}
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          <Lock className="h-5 w-5" />
          {featureName} Unavailable
        </CardTitle>
        <CardDescription>
          {description || checkResult.reason}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {checkResult.upgradeRequired ? (
          <div className="space-y-2">
            <Badge variant="outline" className="text-primary">
              Premium Feature
            </Badge>
            <p className="text-sm text-muted-foreground">
              This feature requires a subscription upgrade to unlock advanced capabilities.
            </p>
            <Button 
              onClick={() => navigate('/subscription')}
              className="w-full"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : checkResult.creditsNeeded ? (
          <div className="space-y-2">
            <Badge variant="outline" className="text-warning">
              {checkResult.creditsNeeded} Credits Needed
            </Badge>
            <p className="text-sm text-muted-foreground">
              You currently have {subscriptionData?.credits || 0} credits. 
              Purchase more credits to access this feature.
            </p>
            <Button 
              onClick={() => navigate('/subscription?tab=credits')}
              variant="secondary"
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Buy Credits
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <Button 
            onClick={() => navigate('/subscription')}
            variant="outline"
            className="w-full"
          >
            View Subscription Options
          </Button>
        )}
      </CardContent>
    </Card>
  );
}