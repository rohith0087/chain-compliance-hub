import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Upload, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  Send,
  Calendar,
  Building2,
  Search,
  Filter
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow, format } from 'date-fns';

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

export const SimulationRequestsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { 
    documentRequests, 
    submitDocumentForRequest,
    connectionStatus,
  } = useSimulation();

  // Filter requests based on search
  const filteredRequests = documentRequests.filter(request =>
    request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.buyers?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingCount = documentRequests.filter(r => r.status === 'pending').length;
  const submittedCount = documentRequests.filter(r => r.status === 'submitted').length;
  const approvedCount = documentRequests.filter(r => r.status === 'approved').length;

  // Show message if connection not yet active
  if (connectionStatus === 'pending') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Document Requests</h1>
          <p className="text-muted-foreground">Requests from your connected buyers</p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Requests Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              You'll see document requests here once you accept a buyer connection and complete onboarding.
              Check the Connections tab to get started!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Document Requests
            <Badge variant="outline" className="text-xs">Demo Data</Badge>
          </h1>
          <p className="text-muted-foreground">Requests from your connected buyers</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {pendingCount} pending
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Send className="h-3 w-3" />
            {submittedCount} submitted
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {approvedCount} approved
          </Badge>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Requests List */}
      <div className="grid gap-4">
        {filteredRequests.map((request, index) => {
          const isPending = request.status === 'pending';
          const dueDate = new Date(request.due_date);
          const isOverdue = dueDate < new Date() && isPending;
          
          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={isPending ? 'border-primary/20' : ''}>
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
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Building2 className="h-3 w-3" />
                          {request.buyers?.company_name || 'Unknown Buyer'}
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
                      className="w-full gap-2"
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

      {filteredRequests.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Requests Found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms' : 'No document requests yet'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
