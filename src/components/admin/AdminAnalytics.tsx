import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  MessageSquare, 
  FileText, 
  Download,
  Calendar,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminAnalytics = () => {
  const [timeRange, setTimeRange] = useState('30');
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [activityData, setActivityData] = useState([]);
  const [roleDistribution, setRoleDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch user registration trends
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('created_at, roles')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (profilesError) throw profilesError;

      // Process user growth data
      const growthMap = new Map();
      const now = new Date();
      
      // Initialize with zeros for each day
      for (let i = parseInt(timeRange) - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        growthMap.set(dateStr, { date: dateStr, users: 0, buyers: 0, suppliers: 0 });
      }

      // Count registrations by date
      profiles?.forEach(profile => {
        const dateStr = profile.created_at.split('T')[0];
        if (growthMap.has(dateStr)) {
          const entry = growthMap.get(dateStr);
          entry.users += 1;
          if (profile.roles.includes('buyer')) entry.buyers += 1;
          if (profile.roles.includes('supplier')) entry.suppliers += 1;
        }
      });

      const growthData = Array.from(growthMap.values()).map(entry => ({
        ...entry,
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

      setUserGrowthData(growthData);

      // Fetch activity data (chat sessions, document uploads)
      const { data: chatSessions, error: chatError } = await supabase
        .from('chat_sessions')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      const { data: docUploads, error: docError } = await supabase
        .from('document_uploads')
        .select('created_at')
        .gte('created_at', startDate.toISOString());

      if (chatError) throw chatError;
      if (docError) throw docError;

      // Process activity data
      const activityMap = new Map();
      
      // Initialize with zeros
      for (let i = parseInt(timeRange) - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        activityMap.set(dateStr, { date: dateStr, chats: 0, documents: 0 });
      }

      // Count activities by date
      chatSessions?.forEach(session => {
        const dateStr = session.created_at.split('T')[0];
        if (activityMap.has(dateStr)) {
          activityMap.get(dateStr).chats += 1;
        }
      });

      docUploads?.forEach(upload => {
        const dateStr = upload.created_at.split('T')[0];
        if (activityMap.has(dateStr)) {
          activityMap.get(dateStr).documents += 1;
        }
      });

      const activityChartData = Array.from(activityMap.values()).map(entry => ({
        ...entry,
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));

      setActivityData(activityChartData);

      // Calculate role distribution
      const roleCount = { admin: 0, buyer: 0, supplier: 0, other: 0 };
      
      profiles?.forEach(profile => {
        if (profile.roles.includes('admin')) roleCount.admin += 1;
        else if (profile.roles.includes('buyer')) roleCount.buyer += 1;
        else if (profile.roles.includes('supplier')) roleCount.supplier += 1;
        else roleCount.other += 1;
      });

      const roleData = [
        { name: 'Buyers', value: roleCount.buyer, color: COLORS[0] },
        { name: 'Suppliers', value: roleCount.supplier, color: COLORS[1] },
        { name: 'Admins', value: roleCount.admin, color: COLORS[2] },
        { name: 'Others', value: roleCount.other, color: COLORS[3] }
      ].filter(item => item.value > 0);

      setRoleDistribution(roleData);

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const exportData = () => {
    toast({
      title: "Export Started",
      description: "Analytics data export will be available soon."
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={exportData} variant="outline" className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Data
        </Button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Role Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Daily Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="chats" fill="#3b82f6" name="Chat Sessions" />
                <Bar dataKey="documents" fill="#10b981" name="Document Uploads" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {activityData.reduce((sum, day) => sum + day.chats, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Chat Sessions</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <FileText className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {activityData.reduce((sum, day) => sum + day.documents, 0)}
              </p>
              <p className="text-sm text-gray-600">Documents Uploaded</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-gray-900">
                {userGrowthData.reduce((sum, day) => sum + day.users, 0)}
              </p>
              <p className="text-sm text-gray-600">New Registrations</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;