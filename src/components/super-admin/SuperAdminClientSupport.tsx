import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdminTicketConversation } from '@/components/support/AdminTicketConversation';
import { 
  Search, UserCheck, AlertTriangle, MessageSquare, Eye, 
  HelpCircle, Activity, Clock, Globe, Monitor, MapPin,
  RefreshCw, CheckCircle, XCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Neon color palette for cyber theme
const NEON_COLORS = {
  cyan: '#22d3ee',
  purple: '#a855f7',
  green: '#4ade80',
  amber: '#fbbf24',
  pink: '#f472b6',
  red: '#ef4444',
  blue: '#3b82f6'
};

// Dark card styling
const cardStyle = {
  backgroundColor: 'hsl(var(--admin-card))',
  borderColor: 'hsl(var(--admin-border))'
};

export const SuperAdminClientSupport = () => {
  const navigate = useNavigate();
  const { users, loading: usersLoading } = usePlatformAdmin();
  const { 
    tickets, 
    loading: ticketsLoading, 
    stats, 
    newTicketCount,
    clearNewTicketCount,
    updateTicketStatus,
    refetch 
  } = useSupportTickets();
  const { startImpersonation } = useImpersonation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);
  const [isTicketDetailOpen, setIsTicketDetailOpen] = useState(false);

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTickets = tickets.filter(ticket => {
    if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
    return true;
  });

  const handleImpersonate = (user: any) => {
    setSelectedUser(user);
    setIsImpersonateDialogOpen(true);
  };

  const confirmImpersonate = async () => {
    if (!selectedUser) return;

    // Determine company type and ID from the user's data
    const companyType = selectedUser.company_type || (selectedUser.buyer_id ? 'buyer' : 'supplier');
    const companyId = selectedUser.company_id || selectedUser.buyer_id || selectedUser.supplier_id;
    const companyName = selectedUser.company_name || 'Unknown Company';

    if (!companyId) {
      toast({
        title: "Cannot Impersonate",
        description: "This user doesn't have an associated company.",
        variant: "destructive"
      });
      return;
    }

    await startImpersonation(
      {
        id: selectedUser.id,
        email: selectedUser.email,
        fullName: selectedUser.full_name || selectedUser.email
      },
      {
        id: companyId,
        name: companyName,
        type: companyType as 'buyer' | 'supplier'
      }
    );

    toast({
      title: "Impersonation Started",
      description: `Now viewing the system as ${selectedUser.email}. This action has been logged.`,
    });
    
    setIsImpersonateDialogOpen(false);
    
    // Navigate to the appropriate dashboard
    navigate('/dashboard');
  };

  const viewTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setIsTicketDetailOpen(true);
    if (newTicketCount > 0) clearNewTicketCount();
  };

  const handleStatusChange = async (status: SupportTicket['status']) => {
    if (!selectedTicket) return;
    await updateTicketStatus(selectedTicket.id, status);
    setSelectedTicket(prev => prev ? { ...prev, status } : null);
  };

  // Neon style priority badges
  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent': return { backgroundColor: `${NEON_COLORS.red}20`, color: NEON_COLORS.red, borderColor: NEON_COLORS.red };
      case 'high': return { backgroundColor: `${NEON_COLORS.amber}20`, color: NEON_COLORS.amber, borderColor: NEON_COLORS.amber };
      case 'medium': return { backgroundColor: `${NEON_COLORS.cyan}20`, color: NEON_COLORS.cyan, borderColor: NEON_COLORS.cyan };
      case 'low': return { backgroundColor: `${NEON_COLORS.green}20`, color: NEON_COLORS.green, borderColor: NEON_COLORS.green };
      default: return { backgroundColor: `${NEON_COLORS.purple}20`, color: NEON_COLORS.purple, borderColor: NEON_COLORS.purple };
    }
  };

  // Neon style status badges
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'open': return { backgroundColor: `${NEON_COLORS.red}20`, color: NEON_COLORS.red, borderColor: NEON_COLORS.red };
      case 'in_progress': return { backgroundColor: `${NEON_COLORS.cyan}20`, color: NEON_COLORS.cyan, borderColor: NEON_COLORS.cyan };
      case 'resolved': return { backgroundColor: `${NEON_COLORS.green}20`, color: NEON_COLORS.green, borderColor: NEON_COLORS.green };
      case 'closed': return { backgroundColor: `${NEON_COLORS.purple}20`, color: NEON_COLORS.purple, borderColor: NEON_COLORS.purple };
      default: return { backgroundColor: `${NEON_COLORS.purple}20`, color: NEON_COLORS.purple, borderColor: NEON_COLORS.purple };
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'buyer_portal': return '🛒';
      case 'supplier_portal': return '📦';
      case 'login_page': return '🔐';
      default: return '📋';
    }
  };

  const loading = usersLoading || ticketsLoading;

  if (loading) {
    return (
      <Card style={cardStyle}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: NEON_COLORS.cyan }}></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Quick Stats - Mobile: 3 columns, Tablet: 4, Desktop: 6 */}
      <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-4">
        <Card style={cardStyle}>
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Open</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: NEON_COLORS.red }}>{stats.open}</p>
              </div>
              <AlertTriangle className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.red }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>In Progress</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: NEON_COLORS.cyan }}>{stats.inProgress}</p>
              </div>
              <Activity className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.cyan }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Resolved</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: NEON_COLORS.green }}>{stats.resolved}</p>
              </div>
              <CheckCircle className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.green }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle} className="hidden md:block">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Closed</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: NEON_COLORS.purple }}>{stats.closed}</p>
              </div>
              <XCircle className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.purple }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle} className="hidden lg:block">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Urgent</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: NEON_COLORS.amber }}>{stats.urgent}</p>
              </div>
              <Clock className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.amber }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle} className="hidden lg:block">
          <CardContent className="p-2 md:p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-[10px] md:text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Total</p>
                <p className="text-lg md:text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>{stats.total}</p>
              </div>
              <MessageSquare className="hidden md:block w-6 h-6" style={{ color: NEON_COLORS.blue }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card style={cardStyle}>
        <CardHeader className="p-3 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base md:text-lg" style={{ color: 'hsl(var(--admin-text))' }}>
                <HelpCircle className="w-4 h-4 md:w-5 md:h-5" style={{ color: NEON_COLORS.cyan }} />
                Support Tickets
                {newTicketCount > 0 && (
                  <Badge className="animate-pulse text-xs" style={{ backgroundColor: NEON_COLORS.red, color: '#fff' }}>
                    {newTicketCount} new
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs md:text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Real-time support requests from users
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-36 border text-sm" style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={refetch} className="shrink-0" style={{ borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 md:py-12" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              <MessageSquare className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm md:text-base">No support tickets yet</p>
              <p className="text-xs md:text-sm">Tickets will appear here in real-time</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block rounded-md border" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ borderColor: 'hsl(var(--admin-border))' }}>
                      <TableHead className="hidden lg:table-cell" style={{ color: 'hsl(var(--admin-text-muted))' }}>Source</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>User</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Subject</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Priority</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Status</TableHead>
                      <TableHead className="hidden lg:table-cell" style={{ color: 'hsl(var(--admin-text-muted))' }}>Created</TableHead>
                      <TableHead className="text-right" style={{ color: 'hsl(var(--admin-text-muted))' }}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTickets.map((ticket) => (
                      <TableRow 
                        key={ticket.id} 
                        className="cursor-pointer transition-colors" 
                        style={{ borderColor: 'hsl(var(--admin-border))' }}
                        onClick={() => viewTicketDetails(ticket)}
                      >
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-lg" title={ticket.source}>
                            {getSourceIcon(ticket.source)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'hsl(var(--admin-text))' }}>
                              {ticket.user_name || ticket.user_email || 'Anonymous'}
                            </p>
                            {ticket.company_name && (
                              <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{ticket.company_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium truncate max-w-[200px]" style={{ color: 'hsl(var(--admin-text))' }}>{ticket.subject}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" style={getPriorityStyle(ticket.priority)}>
                            {ticket.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" style={getStatusStyle(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                          {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); viewTicketDetails(ticket); }}
                            style={{ color: NEON_COLORS.cyan }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    className="w-full p-3 rounded-lg border text-left transition-colors active:opacity-80"
                    style={{ 
                      backgroundColor: 'hsl(var(--admin-bg))',
                      borderColor: 'hsl(var(--admin-border))'
                    }}
                    onClick={() => viewTicketDetails(ticket)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate" style={{ color: 'hsl(var(--admin-text))' }}>
                          {ticket.subject}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                          {ticket.user_name || ticket.user_email || 'Anonymous'}
                        </p>
                      </div>
                      <span className="text-base shrink-0">{getSourceIcon(ticket.source)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={getPriorityStyle(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0" style={getStatusStyle(ticket.status)}>
                          {ticket.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* User Impersonation - Hidden on mobile */}
      <Card style={cardStyle} className="hidden md:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: 'hsl(var(--admin-text))' }}>
            <UserCheck className="w-5 h-5" style={{ color: NEON_COLORS.purple }} />
            User Impersonation
          </CardTitle>
          <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Debug client issues by viewing the system from their perspective
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <Input
                placeholder="Search users to impersonate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
              />
            </div>

            <div className="rounded-md border max-h-64 overflow-y-auto" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'hsl(var(--admin-border))' }}>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>User</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Company</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Type</TableHead>
                    <TableHead className="text-right" style={{ color: 'hsl(var(--admin-text-muted))' }}>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.slice(0, 10).map((user) => (
                    <TableRow key={user.id} style={{ borderColor: 'hsl(var(--admin-border))' }}>
                      <TableCell>
                        <div>
                          <p className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{user.full_name || 'No Name'}</p>
                          <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell style={{ color: 'hsl(var(--admin-text))' }}>{user.company_name || 'No Company'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(user.user_type === 'Buyer' || user.user_type === 'Both') && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: NEON_COLORS.cyan, color: NEON_COLORS.cyan }}>
                              Buyer
                            </Badge>
                          )}
                          {(user.user_type === 'Supplier' || user.user_type === 'Both') && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: NEON_COLORS.purple, color: NEON_COLORS.purple }}>
                              Supplier
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleImpersonate(user)}
                          style={{ borderColor: NEON_COLORS.purple, color: NEON_COLORS.purple }}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Impersonate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog - Full screen on mobile */}
      <Dialog open={isTicketDetailOpen} onOpenChange={setIsTicketDetailOpen}>
        <DialogContent 
          className="w-full h-full md:max-w-3xl md:h-[85vh] flex flex-col p-0 md:p-6 gap-0" 
          style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}
        >
          <DialogHeader className="flex-shrink-0 p-4 md:p-0 border-b md:border-0" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <DialogTitle className="flex items-center gap-2 text-base md:text-lg" style={{ color: 'hsl(var(--admin-text))' }}>
              <span className="text-lg">{selectedTicket && getSourceIcon(selectedTicket.source)}</span>
              Ticket Details
            </DialogTitle>
            <DialogDescription className="text-xs md:text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              View and manage support ticket
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="flex-1 flex flex-col min-h-0 gap-3 md:gap-4 p-4 md:p-0 overflow-hidden">
              {/* Header Info - Stacked on mobile */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 flex-shrink-0">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base md:text-lg truncate" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.subject}</h3>
                  <p className="text-xs md:text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs" style={getPriorityStyle(selectedTicket.priority)}>
                    {selectedTicket.priority}
                  </Badge>
                  <Badge variant="outline" className="text-xs" style={getStatusStyle(selectedTicket.status)}>
                    {selectedTicket.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* User Info - Stacked on mobile */}
              <div className="p-2 md:p-3 rounded-lg flex-shrink-0" style={{ backgroundColor: 'hsl(var(--admin-bg))', border: '1px solid hsl(var(--admin-border))' }}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs md:text-sm">
                  <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                    <div>
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>User:</span>{' '}
                      <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.user_name || 'Anonymous'}</span>
                    </div>
                    <div className="truncate">
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Email:</span>{' '}
                      <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.user_email || 'N/A'}</span>
                    </div>
                    {selectedTicket.company_name && (
                      <div className="hidden md:block">
                        <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Company:</span>{' '}
                        <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.company_name}</span>
                      </div>
                    )}
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    <Globe className="w-3 h-3" />
                    <span className="font-mono truncate max-w-[150px]">{selectedTicket.page_url || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Conversation Area - Takes remaining space */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <AdminTicketConversation
                  ticketId={selectedTicket.id}
                  ticketDescription={selectedTicket.description}
                  ticketCreatedAt={selectedTicket.created_at}
                  userName={selectedTicket.user_name || selectedTicket.user_email || 'Anonymous'}
                  isClosed={selectedTicket.status === 'closed'}
                />
              </div>

              {/* Actions - Full width buttons on mobile */}
              <div className="flex flex-col md:flex-row gap-2 pt-2 flex-shrink-0" style={{ borderTop: '1px solid hsl(var(--admin-border))' }}>
                <Button 
                  size="sm"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={selectedTicket.status === 'in_progress'}
                  className="disabled:opacity-50 w-full md:w-auto"
                  style={{ backgroundColor: NEON_COLORS.cyan, color: '#000', fontWeight: 600 }}
                >
                  <Activity className="w-4 h-4 mr-1" />
                  Mark In Progress
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleStatusChange('resolved')}
                  disabled={selectedTicket.status === 'resolved'}
                  className="disabled:opacity-50 w-full md:w-auto"
                  style={{ backgroundColor: NEON_COLORS.green, color: '#000', fontWeight: 600 }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Resolve
                </Button>
                <Button 
                  size="sm"
                  onClick={() => handleStatusChange('closed')}
                  disabled={selectedTicket.status === 'closed'}
                  className="disabled:opacity-50 w-full md:w-auto"
                  style={{ backgroundColor: NEON_COLORS.purple, color: '#fff', fontWeight: 600 }}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Impersonation Confirmation Dialog */}
      <Dialog open={isImpersonateDialogOpen} onOpenChange={setIsImpersonateDialogOpen}>
        <DialogContent style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
          <DialogHeader>
            <DialogTitle style={{ color: 'hsl(var(--admin-text))' }}>Confirm User Impersonation</DialogTitle>
            <DialogDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              You are about to impersonate {selectedUser?.email}. This action will be logged for security purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.amber}15`, border: `1px solid ${NEON_COLORS.amber}40` }}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" style={{ color: NEON_COLORS.amber }} />
                <p className="text-sm font-medium" style={{ color: NEON_COLORS.amber }}>Security Notice</p>
              </div>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                All actions performed during impersonation will be logged and audited.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsImpersonateDialogOpen(false)}
                style={{ borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmImpersonate}
                style={{ backgroundColor: NEON_COLORS.purple, color: '#fff' }}
              >
                Start Impersonation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
