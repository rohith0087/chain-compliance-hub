import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Activity, 
  RefreshCw, 
  MessageSquare, 
  FileText, 
  UserPlus, 
  LogIn,
  Upload,
  Download,
  Settings,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  activity_details: any;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

const AdminActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchActivities = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      // Fetch activity logs with user information
      const { data: activityData, error: activityError } = await supabase
        .from('user_activity_logs')
        .select(`
          id,
          user_id,
          activity_type,
          activity_details,
          created_at
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (activityError) throw activityError;

      // Get user profiles for the activities
      const userIds = [...new Set(activityData?.map(activity => activity.user_id))];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Merge activity data with user information
      const enrichedActivities = activityData?.map(activity => {
        const userProfile = profiles?.find(profile => profile.id === activity.user_id);
        return {
          ...activity,
          user_email: userProfile?.email,
          user_name: userProfile?.full_name
        };
      }) || [];

      setActivities(enrichedActivities);

    } catch (error) {
      console.error('Error fetching activities:', error);
      toast({
        title: "Error",
        description: "Failed to load activity feed. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    
    // Set up real-time subscription for new activities
    const subscription = supabase
      .channel('activity_logs')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'user_activity_logs' },
        () => {
          fetchActivities(true);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getActivityIcon = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'login':
      case 'sign_in':
        return <LogIn className="w-4 h-4 text-green-600" />;
      case 'signup':
      case 'registration':
        return <UserPlus className="w-4 h-4 text-blue-600" />;
      case 'chat_session':
      case 'message':
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      case 'document_upload':
      case 'file_upload':
        return <Upload className="w-4 h-4 text-orange-600" />;
      case 'document_download':
        return <Download className="w-4 h-4 text-teal-600" />;
      case 'settings_change':
        return <Settings className="w-4 h-4 text-gray-600" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityColor = (activityType: string) => {
    switch (activityType.toLowerCase()) {
      case 'login':
      case 'sign_in':
        return 'bg-green-100 text-green-800';
      case 'signup':
      case 'registration':
        return 'bg-blue-100 text-blue-800';
      case 'chat_session':
      case 'message':
        return 'bg-purple-100 text-purple-800';
      case 'document_upload':
      case 'file_upload':
        return 'bg-orange-100 text-orange-800';
      case 'document_download':
        return 'bg-teal-100 text-teal-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatActivityMessage = (activity: ActivityLog) => {
    const details = activity.activity_details || {};
    const userName = activity.user_name || 'Unknown User';
    
    switch (activity.activity_type.toLowerCase()) {
      case 'login':
      case 'sign_in':
        return `${userName} signed in`;
      case 'signup':
      case 'registration':
        return `${userName} created a new account`;
      case 'chat_session':
        return `${userName} started a chat session`;
      case 'message':
        return `${userName} sent a message`;
      case 'document_upload':
      case 'file_upload':
        return `${userName} uploaded a document${details.filename ? ` (${details.filename})` : ''}`;
      case 'document_download':
        return `${userName} downloaded a document`;
      case 'settings_change':
        return `${userName} updated their settings`;
      case 'error':
        return `Error occurred for ${userName}${details.error ? `: ${details.error}` : ''}`;
      default:
        return `${userName} performed ${activity.activity_type}`;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const activityDate = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return activityDate.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading activity feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          <p className="text-sm text-gray-600">Real-time feed of user activities across the platform</p>
        </div>
        <Button
          onClick={() => fetchActivities(true)}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardContent className="p-0">
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
              <p className="text-gray-500">User activities will appear here when they occur.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {activity.user_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getActivityIcon(activity.activity_type)}
                          <p className="text-sm text-gray-900">
                            {formatActivityMessage(activity)}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant="secondary" 
                            className={getActivityColor(activity.activity_type)}
                          >
                            {activity.activity_type}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatTimeAgo(activity.created_at)}
                          </span>
                        </div>
                      </div>
                      
                      {activity.user_email && (
                        <p className="text-xs text-gray-500 mt-1">
                          {activity.user_email}
                        </p>
                      )}
                      
                      {activity.activity_details && Object.keys(activity.activity_details).length > 0 && (
                        <div className="mt-2 text-xs text-gray-600 bg-gray-100 rounded p-2 font-mono">
                          {JSON.stringify(activity.activity_details, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more button - could be implemented for pagination */}
      {activities.length >= 50 && (
        <div className="text-center">
          <Button variant="outline" onClick={() => {}}>
            Load More Activities
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminActivityFeed;