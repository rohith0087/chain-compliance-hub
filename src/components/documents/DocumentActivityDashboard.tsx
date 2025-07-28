import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  TrendingUp,
  Filter,
  Download,
  Bell
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, subDays } from 'date-fns';

interface ActivityEvent {
  id: string;
  type: 'created' | 'submitted' | 'approved' | 'rejected' | 'expired' | 'reminder';
  title: string;
  description: string;
  date: string;
  status?: string;
  documentTitle?: string;
  supplier?: string;
  priority?: 'high' | 'medium' | 'low';
  category?: string;
}

interface MetricData {
  label: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  color: string;
}

interface DocumentActivityDashboardProps {
  events: ActivityEvent[];
  documents?: any[];
}

const DocumentActivityDashboard = ({ events, documents = [] }: DocumentActivityDashboardProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('7_days');

  // Group events by time periods
  const groupedEvents = useMemo(() => {
    const filtered = events.filter(event => {
      const matchesSearch = searchTerm === '' || 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = selectedFilter === 'all' || event.type === selectedFilter;
      
      const eventDate = new Date(event.date);
      const cutoffDate = subDays(new Date(), timeRange === '7_days' ? 7 : timeRange === '30_days' ? 30 : 90);
      const matchesTimeRange = eventDate >= cutoffDate;
      
      return matchesSearch && matchesFilter && matchesTimeRange;
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
  }, [events, searchTerm, selectedFilter, timeRange]);

  // Calculate metrics
  const metrics: MetricData[] = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recentEvents = events.filter(e => new Date(e.date) >= sevenDaysAgo);
    
    return [
      {
        label: 'Recent Activity',
        value: recentEvents.length,
        icon: <TrendingUp className="h-4 w-4" />,
        color: 'text-blue-600'
      },
      {
        label: 'Urgent Actions',
        value: events.filter(e => e.type === 'rejected' || e.priority === 'high').length,
        icon: <AlertTriangle className="h-4 w-4" />,
        color: 'text-red-600'
      },
      {
        label: 'Approvals',
        value: events.filter(e => e.type === 'approved').length,
        icon: <CheckCircle className="h-4 w-4" />,
        color: 'text-green-600'
      },
      {
        label: 'Pending Reviews',
        value: events.filter(e => e.type === 'submitted').length,
        icon: <Clock className="h-4 w-4" />,
        color: 'text-yellow-600'
      }
    ];
  }, [events]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'created': return <Clock className="w-4 h-4" />;
      case 'submitted': return <Upload className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'expired': return <AlertTriangle className="w-4 h-4" />;
      case 'reminder': return <Calendar className="w-4 h-4" />;
      default: return <FileCheck className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'created': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'submitted': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
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
          {events.map((event, index) => (
            <div key={event.id} className={`flex items-start gap-3 p-4 rounded-lg border ${getEventColor(event.type)}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-background shadow-sm`}>
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
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
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <div className={metric.color}>{metric.icon}</div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.color}`}>{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Document Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
            
            <div className="flex gap-2">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Events</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="created">Created</option>
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
              
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
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
    </div>
  );
};

export default DocumentActivityDashboard;