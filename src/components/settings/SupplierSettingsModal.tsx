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
  const [activeTab, setActiveTab] = useState('company');

  useEffect(() => {
    if (isOpen && user) {
      loadSupplierData();
    }
  }, [isOpen, user]);

  const loadSupplierData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

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
    if (!user) return;

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
        .eq('profile_id', user.id);

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
    setSupplierData(prev => ({ ...prev, company_logo_url: url || '' }));
    
    // Auto-save logo to database immediately
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ company_logo_url: url || '' })
        .eq('profile_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logo updated and saved successfully",
      });
      
      onProfileUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save logo",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof SupplierData, value: string | boolean) => {
    setSupplierData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="logo">Logo</TabsTrigger>
          </TabsList>
          
          <TabsContent value="company" className="space-y-4 mt-6">
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
          
          <TabsContent value="account" className="space-y-4 mt-6">
            <AccountSettingsForm />
            <PasswordChangeForm />
          </TabsContent>
          
          <TabsContent value="logo" className="space-y-4 mt-6">
            <LogoUploadWidget
              currentLogoUrl={supplierData.company_logo_url}
              onLogoUpdate={handleLogoUpdate}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};