import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useDocumentAssignments } from '@/hooks/useDocumentAssignments';
import { formatDistanceToNow } from 'date-fns';

export const MyAssignments = () => {
  const { myAssignments, loading, completeAssignment } = useDocumentAssignments();

  const pendingAssignments = myAssignments.filter(a => a.status === 'pending');
  const inProgressAssignments = myAssignments.filter(a => a.status === 'in_progress');
  const completedAssignments = myAssignments.filter(a => a.status === 'completed');

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const handleComplete = async (assignmentId: string) => {
    await completeAssignment(assignmentId);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Assignments</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="in-progress">
              In Progress ({inProgressAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-2">
            {pendingAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending assignments</p>
            ) : (
              pendingAssignments.map(assignment => (
                <div key={assignment.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{assignment.document?.request?.title}</p>
                        {isOverdue(assignment.due_date) && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Overdue
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignment.document?.request?.document_type}
                      </p>
                      {assignment.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="inline h-3 w-3 mr-1" />
                          Due {formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                    <Badge>{assignment.assignment_type}</Badge>
                  </div>

                  {assignment.notes && (
                    <p className="text-sm text-muted-foreground border-l-2 pl-3">
                      {assignment.notes}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleComplete(assignment.id)}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark Complete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="in-progress" className="space-y-2">
            {inProgressAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments in progress</p>
            ) : (
              inProgressAssignments.map(assignment => (
                <div key={assignment.id} className="p-4 border rounded-lg">
                  <p className="font-medium">{assignment.document?.request?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {assignment.document?.request?.document_type}
                  </p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-2">
            {completedAssignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed assignments</p>
            ) : (
              completedAssignments.map(assignment => (
                <div key={assignment.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{assignment.document?.request?.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Completed {formatDistanceToNow(new Date(assignment.completed_at), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="outline">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Done
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
