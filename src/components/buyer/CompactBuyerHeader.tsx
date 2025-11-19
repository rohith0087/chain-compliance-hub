import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserCheck, Users, UserPlus, Zap } from 'lucide-react';

interface CompactBuyerHeaderProps {
  buyerId: string;
  pendingConnectionsCount?: number;
  onInviteClick: () => void;
  onConnectionsClick: () => void;
  onBranchesClick: () => void;
  onQuickOnboardingClick: () => void;
}

export const CompactBuyerHeader = ({
  pendingConnectionsCount = 0,
  onInviteClick,
  onConnectionsClick,
  onBranchesClick,
  onQuickOnboardingClick,
}: CompactBuyerHeaderProps) => {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Manage your supplier connections and discover new suppliers
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onQuickOnboardingClick}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Zap className="h-4 w-4" />
              Quick Onboarding
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onConnectionsClick}
              className="gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Connection Requests
              {pendingConnectionsCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 min-w-5 px-1">
                  {pendingConnectionsCount}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={onBranchesClick}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Branch Suppliers
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onInviteClick}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Suppliers
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

