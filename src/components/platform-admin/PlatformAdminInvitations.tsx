import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, Trash2, Copy, Clock, CheckCircle, XCircle } from "lucide-react";
import { usePlatformAdmin, type PlatformRole } from "@/hooks/usePlatformAdmin";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function PlatformAdminInvitations() {
  const { invitations, loading, createInvitation, revokeInvitation, fetchInvitations } = usePlatformAdmin();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    roles: [] as PlatformRole[]
  });

  const handleCreateInvitation = async () => {
    if (!formData.email || formData.roles.length === 0) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const result = await createInvitation(formData.email, formData.roles);
      if (result.success) {
        setIsCreateDialogOpen(false);
        setFormData({ email: "", roles: [] });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRoleToggle = (role: PlatformRole) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role) 
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const copyInvitationLink = (token: string) => {
    const inviteUrl = `${window.location.origin}/platform-admin/accept-invitation?token=${token}`;
    navigator.clipboard.writeText(inviteUrl);
    toast({
      title: "Success",
      description: "Invitation link copied to clipboard",
    });
  };

  const getStatusBadge = (invitation: any) => {
    if (invitation.is_used) {
      return <Badge variant="default" className="text-emerald-700 bg-emerald-100"><CheckCircle className="w-3 h-3 mr-1" />Accepted</Badge>;
    }
    
    const isExpired = new Date(invitation.expires_at) < new Date();
    if (isExpired) {
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    }
    
    return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Admin Invitations</h2>
          <p className="text-muted-foreground">
            Manage invitations for new platform administrators
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Invitation
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Platform Admin Invitation</DialogTitle>
              <DialogDescription>
                Send an invitation to a new platform administrator. They will receive an email with instructions to accept.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Platform Roles</Label>
                <div className="space-y-2">
                  {(['super_admin', 'platform_admin', 'support_admin'] as PlatformRole[]).map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={role}
                        checked={formData.roles.includes(role)}
                        onCheckedChange={() => handleRoleToggle(role)}
                      />
                      <Label htmlFor={role} className="text-sm font-medium">
                        {role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateInvitation} disabled={isCreating}>
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invitations</CardTitle>
          <CardDescription>
            View and manage all platform admin invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No invitations found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first invitation to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {invitation.platform_roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-xs">
                            {role.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{invitation.invited_by_name || 'System'}</TableCell>
                    <TableCell>{format(new Date(invitation.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{format(new Date(invitation.expires_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(invitation)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {!invitation.is_used && new Date(invitation.expires_at) > new Date() && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyInvitationLink('token-placeholder')}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to revoke this invitation? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => revokeInvitation(invitation.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Revoke
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}