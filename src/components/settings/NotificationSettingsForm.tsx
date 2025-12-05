import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Clock, AlertTriangle, AlertCircle, Loader2, Play } from 'lucide-react';
import { useBuyerNotificationSettings, NotificationSettings } from '@/hooks/useBuyerNotificationSettings';

export const NotificationSettingsForm: React.FC = () => {
  const { settings, loading, saving, saveSettings, triggerManualCheck } = useBuyerNotificationSettings();
  const [localSettings, setLocalSettings] = useState<Partial<NotificationSettings>>({});
  const [runningCheck, setRunningCheck] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof NotificationSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    await saveSettings(localSettings);
  };

  const handleRunCheck = async () => {
    setRunningCheck(true);
    try {
      await triggerManualCheck();
    } finally {
      setRunningCheck(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Document Expiry Notifications
              </CardTitle>
              <CardDescription>
                Automatically notify suppliers when their documents are about to expire
              </CardDescription>
            </div>
            <Switch
              checked={localSettings.enabled ?? true}
              onCheckedChange={(checked) => handleChange('enabled', checked)}
            />
          </div>
        </CardHeader>
      </Card>

      {localSettings.enabled && (
        <>
          {/* Threshold Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Notification Thresholds
              </CardTitle>
              <CardDescription>
                Define when each notification tier is triggered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Expires Soon
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={localSettings.expiring_soon_days ?? 30}
                      onChange={(e) => handleChange('expiring_soon_days', parseInt(e.target.value) || 30)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days before expiry</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Urgent
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={localSettings.urgent_days ?? 14}
                      onChange={(e) => handleChange('urgent_days', parseInt(e.target.value) || 14)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days before expiry</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="7"
                      value={localSettings.overdue_threshold_days ?? 0}
                      onChange={(e) => handleChange('overdue_threshold_days', parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days after expiry</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Maximum notifications per document</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    value={localSettings.max_notifications_per_document ?? 3}
                    onChange={(e) => handleChange('max_notifications_per_document', parseInt(e.target.value) || 3)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">notifications total (across all tiers)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Channel Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Notification Channels
              </CardTitle>
              <CardDescription>
                Choose how suppliers are notified at each urgency level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Expires Soon */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      Expires Soon
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({localSettings.expiring_soon_days ?? 30} days before)
                    </span>
                  </div>
                  <div className="flex gap-6 pl-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="expires-soon-inapp"
                        checked={localSettings.expires_soon_in_app ?? true}
                        onCheckedChange={(checked) => handleChange('expires_soon_in_app', checked)}
                      />
                      <Label htmlFor="expires-soon-inapp" className="flex items-center gap-1">
                        <Bell className="h-4 w-4" /> In-App
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="expires-soon-email"
                        checked={localSettings.expires_soon_email ?? false}
                        onCheckedChange={(checked) => handleChange('expires_soon_email', checked)}
                      />
                      <Label htmlFor="expires-soon-email" className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> Email
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Urgent */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Urgent
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      ({localSettings.urgent_days ?? 14} days before)
                    </span>
                  </div>
                  <div className="flex gap-6 pl-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="urgent-inapp"
                        checked={localSettings.urgent_in_app ?? true}
                        onCheckedChange={(checked) => handleChange('urgent_in_app', checked)}
                      />
                      <Label htmlFor="urgent-inapp" className="flex items-center gap-1">
                        <Bell className="h-4 w-4" /> In-App
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="urgent-email"
                        checked={localSettings.urgent_email ?? true}
                        onCheckedChange={(checked) => handleChange('urgent_email', checked)}
                      />
                      <Label htmlFor="urgent-email" className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> Email
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Overdue */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Overdue
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      (after expiry date)
                    </span>
                  </div>
                  <div className="flex gap-6 pl-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="overdue-inapp"
                        checked={localSettings.overdue_in_app ?? true}
                        onCheckedChange={(checked) => handleChange('overdue_in_app', checked)}
                      />
                      <Label htmlFor="overdue-inapp" className="flex items-center gap-1">
                        <Bell className="h-4 w-4" /> In-App
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="overdue-email"
                        checked={localSettings.overdue_email ?? true}
                        onCheckedChange={(checked) => handleChange('overdue_email', checked)}
                      />
                      <Label htmlFor="overdue-email" className="flex items-center gap-1">
                        <Mail className="h-4 w-4" /> Email
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual Check */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Manual Check</CardTitle>
              <CardDescription>
                Run an immediate check for expiring documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleRunCheck}
                disabled={runningCheck}
              >
                {runningCheck ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Expiry Check Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
};