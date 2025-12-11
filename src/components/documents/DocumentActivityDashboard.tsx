import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Search,
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Upload,
  FileCheck,
  Calendar,
  Download,
  Link,
  Eye,
  FileText
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, subDays } from 'date-fns';
import DocumentActivityChain from './DocumentActivityChain';

interface ActivityEvent {
  id: string;
  type: 'requested' | 'uploaded' | 'approved' | 'rejected' | 'downloaded' | 'link_created' | 'link_accessed' | 'created' | 'submitted' | 'expired' | 'reminder';
  title: string;
  description: string;
  date: string;
  status?: string;
  documentTitle?: string;
  supplier?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
  userName?: string;
  userEmail?: string;
  documentRequestId?: string;
  documentUploadId?: string;
  notes?: string;
}

interface DocumentActivityDashboardProps {
  events: ActivityEvent[];
  documents?: any[];
}

const DocumentActivityDashboard = ({ events, documents = [] }: DocumentActivityDashboardProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7_days');
  const [selectedActivity, setSelectedActivity] = useState<{
    documentRequestId: string | null;
    documentTitle?: string;
    supplierName?: string;
  } | null>(null);

  // Extract unique users from events
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    events.forEach(event => {
      if (event.userName && event.userEmail) {
        users.set(event.userEmail, event.userName);
      }
    });
    return Array.from(users.entries());
  }, [events]);

  // Group events by time periods
  const groupedEvents = useMemo(() => {
    const filtered = events.filter(event => {
      const matchesSearch = searchTerm === '' || 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = selectedFilter === 'all' || event.type === selectedFilter;
      const matchesUser = selectedUser === 'all' || event.userEmail === selectedUser;
      
      const eventDate = new Date(event.date);
      const cutoffDate = subDays(new Date(), timeRange === '7_days' ? 7 : timeRange === '30_days' ? 30 : 90);
      const matchesTimeRange = eventDate >= cutoffDate;
      
      return matchesSearch && matchesFilter && matchesUser && matchesTimeRange;
    });

    const groups: { [key: string]: ActivityEvent[] } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filtered.forEach(event => {
      const eventDate = new Date(event.date);
      if (isToday(eventDate)) {
        groups.today.push(event);
      } else if (isYesterday(eventDate)) {
        groups.yesterday.push(event);
      } else if (isThisWeek(eventDate)) {
        groups.thisWeek.push(event);
      } else {
        groups.older.push(event);
      }
    });

    return groups;
  }, [events, searchTerm, selectedFilter, selectedUser, timeRange]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'requested': return <FileText className="w-4 h-4" />;
      case 'created': return <FileText className="w-4 h-4" />;
      case 'uploaded': return <Upload className="w-4 h-4" />;
      case 'submitted': return <Upload className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'downloaded': return <Download className="w-4 h-4" />;
      case 'link_created': return <Link className="w-4 h-4" />;
      case 'link_accessed': return <Eye className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      case 'reminder': return <Calendar className="w-4 h-4" />;
      default: return <FileCheck className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'requested': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'created': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'uploaded': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'submitted': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'downloaded': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'link_created': return 'text-cyan-600 bg-cyan-50 border-cyan-200';
      case 'link_accessed': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'expired': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'reminder': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatGroupDate = (groupKey: string) => {
    switch (groupKey) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'thisWeek': return 'This Week';
      case 'older': return 'Older';
      default: return groupKey;
    }
  };

  const handleEventClick = (event: ActivityEvent) => {
    if (event.documentRequestId) {
      setSelectedActivity({
        documentRequestId: event.documentRequestId,
        documentTitle: event.documentTitle,
        supplierName: event.supplier
      });
    }
  };

  const renderEventGroup = (groupKey: string, events: ActivityEvent[]) => {
    if (events.length === 0) return null;

    return (
      <div key={groupKey} className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-foreground">{formatGroupDate(groupKey)}</h3>
          <Badge variant="secondary" className="text-xs">
            {events.length}
          </Badge>
        </div>
        
        <div className="space-y-3">
          {events.map((event) => (
            <div 
              key={event.id} 
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getEventColor(event.type)}`}
              onClick={() => handleEventClick(event)}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-background shadow-sm`}>
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    {event.userName && (
                      <p className="text-xs text-muted-foreground mt-1">
                        by {event.userName}
                      </p>
                    )}
                    {event.notes && (
                      <p className="text-xs italic text-muted-foreground mt-1">
                        "{event.notes}"
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(event.date), 'MMM d, HH:mm')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  {event.documentTitle && (
                    <Badge variant="outline" className="text-xs">
                      {event.documentTitle}
                    </Badge>
                  )}
                  {event.supplier && (
                    <Badge variant="secondary" className="text-xs">
                      {event.supplier}
                    </Badge>
                  )}
                  {event.priority === 'high' && (
                    <Badge variant="destructive" className="text-xs">
                      High Priority
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2 flex-wrap">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Events</option>
                <option value="requested">Requested</option>
                <option value="uploaded">Uploaded</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="downloaded">Downloaded</option>
                <option value="link_created">Link Created</option>
              </select>
              
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Users</option>
                {uniqueUsers.map(([email, name]) => (
                  <option key={email} value={email}>{name}</option>
                ))}
              </select>
              
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="7_days">Last 7 days</option>
                <option value="30_days">Last 30 days</option>
                <option value="90_days">Last 90 days</option>
              </select>
            </div>
          </div>

          {/* Activity Groups */}
          <div className="space-y-6 max-h-96 overflow-y-auto">
            {Object.entries(groupedEvents).map(([groupKey, groupEvents]) => 
              renderEventGroup(groupKey, groupEvents)
            )}
            
            {Object.values(groupedEvents).every(group => group.length === 0) && (
              <div className="text-center py-8">
                <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity found matching your criteria</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity Chain Detail Sheet */}
      <DocumentActivityChain
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        documentRequestId={selectedActivity?.documentRequestId || null}
        documentTitle={selectedActivity?.documentTitle}
        supplierName={selectedActivity?.supplierName}
      />
    </div>
  );
};

export default DocumentActivityDashboard;
