import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Eye, EyeOff, UserCheck, Users, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CompactBuyerHeaderProps {
  buyerId: string;
  pendingConnectionsCount?: number;
  onInviteClick: () => void;
  onConnectionsClick: () => void;
  onBranchesClick: () => void;
}

export const CompactBuyerHeader = ({
  buyerId,
  pendingConnectionsCount = 0,
  onInviteClick,
  onConnectionsClick,
  onBranchesClick,
}: CompactBuyerHeaderProps) => {
  const [copied, setCopied] = useState(false);
  const [showId, setShowId] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buyerId);
      setCopied(true);
      toast.success('Buyer ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const maskedId = buyerId.replace(/(.{4})(.*)(.{4})/, '$1****$3');

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Side - Buyer ID */}
          <div className="flex items-center gap-3">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-md border border-border/50 hover:bg-muted/50 transition-colors">
                    <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-primary-foreground text-[10px] font-bold">ID</span>
                    </div>
                    <code className="font-mono text-sm font-semibold tracking-wide">
                      {showId ? buyerId : maskedId}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowId(!showId)}
                      className="h-6 w-6 p-0 hover:bg-background"
                    >
                      {showId ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopy}
                      className="h-6 w-6 p-0 hover:bg-background"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1">
                    <p className="font-medium">Your Unique Buyer ID</p>
                    <p className="text-xs text-muted-foreground">
                      Share this ID with suppliers to enable direct connection requests. 
                      They can use it to find and connect with your company.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
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
              size="sm"
              onClick={onInviteClick}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Invite Suppliers
            </Button>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
          <span className="inline-block w-1 h-1 rounded-full bg-primary"></span>
          Share this ID with suppliers to enable direct connections
        </p>
      </CardContent>
    </Card>
  );
};
