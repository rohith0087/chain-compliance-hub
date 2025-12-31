import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Upload, 
  Download, 
  Eye,
  Search,
  Calendar,
  Tag,
  FolderOpen,
  Plus,
  Info,
  X,
  Trash2,
  Lightbulb
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export const SimulationLibraryPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showEducationalCard, setShowEducationalCard] = useState(true);
  const { libraryDocuments, setShowLibraryUploadModal } = useSimulation();

  // Filter documents based on search
  const filteredDocuments = libraryDocuments.filter(doc =>
    doc.document_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleDelete = (docName: string) => {
    toast.success(`"${docName}" would be deleted in the real app`);
  };

  const handleView = (docName: string) => {
    toast.info(`Viewing "${docName}" - Document preview would open here`);
  };

  const handleDownload = (docName: string) => {
    toast.success(`Downloading "${docName}"...`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Document Library
            <Badge variant="outline" className="text-xs">Demo Data</Badge>
          </h1>
          <p className="text-muted-foreground">Your central repository for all documents</p>
        </div>
        <Button className="gap-2" onClick={() => setShowLibraryUploadModal(true)}>
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Educational Card */}
      {showEducationalCard && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Lightbulb className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-900">What is the Document Library?</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      This is your central repository for storing frequently used documents. Upload documents here once 
                      and reuse them for multiple buyer requests - saving you time on repeated uploads.
                    </p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <div className="flex items-center gap-1 text-blue-600">
                        <FolderOpen className="h-4 w-4" />
                        <span>Central storage</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600">
                        <Upload className="h-4 w-4" />
                        <span>Quick reuse</span>
                      </div>
                      <div className="flex items-center gap-1 text-blue-600">
                        <FileText className="h-4 w-4" />
                        <span>Version control</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                  onClick={() => setShowEducationalCard(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, category, or tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Document Grid */}
      {filteredDocuments.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow group">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.document_name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <FolderOpen className="h-3 w-3" />
                        {doc.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="shrink-0">
                        v{doc.version}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(doc.document_name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Size</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>
                    {doc.expiration_date && (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expires
                        </span>
                        <span>{format(new Date(doc.expiration_date), 'MMM d, yyyy')}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Uploaded</span>
                      <span>{format(new Date(doc.created_at), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {doc.tags.map(tag => (
                        <Badge 
                          key={tag} 
                          variant="secondary" 
                          className="text-xs"
                        >
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => handleView(doc.document_name)}
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => handleDownload(doc.document_name)}
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Your document library is empty'}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowLibraryUploadModal(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Your First Document
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
