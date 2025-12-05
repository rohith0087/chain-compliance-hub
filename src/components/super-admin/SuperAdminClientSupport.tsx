import { useState } from 'react';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useSupportTickets, SupportTicket } from '@/hooks/useSupportTickets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  const { users, loading: usersLoading } = useSuperAdmin();
  const { 
    tickets, 
    loading: ticketsLoading, 
    stats, 
    newTicketCount,
    clearNewTicketCount,
    updateTicketStatus,
    refetch 
  } = useSupportTickets();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isImpersonateDialogOpen, setIsImpersonateDialogOpen] = useState(false);
  const [isTicketDetailOpen, setIsTicketDetailOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

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

  const confirmImpersonate = () => {
    toast({
      title: "Impersonation Started",
      description: `Now viewing the system as ${selectedUser.email}. This action has been logged.`,
    });
    setIsImpersonateDialogOpen(false);
  };

  const viewTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setResolutionNotes(ticket.resolution_notes || '');
    setIsTicketDetailOpen(true);
    if (newTicketCount > 0) clearNewTicketCount();
  };

  const handleStatusChange = async (status: SupportTicket['status']) => {
    if (!selectedTicket) return;
    await updateTicketStatus(selectedTicket.id, status, resolutionNotes || undefined);
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
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Open</p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.red }}>{stats.open}</p>
              </div>
              <AlertTriangle className="w-6 h-6" style={{ color: NEON_COLORS.red }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>In Progress</p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.cyan }}>{stats.inProgress}</p>
              </div>
              <Activity className="w-6 h-6" style={{ color: NEON_COLORS.cyan }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Resolved</p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.green }}>{stats.resolved}</p>
              </div>
              <CheckCircle className="w-6 h-6" style={{ color: NEON_COLORS.green }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Closed</p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.purple }}>{stats.closed}</p>
              </div>
              <XCircle className="w-6 h-6" style={{ color: NEON_COLORS.purple }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Urgent</p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.amber }}>{stats.urgent}</p>
              </div>
              <Clock className="w-6 h-6" style={{ color: NEON_COLORS.amber }} />
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>Total</p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>{stats.total}</p>
              </div>
              <MessageSquare className="w-6 h-6" style={{ color: NEON_COLORS.blue }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Tickets */}
      <Card style={cardStyle}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2" style={{ color: 'hsl(var(--admin-text))' }}>
                <HelpCircle className="w-5 h-5" style={{ color: NEON_COLORS.cyan }} />
                Support Tickets
                {newTicketCount > 0 && (
                  <Badge className="animate-pulse" style={{ backgroundColor: NEON_COLORS.red, color: '#fff' }}>
                    {newTicketCount} new
                  </Badge>
                )}
              </CardTitle>
              <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Real-time support requests from users
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 border" style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
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
              <Button variant="outline" size="icon" onClick={refetch} style={{ borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No support tickets yet</p>
              <p className="text-sm">Tickets will appear here in real-time</p>
            </div>
          ) : (
            <div className="rounded-md border" style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <Table>
                <TableHeader>
                  <TableRow style={{ borderColor: 'hsl(var(--admin-border))' }}>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Source</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>User</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Subject</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Priority</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Status</TableHead>
                    <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Created</TableHead>
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
                      <TableCell>
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
                      <TableCell className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
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
          )}
        </CardContent>
      </Card>

      {/* User Impersonation */}
      <Card style={cardStyle}>
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
                          {user.is_buyer && (
                            <Badge variant="outline" className="text-xs" style={{ borderColor: NEON_COLORS.cyan, color: NEON_COLORS.cyan }}>
                              Buyer
                            </Badge>
                          )}
                          {user.is_supplier && (
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

      {/* Ticket Detail Dialog */}
      <Dialog open={isTicketDetailOpen} onOpenChange={setIsTicketDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]" style={{ backgroundColor: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" style={{ color: 'hsl(var(--admin-text))' }}>
              <span className="text-lg">{selectedTicket && getSourceIcon(selectedTicket.source)}</span>
              Ticket Details
            </DialogTitle>
            <DialogDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              View and manage support ticket
            </DialogDescription>
          </DialogHeader>
          
          {selectedTicket && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-4">
                {/* Header Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.subject}</h3>
                    <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                      {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" style={getPriorityStyle(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </Badge>
                    <Badge variant="outline" style={getStatusStyle(selectedTicket.status)}>
                      {selectedTicket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* User Info */}
                <div className="p-4 rounded-lg space-y-2" style={{ backgroundColor: 'hsl(var(--admin-bg))', border: '1px solid hsl(var(--admin-border))' }}>
                  <h4 className="font-medium text-sm" style={{ color: NEON_COLORS.cyan }}>User Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Name:</span>{' '}
                      <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.user_name || 'Anonymous'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Email:</span>{' '}
                      <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.user_email || 'Not provided'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Company:</span>{' '}
                      <span className="font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.company_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>User Type:</span>{' '}
                      <span className="font-medium capitalize" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.user_type || 'Guest'}</span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>Description</Label>
                  <div className="mt-2 p-4 rounded-lg whitespace-pre-wrap text-sm" style={{ backgroundColor: 'hsl(var(--admin-bg))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                    {selectedTicket.description}
                  </div>
                </div>

                {/* Context Info */}
                <div className="p-4 rounded-lg space-y-2" style={{ backgroundColor: 'hsl(var(--admin-bg))', border: '1px solid hsl(var(--admin-border))' }}>
                  <h4 className="font-medium text-sm" style={{ color: NEON_COLORS.cyan }}>Context (Auto-captured)</h4>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Page:</span>
                      <span className="font-mono text-xs truncate" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.page_url || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>IP:</span>
                      <span className="font-mono text-xs" style={{ color: 'hsl(var(--admin-text))' }}>{selectedTicket.ip_address || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
                      <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Browser:</span>
                      <span className="font-mono text-xs truncate max-w-[300px]" style={{ color: 'hsl(var(--admin-text))' }}>
                        {selectedTicket.user_agent?.split(' ').slice(0, 3).join(' ') || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Resolution Notes */}
                <div className="space-y-2">
                  <Label htmlFor="resolution" style={{ color: 'hsl(var(--admin-text))' }}>Resolution Notes</Label>
                  <Textarea
                    id="resolution"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about resolution or response..."
                    rows={3}
                    style={{ backgroundColor: 'hsl(var(--admin-bg))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={selectedTicket.status === 'in_progress'}
                    style={{ borderColor: NEON_COLORS.cyan, color: NEON_COLORS.cyan }}
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Mark In Progress
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleStatusChange('resolved')}
                    disabled={selectedTicket.status === 'resolved'}
                    style={{ borderColor: NEON_COLORS.green, color: NEON_COLORS.green }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Resolve
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleStatusChange('closed')}
                    disabled={selectedTicket.status === 'closed'}
                    style={{ borderColor: NEON_COLORS.purple, color: NEON_COLORS.purple }}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Close
                  </Button>
                </div>
              </div>
            </ScrollArea>
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
