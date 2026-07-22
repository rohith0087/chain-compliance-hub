import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Building2, FileText } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { useToast } from '@/hooks/use-toast';

interface OnboardingNotificationProps {
  request: any;
  onAccept?: () => void;
  onDecline?: () => void;
}

export const OnboardingNotification: React.FC<OnboardingNotificationProps> = ({
  request,
  onAccept,
  onDecline
}) => {
  const [loading, setLoading] = useState(false);
  const { updateRequestStatus } = useOnboardingRequests();
  const { toast } = useToast();

  const handleAccept = async () => {
    setLoading(true);
    try {
      await updateRequestStatus(request.id, 'onboarding_initiated');
      toast({
        title: "Success",
        description: "Onboarding process initiated successfully"
      });
      onAccept?.();
    } catch (error) {
      console.error('Error accepting onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to accept onboarding request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await updateRequestStatus(request.id, 'rejected');
      toast({
        title: "Success",
        description: "Onboarding request declined"
      });
      onDecline?.();
    } catch (error) {
      console.error('Error declining onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to decline onboarding request",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-warning" />;
      case 'onboarding_initiated':
        return <FileText className="w-5 h-5 text-primary" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-danger" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/15 text-warning';
      case 'onboarding_initiated':
        return 'bg-primary/15 text-primary';
      case 'approved':
        return 'bg-success/15 text-success';
      case 'rejected':
        return 'bg-danger/15 text-danger';
      default:
        return 'bg-muted text-foreground';
    }
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(request.status)}
            <div>
              <CardTitle className="text-lg">Onboarding Request</CardTitle>
              <p className="text-sm text-muted-foreground">
                From: {request.supplier_company_name || request.supplier_email}
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(request.status)}>
            {request.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Request Details */}
        <div className="space-y-2">
          <div className="text-sm">
            <span className="font-medium">Request Date: </span>
            {new Date(request.created_at).toLocaleDateString()}
          </div>
          {request.expires_at && (
            <div className="text-sm">
              <span className="font-medium">Expires: </span>
              {new Date(request.expires_at).toLocaleDateString()}
            </div>
          )}
          {request.can_choose_branches && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4" />
              <span>You can select which branches to supply to</span>
            </div>
          )}
        </div>

        {/* Custom Message */}
        {request.custom_message && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Message from buyer:</p>
            <p className="text-sm">{request.custom_message}</p>
          </div>
        )}

        {/* Actions */}
        {request.status === 'pending' && (
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleAccept}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Accept & Begin Onboarding
            </Button>
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </Button>
          </div>
        )}

        {request.status === 'onboarding_initiated' && (
          <div className="p-3 bg-primary/10 rounded-lg">
            <p className="text-sm text-primary">
              Onboarding in progress. Please complete all required steps to proceed.
            </p>
          </div>
        )}

        {request.status === 'approved' && (
          <div className="p-3 bg-success/10 rounded-lg">
            <p className="text-sm text-success">
              Congratulations! Your onboarding has been approved. You are now a linked supplier.
            </p>
          </div>
        )}

        {request.status === 'rejected' && (
          <div className="p-3 bg-danger/10 rounded-lg">
            <p className="text-sm text-danger">
              This onboarding request was declined. Please contact the buyer for more information.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};