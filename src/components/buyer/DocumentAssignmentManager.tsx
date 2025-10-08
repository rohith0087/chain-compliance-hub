import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserCircle, AlertCircle, CheckCircle } from 'lucide-react';
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

      if (!buyer) return;

      // Get unassigned documents
      const { data: docs } = await supabase
        .from('document_uploads')
        .select(`
          *,
          request:document_requests(
            id,
            title,
            document_type,
            supplier:suppliers(company_name)
          )
        `)
        .eq('status', 'pending_review')
        .not('id', 'in', `(SELECT document_upload_id FROM document_assignments)`)
        .limit(50);

      setUnassignedDocs(docs || []);

      // Get team members
      const { data: team } = await supabase
        .from('company_users')
        .select(`
          *,
          profile:profiles(full_name, email)
        `)
        .eq('company_id', buyer.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .in('role', ['company_admin', 'branch_manager', 'document_manager', 'approver']);

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
                <p className="text-sm text-muted-foreground">No unassigned documents</p>
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
              {teamMembers.map(member => {
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
              })}
            </TabsContent>

            <TabsContent value="overdue" className="space-y-2">
              {assignments
                .filter(a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'completed')
                .map(assignment => (
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
                ))}
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
