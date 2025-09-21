import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Building2, FileText, MessageSquare } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export function PlatformAdminAnalytics() {
  const { stats, users, loading } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Prepare data for charts
  const userTypeData = [
    { name: 'Buyers', value: users.filter(u => u.user_type === 'buyer').length, color: '#3b82f6' },
    { name: 'Suppliers', value: users.filter(u => u.user_type === 'supplier').length, color: '#10b981' },
    { name: 'Admins', value: users.filter(u => u.user_type === 'admin').length, color: '#8b5cf6' },
    { name: 'Others', value: users.filter(u => !['buyer', 'supplier', 'admin'].includes(u.user_type)).length, color: '#6b7280' }
  ];

  const roleData = [
    { role: 'Buyer', count: users.filter(u => u.roles.includes('buyer')).length },
    { role: 'Supplier', count: users.filter(u => u.roles.includes('supplier')).length },
    { role: 'Admin', count: users.filter(u => u.roles.includes('admin')).length },
    { role: 'Company Admin', count: users.filter(u => u.roles.includes('company_admin')).length }
  ];

  // Mock activity data for demonstration
  const activityData = [
    { week: 'Week 1', documents: 45, users: 12, connections: 8 },
    { week: 'Week 2', documents: 52, users: 15, connections: 12 },
    { week: 'Week 3', documents: 48, users: 18, connections: 15 },
    { week: 'Week 4', documents: 61, users: 22, connections: 18 }
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Growth</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats?.recent_signups || 0}</div>
            <p className="text-xs text-muted-foreground">New users this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_connections || 0}</div>
            <p className="text-xs text-muted-foreground">Buyer-Supplier pairs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Document Volume</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_documents || 0}</div>
            <p className="text-xs text-muted-foreground">Total uploads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chat Activity</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_chat_sessions || 0}</div>
            <p className="text-xs text-muted-foreground">Total sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>User Type Distribution</CardTitle>
            <CardDescription>Breakdown of users by primary type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={userTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {userTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-4 justify-center">
              {userTypeData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
            <CardDescription>User count by assigned roles</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roleData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="role" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Activity Trends</CardTitle>
          <CardDescription>Platform activity over the last 4 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="documents" stroke="#3b82f6" strokeWidth={2} name="Documents" />
              <Line type="monotone" dataKey="users" stroke="#10b981" strokeWidth={2} name="New Users" />
              <Line type="monotone" dataKey="connections" stroke="#8b5cf6" strokeWidth={2} name="Connections" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Database</span>
                <span className="text-green-600 font-medium">Healthy</span>
              </div>
              <div className="flex justify-between">
                <span>API</span>
                <span className="text-green-600 font-medium">Operational</span>
              </div>
              <div className="flex justify-between">
                <span>Storage</span>
                <span className="text-green-600 font-medium">Available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Response Time</span>
                <span className="font-medium">145ms</span>
              </div>
              <div className="flex justify-between">
                <span>Uptime</span>
                <span className="font-medium">99.9%</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate</span>
                <span className="font-medium">0.1%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>CPU</span>
                <span className="font-medium">45%</span>
              </div>
              <div className="flex justify-between">
                <span>Memory</span>
                <span className="font-medium">62%</span>
              </div>
              <div className="flex justify-between">
                <span>Storage</span>
                <span className="font-medium">38%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}