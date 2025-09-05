import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Eye, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useOnboardingRequests } from '@/hooks/useOnboardingRequests';
import { OnboardingRequestForm } from './OnboardingRequestForm';
import { OnboardingReviewModal } from './OnboardingReviewModal';

interface SupplierOnboardingProps {
  buyerId: string;
  onBack: () => void;
}

export const SupplierOnboarding: React.FC<SupplierOnboardingProps> = ({ buyerId, onBack }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const { requests, loading, updateRequestStatus } = useOnboardingRequests();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'onboarding_initiated':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'documents_pending':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'under_review':
        return <Eye className="w-4 h-4 text-purple-600" />;
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'onboarding_initiated':
        return 'bg-blue-100 text-blue-800';
      case 'documents_pending':
        return 'bg-orange-100 text-orange-800';
      case 'under_review':
        return 'bg-purple-100 text-purple-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleReviewRequest = (request: any) => {
    setSelectedRequest(request);
    setShowReviewModal(true);
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      await updateRequestStatus(requestId, 'approved');
      setShowReviewModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateRequestStatus(requestId, 'rejected');
      setShowReviewModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  if (showCreateForm) {
    return (
      <OnboardingRequestForm
        buyerId={buyerId}
        onBack={() => setShowCreateForm(false)}
        onSuccess={() => setShowCreateForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Suppliers
          </Button>
          <div>
            <h2 className="text-2xl font-semibold">Supplier Onboarding</h2>
            <p className="text-muted-foreground">Manage supplier onboarding requests and approvals</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Onboarding Request
        </Button>
      </div>

      {/* Onboarding Requests */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Onboarding Requests</h3>
        
        {loading ? (
          <div className="text-center py-8">
            <div className="text-muted-foreground">Loading onboarding requests...</div>
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-muted-foreground mb-4">No onboarding requests yet</div>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Your First Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(request.status)}
                      <div>
                        <CardTitle className="text-lg">
                          {request.supplier_company_name || request.supplier_email}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {request.supplier_email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getStatusColor(request.status)}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {(request.status === 'under_review' || request.status === 'documents_pending') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewRequest(request)}
                          className="flex items-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Branch Selection: </span>
                      {request.can_choose_branches ? 'Enabled' : 'Disabled'}
                    </div>
                    <div>
                      <span className="font-medium">Created: </span>
                      {new Date(request.created_at).toLocaleDateString()}
                    </div>
                    {request.custom_message && (
                      <div className="col-span-2">
                        <span className="font-medium">Message: </span>
                        {request.custom_message}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && selectedRequest && (
        <OnboardingReviewModal
          request={selectedRequest}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedRequest(null);
          }}
          onApprove={() => handleApproveRequest(selectedRequest.id)}
          onReject={() => handleRejectRequest(selectedRequest.id)}
        />
      )}
    </div>
  );
};