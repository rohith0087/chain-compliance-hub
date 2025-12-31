import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, FileText, X, CheckCircle2, Info, ArrowDown } from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { cn } from '@/lib/utils';

export const SimulationOnboardingUploadModal = () => {
  const { 
    showOnboardingUploadModal, 
    closeOnboardingUploadModal, 
    selectedOnboardingDoc,
    uploadOnboardingDocument,
    downloadTemplate,
  } = useSimulation();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [templateDownloaded, setTemplateDownloaded] = useState(false);

  if (!selectedOnboardingDoc) return null;

  const hasTemplate = selectedOnboardingDoc.has_template;

  const handleDownloadTemplate = () => {
    downloadTemplate(selectedOnboardingDoc.id);
    setTemplateDownloaded(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    uploadOnboardingDocument(selectedOnboardingDoc.id);
    setSelectedFile(null);
    setTemplateDownloaded(false);
  };

  const handleClose = () => {
    closeOnboardingUploadModal();
    setSelectedFile(null);
    setTemplateDownloaded(false);
  };

  return (
    <Dialog open={showOnboardingUploadModal} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload: {selectedOnboardingDoc.document_name}
          </DialogTitle>
          <DialogDescription>
            {selectedOnboardingDoc.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Download Section */}
          {hasTemplate && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  This document requires using a buyer-provided template. Download it, fill in your details, and re-upload.
                </p>
              </div>

              {/* Step-by-step instructions */}
              <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm">How to complete:</h4>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Badge variant={templateDownloaded ? "default" : "outline"} className="h-5 w-5 p-0 justify-center shrink-0">
                      {templateDownloaded ? <CheckCircle2 className="h-3 w-3" /> : "1"}
                    </Badge>
                    Download the template
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 w-5 p-0 justify-center shrink-0">2</Badge>
                    Fill in your company information
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant={selectedFile ? "default" : "outline"} className="h-5 w-5 p-0 justify-center shrink-0">
                      {selectedFile ? <CheckCircle2 className="h-3 w-3" /> : "3"}
                    </Badge>
                    Upload the completed form
                  </li>
                </ol>
              </div>

              {/* Template Download Button */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedOnboardingDoc.template_file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedOnboardingDoc.template_file_size 
                        ? `${(selectedOnboardingDoc.template_file_size / 1024).toFixed(1)} KB`
                        : 'Template file'}
                    </p>
                  </div>
                </div>
                <Button 
                  variant={templateDownloaded ? "outline" : "default"}
                  size="sm" 
                  onClick={handleDownloadTemplate}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  {templateDownloaded ? 'Downloaded' : 'Download'}
                </Button>
              </div>

              {templateDownloaded && (
                <div className="flex items-center justify-center py-2">
                  <ArrowDown className="h-5 w-5 text-muted-foreground animate-bounce" />
                </div>
              )}
            </div>
          )}

          {/* File Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
              selectedFile && "border-green-500 bg-green-50"
            )}
          >
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Ready to upload
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  {hasTemplate 
                    ? 'Upload your completed template here'
                    : 'Drag and drop your document here, or'}
                </p>
                <label htmlFor="onboarding-file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                  <input
                    id="onboarding-file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                </label>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedFile} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
