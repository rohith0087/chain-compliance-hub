import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  FileText,
  User,
  Activity,
  ArrowRight
} from 'lucide-react';
import { format, isToday, isYesterday, isThisWeek, subDays } from 'date-fns';

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
  const [selectedActivity, setSelectedActivity] = useState<ActivityEvent | null>(null);

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
    const className = "w-4 h-4";
    switch (type) {
      case 'requested': return <FileText className={`${className} text-[#3B82F6]`} />;
      case 'created': return <FileText className={`${className} text-[#3B82F6]`} />;
      case 'uploaded': return <Upload className={`${className} text-[#8B5CF6]`} />;
      case 'submitted': return <Upload className={`${className} text-[#3B82F6]`} />;
      case 'approved': return <CheckCircle className={`${className} text-[#10B981]`} />;
      case 'rejected': return <XCircle className={`${className} text-[#EF4444]`} />;
      case 'downloaded': return <Download className={`${className} text-[#F59E0B]`} />;
      case 'link_created': return <Link className={`${className} text-[#06B6D4]`} />;
      case 'link_accessed': return <Eye className={`${className} text-[#06B6D4]`} />;
      case 'expired': return <AlertTriangle className={`${className} text-[#EF4444]`} />;
      case 'reminder': return <Calendar className={`${className} text-[#F59E0B]`} />;
      default: return <FileCheck className={`${className} text-muted-foreground`} />;
    }
  };

  const getEventBgColor = (type: string) => {
    switch (type) {
      case 'requested': return 'bg-[#EFF6FF] border border-[#DBEAFE]';
      case 'created': return 'bg-[#EFF6FF] border border-[#DBEAFE]';
      case 'uploaded': return 'bg-[#FAF5FF] border border-[#F3E8FF]';
      case 'submitted': return 'bg-[#EFF6FF] border border-[#DBEAFE]';
      case 'approved': return 'bg-[#F0FDF4] border border-[#DCFCE7]';
      case 'rejected': return 'bg-[#FEF2F2] border border-[#FEE2E2]';
      case 'downloaded': return 'bg-[#FFFBEB] border border-[#FEF3C7]';
      case 'link_created': return 'bg-[#ECFEFF] border border-[#CFFAFE]';
      case 'link_accessed': return 'bg-[#ECFEFF] border border-[#CFFAFE]';
      case 'expired': return 'bg-[#FEF2F2] border border-[#FEE2E2]';
      case 'reminder': return 'bg-[#FFFBEB] border border-[#FEF3C7]';
      default: return 'bg-muted border border-border';
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
    setSelectedActivity(selectedActivity?.id === event.id ? null : event);
  };

  const renderEventGroup = (groupKey: string, groupEvents: ActivityEvent[]) => {
    if (groupEvents.length === 0) return null;

    return (
      <div key={groupKey} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-[18px] font-bold text-foreground">{formatGroupDate(groupKey)}</h3>
          <Badge className="bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#EEF2FF] border-0 text-[12px] px-2 py-0.5 rounded-full font-bold">
            {groupEvents.length}
          </Badge>
        </div>
        
        <div className="space-y-3">
          {groupEvents.map((event) => (
            <div 
              key={event.id} 
              className={`flex items-start gap-4 p-4 rounded-[16px] bg-card border border-border shadow-[0_1px_3px_rgba(15,23,42,0.06)] cursor-pointer transition-all hover:border-border hover:shadow-md ${selectedActivity?.id === event.id ? 'ring-2 ring-[#4F46E5] ring-offset-2' : ''}`}
              onClick={() => handleEventClick(event)}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getEventBgColor(event.type)}`}>
                {getEventIcon(event.type)}
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <h4 className="text-[15px] font-bold text-foreground truncate">{event.title}</h4>
                  <span className="text-[13px] font-medium text-muted-foreground flex-shrink-0">{format(new Date(event.date), 'MMM d, HH:mm')}</span>
                </div>
                
                <div className="text-[14px] text-muted-foreground truncate mb-3">
                  <span className="font-medium text-foreground">{event.description}</span>
                  {event.userName && <span> by <span className="font-medium">{event.userName}</span></span>}
                </div>
                
                <div className="flex items-center gap-2">
                  {event.documentTitle && (
                    <Badge variant="secondary" className="bg-muted text-foreground/80 hover:bg-muted font-medium border-0 truncate max-w-[200px] rounded-md px-2 py-0.5">
                      {event.documentTitle}
                    </Badge>
                  )}
                  {event.supplier && (
                    <Badge variant="secondary" className="bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] font-medium border-0 truncate max-w-[150px] rounded-md px-2 py-0.5">
                      {event.supplier}
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

  // Metrics calculations
  const todayCount = groupedEvents.today.length;
  const pendingDocsCount = documents?.filter(d => d.status === 'submitted' || d.status === 'pending').length || 0;
  const approvedCount = events.filter(e => e.type === 'approved').length;
  const uploadsCount = events.filter(e => e.type === 'uploaded' || e.type === 'submitted').length;

  return (
    <div className="w-full">
      {/* Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[26px] font-bold text-foreground mb-1">Activity Center</h1>
          <p className="text-muted-foreground text-[15px]">Monitor document, supplier, request, and approval activity across your workspace.</p>
        </div>
        <Button variant="outline" className="border-border text-foreground/80 rounded-full font-semibold bg-card shadow-sm h-9 px-5 whitespace-nowrap">
          <Download className="w-4 h-4 mr-2" />
          Export Audit Log
        </Button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/70 h-4 w-4" />
          <Input
            placeholder="Search activities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-card border-border rounded-[14px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-visible:ring-[#4F46E5]"
          />
        </div>
        
        <select
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value)}
          className="h-9 px-3 bg-card border border-border rounded-[14px] text-sm text-foreground/80 font-medium outline-none shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent min-w-[140px]"
        >
          <option value="all">All Events</option>
          <option value="requested">Requested</option>
          <option value="uploaded">Uploaded</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="h-9 px-3 bg-card border border-border rounded-[14px] text-sm text-foreground/80 font-medium outline-none shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent min-w-[140px]"
        >
          <option value="all">All Users</option>
          {uniqueUsers.map(([email, name]) => (
            <option key={email} value={email}>{name}</option>
          ))}
        </select>
        
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="h-9 px-3 bg-card border border-border rounded-[14px] text-sm text-foreground/80 font-medium outline-none shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent min-w-[140px]"
        >
          <option value="7_days">Last 7 days</option>
          <option value="30_days">Last 30 days</option>
          <option value="90_days">Last 90 days</option>
        </select>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-[20px] border border-border p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
            <Calendar className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Today</p>
            <div className="flex items-end gap-1.5">
              <span className="text-[20px] font-bold text-foreground leading-none">{todayCount}</span>
              <span className="text-[12px] text-muted-foreground mb-0.5">events</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-[20px] border border-border p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FFFBEB] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Pending</p>
            <div className="flex items-end gap-1.5">
              <span className="text-[20px] font-bold text-foreground leading-none">{pendingDocsCount}</span>
              <span className="text-[12px] text-muted-foreground mb-0.5">docs</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-[20px] border border-border p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Approved</p>
            <div className="flex items-end gap-1.5">
              <span className="text-[20px] font-bold text-foreground leading-none">{approvedCount}</span>
              <span className="text-[12px] text-muted-foreground mb-0.5">all-time</span>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-[20px] border border-border p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#FAF5FF] flex items-center justify-center flex-shrink-0">
            <Upload className="w-5 h-5 text-[#8B5CF6]" />
          </div>
          <div>
            <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Uploads</p>
            <div className="flex items-end gap-1.5">
              <span className="text-[20px] font-bold text-foreground leading-none">{uploadsCount}</span>
              <span className="text-[12px] text-muted-foreground mb-0.5">all-time</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Timeline (68%) */}
        <div className="w-full lg:w-[68%] h-[calc(100vh-280px)] overflow-y-auto pr-3 pb-8">
          <div className="space-y-10">
            {Object.entries(groupedEvents).map(([groupKey, groupEvents]) => 
              renderEventGroup(groupKey, groupEvents)
            )}
            
            {Object.values(groupedEvents).every(group => group.length === 0) && (
              <div className="text-center py-12 bg-card rounded-[16px] border border-border shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-8 h-8 text-muted-foreground/70" />
                </div>
                <h3 className="text-[18px] font-bold text-foreground mb-2">No activity found</h3>
                <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Insights Panel (32%) */}
        <div className="w-full lg:w-[32%]">
          <div className="sticky top-6 space-y-6">
            
            {/* Conditional Rendering: Event Details OR Global Summary */}
            {selectedActivity ? (
              <div className="bg-card rounded-[16px] border border-border shadow-[0_4px_6px_rgba(15,23,42,0.08)] overflow-hidden">
                <div className="bg-muted border-b border-border p-5 flex items-center justify-between">
                  <h3 className="text-[16px] font-bold text-foreground">Activity Details</h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-muted" onClick={() => setSelectedActivity(null)}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>
                <div className="p-5 space-y-6">
                  <div>
                    <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Event</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getEventBgColor(selectedActivity.type)}`}>
                        {getEventIcon(selectedActivity.type)}
                      </div>
                      <span className="text-[15px] font-medium text-foreground">{selectedActivity.title}</span>
                    </div>
                  </div>
                  
                  {selectedActivity.documentTitle && (
                    <div>
                      <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Document</p>
                      <p className="text-[15px] text-foreground">{selectedActivity.documentTitle}</p>
                    </div>
                  )}

                  {selectedActivity.supplier && (
                    <div>
                      <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Supplier</p>
                      <p className="text-[15px] text-foreground">{selectedActivity.supplier}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Performed By</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-[15px] text-foreground">{selectedActivity.userName || 'System'}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Timestamp</p>
                    <p className="text-[15px] text-foreground">{format(new Date(selectedActivity.date), 'MMMM do, yyyy \u00B7 HH:mm a')}</p>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button className="w-full justify-between bg-card text-foreground/80 border border-border shadow-sm hover:bg-muted h-10 rounded-[10px] mb-2">
                      View Document
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                    </Button>
                    <Button className="w-full justify-between bg-card text-foreground/80 border border-border shadow-sm hover:bg-muted h-10 rounded-[10px]">
                      View Supplier
                      <ArrowRight className="w-4 h-4 text-muted-foreground/70" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Global Insights Panel */}
                <div className="bg-card rounded-[16px] border border-border shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="bg-muted border-b border-border p-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-[15px] font-bold text-foreground">Global Summary</h3>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                        <span className="text-[14px] text-muted-foreground">Total Approvals</span>
                      </div>
                      <span className="font-semibold text-foreground">{approvedCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#8B5CF6]"></div>
                        <span className="text-[14px] text-muted-foreground">Total Uploads</span>
                      </div>
                      <span className="font-semibold text-foreground">{uploadsCount}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                        <span className="text-[14px] text-muted-foreground">Pending Reviews</span>
                      </div>
                      <span className="font-semibold text-foreground">{pendingDocsCount}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-[16px] border border-border shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden">
                  <div className="bg-[#FEF2F2] border-b border-[#FEE2E2] p-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
                    <h3 className="text-[15px] font-bold text-[#991B1B]">Needs Attention</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    {pendingDocsCount > 0 ? (
                      <div className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444] mt-2"></div>
                        <div>
                          <p className="text-[14px] font-medium text-foreground">{pendingDocsCount} documents pending</p>
                          <p className="text-[13px] text-muted-foreground">Review required to unblock compliance.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-4">
                        <p className="text-[14px] text-muted-foreground">All caught up!</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentActivityDashboard;
