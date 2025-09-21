import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Crown, CreditCard, AlertTriangle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';

interface SubscriptionStatusWidgetProps {
  compact?: boolean;
}

export function SubscriptionStatusWidget({ compact = false }: SubscriptionStatusWidgetProps) {
  const navigate = useNavigate();
  const { subscriptionData, loading } = useSubscription();

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSubscribed = subscriptionData?.subscribed;
  const isEnterprise = subscriptionData?.plan_type?.includes('enterprise');
  const creditUsagePercentage = isEnterprise ? 0 : 
    subscriptionData ? Math.min((subscriptionData.total_consumed_credits / (subscriptionData.total_purchased_credits || 1)) * 100, 100) : 0;

  const planDisplayName = subscriptionData?.plan_type ? 
    subscriptionData.plan_type.charAt(0).toUpperCase() + subscriptionData.plan_type.slice(1) : 'Free';

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-lg border">
        {!isEnterprise ? (
          <>
            <CreditCard className="h-4 w-4 text-primary" />
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-foreground">
                {subscriptionData?.credits || 0}
              </span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          </>
        ) : (
          <>
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Unlimited</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Crown className="h-5 w-5 text-primary" />
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="font-medium">{planDisplayName} Plan</h3>
              <p className="text-sm text-muted-foreground">
                {isSubscribed ? "Subscription Active" : "Free Plan"}
              </p>
            </div>
          </div>
          <Badge variant={isSubscribed ? "default" : "secondary"}>
            {isSubscribed ? "Active" : "Free"}
          </Badge>
        </div>

        {!isEnterprise && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Credits Available</span>
              <span className="font-medium">{subscriptionData?.credits || 0}</span>
            </div>
            {subscriptionData?.total_purchased_credits > 0 && (
              <>
                <Progress value={creditUsagePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {subscriptionData.total_consumed_credits} of {subscriptionData.total_purchased_credits} credits used
                </p>
              </>
            )}
          </div>
        )}

        {isEnterprise && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4" />
            <span>Unlimited credits</span>
          </div>
        )}

        {!isSubscribed && (
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock advanced features and get more credits
              </p>
              <Button size="sm" onClick={() => navigate('/subscription')}>
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}

        {(subscriptionData?.credits || 0) < 10 && !isEnterprise && (
          <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-muted-foreground">
                Low credit balance. Purchase more credits to continue generating reports.
              </p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => navigate('/subscription?tab=credits')}
              >
                Buy Credits
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}