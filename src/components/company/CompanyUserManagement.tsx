import React, { useState } from 'react';
import { Users, UserPlus, Mail, Shield, Building, Trash2, Eye, RotateCcw, Clock, Link, Check } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CompanyBranch, CompanyUser } from '@/hooks/useCompanyBranches';

interface CompanyUserManagementProps {
  branches: CompanyBranch[];
  companyUsers: CompanyUser[];
  onInviteUser: (fullName: string, email: string, branchId: string, role: string) => Promise<any>;
  onResendInvitation?: (email: string, branchId: string, role: string) => Promise<any>;
  onRemoveUser?: (companyUserId: string, forceDelete?: boolean) => Promise<any>;
  loading?: boolean;
}

const roleOptions = [
  { value: 'company_admin', label: 'Company Admin', description: 'Full access to all company data' },
  { value: 'branch_manager', label: 'Branch Manager', description: 'Manage specific branch operations' },
  { value: 'document_manager', label: 'Document Manager', description: 'Handle documents and compliance' },
  { value: 'approver', label: 'Approver', description: 'Review and approve documents' },
  { value: 'viewer', label: 'Viewer', description: 'View-only access to assigned data' }
];

const statusColors = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800'
};

export const CompanyUserManagement: React.FC<CompanyUserManagementProps> = ({
  branches,
  companyUsers,
  onInviteUser,
  onResendInvitation,
  onRemoveUser,
  loading = false
}) => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [viewUserModalOpen, setViewUserModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<CompanyUser | null>(null);
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null);
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    branchId: '',
    role: 'viewer'
  });
  const [inviting, setInviting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteForm.fullName || !inviteForm.email || !inviteForm.branchId || !inviteForm.role) {
      toast.error('Please fill in all fields');
      return;
    }

    setInviting(true);
    try {
      const result = await onInviteUser(inviteForm.fullName, inviteForm.email, inviteForm.branchId, inviteForm.role);
      if (!result.error) {
        setInviteModalOpen(false);
        setInviteForm({ fullName: '', email: '', branchId: '', role: 'viewer' });
      }
    } catch (error) {
      console.error('Error creating user:', error);
    } finally {
      setInviting(false);
    }
  };

  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.branch_name || 'Unknown Branch';
  };

  const getRoleDisplay = (role: string) => {
    const roleOption = roleOptions.find(r => r.value === role);
    return roleOption?.label || role;
  };

  const handleResendInvitation = async (user: CompanyUser) => {
    if (!onResendInvitation || !user.email || !user.branch_id) {
      toast.error('Cannot resend invitation - missing required information');
      return;
    }

    // Validate email format
    if (user.email === 'Invitation data unavailable' || user.email === 'No email' || !user.email.includes('@')) {
      toast.error('Cannot resend invitation - invalid email address. Please delete and re-invite this user.');
      return;
    }

    setResending(user.id);
    try {
      await onResendInvitation(user.email, user.branch_id, user.role);
    } catch (error) {
      console.error('Error resending invitation:', error);
    } finally {
      setResending(null);
    }
  };

  const handleViewUser = (user: CompanyUser) => {
    setSelectedUser(user);
    setViewUserModalOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRemoveUser = async () => {
    if (!userToDelete || !onRemoveUser) return;
    
    setInviting(true);
    try {
      const result = await onRemoveUser(userToDelete.id, forceDelete);
      
      if (result.data?.requires_confirmation) {
        setDeleteConfirmation(result.data);
        return;
      }
      
      if (!result.error) {
        setDeleteDialogOpen(false);
        setUserToDelete(null);
        setForceDelete(false);
        setDeleteConfirmation(null);
      }
    } finally {
      setInviting(false);
    }
  };

  const isInvitationExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleCopyInvitationLink = async (token: string) => {
    try {
      const invitationUrl = `${window.location.origin}/invite/${token}`;
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedLink(true);
      toast.success('Invitation link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast.error('Failed to copy link to clipboard');
    }
  };

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Company Users
            </CardTitle>
            <CardDescription>
              Manage users and their access across company branches
            </CardDescription>
          </div>
          <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. They will receive an email with instructions to set their password.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={inviteForm.fullName || ''}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@company.com"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Select
                    value={inviteForm.branchId}
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, branchId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className="flex items-center space-x-2">
                            <Building className="h-4 w-4" />
                            <span>{branch.branch_name}</span>
                            {branch.location && (
                              <span className="text-xs text-muted-foreground">
                                ({branch.location})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) => setInviteForm(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div>
                            <div className="font-medium">{role.label}</div>
                            <div className="text-xs text-muted-foreground">{role.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? (
                      <>
                        <Mail className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create User
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* User Details Modal */}
          <Dialog open={viewUserModalOpen} onOpenChange={setViewUserModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>User Details</DialogTitle>
                <DialogDescription>
                  View detailed information about this user
                </DialogDescription>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <p className="text-sm">{selectedUser.full_name}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm">{selectedUser.email}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Branch</Label>
                    <p className="text-sm">{getBranchName(selectedUser.branch_id || '')}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Role</Label>
                    <p className="text-sm">{getRoleDisplay(selectedUser.role)}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge 
                      variant="outline" 
                      className={statusColors[selectedUser.status as keyof typeof statusColors]}
                    >
                      {selectedUser.status}
                    </Badge>
                  </div>
                  
                  {selectedUser.status === 'pending' && (
                    <>
                      {selectedUser.invitation_expires_at && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Invitation Expires</Label>
                          <p className="text-sm">{formatDate(selectedUser.invitation_expires_at)}</p>
                          {isInvitationExpired(selectedUser.invitation_expires_at) && (
                            <p className="text-sm text-red-600">⚠️ Invitation has expired</p>
                          )}
                        </div>
                      )}
                      
                      {selectedUser.inviter_name && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Invited By</Label>
                          <p className="text-sm">{selectedUser.inviter_name}</p>
                        </div>
                      )}
                      
                      {onResendInvitation && (
                        <>
                          <Button 
                            onClick={() => handleResendInvitation(selectedUser)}
                            disabled={resending === selectedUser.id}
                            className="w-full"
                          >
                            {resending === selectedUser.id ? (
                              <>
                                <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                                Resending...
                              </>
                            ) : (
                              <>
                                <Mail className="h-4 w-4 mr-2" />
                                Resend Invitation
                              </>
                            )}
                          </Button>
                          
                          {selectedUser.invitation_token && (
                            <Button 
                              onClick={() => handleCopyInvitationLink(selectedUser.invitation_token!)}
                              disabled={copiedLink}
                              variant="outline"
                              className="w-full"
                            >
                              {copiedLink ? (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Link className="h-4 w-4 mr-2" />
                                  Copy Invitation Link
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                  
                  {selectedUser.status === 'active' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Joined</Label>
                        <p className="text-sm">{formatDate(selectedUser.joined_at)}</p>
                      </div>
                      
                      {selectedUser.inviter_name && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Originally Invited By</Label>
                          <p className="text-sm">{selectedUser.inviter_name}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : companyUsers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No users yet</p>
            <p className="text-sm">Start by inviting team members to join your company.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {companyUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                    <div>
                      <div className="font-medium">
                        {user.status === 'pending' 
                          ? user.full_name || 'Pending invitation'
                          : user.full_name || user.email || 'Unknown User'
                        }
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1 mb-1">
                          <Mail className="h-3 w-3" />
                          <span className={user.email === 'Invitation data unavailable' ? 'text-orange-600' : ''}>
                            {user.email}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Building className="h-3 w-3" />
                          <span>{getBranchName(user.branch_id || '')}</span>
                          <span>•</span>
                          <Shield className="h-3 w-3" />
                          <span>{getRoleDisplay(user.role)}</span>
                          {user.status === 'pending' && user.inviter_name && (
                            <>
                              <span>•</span>
                              <span className={user.inviter_name === 'Unknown' ? 'text-orange-600' : ''}>
                                Invited by {user.inviter_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                </div>
                 <div className="flex items-center space-x-2">
                   <div className="flex flex-col items-end space-y-1">
                     <Badge 
                       variant="outline" 
                       className={statusColors[user.status as keyof typeof statusColors]}
                     >
                       {user.status}
                       {user.status === 'pending' && user.invitation_expires_at && isInvitationExpired(user.invitation_expires_at) && (
                         <span className="ml-1 text-red-600">(Expired)</span>
                       )}
                     </Badge>
                     {user.status === 'pending' && user.invitation_expires_at && (
                       <div className="text-xs text-muted-foreground flex items-center">
                         <Clock className="h-3 w-3 mr-1" />
                         Expires {formatDate(user.invitation_expires_at)}
                       </div>
                     )}
                   </div>
                   <div className="flex space-x-1">
                     {user.status === 'pending' && onResendInvitation && (
                       <Button 
                         variant="ghost" 
                         size="sm"
                         onClick={() => handleResendInvitation(user)}
                         disabled={resending === user.id}
                         title="Resend invitation"
                       >
                         {resending === user.id ? (
                           <RotateCcw className="h-4 w-4 animate-spin" />
                         ) : (
                           <Mail className="h-4 w-4" />
                         )}
                       </Button>
                     )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleViewUser(user)}
                        title="View user details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setUserToDelete(user);
                          setDeleteDialogOpen(true);
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Remove user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                 </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* Delete User Dialog */}
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove User?</DialogTitle>
          <DialogDescription>
            {userToDelete?.status === 'pending' 
              ? `Are you sure you want to cancel the invitation for ${userToDelete?.email}?`
              : `Are you sure you want to remove ${userToDelete?.full_name || userToDelete?.email}?`
            }
          </DialogDescription>
        </DialogHeader>
        
        {deleteConfirmation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 mb-2">
              ⚠️ {deleteConfirmation.message}
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="force-delete"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
              />
              <label htmlFor="force-delete" className="text-sm">
                I understand and want to proceed anyway
              </label>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setDeleteDialogOpen(false);
              setForceDelete(false);
              setDeleteConfirmation(null);
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleRemoveUser}
            disabled={inviting || (deleteConfirmation && !forceDelete)}
          >
            {inviting ? 'Removing...' : userToDelete?.status === 'pending' ? 'Cancel Invitation' : 'Remove User'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};