import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Download, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Document {
  id: string;
  title: string;
  status: string;
  expiration_date?: string;
  created_at?: string;
  file_path?: string;
  supplier_name?: string;
}

interface DocumentTableProps {
  documents: Document[];
  count?: number;
}

const getStatusBadge = (status: string) => {
  const normalizedStatus = status?.toLowerCase();
  
  switch (normalizedStatus) {
    case 'approved':
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Approved
        </Badge>
      );
    case 'pending':
    case 'pending_review':
    case 'submitted':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case 'rejected':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <XCircle className="h-3 w-3" />
          Rejected
        </Badge>
      );
    case 'expired':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1">
          <AlertTriangle className="h-3 w-3" />
          Expired
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1">
          {status || 'Unknown'}
        </Badge>
      );
  }
};

const getExpiryStyle = (expirationDate?: string) => {
  if (!expirationDate) return '';
  
  const expDate = new Date(expirationDate);
  const now = new Date();
  const thirtyDaysFromNow = addDays(now, 30);
  
  if (isBefore(expDate, now)) {
    return 'text-red-400 font-medium';
  } else if (isBefore(expDate, thirtyDaysFromNow)) {
    return 'text-yellow-400 font-medium';
  }
  return 'text-muted-foreground';
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

export const DocumentTable: React.FC<DocumentTableProps> = ({ documents, count }) => {
  const handleDownload = async (filePath?: string, title?: string) => {
    if (!filePath) {
      toast({
        title: "Download unavailable",
        description: "No file path available for this document",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('secure-document-url', {
        body: { filePath }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No signed URL returned');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Could not generate download link",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-5 w-5 text-primary" />
          Requested Documents
          {count !== undefined && (
            <Badge variant="secondary" className="ml-2">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Title</TableHead>
                <TableHead className="text-muted-foreground font-medium">Status</TableHead>
                <TableHead className="text-muted-foreground font-medium">Expiration</TableHead>
                <TableHead className="text-muted-foreground font-medium">Created</TableHead>
                {documents.some(d => d.supplier_name) && (
                  <TableHead className="text-muted-foreground font-medium">Supplier</TableHead>
                )}
                <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc, index) => (
                <TableRow key={doc.id || index} className="border-border/30 hover:bg-muted/20">
                  <TableCell className="font-medium text-foreground max-w-[200px] truncate">
                    {doc.title || 'Untitled Document'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(doc.status)}
                  </TableCell>
                  <TableCell className={getExpiryStyle(doc.expiration_date)}>
                    {formatDate(doc.expiration_date)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(doc.created_at)}
                  </TableCell>
                  {documents.some(d => d.supplier_name) && (
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {doc.supplier_name || '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {doc.file_path && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc.file_path, doc.title)}
                        className="h-8 px-2 text-primary hover:text-primary/80"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {documents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No documents found
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentTable;
