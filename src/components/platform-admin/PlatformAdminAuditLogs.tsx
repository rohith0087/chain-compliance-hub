import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  FileText,
  Upload,
  CheckCircle,
  XCircle,
  Download,
  Link,
  Eye,
  Key,
  LogOut,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  User,
  Building2,
  Globe,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';

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

interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: 'document' | 'auth' | 'system';
  action: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
  ipAddress: string | null;
  details: {
    documentName?: string;
    companyName?: string;
    supplierId?: string;
    buyerId?: string;
    status?: string;
    notes?: string;
    path?: string;
  };
  metadata?: Record<string, any>;
}

const cardStyle = {
  backgroundColor: 'hsl(var(--admin-card))',
  borderColor: 'hsl(var(--admin-border))'
};

const ACTION_ICONS: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  requested: { icon: <FileText className="h-4 w-4" />, color: NEON_COLORS.blue, label: 'Requested' },
  uploaded: { icon: <Upload className="h-4 w-4" />, color: NEON_COLORS.green, label: 'Uploaded' },
  approved: { icon: <CheckCircle className="h-4 w-4" />, color: NEON_COLORS.green, label: 'Approved' },
  rejected: { icon: <XCircle className="h-4 w-4" />, color: NEON_COLORS.red, label: 'Rejected' },
  downloaded: { icon: <Download className="h-4 w-4" />, color: NEON_COLORS.purple, label: 'Downloaded' },
  link_created: { icon: <Link className="h-4 w-4" />, color: NEON_COLORS.amber, label: 'Link Created' },
  link_accessed: { icon: <Eye className="h-4 w-4" />, color: NEON_COLORS.cyan, label: 'Link Accessed' },
  login: { icon: <Key className="h-4 w-4" />, color: NEON_COLORS.cyan, label: 'Login' },
  logout: { icon: <LogOut className="h-4 w-4" />, color: NEON_COLORS.pink, label: 'Logout' },
};

