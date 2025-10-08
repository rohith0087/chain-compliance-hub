import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { useDocumentAssignments } from '@/hooks/useDocumentAssignments';
import { formatDistanceToNow } from 'date-fns';
import { AssignmentCardSkeleton } from '@/components/ui/skeleton-card';
import { UrgencyBadge } from '@/components/ui/priority-badge';

export const MyAssignments = () => {
  const { myAssignments, loading, completeAssignment } = useDocumentAssignments();

  const pendingAssignments = myAssignments.filter(a => a.status === 'pending');
  const inProgressAssignments = myAssignments.filter(a => a.status === 'in_progress');
  const completedAssignments = myAssignments.filter(a => a.status === 'completed');

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getDaysUntilDue = (dueDate: string) => {
    if (!dueDate) return null;
    return Math.ceil((new Date(dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const handleComplete = async (assignmentId: string) => {
    await completeAssignment(assignmentId);
  };

  if (loading) {
    return (
      <Card className="border-0 bg-gradient-card">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
            My Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <AssignmentCardSkeleton />
          <AssignmentCardSkeleton />
          <AssignmentCardSkeleton />
        </CardContent>
      </Card>
    );
  }

  const allAssignments = [...pendingAssignments, ...inProgressAssignments].slice(0, 4);

  return (
    <Card className="border-0 bg-gradient-card">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent to-primary" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-accent" />
            </div>
            My Assignments
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="rounded-full">
              {pendingAssignments.length} Pending
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {inProgressAssignments.length} In Progress
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {allAssignments.length === 0 ? (
          <div className="text-center py-8">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <p className="text-sm font-medium mb-1">No active assignments</p>
            <p className="text-xs text-muted-foreground">You're all caught up!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allAssignments.map((assignment) => {
              const daysUntilDue = assignment.due_date ? getDaysUntilDue(assignment.due_date) : null;
              const overdue = assignment.due_date && isOverdue(assignment.due_date);
              
              return (
                <div 
                  key={assignment.id} 
                  className="group relative p-4 rounded-xl border border-border/50 bg-surface hover:border-accent/30 hover:bg-accent/5 transition-all duration-300"
                >
                  {/* Status indicator dot */}
                  <div className={`absolute top-4 right-4 h-2 w-2 rounded-full ${
                    assignment.status === 'in_progress' ? 'bg-accent animate-pulse' : 'bg-muted'
                  }`} />

                  <div className="flex items-start gap-3 mb-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      overdue 
                        ? 'bg-danger/10' 
                        : 'bg-gradient-to-br from-accent/10 to-accent/5'
                    }`}>
                      {overdue ? (
                        <AlertTriangle className="h-5 w-5 text-danger" />
                      ) : (
                        <Clock className="h-5 w-5 text-accent" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm line-clamp-1">
                          {assignment.document?.request?.title}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {assignment.document?.request?.document_type}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {assignment.assignment_type}
                        </Badge>
                        {daysUntilDue !== null && (
                          <UrgencyBadge daysUntilDue={daysUntilDue} />
                        )}
                        {assignment.status === 'in_progress' && (
                          <Badge className="bg-accent/10 text-accent border-accent/20 text-xs">
                            In Progress
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {assignment.notes && (
                    <p className="text-xs text-muted-foreground border-l-2 border-accent/30 pl-3 mb-3 line-clamp-2">
                      {assignment.notes}
                    </p>
                  )}

                  {assignment.due_date && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}
                    </p>
                  )}

                  <Button 
                    size="sm" 
                    onClick={() => handleComplete(assignment.id)}
                    className="w-full group-hover:shadow-lg transition-shadow"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Complete
                    <ArrowRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {allAssignments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {completedAssignments.length} completed this month
            </p>
            <Button variant="ghost" size="sm" className="hover:bg-accent/10">
              View All Assignments
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
