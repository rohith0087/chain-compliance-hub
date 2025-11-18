import { useState, useEffect } from 'react';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import BuyerDocumentCard from './BuyerDocumentCard';
import BuyerDocumentUploadModal from './BuyerDocumentUploadModal';
import { BUYER_DOCUMENT_TYPES } from '@/config/buyerDocumentTypes';

interface BuyerCorporateDocumentsProps {
  buyerId: string;
}

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size?: number;
  created_at: string;
  expiration_date?: string;
  description?: string;
}

const BuyerCorporateDocuments = ({ buyerId }: BuyerCorporateDocumentsProps) => {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [buyerId]);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('buyer_document_library')
        .select('*')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.document_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || doc.document_type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getCategoryCount = (category: string) => {
    if (category === 'all') return documents.length;
    return documents.filter(doc => doc.document_type === category).length;
  };

  const stats = [
    { label: 'Total Documents', value: documents.length, color: 'primary' },
    { label: 'SOP', value: getCategoryCount('SOP'), color: 'blue' },
    { label: 'GMP', value: getCategoryCount('GMP'), color: 'green' },
    { label: 'HACCP', value: getCategoryCount('HACCP'), color: 'purple' },
  ];

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="text-sm font-medium text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-bold mt-1">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowUploadModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">
            All ({getCategoryCount('all')})
          </TabsTrigger>
          {Object.entries(BUYER_DOCUMENT_TYPES).map(([key, value]) => (
            <TabsTrigger key={key} value={key}>
              {value.label} ({getCategoryCount(key)})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="space-y-4 mt-6">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-24 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredDocuments.map((document) => (
                <BuyerDocumentCard
                  key={document.id}
                  document={document}
                  onDelete={fetchDocuments}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {searchQuery ? 'No documents found' : 'No corporate documents yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? 'Try adjusting your search criteria'
                    : 'Upload your first corporate document to get started'}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setShowUploadModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Modal */}
      <BuyerDocumentUploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        buyerId={buyerId}
        onUploadSuccess={fetchDocuments}
      />
    </div>
  );
};

export default BuyerCorporateDocuments;
