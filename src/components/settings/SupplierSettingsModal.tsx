import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LogoUploadWidget } from './LogoUploadWidget';
import { PasswordChangeForm } from './PasswordChangeForm';
import { AccountSettingsForm } from './AccountSettingsForm';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { VALID_INDUSTRIES } from '@/config/industries';
import { useSupplierNotificationSettings } from '@/hooks/useSupplierNotificationSettings';
import { Bell, Mail, MessageSquare } from 'lucide-react';

interface SupplierSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: () => void;
}

interface SupplierData {
  id?: string;
  company_name: string;
  contact_email: string;
  industry?: string;
  phone?: string;
  address?: string;
  description?: string;
  auto_approve_connections: boolean;
  company_logo_url?: string;
}

export const SupplierSettingsModal: React.FC<SupplierSettingsModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { settings: notificationSettings, loading: notificationsLoading, saving: notificationsSaving, updateSettings: updateNotificationSettings } = useSupplierNotificationSettings();
  const [supplierData, setSupplierData] = useState<SupplierData>({
    company_name: '',
    contact_email: '',
    industry: '',
    phone: '',
    address: '',
    description: '',
    auto_approve_connections: false,
    company_logo_url: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('account'); // Default to account for non-owners

  useEffect(() => {
    if (isOpen && user) {
      loadSupplierData();
    }
  }, [isOpen, user]);

  // Set default tab based on owner status after data loads
  useEffect(() => {
    if (isOwner) {
      setActiveTab('company');
    } else {
      setActiveTab('account');
    }
  }, [isOwner]);

  const loadSupplierData = async () => {
    if (!user) return;

    try {
      // First check if user is a team member via company_users table
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type, role')
        .eq('profile_id', user.id)
        .eq('company_type', 'supplier')
        .eq('status', 'active')
        .maybeSingle();

      if (teamMember) {
        // Team member - check if they're also the owner
        const { data: ownerCheck } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', teamMember.company_id)
          .maybeSingle();

        setIsOwner(!!ownerCheck);
        setSupplierId(teamMember.company_id);

        // Fetch supplier data using company_id
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', teamMember.company_id)
          .single();

        if (error) throw error;

        if (data) {
          setSupplierData({
            id: data.id,
            company_name: data.company_name || '',
            contact_email: data.contact_email || '',
            industry: data.industry || '',
            phone: data.phone || '',
            address: data.address || '',
            description: data.description || '',
            auto_approve_connections: data.auto_approve_connections || false,
            company_logo_url: data.company_logo_url || ''
          });
        }
      } else {
        // Company owner - direct lookup
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setIsOwner(true);
          setSupplierId(data.id);
          setSupplierData({
            id: data.id,
            company_name: data.company_name || '',
            contact_email: data.contact_email || '',
            industry: data.industry || '',
            phone: data.phone || '',
            address: data.address || '',
            description: data.description || '',
            auto_approve_connections: data.auto_approve_connections || false,
            company_logo_url: data.company_logo_url || ''
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load supplier data",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !supplierId) return;

    setLoading(true);
    try {
      const updateData = {
        company_name: supplierData.company_name,
        contact_email: supplierData.contact_email,
        industry: supplierData.industry,
        phone: supplierData.phone,
        address: supplierData.address,
        description: supplierData.description,
        auto_approve_connections: supplierData.auto_approve_connections,
        company_logo_url: supplierData.company_logo_url,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('suppliers')
        .update(updateData)
        .eq('id', supplierId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company information updated successfully",
      });

      onProfileUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update company information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpdate = async (url: string | null) => {
    try {
      // Update local state immediately
      setSupplierData(prev => ({ ...prev, company_logo_url: url || '' }));
      
      if (!user || !supplierId) return;
      
      const { error } = await supabase
        .from('suppliers')
        .update({ 
          company_logo_url: url || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', supplierId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logo updated successfully",
      });
      
      // Trigger parent refresh
      onProfileUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save logo",
        variant: "destructive",
      });
      // Revert local state on error
      setSupplierData(prev => ({ ...prev, company_logo_url: supplierData.company_logo_url }));
    }
  };

  const handleInputChange = (field: keyof SupplierData, value: string | boolean) => {
    setSupplierData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={`grid w-full ${isOwner ? 'grid-cols-5' : 'grid-cols-3'} flex-shrink-0 sticky top-0 z-10 bg-background`}>
            {isOwner && <TabsTrigger value="company">Company</TabsTrigger>}
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            {isOwner && <TabsTrigger value="logo">Logo</TabsTrigger>}
          </TabsList>
          
          <div className="flex-1 overflow-y-auto mt-4">
          {isOwner && (
            <TabsContent value="company" className="space-y-4 mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    Manage your company details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input
                          id="company_name"
                          value={supplierData.company_name}
                          onChange={(e) => handleInputChange('company_name', e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="contact_email">Contact Email</Label>
                        <Input
                          id="contact_email"
                          type="email"
                          value={supplierData.contact_email}
                          onChange={(e) => handleInputChange('contact_email', e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="industry">Industry</Label>
                        <SafeSelect
                          value={supplierData.industry}
                          onValueChange={(value) => handleInputChange('industry', value)}
                          placeholder="Select your industry"
                        >
                          {VALID_INDUSTRIES.map(industry => (
                            <SafeSelectItem key={industry} value={industry}>
                              {industry}
                            </SafeSelectItem>
                          ))}
                        </SafeSelect>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={supplierData.phone || ''}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={supplierData.address || ''}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Company Description</Label>
                      <Textarea
                        id="description"
                        value={supplierData.description || ''}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        placeholder="Brief description of your company and services"
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto_approve"
                        checked={supplierData.auto_approve_connections}
                        onCheckedChange={(checked) => handleInputChange('auto_approve_connections', checked)}
                      />
                      <Label htmlFor="auto_approve" className="text-sm">
                        Auto-approve connection requests
                      </Label>
                    </div>
                    
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          )}
          
          <TabsContent value="account" className="space-y-4 mt-0">
            <AccountSettingsForm />
          </TabsContent>

          <TabsContent value="password" className="space-y-4 mt-0">
            <PasswordChangeForm />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  New Request Notifications
                </CardTitle>
                <CardDescription>
                  Configure how you receive notifications when buyers send you document requests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {notificationsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading settings...</div>
                ) : (
                  <>
                    {/* In-App Notifications (always on) */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label className="text-base font-medium">In-App Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive notifications in the app when new requests arrive
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={true}
                        disabled={true}
                        className="opacity-50"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground -mt-2 ml-11">
                      In-app notifications are always enabled for new requests
                    </p>

                    {/* Email Notifications (configurable) */}
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label className="text-base font-medium">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive email notifications when buyers send new document requests
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationSettings?.new_request_email_enabled || false}
                        onCheckedChange={(checked) => updateNotificationSettings({ new_request_email_enabled: checked })}
                        disabled={notificationsSaving}
                      />
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>When enabled</strong>, email notifications for new requests will be sent to:
                      </p>
                      <ul className="mt-2 text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
                        <li>Company owner</li>
                        <li>Company administrators</li>
                        <li>Users assigned to the target branch (if applicable)</li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          {isOwner && (
            <TabsContent value="logo" className="space-y-4 mt-0">
              <LogoUploadWidget
                currentLogoUrl={supplierData.company_logo_url}
                onLogoUpdate={handleLogoUpdate}
              />
            </TabsContent>
          )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};