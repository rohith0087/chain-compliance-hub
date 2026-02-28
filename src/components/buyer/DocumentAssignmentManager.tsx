import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, AlertCircle, CheckCircle, Users, FileText, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { AssignDocumentModal } from './AssignDocumentModal';

export const DocumentAssignmentManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [unassignedDocs, setUnassignedDocs] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);

      // Get buyer ID
      const { data: buyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .single();

      if (!buyer) {
        logger.debug('[DocumentAssignmentManager] No buyer found for user');
        return;
      }

      logger.debug('[DocumentAssignmentManager] Buyer ID:', buyer.id);

      // Get unassigned documents - relaxed status filter to include both pending_review and submitted
      const { data: docs, error: docsError } = await supabase
        .from('document_uploads')
        .select(`
          *,
          request:document_requests(
            id,
            title,
            document_type,
            buyer_id,
            supplier:suppliers(company_name)
          )
        `)
        .in('status', ['pending_review', 'submitted'])
        .not('id', 'in', `(SELECT document_upload_id FROM document_assignments)`)
        .limit(50);

      logger.debug('[DocumentAssignmentManager] Unassigned docs query result:', {
        count: docs?.length || 0,
        error: docsError
      });

      setUnassignedDocs(docs || []);

      // Get team members
      const { data: team, error: teamError } = await supabase
        .from('company_users')
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .eq('company_id', buyer.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .in('role', ['company_admin', 'branch_manager', 'document_manager', 'approver']);

      logger.debug('[DocumentAssignmentManager] Team members query result:', {
        count: team?.length || 0,
        error: teamError
      });

      setTeamMembers(team || []);

      // Get all assignments
      const { data: assignmentsData } = await supabase
        .from('document_assignments')
        .select(`
          *,
          document:document_uploads(
            id,
            file_name,
            request:document_requests(title, document_type)
          ),
          assignee:profiles!document_assignments_assigned_to_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      setAssignments(assignmentsData || []);

    } catch (error: any) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assignment data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = () => {
    if (selectedDocuments.length === 0) {
      toast({
        title: 'No documents selected',
        description: 'Please select documents to assign',
        variant: 'destructive'
      });
      return;
    }
    setAssignModalOpen(true);
  };

  const getWorkloadForUser = (userId: string) => {
    return assignments.filter(a => 
      a.assigned_to === userId && 
      a.status !== 'completed'
    ).length;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Document Assignments</CardTitle>
            <Button onClick={handleBulkAssign} disabled={selectedDocuments.length === 0}>
              Assign Selected ({selectedDocuments.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="unassigned">
            <TabsList>
              <TabsTrigger value="unassigned">
                Unassigned ({unassignedDocs.length})
              </TabsTrigger>
              <TabsTrigger value="team">Team Workload</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>

            <TabsContent value="unassigned" className="space-y-2">
              {unassignedDocs.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">No unassigned documents found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Documents need status "Pending Review" or "Submitted" to appear here
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Check your Documents Manager to see all pending documents
                    </p>
                  </div>
                </div>
              ) : (
                unassignedDocs.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => {
                      if (selectedDocuments.includes(doc.id)) {
                        setSelectedDocuments(selectedDocuments.filter(id => id !== doc.id));
                      } else {
                        setSelectedDocuments([...selectedDocuments, doc.id]);
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => {}}
                      className="h-4 w-4"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{doc.request?.title || doc.file_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {doc.request?.supplier?.company_name} • {doc.request?.document_type}
                      </p>
                    </div>
                    <Badge>{doc.status}</Badge>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="team" className="space-y-4">
              {teamMembers.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">No team members found</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Invite team members with these roles to enable assignments:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Document Manager</li>
                      <li>• Approver</li>
                      <li>• Branch Manager</li>
                      <li>• Company Admin</li>
                    </ul>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        const event = new CustomEvent('navigate-to-tab', { detail: 'company' });
                        window.dispatchEvent(event);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Go to Company Management
                    </Button>
                  </div>
                </div>
              ) : (
                teamMembers.map(member => {
                const workload = getWorkloadForUser(member.profile_id);
                return (
                  <Card key={member.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-5 w-5" />
                          <div>
                            <p className="font-medium">{member.profile?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{member.role}</p>
                          </div>
                        </div>
                        <Badge variant={workload > 10 ? 'destructive' : 'default'}>
                          {workload} active
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                );
                })
              )}
            </TabsContent>

            <TabsContent value="overdue" className="space-y-2">
              {(() => {
                const overdueAssignments = assignments.filter(
                  a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed'
                );
                
                if (overdueAssignments.length === 0) {
                  return (
                    <div className="text-center py-8 space-y-4">
                      <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <p className="font-medium">No overdue assignments</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          All assignments are on track!
                        </p>
                      </div>
                    </div>
                  );
                }
                
                return overdueAssignments.map(assignment => (
                  <div key={assignment.id} className="flex items-center gap-3 p-3 border border-destructive rounded-lg">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="font-medium">{assignment.document?.request?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Assigned to: {assignment.assignee?.full_name}
                      </p>
                    </div>
                    <Badge variant="destructive">Overdue</Badge>
                  </div>
                ));
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AssignDocumentModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        documentIds={selectedDocuments}
        teamMembers={teamMembers}
        onAssignComplete={() => {
          setSelectedDocuments([]);
          loadData();
        }}
      />
    </>
  );
};
