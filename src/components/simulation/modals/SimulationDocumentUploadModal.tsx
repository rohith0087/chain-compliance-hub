import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Upload, Eye, Download, Calendar, FolderOpen, Info, CheckCircle2 } from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { format } from 'date-fns';

export const SimulationDocumentUploadModal = () => {
  const { showUploadModal, closeUploadModal, selectedRequestForUpload, submitDocumentWithDetails, libraryDocuments } = useSimulation();
  const [fileName, setFileName] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTab, setSelectedTab] = useState('device');
  const [selectedLibraryDoc, setSelectedLibraryDoc] = useState<string | null>(null);
  const [fileSelected, setFileSelected] = useState(false);

  const request = selectedRequestForUpload;

  const handleSubmit = () => {
    if (!request) return;
    const finalFileName = selectedLibraryDoc 
      ? libraryDocuments.find(d => d.id === selectedLibraryDoc)?.document_name || 'document.pdf'
      : fileName || `${request.document_type}_upload.pdf`;
    
    submitDocumentWithDetails(request.id, {
      fileName: finalFileName,
      expirationDate: expirationDate || undefined,
      notes: notes || undefined,
    });
    
    // Reset form
    setFileName('');
    setExpirationDate('');
    setNotes('');
    setSelectedLibraryDoc(null);
    setFileSelected(false);
  };

  const handleFileSelect = () => {
    setFileSelected(true);
    setFileName(`${request?.document_type || 'document'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!request) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={showUploadModal} onOpenChange={(open) => !open && closeUploadModal()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload Document
          </DialogTitle>
          <DialogDescription>
            Submit a document for: <strong>{request.title}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Left Column - Context */}
          <div className="space-y-4">
            {/* Sample Document Section */}
            {request.has_sample && (
              <Card className="p-4 border-blue-200 bg-blue-50/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Info className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Reference Document</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      The buyer uploaded this sample for your reference
                    </p>
                    <div className="mt-3 p-2 bg-white rounded border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">{request.sample_file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(request.sample_file_size || 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {request.sample_notes && (
                      <p className="text-xs text-blue-700 mt-2 italic">
                        "{request.sample_notes}"
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Request Details */}
            <Card className="p-4">
              <h4 className="font-medium text-sm mb-3">Request Details</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="outline">{request.document_type}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary">{request.category}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Priority</span>
                  <Badge className={
                    request.priority === 'high' ? 'bg-red-100 text-red-700' :
                    request.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }>
                    {request.priority}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{format(new Date(request.due_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-3 pt-3 border-t">
                {request.description}
              </p>
            </Card>
          </div>

          {/* Right Column - Upload */}
          <div className="space-y-4">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="w-full">
                <TabsTrigger value="device" className="flex-1">From Device</TabsTrigger>
                <TabsTrigger value="library" className="flex-1">From Library</TabsTrigger>
              </TabsList>

              <TabsContent value="device" className="mt-4">
                {!fileSelected ? (
                  <div 
                    onClick={handleFileSelect}
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">Click to select a file</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or drag and drop here
                    </p>
                    <p className="text-xs text-muted-foreground mt-3">
                      PDF, DOC, DOCX, JPG, PNG up to 10MB
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium text-green-800">File Selected</p>
                        <p className="text-sm text-green-600">{fileName}</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setFileSelected(false)}
                    >
                      Choose Different File
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="library" className="mt-4">
                <div className="border rounded-lg max-h-48 overflow-auto">
                  {libraryDocuments.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => {
                        setSelectedLibraryDoc(doc.id);
                        setFileName(doc.document_name);
                      }}
                      className={`w-full text-left p-3 border-b last:border-0 hover:bg-muted transition-colors flex items-center gap-3 ${
                        selectedLibraryDoc === doc.id ? 'bg-primary/10' : ''
                      }`}
                    >
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.document_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.category}</p>
                      </div>
                      {selectedLibraryDoc === doc.id && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {/* Document Details */}
            <div className="space-y-3 pt-4 border-t">
              <div className="space-y-2">
                <Label>Document Display Name</Label>
                <Input 
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Auto-generated from file"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Expiration Date (Optional)
                </Label>
                <Input 
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes for the buyer..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeUploadModal}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!fileSelected && !selectedLibraryDoc}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
