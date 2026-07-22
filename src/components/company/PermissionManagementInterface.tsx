import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Users, 
  Building2, 
  FileCheck, 
  Settings,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Crown
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface PermissionManagementInterfaceProps {
  companyId: string;
  companyType: 'buyer' | 'supplier';
  companyUsers: any[];
  onPermissionUpdate?: () => void;
}

interface Permission {
  id: string;
  user_id: string;
  permission_type: 'read' | 'write' | 'approve' | 'delete' | 'invite_users' | 'manage_branches' | 'export_data';
  granted_at: string;
  expires_at?: string;
  resource_access?: string;
}

interface UserPermissions {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  branchName?: string;
  permissions: Permission[];
}

export const PermissionManagementInterface: React.FC<PermissionManagementInterfaceProps> = ({
  companyId,
  companyType,
  companyUsers,
  onPermissionUpdate
}) => {
  const [userPermissions, setUserPermissions] = useState<UserPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const permissionTypes = [
    { key: 'read', label: 'View', icon: Eye, description: 'View company data and documents' },
    { key: 'write', label: 'Edit', icon: Edit, description: 'Create and edit documents' },
    { key: 'approve', label: 'Approve', icon: UserCheck, description: 'Approve documents and requests' },
    { key: 'manage_branches', label: 'Manage Branches', icon: Building2, description: 'Create and manage company branches' },
    { key: 'invite_users', label: 'Manage Users', icon: Users, description: 'Invite and manage company users' }
  ];

  const rolePermissionMap = {
    company_admin: ['read', 'write', 'approve', 'manage_branches', 'invite_users'],
    branch_manager: ['read', 'write', 'approve'],
    document_manager: ['read', 'write'],
    approver: ['read', 'approve'],
    viewer: ['read']
  };

  useEffect(() => {
    loadUserPermissions();
  }, [companyId, companyType, companyUsers]);

  const loadUserPermissions = async () => {
    try {
      setLoading(true);
      
      // Get all explicit permissions for company users
      const { data: permissions, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('company_id', companyId)
        .eq('company_type', companyType);

      if (error) {
        console.error('Error loading permissions:', error);
        return;
      }

      // Get user profiles for names
      const userIds = companyUsers.map(user => user.profile_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        return;
      }

      // Get branch information
      const { data: branches, error: branchesError } = await supabase
        .from('company_branches')
        .select('id, branch_name')
        .eq('company_id', companyId)
        .eq('company_type', companyType);

      if (branchesError) {
        console.error('Error loading branches:', branchesError);
      }

      // Combine data
      const userPermissionsData: UserPermissions[] = companyUsers.map(companyUser => {
        const profile = profiles?.find(p => p.id === companyUser.profile_id);
        const branch = branches?.find(b => b.id === companyUser.branch_id);
        const userPerms = permissions?.filter(p => p.user_id === companyUser.profile_id) || [];

        return {
          userId: companyUser.profile_id,
          userName: profile?.full_name || 'Unknown User',
          userEmail: profile?.email || '',
          role: companyUser.role,
          branchName: branch?.branch_name,
          permissions: userPerms
        };
      });

      setUserPermissions(userPermissionsData);
    } catch (error) {
      console.error('Error in loadUserPermissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (userPerms: UserPermissions, permissionType: string): boolean => {
    // Check role-based permissions
    const rolePerms = rolePermissionMap[userPerms.role as keyof typeof rolePermissionMap] || [];
    if (rolePerms.includes(permissionType)) {
      return true;
    }

    // Check explicit permissions
    return userPerms.permissions.some(p => 
      p.permission_type === permissionType && 
      (!p.expires_at || new Date(p.expires_at) > new Date())
    );
  };

  const togglePermission = async (userId: string, permissionType: string, currentlyHas: boolean) => {
    try {
      if (currentlyHas) {
        // Remove permission
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('company_id', companyId)
          .eq('company_type', companyType)
          .eq('permission_type', permissionType as any);

        if (error) throw error;
        
        toast({
          title: "Permission Removed",
          description: "User permission has been revoked."
        });
      } else {
        // Add permission
        const { error } = await supabase
          .from('user_permissions')
          .insert({
            user_id: userId,
            company_id: companyId,
            company_type: companyType,
            permission_type: permissionType as any,
            granted_by: user?.id
          });

        if (error) throw error;
        
        toast({
          title: "Permission Granted",
          description: "User permission has been granted."
        });
      }

      // Reload permissions
      await loadUserPermissions();
      onPermissionUpdate?.();
    } catch (error) {
      console.error('Error toggling permission:', error);
      toast({
        title: "Error",
        description: "Failed to update permission. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'company_admin': return 'bg-primary/15 text-primary';
      case 'branch_manager': return 'bg-primary/15 text-primary';
      case 'document_manager': return 'bg-success/15 text-success';
      case 'approver': return 'bg-warning/15 text-warning';
      case 'viewer': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'company_admin': return <Crown className="w-3 h-3" />;
      case 'branch_manager': return <Building2 className="w-3 h-3" />;
      case 'document_manager': return <FileCheck className="w-3 h-3" />;
      case 'approver': return <UserCheck className="w-3 h-3" />;
      case 'viewer': return <Eye className="w-3 h-3" />;
      default: return <Users className="w-3 h-3" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Permission Management
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Manage user permissions for your organization. Role-based permissions are automatically applied.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="matrix" className="space-y-4">
          <TabsList>
            <TabsTrigger value="matrix">Permission Matrix</TabsTrigger>
            <TabsTrigger value="roles">Role Definitions</TabsTrigger>
          </TabsList>

          <TabsContent value="matrix" className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">User</th>
                    {permissionTypes.map(perm => (
                      <th key={perm.key} className="text-center p-3 font-medium min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <perm.icon className="h-4 w-4" />
                          <span className="text-xs">{perm.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userPermissions.map(userPerm => (
                    <tr key={userPerm.userId} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{userPerm.userName}</div>
                          <div className="text-sm text-muted-foreground">{userPerm.userEmail}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className={getRoleColor(userPerm.role)}>
                              {getRoleIcon(userPerm.role)}
                              <span className="ml-1 capitalize">{userPerm.role.replace('_', ' ')}</span>
                            </Badge>
                            {userPerm.branchName && (
                              <Badge variant="outline" className="text-xs">
                                {userPerm.branchName}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      {permissionTypes.map(perm => {
                        const hasThisPermission = hasPermission(userPerm, perm.key);
                        const isRoleBased = rolePermissionMap[userPerm.role as keyof typeof rolePermissionMap]?.includes(perm.key);
                        
                        return (
                          <td key={perm.key} className="p-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Switch
                                checked={hasThisPermission}
                                onCheckedChange={(checked) => 
                                  !isRoleBased && togglePermission(userPerm.userId, perm.key, hasThisPermission)
                                }
                                disabled={isRoleBased}
                                className="scale-75"
                              />
                              {isRoleBased && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  Role
                                </Badge>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(rolePermissionMap).map(([role, permissions]) => (
                <Card key={role}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {getRoleIcon(role)}
                      <span className="capitalize">{role.replace('_', ' ')}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {permissions.map(permKey => {
                        const perm = permissionTypes.find(p => p.key === permKey);
                        return perm ? (
                          <Badge key={permKey} variant="secondary" className="flex items-center gap-1">
                            <perm.icon className="w-3 h-3" />
                            {perm.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};