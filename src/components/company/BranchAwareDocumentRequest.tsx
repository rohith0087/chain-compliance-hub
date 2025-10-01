import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Building2, 
  FileCheck, 
  Calendar,
  Users,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface BranchAwareDocumentRequestProps {
  supplierInfo: {
    id: string;
    company_name: string;
    branches?: any[];
  };
  onRequestCreated?: () => void;
  onClose?: () => void;
}

export const BranchAwareDocumentRequest: React.FC<BranchAwareDocumentRequestProps> = ({
  supplierInfo,
  onRequestCreated,
  onClose
}) => {
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    document_type: '',
    category: '',
    priority: 'medium',
    due_date: ''
  });
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(true);
  
  const { user } = useAuth();

  useEffect(() => {
    loadSupplierBranches();
  }, [supplierInfo.id]);

  const loadSupplierBranches = async () => {
    try {
      setLoadingBranches(true);
      
      const { data: branches, error } = await supabase
        .from('company_branches')
        .select('id, branch_name, location, status')
        .eq('company_id', supplierInfo.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .order('branch_name');

      if (error) {
        console.error('Error loading supplier branches:', error);
        setBranches([]);
        return;
      }

      setBranches(branches || []);
      
      // Auto-select first branch if only one exists
      if (branches && branches.length === 1) {
        setSelectedBranch(branches[0].id);
      }
    } catch (error) {
      console.error('Error in loadSupplierBranches:', error);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranch) {
      toast({
        title: "Branch Required",
        description: "Please select a branch for this document request.",
        variant: "destructive"
      });
      return;
    }

    if (!formData.title || !formData.document_type || !formData.category) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Get buyer profile
      const { data: buyerProfile, error: buyerError } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();

      if (buyerError || !buyerProfile) {
        throw new Error('Buyer profile not found');
      }

      // Create the document request
      const { error: requestError } = await supabase
        .from('document_requests')
        .insert({
          title: formData.title,
          description: formData.description,
          document_type: formData.document_type,
          category: formData.category,
          priority: formData.priority as any,
          due_date: formData.due_date || null,
          buyer_id: buyerProfile.id,
          supplier_id: supplierInfo.id,
          branch_id: selectedBranch,
          requester_id: user?.id,
          status: 'pending'
        });

      if (requestError) {
        throw requestError;
      }

      toast({
        title: "Request Created",
        description: "Document request has been sent to the supplier branch."
      });

      onRequestCreated?.();
      onClose?.();
    } catch (error) {
      console.error('Error creating document request:', error);
      toast({
        title: "Error",
        description: "Failed to create document request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const documentTypes = [
    'ISO Certification',
    'Safety Compliance',
    'Environmental Certificate',
    'Financial Statement',
    'Insurance Certificate',
    'Quality Assurance',
    'Regulatory Approval',
    'Tax Certificate',
    'Business License',
    'Other'
  ];

  const categories = [
    'Quality Management',
    'Environmental',
    'Health & Safety',
    'Financial',
    'Legal & Regulatory',
    'Security',
    'Technical',
    'Operational'
  ];

  if (loadingBranches) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading supplier branches...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5" />
          Request Documents from {supplierInfo.company_name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a branch-specific document request
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Branch Selection */}
          <div className="space-y-2">
            <Label htmlFor="branch">Target Branch *</Label>
            {branches.length > 0 ? (
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{branch.branch_name}</span>
                        {branch.location && (
                          <span className="text-xs text-muted-foreground">
                            - {branch.location}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-3 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>This supplier has no active branches available</span>
                </div>
              </div>
            )}
          </div>

          {/* Request Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Request Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="e.g., ISO 9001 Certificate Request"
              required
            />
          </div>

          {/* Document Type */}
          <div className="space-y-2">
            <Label htmlFor="document_type">Document Type *</Label>
            <Select value={formData.document_type} onValueChange={(value) => handleInputChange('document_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority and Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange('due_date', e.target.value)}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Additional details about the document request..."
              rows={3}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || branches.length === 0}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Request...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4 mr-2" />
                  Create Request
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};