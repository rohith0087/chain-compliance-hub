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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, X, CalendarIcon, FileText, Tag, Info } from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export const SimulationLibraryUploadModal = () => {
  const { showLibraryUploadModal, setShowLibraryUploadModal, uploadToLibrary } = useSimulation();
  
  const [documentName, setDocumentName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const categories = [
    'Insurance',
    'Certification',
    'Compliance',
    'Legal',
    'Quality',
    'Financial',
    'Other',
  ];

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = () => {
    uploadToLibrary({
      name: documentName,
      category,
      tags,
      expirationDate: expirationDate?.toISOString(),
    });
    
    // Reset form
    setDocumentName('');
    setCategory('');
    setTags([]);
    setExpirationDate(undefined);
    setSelectedFile(null);
  };

  const isValid = documentName && category && selectedFile;

  return (
    <Dialog open={showLibraryUploadModal} onOpenChange={setShowLibraryUploadModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload to Document Library
          </DialogTitle>
          <DialogDescription>
            Add a document to your library for easy reuse across buyer requests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Educational tip */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-700">
              Documents in your library can be quickly attached to multiple buyer requests, 
              saving you time on repeated uploads.
            </p>
          </div>

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
                <FileText className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-sm">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
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
                  Drag and drop your file here, or
                </p>
                <label htmlFor="library-file-upload">
                  <Button variant="outline" size="sm" asChild>
                    <span>Browse Files</span>
                  </Button>
                  <input
                    id="library-file-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                </label>
              </>
            )}
          </div>

          {/* Document Name */}
          <div className="space-y-2">
            <Label htmlFor="doc-name">Document Name *</Label>
            <Input
              id="doc-name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., General Liability Insurance Certificate"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tags (press Enter)"
                className="flex-1"
              />
              <Button variant="outline" size="sm" onClick={handleAddTag} disabled={!tagInput.trim()}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>Expiration Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={setExpirationDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowLibraryUploadModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload to Library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
