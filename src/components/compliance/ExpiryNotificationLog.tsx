import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, Mail, Search, FileText, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface ExpiryNotificationLogProps {
  buyerId: string;
}

interface NotificationRecord {
  id: string;
  document_upload_id: string;
  document_name: string | null;
  expiration_date: string | null;
  notification_tier: string;
  channel: string;
  sent_at: string;
  days_until_expiry: number | null;
  supplier_id: string | null;
  supplier_name?: string;
  request_title?: string;
  total_notifications?: number;
}

const ExpiryNotificationLog: React.FC<ExpiryNotificationLogProps> = ({ buyerId }) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');

  useEffect(() => {
    if (buyerId) {
      loadNotifications();
    }
  }, [buyerId]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      // First get all notifications for this buyer
      const { data: notificationsData, error } = await supabase
        .from('document_expiry_notifications')
        .select(`
          id,
          document_upload_id,
          document_name,
          expiration_date,
          notification_tier,
          channel,
          sent_at,
          days_until_expiry,
          supplier_id
        `)
        .eq('buyer_id', buyerId)
        .order('sent_at', { ascending: false });

      if (error) throw error;

      if (!notificationsData || notificationsData.length === 0) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      // Get unique supplier IDs
      const supplierIds = [...new Set(notificationsData.filter(n => n.supplier_id).map(n => n.supplier_id))];
      
      // Fetch supplier names
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .in('id', supplierIds);

      const supplierMap = new Map(suppliers?.map(s => [s.id, s.company_name]) || []);

      // Get unique document upload IDs
      const uploadIds = [...new Set(notificationsData.map(n => n.document_upload_id))];
      
      // Fetch request titles via uploads
      const { data: uploads } = await supabase
        .from('document_uploads')
        .select('id, request_id, document_requests(title)')
        .in('id', uploadIds);

      const uploadRequestMap = new Map(
        uploads?.map(u => [u.id, (u.document_requests as any)?.title]) || []
      );

      // Count notifications per document
      const countMap = new Map<string, number>();
      notificationsData.forEach(n => {
        const count = countMap.get(n.document_upload_id) || 0;
        countMap.set(n.document_upload_id, count + 1);
      });

      // Enrich notifications
      const enriched = notificationsData.map(n => ({
        ...n,
        supplier_name: n.supplier_id ? supplierMap.get(n.supplier_id) : undefined,
        request_title: uploadRequestMap.get(n.document_upload_id),
        total_notifications: countMap.get(n.document_upload_id) || 1
      }));

      setNotifications(enriched);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        n.document_name?.toLowerCase().includes(query) ||
        n.supplier_name?.toLowerCase().includes(query) ||
        n.request_title?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Channel filter
    if (channelFilter !== 'all' && n.channel !== channelFilter) return false;

    // Tier filter
    if (tierFilter !== 'all' && n.notification_tier !== tierFilter) return false;

    return true;
  });

  // Calculate stats
  const stats = {
    total: notifications.length,
    inApp: notifications.filter(n => n.channel === 'in_app').length,
    email: notifications.filter(n => n.channel === 'email').length,
    uniqueDocs: new Set(notifications.map(n => n.document_upload_id)).size
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'expires_soon':
        return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><Clock className="w-3 h-3 mr-1" />Expires Soon</Badge>;
      case 'urgent':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><AlertTriangle className="w-3 h-3 mr-1" />Urgent</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    return channel === 'email' 
      ? <Mail className="w-4 h-4 text-blue-500" />
      : <Bell className="w-4 h-4 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Bell className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inApp}</p>
                <p className="text-sm text-muted-foreground">In-App</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.email}</p>
                <p className="text-sm text-muted-foreground">Email</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.uniqueDocs}</p>
                <p className="text-sm text-muted-foreground">Docs Notified</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="in_app">In-App</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="expires_soon">Expires Soon</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notifications Table */}
      <Card>
        <CardHeader>
          <CardTitle>Notification History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No notification records found</p>
              <p className="text-sm mt-1">Notifications will appear here when document expiry alerts are sent</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Sent At</TableHead>
                  <TableHead className="text-right">Total Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications.map((notification) => {
                  const daysUntil = notification.expiration_date 
                    ? differenceInDays(new Date(notification.expiration_date), new Date())
                    : null;
                  
                  return (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{notification.document_name || notification.request_title || 'Unknown Document'}</p>
                            {notification.request_title && notification.document_name && (
                              <p className="text-xs text-muted-foreground">{notification.request_title}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{notification.supplier_name || 'Unknown'}</TableCell>
                      <TableCell>
                        <div>
                          <p>{notification.expiration_date ? format(new Date(notification.expiration_date), 'MMM d, yyyy') : 'N/A'}</p>
                          {daysUntil !== null && (
                            <p className={`text-xs ${daysUntil < 0 ? 'text-destructive' : daysUntil <= 7 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                              {daysUntil < 0 ? `${Math.abs(daysUntil)} days overdue` : daysUntil === 0 ? 'Expires today' : `${daysUntil} days left`}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTierBadge(notification.notification_tier)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getChannelIcon(notification.channel)}
                          <span className="capitalize">{notification.channel.replace('_', '-')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{format(new Date(notification.sent_at), 'MMM d, yyyy')}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(notification.sent_at), 'h:mm a')}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{notification.total_notifications}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpiryNotificationLog;
