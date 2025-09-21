import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { 
  Settings, 
  Database, 
  Shield, 
  Bell, 
  Globe, 
  Server, 
  Key, 
  AlertTriangle,
  Save,
  RefreshCw
} from 'lucide-react';

export const SuperAdminSystemSettings = () => {
  const [settings, setSettings] = useState({
    // System Configuration
    maintenanceMode: false,
    maxFileSize: '50',
    sessionTimeout: '24',
    apiRateLimit: '1000',
    
    // Security Settings
    enforceSSL: true,
    requireMFA: false,
    passwordExpiry: '90',
    maxLoginAttempts: '5',
    
    // Notification Settings
    emailNotifications: true,
    systemAlerts: true,
    backupNotifications: true,
    
    // Feature Flags
    chatFeature: true,
    documentOCR: true,
    aiInsights: false,
    
    // System Announcements
    announcement: '',
    announcementType: 'info' as 'info' | 'warning' | 'error',
    showAnnouncement: false
  });

  const [systemInfo] = useState({
    version: '2.1.0',
    uptime: '15 days, 3 hours',
    lastBackup: '2 hours ago',
    dbSize: '2.4 GB',
    storageUsed: '15.6 GB / 100 GB',
    activeConnections: 342
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    // In a real implementation, this would save to the database
    toast({
      title: "Settings Saved",
      description: "System settings have been updated successfully.",
    });
  };

  const handleSystemAction = (action: string) => {
    // In a real implementation, these would trigger actual system actions
    const actions = {
      'clear-cache': 'System cache cleared successfully',
      'restart-services': 'Services restarted successfully',
      'run-backup': 'Backup initiated successfully',
      'test-notifications': 'Test notification sent'
    };

    toast({
      title: "System Action",
      description: actions[action as keyof typeof actions] || 'Action completed',
    });
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Status
          </CardTitle>
          <CardDescription>
            Current system information and health status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Version</p>
              <p className="text-lg">{systemInfo.version}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Uptime</p>
              <p className="text-lg text-green-600">{systemInfo.uptime}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Last Backup</p>
              <p className="text-lg">{systemInfo.lastBackup}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Database Size</p>
              <p className="text-lg">{systemInfo.dbSize}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Storage Used</p>
              <p className="text-lg">{systemInfo.storageUsed}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Active Connections</p>
              <p className="text-lg">{systemInfo.activeConnections}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              System Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Prevent user access during updates
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
              <Input
                id="maxFileSize"
                value={settings.maxFileSize}
                onChange={(e) => handleSettingChange('maxFileSize', e.target.value)}
                type="number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout">Session Timeout (hours)</Label>
              <Input
                id="sessionTimeout"
                value={settings.sessionTimeout}
                onChange={(e) => handleSettingChange('sessionTimeout', e.target.value)}
                type="number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiRateLimit">API Rate Limit (requests/hour)</Label>
              <Input
                id="apiRateLimit"
                value={settings.apiRateLimit}
                onChange={(e) => handleSettingChange('apiRateLimit', e.target.value)}
                type="number"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enforce SSL</Label>
                <p className="text-sm text-muted-foreground">
                  Redirect all HTTP to HTTPS
                </p>
              </div>
              <Switch
                checked={settings.enforceSSL}
                onCheckedChange={(checked) => handleSettingChange('enforceSSL', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require MFA</Label>
                <p className="text-sm text-muted-foreground">
                  Force multi-factor authentication
                </p>
              </div>
              <Switch
                checked={settings.requireMFA}
                onCheckedChange={(checked) => handleSettingChange('requireMFA', checked)}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
              <Input
                id="passwordExpiry"
                value={settings.passwordExpiry}
                onChange={(e) => handleSettingChange('passwordExpiry', e.target.value)}
                type="number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
              <Input
                id="maxLoginAttempts"
                value={settings.maxLoginAttempts}
                onChange={(e) => handleSettingChange('maxLoginAttempts', e.target.value)}
                type="number"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Enable or disable platform features globally
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Chat Feature</Label>
                <p className="text-sm text-muted-foreground">AI-powered chat</p>
              </div>
              <Switch
                checked={settings.chatFeature}
                onCheckedChange={(checked) => handleSettingChange('chatFeature', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>Document OCR</Label>
                <p className="text-sm text-muted-foreground">Text extraction</p>
              </div>
              <Switch
                checked={settings.documentOCR}
                onCheckedChange={(checked) => handleSettingChange('documentOCR', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label>AI Insights</Label>
                <p className="text-sm text-muted-foreground">Analytics insights</p>
              </div>
              <Switch
                checked={settings.aiInsights}
                onCheckedChange={(checked) => handleSettingChange('aiInsights', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Announcements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            System Announcements
          </CardTitle>
          <CardDescription>
            Create platform-wide notifications for users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Show Announcement</Label>
            <Switch
              checked={settings.showAnnouncement}
              onCheckedChange={(checked) => handleSettingChange('showAnnouncement', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcementType">Announcement Type</Label>
            <Select 
              value={settings.announcementType} 
              onValueChange={(value) => handleSettingChange('announcementType', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="announcement">Announcement Text</Label>
            <Textarea
              id="announcement"
              value={settings.announcement}
              onChange={(e) => handleSettingChange('announcement', e.target.value)}
              placeholder="Enter your announcement message..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5" />
            System Actions
          </CardTitle>
          <CardDescription>
            Perform administrative system operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              onClick={() => handleSystemAction('clear-cache')}
              className="h-auto flex flex-col items-center p-4"
            >
              <RefreshCw className="w-6 h-6 mb-2" />
              <span>Clear Cache</span>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleSystemAction('restart-services')}
              className="h-auto flex flex-col items-center p-4"
            >
              <Server className="w-6 h-6 mb-2" />
              <span>Restart Services</span>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleSystemAction('run-backup')}
              className="h-auto flex flex-col items-center p-4"
            >
              <Database className="w-6 h-6 mb-2" />
              <span>Run Backup</span>
            </Button>

            <Button 
              variant="outline" 
              onClick={() => handleSystemAction('test-notifications')}
              className="h-auto flex flex-col items-center p-4"
            >
              <Bell className="w-6 h-6 mb-2" />
              <span>Test Notifications</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Settings */}
      <div className="flex justify-end">
        <Button onClick={handleSaveSettings} size="lg">
          <Save className="w-4 h-4 mr-2" />
          Save All Settings
        </Button>
      </div>
    </div>
  );
};