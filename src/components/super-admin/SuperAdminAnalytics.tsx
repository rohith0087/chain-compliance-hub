import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Building2, FileText, MessageSquare, TrendingUp } from 'lucide-react';

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

export const SuperAdminAnalytics = () => {
  const { stats, users, loading } = useSuperAdmin();

  // Prepare data for charts with neon colors
  const userTypeData = [
    { name: 'Buyers', value: stats?.total_buyers || 0, color: NEON_COLORS.cyan },
    { name: 'Suppliers', value: stats?.total_suppliers || 0, color: NEON_COLORS.green },
    { name: 'Other', value: (stats?.total_users || 0) - (stats?.total_buyers || 0) - (stats?.total_suppliers || 0), color: NEON_COLORS.amber }
  ];

  const roleDistribution = users.reduce((acc, user) => {
    user.roles.forEach(role => {
      acc[role] = (acc[role] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  const roleData = Object.entries(roleDistribution).map(([role, count]) => ({
    name: role.replace('_', ' '),
    value: count
  }));

  // Sample activity data (you'd get this from actual analytics)
  const activityData = [
    { name: 'Mon', documents: 45, users: 12, connections: 8 },
    { name: 'Tue', documents: 52, users: 15, connections: 12 },
    { name: 'Wed', documents: 38, users: 18, connections: 6 },
    { name: 'Thu', documents: 61, users: 22, connections: 15 },
    { name: 'Fri', documents: 55, users: 19, connections: 11 },
    { name: 'Sat', documents: 25, users: 8, connections: 4 },
    { name: 'Sun', documents: 32, users: 10, connections: 7 }
  ];

  if (loading) {
    return (
      <Card style={cardStyle}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64">
            <div 
              className="animate-spin rounded-full h-8 w-8 border-b-2"
              style={{ borderColor: NEON_COLORS.cyan }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card style={cardStyle}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Platform Growth
                </p>
                <p className="text-2xl font-bold" style={{ color: NEON_COLORS.green }}>
                  +{stats?.recent_signups || 0}
                </p>
                <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  New users (7 days)
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.green}20` }}>
                <TrendingUp className="w-6 h-6" style={{ color: NEON_COLORS.green }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Active Connections
                </p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
                  {stats?.active_connections || 0}
                </p>
                <p className="text-xs" style={{ color: NEON_COLORS.green }}>
                  ✓ Healthy network
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.cyan}20` }}>
                <Building2 className="w-6 h-6" style={{ color: NEON_COLORS.cyan }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Document Volume
                </p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
                  {stats?.total_documents || 0}
                </p>
                <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Total uploaded
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.purple}20` }}>
                <FileText className="w-6 h-6" style={{ color: NEON_COLORS.purple }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Chat Activity
                </p>
                <p className="text-2xl font-bold" style={{ color: 'hsl(var(--admin-text))' }}>
                  {stats?.total_chat_sessions || 0}
                </p>
                <p className="text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  Total sessions
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${NEON_COLORS.amber}20` }}>
                <MessageSquare className="w-6 h-6" style={{ color: NEON_COLORS.amber }} />
              </div>
            </div>
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
              Breakdown of users by type
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
              User roles across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill={NEON_COLORS.cyan} radius={[4, 4, 0, 0]} />
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
            Platform activity over the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
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
                stroke={NEON_COLORS.amber} 
                strokeWidth={2} 
                name="Connections"
                dot={{ fill: NEON_COLORS.amber, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Database</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Storage</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>Healthy</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>API</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NEON_COLORS.green }} />
                  <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>Healthy</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Avg Response Time</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.cyan }}>245ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Uptime</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>99.9%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Error Rate</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>0.02%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={cardStyle}>
          <CardHeader>
            <CardTitle className="text-sm" style={{ color: 'hsl(var(--admin-text))' }}>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>CPU Usage</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.cyan }}>34%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Memory</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.amber }}>67%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Storage</span>
                <span className="text-sm font-medium" style={{ color: NEON_COLORS.green }}>45%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
