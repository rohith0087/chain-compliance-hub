import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
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
  AlertTriangle,
  RefreshCw,
  Info
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { format, formatDistanceToNow, differenceInDays, isPast } from 'date-fns';

export const SimulationDocumentsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const { 
    documentUploads, 
    connectionStatus, 
    getExpiringDocuments, 
    openRenewalModal,
    currentStep 
  } = useSimulation();

  const expiringDocuments = getExpiringDocuments();

  // Filter documents based on search and tab
  const filteredDocuments = documentUploads.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_requests?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'expiring') return false; // Handled separately
    return matchesSearch && doc.status === activeTab;
  });

  const totalCount = documentUploads.length;
  const pendingCount = documentUploads.filter(d => d.status === 'pending').length;
  const submittedCount = documentUploads.filter(d => d.status === 'submitted').length;
  const approvedCount = documentUploads.filter(d => d.status === 'approved').length;
  const rejectedCount = documentUploads.filter(d => d.status === 'rejected').length;
  const expiringCount = expiringDocuments.length;

  const isRenewStep = currentStep === 'renew-document';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
      case 'submitted': return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getExpiryStatus = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const daysUntil = differenceInDays(expDate, new Date());
    
    if (isPast(expDate)) {
      const daysOverdue = Math.abs(daysUntil);
      return {
        label: `${daysOverdue}d overdue`,
        className: 'bg-red-500 text-white',
        isExpired: true,
        daysOverdue,
      };
    } else if (daysUntil <= 7) {
      return {
        label: `${daysUntil}d left`,
        className: 'bg-red-100 text-red-700 border-red-200',
        isExpired: false,
        daysLeft: daysUntil,
      };
    } else if (daysUntil <= 30) {
      return {
        label: `${daysUntil}d left`,
        className: 'bg-amber-100 text-amber-700 border-amber-200',
        isExpired: false,
        daysLeft: daysUntil,
      };
    } else {
      return {
        label: `${daysUntil}d left`,
        className: 'bg-green-100 text-green-700 border-green-200',
        isExpired: false,
        daysLeft: daysUntil,
      };
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
        <Card className={`p-4 ${isRenewStep ? 'ring-2 ring-amber-400' : ''}`}>
          <div className="text-sm text-orange-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Expiring
          </div>
          <div className="text-2xl font-bold text-orange-600">{expiringCount}</div>
        </Card>
      </div>

      {/* Tabs and Search */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger 
              value="expiring" 
              className={`gap-1 ${isRenewStep ? 'ring-2 ring-amber-400' : ''}`}
            >
              Expiring
              {expiringCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                  {expiringCount}
                </Badge>
              )}
            </TabsTrigger>
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

        {/* Regular Documents Tab Content */}
        {activeTab !== 'expiring' && (
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
                              <p className="font-medium flex items-center gap-2">
                                {doc.file_name}
                                {(doc as any).version && (doc as any).version > 1 && (
                                  <Badge variant="outline" className="text-xs">
                                    V{(doc as any).version}
                                  </Badge>
                                )}
                              </p>
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
        )}

        {/* Expiring Documents Tab */}
        <TabsContent value="expiring" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-4 bg-amber-50 rounded-lg border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-amber-800">Documents Requiring Attention</h4>
                <p className="text-sm text-amber-700">
                  These documents are expired or expiring soon. Renew them to maintain compliance with your buyers.
                </p>
              </div>
            </div>

            {/* Version info card */}
            <div className="flex items-start gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-medium text-blue-800">Document Versioning</h4>
                <p className="text-sm text-blue-700">
                  When you renew a document, a new version (V2, V3, etc.) is created. The old version is archived and the new one becomes active.
                </p>
              </div>
            </div>

            {expiringDocuments.length > 0 ? (
              <div className="grid gap-4">
                {expiringDocuments.map((doc, index) => {
                  const expiryStatus = getExpiryStatus(doc.expiration_date);
                  return (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className={`${expiryStatus.isExpired ? 'border-red-200' : 'border-amber-200'} ${isRenewStep ? 'ring-2 ring-amber-400' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${expiryStatus.isExpired ? 'bg-red-100' : 'bg-amber-100'}`}>
                                <FileText className={`h-5 w-5 ${expiryStatus.isExpired ? 'text-red-600' : 'text-amber-600'}`} />
                              </div>
                              <div>
                                <p className="font-medium flex items-center gap-2">
                                  {doc.title}
                                  <Badge variant="outline" className="text-xs">
                                    V{doc.version || 1}
                                  </Badge>
                                  <Badge className={expiryStatus.className}>
                                    {expiryStatus.isExpired ? 'Expired' : 'Expiring Soon'}
                                  </Badge>
                                </p>
                                <p className="text-sm text-muted-foreground flex items-center gap-2">
                                  <Building2 className="h-3 w-3" />
                                  {doc.buyer_name}
                                  <span className="text-muted-foreground/50">•</span>
                                  <span>{doc.category}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="text-right text-sm">
                                <p className="text-muted-foreground">
                                  {expiryStatus.isExpired ? 'Expired on' : 'Expires on'}
                                </p>
                                <p className="font-medium">
                                  {format(new Date(doc.expiration_date), 'MMM d, yyyy')}
                                </p>
                              </div>
                              
                              <Badge className={expiryStatus.className}>
                                {expiryStatus.label}
                              </Badge>
                              
                              <Button 
                                size="sm"
                                variant={expiryStatus.isExpired ? "destructive" : "outline"}
                                onClick={() => openRenewalModal(doc)}
                                className="gap-1"
                              >
                                <RefreshCw className="h-3 w-3" />
                                Renew
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-green-200 bg-green-50/50">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-green-700">All Documents Up to Date</h3>
                  <p className="text-green-600">
                    None of your documents are expiring soon. Great job maintaining compliance!
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