const DATE_RANGES = [
  { value: '1', label: 'Last 24 hours' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export function PlatformAdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('7');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const logsPerPage = 25;

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated');
        return;
      }

      // Calculate date range
      let dateFrom: string | undefined;
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        dateFrom = subDays(new Date(), days).toISOString();
      }

      // Build action types filter
      const actionTypes = actionFilter !== 'all' ? [actionFilter] : [];

      const response = await supabase.functions.invoke('get-audit-logs', {
        body: {
          dateFrom,
          actionTypes,
          limit: logsPerPage,
          offset: (currentPage - 1) * logsPerPage
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      setLogs(data.logs || []);
      setTotalLogs(data.total || 0);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [dateRange, actionFilter, currentPage]);

  // Filter logs by search query (client-side)
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.userName?.toLowerCase().includes(query) ||
      log.userEmail?.toLowerCase().includes(query) ||
      log.details?.documentName?.toLowerCase().includes(query) ||
      log.details?.companyName?.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query)
    );
  });

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
  };

  const getActionInfo = (action: string) => {
    return ACTION_ICONS[action] || { 
      icon: <Activity className="h-4 w-4" />, 
      color: NEON_COLORS.blue, 
      label: action 
    };
  };

  const totalPages = Math.ceil(totalLogs / logsPerPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'hsl(var(--admin-text))' }}>
          Audit Logs
        </h2>
        <p style={{ color: 'hsl(var(--admin-text-muted))' }}>
          Track all system activities, document events, and user actions across the platform
        </p>
      </div>

      {/* Filters */}
      <Card style={cardStyle}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <Input
                placeholder="Search by user, document, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                style={{
                  backgroundColor: 'hsl(var(--admin-surface))',
                  borderColor: 'hsl(var(--admin-border))',
                  color: 'hsl(var(--admin-text))'
                }}
              />
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger 
                  className="w-[150px]"
                  style={{
                    backgroundColor: 'hsl(var(--admin-surface))',
                    borderColor: 'hsl(var(--admin-border))',
                    color: 'hsl(var(--admin-text))'
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_RANGES.map((range) => (
                    <SelectItem key={range.value} value={range.value}>
                      {range.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger 
                  className="w-[150px]"
                  style={{
                    backgroundColor: 'hsl(var(--admin-surface))',
                    borderColor: 'hsl(var(--admin-border))',
                    color: 'hsl(var(--admin-text))'
                  }}
                >
                  <SelectValue placeholder="All Actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="uploaded">Uploaded</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="downloaded">Downloaded</SelectItem>
                  <SelectItem value="link_created">Link Created</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAuditLogs}
              disabled={loading}
              style={{
                borderColor: 'hsl(var(--admin-border))',
                color: 'hsl(var(--admin-text))'
              }}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: totalLogs, color: NEON_COLORS.cyan, icon: Activity },
          { label: 'Documents', value: filteredLogs.filter(l => ['requested', 'uploaded', 'approved', 'rejected'].includes(l.action)).length, color: NEON_COLORS.green, icon: FileText },
          { label: 'Downloads', value: filteredLogs.filter(l => l.action === 'downloaded').length, color: NEON_COLORS.purple, icon: Download },
          { label: 'Links Created', value: filteredLogs.filter(l => l.action === 'link_created').length, color: NEON_COLORS.amber, icon: Link },
        ].map((stat, index) => (
          <Card key={index} style={cardStyle}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{stat.label}</p>
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${stat.color}20` }}>
                  <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs Table */}
      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>Activity Log</CardTitle>
          <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Showing {filteredLogs.length} of {totalLogs} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4" style={{ color: NEON_COLORS.red }} />
              <p style={{ color: 'hsl(var(--admin-text))' }}>{error}</p>
              <Button 
                onClick={fetchAuditLogs} 
                className="mt-4"
                style={{ backgroundColor: NEON_COLORS.cyan }}
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: NEON_COLORS.cyan }} />
              <p style={{ color: 'hsl(var(--admin-text-muted))' }}>Loading audit logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 mx-auto mb-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <p style={{ color: 'hsl(var(--admin-text))' }}>No audit logs found</p>
              <p className="text-sm mt-1" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Try adjusting your filters or date range
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ backgroundColor: 'hsl(var(--admin-surface))' }}>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Timestamp
                        </div>
                      </TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Action</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          User
                        </div>
                      </TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          IP
                        </div>
                      </TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>Details</TableHead>
                      <TableHead style={{ color: 'hsl(var(--admin-text-muted))' }}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          Company
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const actionInfo = getActionInfo(log.action);
                      return (
                        <TableRow 
                          key={log.id}
                          className="hover:bg-opacity-50 transition-colors"
                          style={{ borderColor: 'hsl(var(--admin-border))' }}
                        >
                          <TableCell style={{ color: 'hsl(var(--admin-text-muted))' }} className="text-sm">
                            {formatTimestamp(log.timestamp)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className="flex items-center gap-1.5 w-fit"
                              style={{ 
                                backgroundColor: `${actionInfo.color}20`,
                                color: actionInfo.color,
                                borderColor: actionInfo.color
                              }}
                            >
                              {actionInfo.icon}
                              {actionInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'hsl(var(--admin-text))' }}>
                                {log.userName || 'Unknown'}
                              </p>
                              <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                                {log.userEmail || '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-mono" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                              {log.ipAddress || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm truncate max-w-[200px]" style={{ color: 'hsl(var(--admin-text))' }}>
                              {log.details?.documentName || log.details?.notes || '-'}
                            </p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                              {log.details?.companyName || '-'}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        borderColor: 'hsl(var(--admin-border))',
                        color: 'hsl(var(--admin-text))'
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        borderColor: 'hsl(var(--admin-border))',
                        color: 'hsl(var(--admin-text))'
                      }}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
