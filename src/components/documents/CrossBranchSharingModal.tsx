import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarIcon, Share2, Users, Lock, Eye } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { useCompanyBranches, CompanyBranch } from '@/hooks/useCompanyBranches';
import { useBranchDocumentLibraries } from '@/hooks/useBranchDocumentLibraries';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface CrossBranchSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentType: 'upload' | 'request';
  documentTitle?: string;
  sourceBranchId: string;
  sourceBranchName?: string;
  companyId: string;
  companyType: 'buyer' | 'supplier';
}

const CrossBranchSharingModal: React.FC<CrossBranchSharingModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentType,
  documentTitle,
  sourceBranchId,
  sourceBranchName,
  companyId,
  companyType
}) => {
  const { user } = useAuth();
  const { branches } = useCompanyBranches(companyId, companyType);
  const { shareDocument } = useBranchDocumentLibraries(companyId, companyType);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [permissionLevel, setPermissionLevel] = useState<'read' | 'write' | 'admin'>('read');
  const [expirationDate, setExpirationDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter out the source branch from available branches
  const availableBranches = branches.filter(branch => branch.id !== sourceBranchId);

  const handleBranchSelection = (branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId) 
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleShare = async () => {
    if (!user || selectedBranches.length === 0) return;

    setLoading(true);
    try {
      const sharePromises = selectedBranches.map(targetBranchId => 
        shareDocument({
          document_id: documentId,
          document_type: documentType,
          shared_from_branch_id: sourceBranchId,
          shared_to_branch_id: targetBranchId,
          shared_by: user.id,
          permission_level: permissionLevel,
          expires_at: expirationDate?.toISOString(),
          notes: notes || undefined,
          status: 'active'
        })
      );

      const results = await Promise.all(sharePromises);
      const hasErrors = results.some(result => result.error);

      if (!hasErrors) {
        onClose();
        // Reset form
        setSelectedBranches([]);
        setPermissionLevel('read');
        setExpirationDate(undefined);
        setNotes('');
      }
    } catch (error) {
      console.error('Error sharing document:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'read': return <Eye className="h-3 w-3" />;
      case 'write': return <Users className="h-3 w-3" />;
      case 'admin': return <Lock className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  const getPermissionDescription = (level: string) => {
    switch (level) {
      case 'read': return 'View only access to the document';
      case 'write': return 'Can view and edit the document';
      case 'admin': return 'Full control including sharing permissions';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Document Across Branches
          </DialogTitle>
          <DialogDescription>
            Share "{documentTitle || documentId}" from {sourceBranchName || 'current branch'} with other branches in your organization.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Document Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Document Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Document:</span>
                <span className="font-medium">{documentTitle || documentId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <Badge variant="outline">{documentType}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Source Branch:</span>
                <span className="font-medium">{sourceBranchName || 'Current Branch'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Branch Selection */}
          <div className="space-y-3">
            <Label>Select Branches to Share With</Label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {availableBranches.map((branch) => (
                <Card 
                  key={branch.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedBranches.includes(branch.id) 
                      ? "bg-primary/5 border-primary" 
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleBranchSelection(branch.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{branch.branch_name}</p>
                        {branch.location && (
                          <p className="text-sm text-muted-foreground">{branch.location}</p>
                        )}
                      </div>
                      {selectedBranches.includes(branch.id) && (
                        <Badge variant="default">Selected</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedBranches.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedBranches.length} branch{selectedBranches.length > 1 ? 'es' : ''} selected
              </p>
            )}
          </div>

          {/* Permission Level */}
          <div className="space-y-3">
            <Label>Permission Level</Label>
            <Select value={permissionLevel} onValueChange={(value) => setPermissionLevel(value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <p>Read Only</p>
                      <p className="text-xs text-muted-foreground">View only access</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="write">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <p>Read & Write</p>
                      <p className="text-xs text-muted-foreground">Can view and edit</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <div>
                      <p>Admin</p>
                      <p className="text-xs text-muted-foreground">Full control</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {getPermissionDescription(permissionLevel)}
            </p>
          </div>

          {/* Expiration Date */}
          <div className="space-y-3">
            <Label>Expiration Date (Optional)</Label>
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expirationDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expirationDate ? format(expirationDate, "PPP") : "Set expiration date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expirationDate}
                  onSelect={(date) => {
                    setExpirationDate(date);
                    setIsCalendarOpen(false);
                  }}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {expirationDate && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Access will expire on {format(expirationDate, "PPP")}
                </p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setExpirationDate(undefined)}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes about this document share..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleShare} 
            disabled={selectedBranches.length === 0 || loading}
          >
            {loading ? 'Sharing...' : `Share with ${selectedBranches.length} Branch${selectedBranches.length > 1 ? 'es' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CrossBranchSharingModal;