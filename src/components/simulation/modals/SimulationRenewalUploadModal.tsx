import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';

export const SimulationRenewalUploadModal = () => {
  const { showRenewalUploadModal, closeRenewalModal, selectedExpiringDoc, submitRenewal } = useSimulation();
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');

  const handleSubmit = () => {
    if (!selectedExpiringDoc) return;
    setIsUploading(true);
    
    setTimeout(() => {
      submitRenewal(selectedExpiringDoc.id, fileName || `${selectedExpiringDoc.document_type}_v${selectedExpiringDoc.version + 1}.pdf`);
      setFileName('');
      setFileSelected(false);
      setSelectedFileName('');
      setIsUploading(false);
    }, 1000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedExpiringDoc) {
      setFileSelected(true);
      setSelectedFileName(file.name);
      // Auto-generate file name with version
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setFileName(`${baseName}_v${selectedExpiringDoc.version + 1}.pdf`);
    }
  };

  const handleUploadZoneClick = () => {
    document.getElementById('renewal-file-input')?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && selectedExpiringDoc) {
      setFileSelected(true);
      setSelectedFileName(file.name);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      setFileName(`${baseName}_v${selectedExpiringDoc.version + 1}.pdf`);
    }
  };

  if (!selectedExpiringDoc) return null;

  return (
    <Dialog open={showRenewalUploadModal} onOpenChange={() => {
      closeRenewalModal();
      setFileSelected(false);
      setSelectedFileName('');
      setFileName('');
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-amber-500" />
            Renew Document
          </DialogTitle>
          <DialogDescription>
            Upload a new version of your expired document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Document Info */}
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">{selectedExpiringDoc.title}</p>
                <p className="text-sm text-red-600">Current Version: V{selectedExpiringDoc.version}</p>
                <Badge variant="destructive" className="mt-2">Expired</Badge>
              </div>
            </div>
          </div>

          {/* New Version Info */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">New Version: V{selectedExpiringDoc.version + 1}</p>
                <p className="text-sm text-green-600">This will replace the expired document</p>
              </div>
            </div>
          </div>

          {/* File Upload Zone */}
          <input
            id="renewal-file-input"
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx"
          />
          
          {!fileSelected ? (
            <div 
              onClick={handleUploadZoneClick}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-muted-foreground">PDF, DOC, DOCX up to 10MB</p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-green-800">File Selected</p>
                  <p className="text-sm text-green-600 truncate">{selectedFileName}</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => {
                  setFileSelected(false);
                  setSelectedFileName('');
                  setFileName('');
                }}
              >
                Choose Different File
              </Button>
            </div>
          )}

          {/* File Name */}
          <div>
            <label className="text-sm font-medium">File Name</label>
            <Input
              placeholder={`${selectedExpiringDoc.document_type}_v${selectedExpiringDoc.version + 1}.pdf`}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button 
            onClick={handleSubmit} 
            className="w-full gap-2"
            disabled={isUploading || !fileSelected}
          >
            {isUploading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Version {selectedExpiringDoc.version + 1}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
