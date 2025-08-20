import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Database, 
  Mail, 
  Shield, 
  Bell,
  Save,
  Download,
  Upload,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const AdminSystemSettings = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    // Security Settings
    requireEmailVerification: true,
    enableTwoFactor: false,
    sessionTimeout: '24',
    maxLoginAttempts: '5',
    
    // Notification Settings
    emailNotifications: true,
    systemAlerts: true,
    activityDigest: 'daily',
    
    // System Settings
    maintenanceMode: false,
    debugMode: false,
    logLevel: 'info',
    backupFrequency: 'daily',
    
    // Email Settings
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    fromEmail: 'noreply@complianceflow.com',
    
    // System Messages
    maintenanceMessage: 'System is currently under maintenance. Please check back later.',
    welcomeMessage: 'Welcome to ComplianceFlow! Get started by setting up your profile.',
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    // Here you would typically save to your backend/database
    toast({
      title: "Settings Saved",
      description: "System settings have been updated successfully."
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'system-settings.json';
    link.click();
    
    toast({
      title: "Settings Exported",
      description: "System settings have been exported to a JSON file."
    });
  };

  const clearCache = () => {
    // Simulate cache clearing
    toast({
      title: "Cache Cleared",
      description: "System cache has been cleared successfully."
    });
  };

  const runSystemDiagnostics = () => {
    // Simulate system diagnostics
    toast({
      title: "Diagnostics Running",
      description: "System diagnostics will complete in a few moments."
    });
  };

  return (
    <div className="space-y-6">
      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-verification">Require Email Verification</Label>
                <Switch
                  id="email-verification"
                  checked={settings.requireEmailVerification}
                  onCheckedChange={(checked) => handleSettingChange('requireEmailVerification', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="two-factor">Enable Two-Factor Authentication</Label>
                <Switch
                  id="two-factor"
                  checked={settings.enableTwoFactor}
                  onCheckedChange={(checked) => handleSettingChange('enableTwoFactor', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                <Select 
                  value={settings.sessionTimeout} 
                  onValueChange={(value) => handleSettingChange('sessionTimeout', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hour</SelectItem>
                    <SelectItem value="8">8 hours</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
                <Input
                  id="max-login-attempts"
                  type="number"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => handleSettingChange('maxLoginAttempts', e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <Switch
                  id="email-notifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="system-alerts">System Alerts</Label>
                <Switch
                  id="system-alerts"
                  checked={settings.systemAlerts}
                  onCheckedChange={(checked) => handleSettingChange('systemAlerts', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="activity-digest">Activity Digest Frequency</Label>
                <Select 
                  value={settings.activityDigest} 
                  onValueChange={(value) => handleSettingChange('activityDigest', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Disabled</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="smtp-host">SMTP Host</Label>
                <Input
                  id="smtp-host"
                  value={settings.smtpHost}
                  onChange={(e) => handleSettingChange('smtpHost', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="smtp-port">SMTP Port</Label>
                <Input
                  id="smtp-port"
                  value={settings.smtpPort}
                  onChange={(e) => handleSettingChange('smtpPort', e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="smtp-user">SMTP Username</Label>
                <Input
                  id="smtp-user"
                  value={settings.smtpUser}
                  onChange={(e) => handleSettingChange('smtpUser', e.target.value)}
                />
              </div>
              
              <div>
                <Label htmlFor="from-email">From Email Address</Label>
                <Input
                  id="from-email"
                  type="email"
                  value={settings.fromEmail}
                  onChange={(e) => handleSettingChange('fromEmail', e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            System Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                <Switch
                  id="maintenance-mode"
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => handleSettingChange('maintenanceMode', checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="debug-mode">Debug Mode</Label>
                <Switch
                  id="debug-mode"
                  checked={settings.debugMode}
                  onCheckedChange={(checked) => handleSettingChange('debugMode', checked)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="log-level">Log Level</Label>
                <Select 
                  value={settings.logLevel} 
                  onValueChange={(value) => handleSettingChange('logLevel', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="backup-frequency">Backup Frequency</Label>
                <Select 
                  value={settings.backupFrequency} 
                  onValueChange={(value) => handleSettingChange('backupFrequency', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Messages */}
      <Card>
        <CardHeader>
          <CardTitle>System Messages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Textarea
              id="maintenance-message"
              value={settings.maintenanceMessage}
              onChange={(e) => handleSettingChange('maintenanceMessage', e.target.value)}
              rows={3}
            />
          </div>
          
          <div>
            <Label htmlFor="welcome-message">Welcome Message</Label>
            <Textarea
              id="welcome-message"
              value={settings.welcomeMessage}
              onChange={(e) => handleSettingChange('welcomeMessage', e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* System Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            System Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button onClick={saveSettings} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
            
            <Button onClick={exportSettings} variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export Settings
            </Button>
            
            <Button onClick={clearCache} variant="outline" className="flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Clear Cache
            </Button>
            
            <Button onClick={runSystemDiagnostics} variant="outline" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Run Diagnostics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemSettings;