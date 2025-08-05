import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, FolderOpen, Share2, Lock, Building, Users, Settings } from 'lucide-react';
import { useBranchDocumentLibraries, DocumentLibrary } from '@/hooks/useBranchDocumentLibraries';
import { useAuth } from '@/hooks/useAuth';

interface BranchDocumentLibraryProps {
  companyId: string;
  companyType: 'buyer' | 'supplier';
  branchId?: string;
  branchName?: string;
}

const BranchDocumentLibrary: React.FC<BranchDocumentLibraryProps> = ({
  companyId,
  companyType,
  branchId,
  branchName
}) => {
  const { libraries, sharedDocuments, loading, createLibrary } = useBranchDocumentLibraries(companyId, companyType, branchId);
  const { user } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newLibrary, setNewLibrary] = useState({
    library_name: '',
    description: '',
    library_type: 'general',
    access_level: 'branch' as 'branch' | 'company' | 'restricted'
  });

  const handleCreateLibrary = async () => {
    if (!user || !newLibrary.library_name.trim()) return;

    const libraryData = {
      company_id: companyId,
      company_type: companyType,
      branch_id: branchId,
      library_name: newLibrary.library_name,
      description: newLibrary.description,
      library_type: newLibrary.library_type,
      is_default: false,
      access_level: newLibrary.access_level,
      created_by: user.id
    };

    const result = await createLibrary(libraryData);
    if (!result.error) {
      setIsCreateDialogOpen(false);
      setNewLibrary({
        library_name: '',
        description: '',
        library_type: 'general',
        access_level: 'branch'
      });
    }
  };

  const getLibraryTypeIcon = (type: string) => {
    switch (type) {
      case 'compliance': return <Lock className="h-4 w-4" />;
      case 'contracts': return <Users className="h-4 w-4" />;
      case 'general': return <FolderOpen className="h-4 w-4" />;
      default: return <FolderOpen className="h-4 w-4" />;
    }
  };

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case 'branch':
        return <Badge variant="secondary" className="text-xs"><Building className="h-3 w-3 mr-1" />Branch</Badge>;
      case 'company':
        return <Badge variant="default" className="text-xs"><Users className="h-3 w-3 mr-1" />Company</Badge>;
      case 'restricted':
        return <Badge variant="destructive" className="text-xs"><Lock className="h-3 w-3 mr-1" />Restricted</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{level}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Document Libraries</h2>
          <p className="text-muted-foreground">
            {branchName ? `Manage documents for ${branchName}` : 'Manage company document libraries'}
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Library
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Document Library</DialogTitle>
              <DialogDescription>
                Create a new document library to organize your files.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="library_name">Library Name</Label>
                <Input
                  id="library_name"
                  value={newLibrary.library_name}
                  onChange={(e) => setNewLibrary({ ...newLibrary, library_name: e.target.value })}
                  placeholder="e.g., Compliance Documents"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newLibrary.description}
                  onChange={(e) => setNewLibrary({ ...newLibrary, description: e.target.value })}
                  placeholder="Brief description of what this library contains..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="library_type">Library Type</Label>
                <Select value={newLibrary.library_type} onValueChange={(value) => setNewLibrary({ ...newLibrary, library_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Documents</SelectItem>
                    <SelectItem value="compliance">Compliance & Regulatory</SelectItem>
                    <SelectItem value="contracts">Contracts & Agreements</SelectItem>
                    <SelectItem value="financial">Financial Documents</SelectItem>
                    <SelectItem value="hr">Human Resources</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="access_level">Access Level</Label>
                <Select value={newLibrary.access_level} onValueChange={(value) => setNewLibrary({ ...newLibrary, access_level: value as any })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="branch">Branch Only</SelectItem>
                    <SelectItem value="company">Company Wide</SelectItem>
                    <SelectItem value="restricted">Restricted Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateLibrary}>
                Create Library
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="libraries" className="w-full">
        <TabsList>
          <TabsTrigger value="libraries">Libraries ({libraries.length})</TabsTrigger>
          <TabsTrigger value="shared">Shared Documents ({sharedDocuments.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="libraries" className="space-y-4">
          {libraries.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Document Libraries</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first document library to start organizing files.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Library
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {libraries.map((library) => (
                <Card key={library.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getLibraryTypeIcon(library.library_type)}
                        <CardTitle className="text-base">{library.library_name}</CardTitle>
                      </div>
                      {getAccessLevelBadge(library.access_level)}
                    </div>
                    {library.description && (
                      <CardDescription>{library.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          {library.library_type}
                        </Badge>
                        {library.is_default && (
                          <Badge variant="default" className="text-xs">Default</Badge>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <Button variant="outline" size="sm">
                          <Share2 className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-4">
          {sharedDocuments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Share2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Shared Documents</h3>
                <p className="text-muted-foreground text-center">
                  Documents shared between branches will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sharedDocuments.map((share) => (
                <Card key={share.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Document ID: {share.document_id}</p>
                        <p className="text-sm text-muted-foreground">
                          Shared from Branch {share.shared_from_branch_id} to Branch {share.shared_to_branch_id}
                        </p>
                        {share.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{share.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={share.permission_level === 'admin' ? 'default' : 'secondary'}>
                          {share.permission_level}
                        </Badge>
                        <Badge variant={share.status === 'active' ? 'default' : 'destructive'}>
                          {share.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BranchDocumentLibrary;