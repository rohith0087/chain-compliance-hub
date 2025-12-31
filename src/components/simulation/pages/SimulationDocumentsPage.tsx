import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle2,
  Send,
  Calendar,
  Building2,
  Search,
  Eye,
  AlertTriangle
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { format, formatDistanceToNow } from 'date-fns';

export const SimulationDocumentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { documentUploads, connectionStatus } = useSimulation();

  // Filter documents based on search and tab
  const filteredDocuments = documentUploads.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_requests?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && doc.status === activeTab;
  });

  const totalCount = documentUploads.length;
  const pendingCount = documentUploads.filter(d => d.status === 'pending').length;
  const submittedCount = documentUploads.filter(d => d.status === 'submitted').length;
  const approvedCount = documentUploads.filter(d => d.status === 'approved').length;
  const rejectedCount = documentUploads.filter(d => d.status === 'rejected').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'submitted': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Show message if connection not yet active
  if (connectionStatus === 'pending') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Documents</h1>
          <p className="text-muted-foreground">View and manage your submitted documents</p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your uploaded documents will appear here. Accept a buyer connection to start uploading.
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
            My Documents
            <Badge variant="outline" className="text-xs">Demo Data</Badge>
          </h1>
          <p className="text-muted-foreground">View and manage your submitted documents</p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{totalCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-amber-600">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-blue-600">Submitted</div>
          <div className="text-2xl font-bold text-blue-600">{submittedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-emerald-600">Approved</div>
          <div className="text-2xl font-bold text-emerald-600">{approvedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-red-600">Rejected</div>
          <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
        </Card>
      </div>

      {/* Tabs and Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
          </TabsList>
          
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <TabsContent value={activeTab} className="mt-6">
          {filteredDocuments.length > 0 ? (
            <div className="grid gap-4">
              {filteredDocuments.map((doc, index) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            doc.status === 'approved' ? 'bg-emerald-500/10' :
                            doc.status === 'submitted' ? 'bg-blue-500/10' :
                            'bg-amber-500/10'
                          }`}>
                            <FileText className={`h-5 w-5 ${
                              doc.status === 'approved' ? 'text-emerald-500' :
                              doc.status === 'submitted' ? 'text-blue-500' :
                              'text-amber-500'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{doc.file_name}</p>
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Building2 className="h-3 w-3" />
                              {doc.document_requests?.buyers?.company_name || 'Unknown Buyer'}
                              <span className="text-muted-foreground/50">•</span>
                              <span>{doc.document_requests?.title}</span>
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">
                              Uploaded {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                            </p>
                            {doc.expiration_date && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                                <Calendar className="h-3 w-3" />
                                Expires {format(new Date(doc.expiration_date), 'MMM d, yyyy')}
                              </p>
                            )}
                          </div>
                          
                          <Badge className={getStatusColor(doc.status)}>
                            {doc.status === 'approved' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {doc.status === 'submitted' && <Send className="h-3 w-3 mr-1" />}
                            {doc.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                            {doc.status}
                          </Badge>
                          
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Try adjusting your search terms' : 'No documents in this category'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
