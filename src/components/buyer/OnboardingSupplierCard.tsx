import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Eye, Send, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface OnboardingSupplierCardProps {
  request: any;
  stageId: string;
  isSelected: boolean;
  alertStatus: { level: string; icon: string; message: string };
  progress: number;
  requirementCount: number;
  onSelect: () => void;
  onClick: () => void;
  onSendReminder: (e: React.MouseEvent) => void;
  onPopulateRequirements: (e: React.MouseEvent) => void;
}

export const OnboardingSupplierCard = ({
  request,
  stageId,
  isSelected,
  alertStatus,
  progress,
  requirementCount,
  onSelect,
  onClick,
  onSendReminder,
  onPopulateRequirements,
}: OnboardingSupplierCardProps) => {
  const getDaysInStage = () => {
    const statusDate = request.responded_at || request.created_at;
    return formatDistanceToNow(new Date(statusDate), { addSuffix: false });
  };

  const getStatusDot = () => {
    if (alertStatus.level === 'critical') return 'bg-destructive';
    if (alertStatus.level === 'warning') return 'bg-yellow-500';
    if (alertStatus.level === 'success') return 'bg-green-500';
    if (alertStatus.level === 'ended') return 'bg-muted-foreground';
    return 'bg-green-500';
  };

  const displayName = request.supplier_company_name || request.supplier_email;
  const truncatedEmail = request.supplier_email?.length > 22 
    ? request.supplier_email.substring(0, 20) + '...' 
    : request.supplier_email;

  return (
    <Card 
      className={`cursor-pointer hover:border-primary/50 transition-colors ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-2 space-y-1.5">
        {/* Row 1: Checkbox + Email + Status Dot */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm font-medium truncate flex-1 min-w-0">
                  {request.supplier_company_name || truncatedEmail}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="font-medium">{request.supplier_company_name || 'No company name'}</p>
                <p className="text-xs text-muted-foreground">{request.supplier_email}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={`h-2 w-2 rounded-full shrink-0 ${getStatusDot()}`} />
              </TooltipTrigger>
              <TooltipContent side="top">{alertStatus.message}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Row 2: Time */}
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="h-3 w-3 mr-1" />
          {getDaysInStage()}
        </div>

        {/* Row 3: Progress (only for active stages) */}
        {stageId !== 'approved' && stageId !== 'rejected' && (
          <div className="flex items-center gap-2">
            <Progress value={progress} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground w-8">{progress}%</span>
          </div>
        )}

        {/* Completed/Declined badges */}
        {stageId === 'approved' && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle className="h-3 w-3" />
            <span>Complete</span>
          </div>
        )}

        {stageId === 'rejected' && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="h-3 w-3" />
            <span>Declined</span>
          </div>
        )}

        {/* Action buttons - appear on hover */}
        <div className="flex gap-1 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                  }}
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Details</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {(stageId === 'pending' || stageId === 'onboarding_initiated' || stageId === 'invited') && (
            <>
              {requirementCount === 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={onPopulateRequirements}
                      >
                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Populate Requirements</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={onSendReminder}
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Send Reminder</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
