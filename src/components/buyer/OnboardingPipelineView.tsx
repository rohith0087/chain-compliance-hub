import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

const PIPELINE_STAGES = [
  { id: 'pending', name: 'Invited', color: 'bg-slate-100' },
  { id: 'onboarding_initiated', name: 'Started', color: 'bg-blue-100' },
  { id: 'under_review', name: 'Under Review', color: 'bg-yellow-100' },
  { id: 'approved', name: 'Approved', color: 'bg-green-100' },
  { id: 'rejected', name: 'Declined', color: 'bg-red-100' }
];

export const OnboardingPipelineView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!buyer) return;

      const { data, error } = await supabase
        .from('supplier_onboarding_requests')
        .select(`
          *,
          supplier:suppliers(company_name, contact_email)
        `)
        .eq('buyer_id', buyer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);

    } catch (error: any) {
      console.error('Error loading requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load onboarding requests',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRequestsForStage = (stageId: string) => {
    return requests.filter(r => r.status === stageId);
  };

  const calculateProgress = (request: any) => {
    if (!request.form_field_responses) return 0;
    
    const totalFields = Object.keys(request.form_fields || {}).length;
    const completedFields = Object.keys(request.form_field_responses || {}).length;
    
    if (totalFields === 0) return 0;
    return Math.round((completedFields / totalFields) * 100);
  };

  const getDaysInStage = (request: any) => {
    const statusDate = request.responded_at || request.created_at;
    return formatDistanceToNow(new Date(statusDate), { addSuffix: false });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-5 gap-4">
      {PIPELINE_STAGES.map(stage => {
        const stageRequests = getRequestsForStage(stage.id);
        
        return (
          <div key={stage.id} className="space-y-3">
            <Card className={stage.color}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {stage.name}
                </CardTitle>
                <Badge variant="secondary">{stageRequests.length}</Badge>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              {stageRequests.map(request => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="font-medium text-sm">
                        {request.supplier?.company_name || request.supplier_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {getDaysInStage(request)}
                      </p>
                    </div>

                    {stage.id !== 'approved' && stage.id !== 'rejected' && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{calculateProgress(request)}%</span>
                        </div>
                        <Progress value={calculateProgress(request)} className="h-2" />
                      </div>
                    )}

                    {stage.id === 'approved' && (
                      <Badge variant="outline" className="w-full justify-center">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Complete
                      </Badge>
                    )}

                    {stage.id === 'rejected' && (
                      <Badge variant="destructive" className="w-full justify-center">
                        <XCircle className="mr-1 h-3 w-3" />
                        Declined
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
