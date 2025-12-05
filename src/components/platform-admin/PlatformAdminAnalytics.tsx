import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Building2, FileText, MessageSquare } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';

// Neon color palette for cyber theme
const NEON_COLORS = {
  cyan: '#22d3ee',
  purple: '#a855f7',
  green: '#4ade80',
  amber: '#fbbf24',
  pink: '#f472b6',
  blue: '#3b82f6'
};

const cardStyle = {
  backgroundColor: 'hsl(var(--admin-card))',
  borderColor: 'hsl(var(--admin-border))'
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="p-3 rounded-lg border shadow-lg"
        style={{
          backgroundColor: 'hsl(240 3.7% 10%)',
          borderColor: 'hsl(240 3.7% 20%)',
        }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: '#e2e8f0' }}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function PlatformAdminAnalytics() {
  const { stats, users, loading } = usePlatformAdmin();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: NEON_COLORS.cyan }} />
      </div>
    );
  }

  // Prepare data for charts with neon colors
  const userTypeData = [
    { name: 'Buyers', value: users.filter(u => u.user_type === 'buyer').length, color: NEON_COLORS.cyan },
    { name: 'Suppliers', value: users.filter(u => u.user_type === 'supplier').length, color: NEON_COLORS.green },
    { name: 'Admins', value: users.filter(u => u.user_type === 'admin').length, color: NEON_COLORS.purple },
    { name: 'Others', value: users.filter(u => !['buyer', 'supplier', 'admin'].includes(u.user_type)).length, color: NEON_COLORS.amber }
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
        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Platform Growth
            </CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.green}20` }}>
              <TrendingUp className="h-4 w-4" style={{ color: NEON_COLORS.green }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: NEON_COLORS.green }}>
              +{stats?.recent_signups || 0}
            </div>
            <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>New users this week</p>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Active Connections
            </CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.cyan}20` }}>
              <Building2 className="h-4 w-4" style={{ color: NEON_COLORS.cyan }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
              {stats?.active_connections || 0}
            </div>
            <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Buyer-Supplier pairs</p>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Document Volume
            </CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.purple}20` }}>
              <FileText className="h-4 w-4" style={{ color: NEON_COLORS.purple }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
              {stats?.total_documents || 0}
            </div>
            <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Total uploads</p>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Chat Activity
            </CardTitle>
            <div className="p-2 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.amber}20` }}>
              <MessageSquare className="h-4 w-4" style={{ color: NEON_COLORS.amber }} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
              {stats?.total_chat_sessions || 0}
            </div>
            <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>Total sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Type Distribution */}
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>User Type Distribution</CardTitle>
            <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Breakdown of users by primary type
            </CardDescription>
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
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-4 justify-center">
              {userTypeData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                    {item.name}: {item.value}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>Role Distribution</CardTitle>
            <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
              User count by assigned roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="role" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={NEON_COLORS.cyan} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trends */}
      <Card style={cardStyle}>
        <CardHeader>
          <CardTitle style={{ color: 'hsl(var(--admin-text))' }}>Weekly Activity Trends</CardTitle>
          <CardDescription style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Platform activity over the last 4 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="week" tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ color: '#9ca3af' }}
                formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
              />
              <Line 
                type="monotone" 
                dataKey="documents" 
                stroke={NEON_COLORS.cyan} 
                strokeWidth={2} 
                name="Documents"
                dot={{ fill: NEON_COLORS.cyan, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="users" 
                stroke={NEON_COLORS.green} 
                strokeWidth={2} 
                name="New Users"
                dot={{ fill: NEON_COLORS.green, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="connections" 
                stroke={NEON_COLORS.purple} 
                strokeWidth={2} 
                name="Connections"
                dot={{ fill: NEON_COLORS.purple, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: 'hsl(var(--admin-text))' }}>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Database</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="font-medium" style={{ color: NEON_COLORS.green }}>Healthy</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>API</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="font-medium" style={{ color: NEON_COLORS.green }}>Operational</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Storage</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="font-medium" style={{ color: NEON_COLORS.green }}>Available</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: 'hsl(var(--admin-text))' }}>Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Response Time</span>
                <span className="font-medium" style={{ color: NEON_COLORS.cyan }}>145ms</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Uptime</span>
                <span className="font-medium" style={{ color: NEON_COLORS.green }}>99.9%</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Error Rate</span>
                <span className="font-medium" style={{ color: NEON_COLORS.green }}>0.1%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: 'hsl(var(--admin-text))' }}>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>CPU</span>
                <span className="font-medium" style={{ color: NEON_COLORS.cyan }}>45%</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Memory</span>
                <span className="font-medium" style={{ color: NEON_COLORS.amber }}>62%</span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'hsl(var(--admin-text-muted))' }}>Storage</span>
                <span className="font-medium" style={{ color: NEON_COLORS.green }}>38%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
