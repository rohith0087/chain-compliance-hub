import React, { useState } from 'react';
import { Building, Plus, Edit2, MapPin, Phone, Mail, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CompanyBranch, CompanyUser } from '@/hooks/useCompanyBranches';

interface BranchManagementProps {
  branches: CompanyBranch[];
  companyUsers: CompanyUser[];
  companyId: string;
  companyType: 'buyer' | 'supplier';
  onCreateBranch: (branchData: Omit<CompanyBranch, 'id' | 'created_at' | 'updated_at'>) => Promise<any>;
  onUpdateBranch: (branchId: string, updates: Partial<CompanyBranch>) => Promise<any>;
  loading?: boolean;
}

export const BranchManagement: React.FC<BranchManagementProps> = ({
  branches,
  companyUsers,
  companyId,
  companyType,
  onCreateBranch,
  onUpdateBranch,
  loading = false
}) => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<CompanyBranch | null>(null);
  const [formData, setFormData] = useState({
    branch_name: '',
    location: '',
    address: '',
    phone: '',
    email: ''
  });
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormData({
      branch_name: '',
      location: '',
      address: '',
      phone: '',
      email: ''
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.branch_name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    setSaving(true);
    try {
      const branchData = {
        ...formData,
        company_id: companyId,
        company_type: companyType,
        status: 'active' as const
      };
      
      const result = await onCreateBranch(branchData);
      if (!result.error) {
        setCreateModalOpen(false);
        resetForm();
      }
    } catch (error) {
      console.error('Error creating branch:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedBranch || !formData.branch_name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    setSaving(true);
    try {
      const result = await onUpdateBranch(selectedBranch.id, formData);
      if (!result.error) {
        setEditModalOpen(false);
        setSelectedBranch(null);
        resetForm();
      }
    } catch (error) {
      console.error('Error updating branch:', error);
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (branch: CompanyBranch) => {
    setSelectedBranch(branch);
    setFormData({
      branch_name: branch.branch_name,
      location: branch.location || '',
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || ''
    });
    setEditModalOpen(true);
  };

  const getBranchUserCount = (branchId: string) => {
    return companyUsers.filter(user => user.branch_id === branchId && user.status === 'active').length;
  };

  const BranchForm = ({ onSubmit, title, submitLabel }: { 
    onSubmit: (e: React.FormEvent) => void;
    title: string;
    submitLabel: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="branch_name">Branch Name</Label>
        <Input
          id="branch_name"
          value={formData.branch_name}
          onChange={(e) => setFormData(prev => ({ ...prev, branch_name: e.target.value }))}
          placeholder="e.g., West Coast Office"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={formData.location}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          placeholder="e.g., San Francisco, CA"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="Full address"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+1 (555) 123-4567"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="branch@company.com"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            setCreateModalOpen(false);
            setEditModalOpen(false);
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Branch Management
            </CardTitle>
            <CardDescription>
              Manage your company branches and locations
            </CardDescription>
          </div>
          <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Branch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Branch</DialogTitle>
                <DialogDescription>
                  Add a new branch location to your company.
                </DialogDescription>
              </DialogHeader>
              <BranchForm 
                onSubmit={handleCreateSubmit} 
                title="Create Branch" 
                submitLabel="Create Branch" 
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="p-4 border rounded-lg animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-5 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-16" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No branches yet</p>
            <p className="text-sm">Create your first branch to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {branches.map((branch) => (
              <div key={branch.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium flex items-center gap-2">
                      {branch.branch_name}
                      {branch.branch_name === 'Main Office' && (
                        <Badge variant="secondary">Main</Badge>
                      )}
                    </h3>
                    {branch.location && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {branch.location}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {getBranchUserCount(branch.id)} users
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openEditModal(branch)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  {branch.address && (
                    <p className="flex items-start gap-2">
                      <Building className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {branch.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-4">
                    {branch.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {branch.phone}
                      </span>
                    )}
                    {branch.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {branch.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Branch</DialogTitle>
              <DialogDescription>
                Update branch information and details.
              </DialogDescription>
            </DialogHeader>
            <BranchForm 
              onSubmit={handleEditSubmit} 
              title="Edit Branch" 
              submitLabel="Save Changes" 
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};