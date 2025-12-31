import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Send,
  Calendar,
  Building2
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow, format } from 'date-fns';
import { motion } from 'framer-motion';

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'bg-red-500/10 text-red-600 border-red-500/30';
    case 'medium':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    case 'low':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Approved
        </Badge>
      );
    case 'submitted':
      return (
        <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">
          <Send className="h-3 w-3 mr-1" />
          Under Review
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};

export const SimulationDocumentRequests = () => {
  const { 
    connectionStatus,
    documentRequests, 
    submitDocumentForRequest,
    submittedDocuments,
  } = useSimulation();

  // Only show after onboarding is complete
  if (connectionStatus !== 'active') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 simulation-requests-list"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Document Requests</h2>
          <p className="text-sm text-muted-foreground">
            Requests from your connected buyers
          </p>
        </div>
        <Badge variant="outline">
          {documentRequests.filter(r => r.status === 'pending').length} pending
        </Badge>
      </div>

      <div className="grid gap-4">
        {documentRequests.map((request, index) => {
          const isPending = request.status === 'pending';
          const dueDate = new Date(request.due_date);
          const isOverdue = dueDate < new Date() && isPending;
          
          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`simulation-request-card ${isPending ? 'border-primary/20' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        request.status === 'approved' 
                          ? 'bg-emerald-500/10' 
                          : request.status === 'submitted'
                            ? 'bg-blue-500/10'
                            : 'bg-primary/10'
                      }`}>
                        <FileText className={`h-5 w-5 ${
                          request.status === 'approved' 
                            ? 'text-emerald-500' 
                            : request.status === 'submitted'
                              ? 'text-blue-500'
                              : 'text-primary'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {request.title}
                          <Badge variant="secondary" className="text-xs">
                            DEMO
                          </Badge>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3" />
                          {request.buyer.company_name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(request.status)}
                      <Badge variant="outline" className={getPriorityColor(request.priority)}>
                        {request.priority} priority
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {request.description}
                  </p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Due: {format(dueDate, 'MMM d, yyyy')}
                        {isOverdue && (
                          <span className="text-red-500 ml-1">(Overdue)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {isPending && (
                    <Button
                      onClick={() => submitDocumentForRequest(request.id)}
                      className="w-full gap-2 simulation-upload-button"
                    >
                      <Upload className="h-4 w-4" />
                      Upload & Submit Document
                    </Button>
                  )}
                  
                  {request.status === 'submitted' && (
                    <div className="text-center py-2 text-sm text-muted-foreground">
                      <Send className="h-4 w-4 inline mr-1 animate-pulse" />
                      Waiting for buyer review...
                    </div>
                  )}
                  
                  {request.status === 'approved' && (
                    <div className="text-center py-2 text-sm text-emerald-600">
                      <CheckCircle2 className="h-4 w-4 inline mr-1" />
                      Document approved
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};
