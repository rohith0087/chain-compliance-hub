import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Search, 
  Filter, 
  UserCheck, 
  UserX, 
  Mail, 
  Calendar,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Users,
  Building2,
  ShoppingCart,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface UserStats {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  company_name?: string;
  registration_date: string;
  total_chat_sessions: number;
  total_chat_messages: number;
  total_document_requests: number;
  total_document_uploads: number;
  last_activity_date?: string;
  total_activities: number;
}

interface AdminUserManagementProps {
  onStatsUpdate: (stats: { totalUsers: number; activeUsers: number; totalSessions: number; totalDocuments: number }) => void;
}

const AdminUserManagement = ({ onStatsUpdate }: AdminUserManagementProps) => {
  const [users, setUsers] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<UserStats | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Call the admin function to get user stats
      const { data, error } = await supabase.rpc('get_admin_user_stats');
      
      if (error) {
        console.error('Error fetching user stats:', error);
        toast({
          title: "Error",
          description: "Failed to load user data. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setUsers(data || []);
      
      // Update stats for parent component
      const totalUsers = data?.length || 0;
      const activeUsers = data?.filter((user: UserStats) => 
        user.last_activity_date && 
        new Date(user.last_activity_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length || 0;
      const totalSessions = data?.reduce((sum: number, user: UserStats) => sum + user.total_chat_sessions, 0) || 0;
      const totalDocuments = data?.reduce((sum: number, user: UserStats) => sum + user.total_document_uploads, 0) || 0;
      
      onStatsUpdate({
        totalUsers,
        activeUsers,
        totalSessions,
        totalDocuments
      });
      
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while loading users.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const getRoleIcon = (roles: string[]) => {
    if (roles.includes('admin')) return <Shield className="w-4 h-4 text-red-600" />;
    if (roles.includes('buyer')) return <ShoppingCart className="w-4 h-4 text-blue-600" />;
    if (roles.includes('supplier')) return <Building2 className="w-4 h-4 text-green-600" />;
    return <Users className="w-4 h-4 text-gray-600" />;
  };

  const getRoleBadgeVariant = (roles: string[]) => {
    if (roles.includes('admin')) return 'destructive';
    if (roles.includes('buyer')) return 'default';
    return 'secondary';
  };

  const getPrimaryRole = (roles: string[]) => {
    if (roles.includes('admin')) return 'Admin';
    if (roles.includes('buyer')) return 'Buyer';
    if (roles.includes('supplier')) return 'Supplier';
    return 'User';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActivityStatus = (lastActivity?: string) => {
    if (!lastActivity) return { status: 'Never', color: 'text-gray-500' };
    
    const daysSince = Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince === 0) return { status: 'Today', color: 'text-green-600' };
    if (daysSince === 1) return { status: 'Yesterday', color: 'text-green-500' };
    if (daysSince <= 7) return { status: `${daysSince} days ago`, color: 'text-yellow-600' };
    if (daysSince <= 30) return { status: `${daysSince} days ago`, color: 'text-orange-600' };
    return { status: `${daysSince} days ago`, color: 'text-red-600' };
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.company_name && user.company_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter);
    
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search users by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const activityStatus = getActivityStatus(user.last_activity_date);
                
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {user.full_name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getRoleBadgeVariant(user.roles)}
                        className="flex items-center gap-1 w-fit"
                      >
                        {getRoleIcon(user.roles)}
                        {getPrimaryRole(user.roles)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-900">
                        {user.company_name || 'Not specified'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{user.total_chat_sessions} sessions</p>
                        <p className="text-gray-500">{user.total_document_uploads} documents</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-900">
                        {formatDate(user.registration_date)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={activityStatus.color}>
                        {activityStatus.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>User Details: {user.full_name}</DialogTitle>
                          </DialogHeader>
                          {selectedUser && (
                            <div className="space-y-6">
                              {/* User Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">Email:</span> {selectedUser.email}</p>
                                    <p><span className="font-medium">Name:</span> {selectedUser.full_name}</p>
                                    <p><span className="font-medium">Company:</span> {selectedUser.company_name || 'Not specified'}</p>
                                    <p><span className="font-medium">Roles:</span> {selectedUser.roles.join(', ')}</p>
                                  </div>
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900 mb-2">Account Status</h4>
                                  <div className="space-y-2 text-sm">
                                    <p><span className="font-medium">Joined:</span> {formatDate(selectedUser.registration_date)}</p>
                                    <p><span className="font-medium">Last Activity:</span> {getActivityStatus(selectedUser.last_activity_date).status}</p>
                                    <p><span className="font-medium">Status:</span> <Badge variant="secondary">Active</Badge></p>
                                  </div>
                                </div>
                              </div>

                              {/* Activity Stats */}
                              <div>
                                <h4 className="font-medium text-gray-900 mb-2">Activity Statistics</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  <Card>
                                    <CardContent className="p-3">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-blue-600">{selectedUser.total_chat_sessions}</p>
                                        <p className="text-xs text-gray-500">Chat Sessions</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="p-3">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-green-600">{selectedUser.total_chat_messages}</p>
                                        <p className="text-xs text-gray-500">Messages</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="p-3">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-purple-600">{selectedUser.total_document_requests}</p>
                                        <p className="text-xs text-gray-500">Doc Requests</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                  <Card>
                                    <CardContent className="p-3">
                                      <div className="text-center">
                                        <p className="text-2xl font-bold text-orange-600">{selectedUser.total_document_uploads}</p>
                                        <p className="text-xs text-gray-500">Uploads</p>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
              <p className="text-gray-500">
                {searchTerm || roleFilter !== 'all' 
                  ? 'Try adjusting your search filters.' 
                  : 'No users have been registered yet.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserManagement;