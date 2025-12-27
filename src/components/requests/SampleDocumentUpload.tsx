import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Cloud, HardDrive, X, Search, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LibraryDocument {
  id: string;
  document_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  category: string | null;
}

interface SampleDocumentUploadProps {
  buyerId: string;
  onSampleChange: (sample: {
    file?: File;
    libraryDoc?: LibraryDocument;
    source: 'device' | 'library' | null;
  }) => void;
  currentSample: {
    file?: File;
    libraryDoc?: LibraryDocument;
    source: 'device' | 'library' | null;
  };
}

const SampleDocumentUpload = ({ buyerId, onSampleChange, currentSample }: SampleDocumentUploadProps) => {
  const [uploadSource, setUploadSource] = useState<'device' | 'library'>('device');
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([]);
  const [librarySearchTerm, setLibrarySearchTerm] = useState('');
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const { toast } = useToast();

  // Fetch library documents when switching to library tab
  useEffect(() => {
    if (uploadSource === 'library' && buyerId) {
      fetchLibraryDocuments();
    }
  }, [uploadSource, buyerId]);

  const fetchLibraryDocuments = async () => {
    setLoadingLibrary(true);
    try {
      const { data, error } = await supabase
        .from('buyer_document_library')
        .select('id, document_name, file_path, file_size, mime_type, category')
        .eq('buyer_id', buyerId)
        .eq('is_current_version', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLibraryDocuments(data || []);
    } catch (error) {
      console.error('Error fetching library documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load document library.',
        variant: 'destructive'
      });
    } finally {
      setLoadingLibrary(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Please select a file smaller than 10MB.',
          variant: 'destructive'
        });
        return;
      }
      onSampleChange({ file: selectedFile, source: 'device' });
    }
  };

  const handleSelectLibraryDoc = (doc: LibraryDocument) => {
    onSampleChange({ libraryDoc: doc, source: 'library' });
  };

  const handleClear = () => {
    onSampleChange({ source: null });
  };

  const filteredLibraryDocs = libraryDocuments.filter(doc =>
    doc.document_name.toLowerCase().includes(librarySearchTerm.toLowerCase()) ||
    (doc.category && doc.category.toLowerCase().includes(librarySearchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <Label className="flex items-center gap-2 text-sm font-medium">
        <FileText className="w-4 h-4" />
        Sample/Reference Document (Optional)
      </Label>
      <p className="text-xs text-muted-foreground">
        Upload a sample to help suppliers understand the expected format and content
      </p>

      {/* Show selected file or allow selection */}
      {currentSample.source === 'device' && currentSample.file ? (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">{currentSample.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(currentSample.file.size)} • From device
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : currentSample.source === 'library' && currentSample.libraryDoc ? (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary" />
            <div>
              <p className="text-sm font-medium">{currentSample.libraryDoc.document_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(currentSample.libraryDoc.file_size)} • From library
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Tabs value={uploadSource} onValueChange={(v) => setUploadSource(v as 'device' | 'library')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="device" className="flex items-center gap-2 text-xs">
              <HardDrive className="w-3 h-3" />
              Upload New
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2 text-xs">
              <Cloud className="w-3 h-3" />
              From Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="device" className="mt-3">
            <div>
              <Input
                type="file"
                onChange={handleFileChange}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                PDF, DOC, XLS, JPG, PNG (Max 10MB)
              </p>
            </div>
          </TabsContent>

          <TabsContent value="library" className="mt-3">
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search library documents..."
                  value={librarySearchTerm}
                  onChange={(e) => setLibrarySearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Library Documents List */}
              {loadingLibrary ? (
                <div className="flex items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading library...
                </div>
              ) : filteredLibraryDocs.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm border rounded-lg bg-muted/20">
                  {libraryDocuments.length === 0
                    ? 'No documents in your library yet.'
                    : 'No documents match your search.'
                  }
                </div>
              ) : (
                <ScrollArea className="h-36 border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredLibraryDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleSelectLibraryDoc(doc)}
                        className={`p-2 rounded-lg cursor-pointer transition-colors border ${
                          currentSample.libraryDoc?.id === doc.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted/50 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.document_name}</p>
                              {doc.category && (
                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {doc.category}
                                </span>
                              )}
                            </div>
                          </div>
                          {currentSample.libraryDoc?.id === doc.id && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default SampleDocumentUpload;
