import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Shield, 
  Bell, 
  Mail, 
  Server, 
  Settings, 
  Download,
  Upload,
  Trash2
} from 'lucide-react';

export function PlatformAdminSystemSettings() {
  return (
    <div className="space-y-6">
      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Settings
          </CardTitle>
          <CardDescription>Configure platform security and access controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">Require 2FA for all platform administrators</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>IP Whitelist</Label>
              <p className="text-sm text-muted-foreground">Restrict admin access to specific IP addresses</p>
            </div>
            <Switch />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Session Timeout</Label>
              <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
            </div>
            <div className="flex items-center gap-2">
              <Input className="w-20" defaultValue="30" />
              <span className="text-sm">minutes</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Management
          </CardTitle>
          <CardDescription>Monitor and maintain database performance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Database Size</Label>
              <div className="text-2xl font-bold">2.4 GB</div>
              <p className="text-sm text-muted-foreground">Current usage</p>
            </div>
            <div className="space-y-2">
              <Label>Active Connections</Label>
              <div className="text-2xl font-bold">47</div>
              <p className="text-sm text-muted-foreground">Real-time connections</p>
            </div>
            <div className="space-y-2">
              <Label>Query Performance</Label>
              <div className="text-2xl font-bold">125ms</div>
              <p className="text-sm text-muted-foreground">Average response time</p>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Backup
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
            <Button variant="outline" size="sm">
              <Database className="h-4 w-4 mr-2" />
              Optimize Tables
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
          </CardTitle>
          <CardDescription>Configure system alerts and notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Alerts</Label>
              <p className="text-sm text-muted-foreground">Critical system events and errors</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Performance Alerts</Label>
              <p className="text-sm text-muted-foreground">Database and API performance warnings</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Security Alerts</Label>
              <p className="text-sm text-muted-foreground">Failed login attempts and security events</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="space-y-2">
            <Label>Alert Recipients</Label>
            <Textarea 
              placeholder="admin@platform.com, security@platform.com" 
              className="min-h-[80px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>Configure SMTP and email templates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>SMTP Server</Label>
              <Input placeholder="smtp.platform.com" />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input placeholder="587" />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input placeholder="noreply@platform.com" />
            </div>
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input placeholder="Platform Notifications" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Authentication</Label>
              <p className="text-sm text-muted-foreground">Enable SMTP authentication</p>
            </div>
            <Switch defaultChecked />
          </div>
          
          <Button variant="outline">Test Email Configuration</Button>
        </CardContent>
      </Card>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Maintenance
          </CardTitle>
          <CardDescription>Platform maintenance and cleanup operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium">Clear Cache</div>
                <p className="text-sm text-muted-foreground">Clear application cache</p>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium">Clean Logs</div>
                <p className="text-sm text-muted-foreground">Remove old system logs</p>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium">Update Statistics</div>
                <p className="text-sm text-muted-foreground">Refresh analytics data</p>
              </div>
            </Button>
            
            <Button variant="outline" className="justify-start h-auto p-4">
              <div className="text-left">
                <div className="font-medium">Health Check</div>
                <p className="text-sm text-muted-foreground">Run system diagnostics</p>
              </div>
            </Button>
          </div>
          
          <Separator />
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <h4 className="font-medium text-destructive mb-2">Danger Zone</h4>
            <p className="text-sm text-muted-foreground mb-4">
              These actions are irreversible and can cause data loss.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Purge Old Data
              </Button>
              <Button variant="destructive" size="sm">
                <Database className="h-4 w-4 mr-2" />
                Reset Statistics
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Platform Information
          </CardTitle>
          <CardDescription>Current platform version and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Version</Label>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">v2.1.0</Badge>
                <Badge variant="outline">Latest</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Badge variant="outline">Production</Badge>
            </div>
            <div className="space-y-2">
              <Label>Last Deploy</Label>
              <p className="text-sm">2024-01-15 14:30 UTC</p>
            </div>
            <div className="space-y-2">
              <Label>Uptime</Label>
              <p className="text-sm">15 days, 8 hours</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}