import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Cloud, HardDrive, X, Search, Check, Loader2, Paperclip } from 'lucide-react';
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
    <div className="w-full">
      {/* Show selected file or allow selection */}
      {(currentSample || { source: null }).source === 'device' && currentSample?.file ? (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <HardDrive className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{currentSample.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(currentSample.file.size)} • From device
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="hover:bg-destructive/10 hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (currentSample || { source: null }).source === 'library' && currentSample?.libraryDoc ? (
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Cloud className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{currentSample.libraryDoc.document_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(currentSample.libraryDoc.file_size)} • From library
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleClear} className="hover:bg-destructive/10 hover:text-destructive">
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Tabs value={uploadSource} onValueChange={(v) => setUploadSource(v as 'device' | 'library')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger 
              value="device" 
              className="flex items-center gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <HardDrive className="w-3.5 h-3.5" />
              Upload New
            </TabsTrigger>
            <TabsTrigger 
              value="library" 
              className="flex items-center gap-2 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Cloud className="w-3.5 h-3.5" />
              From Library
            </TabsTrigger>
          </TabsList>

          <TabsContent value="device" className="mt-3">
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border/60 rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
              <div className="p-3 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors mb-2">
                <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="text-sm font-medium text-foreground">Click to upload</span>
              <span className="text-xs text-muted-foreground mt-1">
                PDF, DOC, XLS, JPG, PNG (Max 10MB)
              </span>
              <Input
                type="file"
                onChange={handleFileChange}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
                className="hidden"
              />
            </label>
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
                  className="pl-9 border-border/80"
                />
              </div>

              {/* Library Documents List */}
              {loadingLibrary ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading library...
                </div>
              ) : filteredLibraryDocs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg bg-muted/20">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {libraryDocuments.length === 0
                    ? 'No documents in your library yet.'
                    : 'No documents match your search.'
                  }
                </div>
              ) : (
                <ScrollArea className="h-40 border rounded-lg bg-muted/10">
                  <div className="p-2 space-y-1">
                    {filteredLibraryDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleSelectLibraryDoc(doc)}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all border ${
                          currentSample.libraryDoc?.id === doc.id
                            ? 'bg-primary/10 border-primary/30 shadow-sm'
                            : 'hover:bg-muted/50 border-transparent hover:border-border/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`p-1.5 rounded-md ${
                              currentSample.libraryDoc?.id === doc.id 
                                ? 'bg-primary/10' 
                                : 'bg-muted/50'
                            }`}>
                              <FileText className={`w-3.5 h-3.5 ${
                                currentSample.libraryDoc?.id === doc.id 
                                  ? 'text-primary' 
                                  : 'text-muted-foreground'
                              }`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.document_name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {doc.category && (
                                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                    {doc.category}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(doc.file_size)}
                                </span>
                              </div>
                            </div>
                          </div>
                          {currentSample.libraryDoc?.id === doc.id && (
                            <div className="p-1 rounded-full bg-primary/10">
                              <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            </div>
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
