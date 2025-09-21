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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'hsl(var(--admin-text))' }} />
      </div>
    );
  }

  return (
    <>
      <Card className="border" style={{ 
        backgroundColor: 'hsl(var(--admin-surface))',
        borderColor: 'hsl(var(--admin-border))'
      }}>
        <CardHeader className="border-b p-6" style={{ 
          borderColor: 'hsl(var(--admin-border))',
          backgroundColor: 'hsl(var(--admin-card))'
        }}>
          <CardTitle className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
            User Management
          </CardTitle>
          <CardDescription className="text-base" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Manage user accounts, roles, and permissions across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8" style={{ backgroundColor: 'hsl(var(--admin-surface))' }}>
          {error && (
            <div className="mb-6 p-6 border rounded-xl" 
              style={{
                backgroundColor: 'hsl(var(--admin-card))',
                borderColor: 'hsl(var(--admin-border))'
              }}>
              <p style={{ color: 'hsl(var(--admin-text))' }}>Error: {error}</p>
              <button 
                onClick={fetchAllUsers}
                className="mt-3 text-sm hover:underline"
                style={{ color: 'hsl(var(--admin-accent-blue))' }}
              >
                Try again
              </button>
            </div>
          )}

          {/* Enhanced Filters */}
          <div className="flex flex-col sm:flex-row gap-6 mb-8 p-6 rounded-xl border" 
            style={{
              backgroundColor: 'hsl(var(--admin-card))',
              borderColor: 'hsl(var(--admin-border))'
            }}>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5" 
                style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <Input
                placeholder="Search users by name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border"
                style={{
                  backgroundColor: 'hsl(var(--admin-background))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-64 h-12 border"
                style={{
                  backgroundColor: 'hsl(var(--admin-background))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}>
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent className="border"
                style={{
                  backgroundColor: 'hsl(var(--admin-surface))',
                  borderColor: 'hsl(var(--admin-border))'
                }}>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="buyer">Buyers</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Professional Users Table */}
          <div className="rounded-xl border overflow-hidden" 
            style={{
              backgroundColor: 'hsl(var(--admin-surface))',
              borderColor: 'hsl(var(--admin-border))'
            }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'hsl(var(--admin-card))' }}>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>User</th>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Company</th>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Roles</th>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Type</th>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Activity</th>
                    <th className="text-left p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Joined</th>
                    <th className="text-right p-6 font-semibold border-b" 
                      style={{ 
                        color: 'hsl(var(--admin-text))',
                        borderColor: 'hsl(var(--admin-border))'
                      }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => (
                    <tr key={user.id} className="border-b transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                      style={{ 
                        borderColor: 'hsl(var(--admin-border))'
                      }}>
                      <td className="p-6">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: 'hsl(var(--admin-accent-blue))' }}>
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-lg" style={{ color: 'hsl(var(--admin-text))' }}>
                              {user.full_name}
                            </div>
                            <div className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                          {user.company_name || 'N/A'}
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs font-medium border"
                              style={{
                                borderColor: 'hsl(var(--admin-border))',
                                color: 'hsl(var(--admin-text))',
                                backgroundColor: 'hsl(var(--admin-card))'
                              }}>
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-6">
                        <Badge className="font-medium border"
                          style={{
                            borderColor: 'hsl(var(--admin-border))',
                            color: 'white',
                            backgroundColor: 'hsl(var(--admin-accent-blue))'
                          }}>
                          {user.user_type}
                        </Badge>
                      </td>
                       <td className="p-6">
                         <div className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                           {user.last_activity_date ? 
                             `Last seen: ${format(new Date(user.last_activity_date), 'MMM dd')}` :
                             'No recent activity'
                           }
                         </div>
                       </td>
                      <td className="p-6">
                        <div className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>
                          {format(new Date(user.registration_date), 'MMM dd, yyyy')}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-10 w-10 rounded-full transition-colors duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                              style={{ 
                                color: 'hsl(var(--admin-text-muted))'
                              }}
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border"
                            style={{
                              backgroundColor: 'hsl(var(--admin-surface))',
                              borderColor: 'hsl(var(--admin-border))'
                            }}>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(user);
                                setShowRoleDialog(true);
                              }}
                              className="transition-colors hover:bg-[hsl(var(--admin-sidebar-accent))]"
                              style={{ 
                                color: 'hsl(var(--admin-text))'
                              }}
                            >
                              <Settings className="h-4 w-4 mr-3" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
                              Manage Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handlePasswordReset(user.id)}
                              className="transition-colors hover:bg-[hsl(var(--admin-sidebar-accent))]"
                              style={{ 
                                color: 'hsl(var(--admin-text))'
                              }}
                            >
                              <RotateCcw className="h-4 w-4 mr-3" style={{ color: 'hsl(var(--admin-accent-blue))' }} />
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
            <div className="text-center py-16" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              <Users className="h-16 w-16 mx-auto mb-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <p className="text-lg font-medium">No users found matching the current criteria.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Professional Role Management Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="border" style={{
          backgroundColor: 'hsl(var(--admin-surface))',
          borderColor: 'hsl(var(--admin-border))'
        }}>
          <DialogHeader className="space-y-4">
            <DialogTitle className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
              Manage User Roles
            </DialogTitle>
            <DialogDescription className="text-base" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Update roles for <span className="font-semibold" style={{ color: 'hsl(var(--admin-accent-blue))' }}>
                {selectedUser?.full_name}
              </span> ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('buyer')}
                className="justify-start h-12 border transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                style={{
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))',
                  backgroundColor: 'hsl(var(--admin-card))'
                }}
              >
                <Users className="h-4 w-4 mr-2" />
                Buyer
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('supplier')}
                className="justify-start h-12 border transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                style={{
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))',
                  backgroundColor: 'hsl(var(--admin-card))'
                }}
              >
                <Database className="h-4 w-4 mr-2" />
                Supplier
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('admin')}
                className="justify-start h-12 border transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                style={{
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))',
                  backgroundColor: 'hsl(var(--admin-card))'
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('buyer_admin')}
                className="justify-start h-12 border transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                style={{
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))',
                  backgroundColor: 'hsl(var(--admin-card))'
                }}
              >
                <Settings className="h-4 w-4 mr-2" />
                Buyer + Admin
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRoleUpdate('supplier_admin')}
                className="justify-start h-12 border transition-all duration-300 hover:bg-[hsl(var(--admin-sidebar-accent))]"
                style={{
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))',
                  backgroundColor: 'hsl(var(--admin-card))'
                }}
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