import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MoreHorizontal, Search, Settings, RotateCcw, Users, Database, Shield } from 'lucide-react';
import { usePlatformAdmin, type DetailedUser } from '@/hooks/usePlatformAdmin';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

export function PlatformAdminUserManagement() {
  const { users, loading, error, updateUserRole, resetUserPassword, fetchAllUsers } = usePlatformAdmin();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<DetailedUser | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.company_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.user_type === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const handleRoleUpdate = async (role: string) => {
    if (!selectedUser) return;
    
    let newRoles: string[] = [];
    if (role === 'buyer') newRoles = ['buyer'];
    else if (role === 'supplier') newRoles = ['supplier'];
    else if (role === 'admin') newRoles = ['admin'];
    else if (role === 'buyer_admin') newRoles = ['buyer', 'admin'];
    else if (role === 'supplier_admin') newRoles = ['supplier', 'admin'];
    
    await updateUserRole(selectedUser.id, newRoles);
    setShowRoleDialog(false);
    setSelectedUser(null);
  };

  const handlePasswordReset = async (userId: string) => {
    const result = await resetUserPassword(userId);
    
    if (result?.success) {
      toast({
        title: "Password Reset Successful",
        description: "Temporary password sent to user's email address",
      });
    } else {
      toast({
        title: "Password Reset Failed", 
        description: result?.error || "Failed to send password reset email",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (userType: string) => {
    switch (userType) {
      case 'buyer': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'supplier': return 'bg-green-100 text-green-800 border-green-200';
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border-white/20 shadow-elegant">
        <CardHeader className="bg-gradient-primary text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">User Management</CardTitle>
          <CardDescription className="text-white/90 text-base">
            Manage user accounts, roles, and permissions across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          {error && (
            <div className="mb-6 p-6 bg-destructive/10 border border-destructive/20 rounded-xl backdrop-blur-sm shadow-lg">
              <p className="text-destructive font-medium">Error: {error}</p>
              <button 
                onClick={fetchAllUsers}
                className="mt-3 text-sm text-destructive hover:underline font-medium"
              >
                Try again
              </button>
            </div>
          )}

          {/* Enhanced Filters */}
          <div className="flex flex-col sm:flex-row gap-6 mb-8 p-6 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl border border-primary/10">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-primary/60" />
              <Input
                placeholder="Search users by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white/70 border-primary/20 focus:border-primary shadow-lg backdrop-blur-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-64 h-12 bg-white/70 border-primary/20 shadow-lg backdrop-blur-sm">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-sm">
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="buyer">Buyers</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Professional Users Table */}
          <div className="rounded-xl border border-primary/10 shadow-elegant overflow-hidden bg-white/80 backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gradient-primary">
                    <th className="text-left p-6 font-semibold text-white">User</th>
                    <th className="text-left p-6 font-semibold text-white">Company</th>
                    <th className="text-left p-6 font-semibold text-white">Roles</th>
                    <th className="text-left p-6 font-semibold text-white">Type</th>
                    <th className="text-left p-6 font-semibold text-white">Activity</th>
                    <th className="text-left p-6 font-semibold text-white">Joined</th>
                    <th className="text-right p-6 font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr key={user.id} className={`border-b border-primary/5 hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 ${index % 2 === 0 ? 'bg-white/50' : 'bg-primary/[0.02]'}`}>
                      <td className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-lg">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{user.full_name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="font-medium">{user.company_name || 'N/A'}</div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs font-medium border-primary/20">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-6">
                        <Badge className={`${getRoleColor(user.user_type)} font-medium`}>
                          {user.user_type}
                        </Badge>
                      </td>
                       <td className="p-6">
                         <div className="text-sm">
                           <div className="text-muted-foreground">
                             {user.last_activity_date ? 
                               `Last seen: ${format(new Date(user.last_activity_date), 'MMM dd')}` :
                               'No recent activity'
                             }
                           </div>
                         </div>
                       </td>
                      <td className="p-6">
                        <div className="text-sm font-medium">
                          {format(new Date(user.registration_date), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-10 w-10 rounded-full hover:bg-primary/10 transition-colors duration-300"
                            >
                              <MoreHorizontal className="h-5 w-5 text-primary" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-sm border-primary/20">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRoleDialog(true);
                              }}
                              className="hover:bg-primary/10"
                            >
                              <Settings className="h-4 w-4 mr-3 text-primary" />
                              Manage Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePasswordReset(user.id)}
                              className="hover:bg-primary/10"
                            >
                              <RotateCcw className="h-4 w-4 mr-3 text-primary" />
                              Reset Password
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No users found matching the current criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Professional Role Management Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="bg-gradient-to-br from-white to-primary/5 border-primary/20 shadow-elegant">
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-bold text-primary">Manage User Roles</DialogTitle>
            <DialogDescription className="text-base">
              Update roles for <span className="font-semibold text-primary">{selectedUser?.full_name}</span> ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('buyer')}
                className="justify-start h-12 border-blue-accent/30 hover:bg-blue-accent/10 hover:border-blue-accent transition-all duration-300"
              >
                <Users className="h-4 w-4 mr-2" />
                Buyer
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('supplier')}
                className="justify-start h-12 border-green-accent/30 hover:bg-green-accent/10 hover:border-green-accent transition-all duration-300"
              >
                <Database className="h-4 w-4 mr-2" />
                Supplier
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('admin')}
                className="justify-start h-12 border-purple-accent/30 hover:bg-purple-accent/10 hover:border-purple-accent transition-all duration-300"
              >
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('buyer_admin')}
                className="justify-start h-12 border-primary/30 hover:bg-primary/10 hover:border-primary transition-all duration-300"
              >
                <Settings className="h-4 w-4 mr-2" />
                Buyer + Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('supplier_admin')}
                className="justify-start h-12 border-secondary/30 hover:bg-secondary/10 hover:border-secondary transition-all duration-300"
              >
                <Settings className="h-4 w-4 mr-2" />
                Supplier + Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}