import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { VALID_INDUSTRIES } from '@/config/industries';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { LogoUploadWidget } from './LogoUploadWidget';
import { DefaultOnboardingSettings } from './DefaultOnboardingSettings';
import { NotificationSettingsForm } from './NotificationSettingsForm';
import { AddressFields, AddressData, emptyAddressData } from '@/components/shared/AddressFields';

interface BuyerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdated?: () => void;
}

export const BuyerSettingsModal: React.FC<BuyerSettingsModalProps> = ({
  open,
  onOpenChange,
  onSettingsUpdated,
}) => {
  const [buyerData, setBuyerData] = useState({
    company_name: '',
    industry: '',
    contact_email: '',
    phone: '',
    company_logo_url: '',
    ...emptyAddressData(),
  });
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      loadBuyerData();
    }
  }, [open, user]);

  const loadBuyerData = async () => {
    if (!user) return;

    try {
      // First, check if user is a team member
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type, role')
        .eq('profile_id', user.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      let buyerId: string;
      let userIsOwner = false;
      
      if (teamMember) {
        // Team member - use company_id from company_users
        buyerId = teamMember.company_id;
        
        // Check if this team member is actually the owner
        const { data: ownerCheck } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', teamMember.company_id)
          .maybeSingle();
        
        userIsOwner = !!ownerCheck;
        const userIsAdmin = teamMember.role === 'company_admin';
        setIsOwner(userIsOwner);
        setIsAdmin(userIsAdmin);
        setCanEdit(userIsOwner || userIsAdmin);
      } else {
        // Company owner - get their buyer profile
        const { data: buyer } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .single();
        
        if (!buyer) throw new Error('No buyer profile found');
        buyerId = buyer.id;
        userIsOwner = true;
        setIsOwner(true);
        setCanEdit(true); // Company owners can always edit
      }

      setCompanyId(buyerId);

      // Now fetch buyer data using the resolved buyer ID
      const { data: buyerData, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();

      if (error) throw error;

      if (buyerData) {
        setBuyerData({
          company_name: buyerData.company_name || '',
          industry: buyerData.industry || '',
          contact_email: buyerData.contact_email || '',
          phone: buyerData.phone || '',
          company_logo_url: buyerData.company_logo_url || '',
          address_line1: buyerData.address_line1 || '',
          address_line2: buyerData.address_line2 || '',
          city: buyerData.city || '',
          state: buyerData.state || '',
          postal_code: buyerData.postal_code || '',
          country: buyerData.country || '',
        });
      }
    } catch (error: any) {
      console.error('Error loading buyer data:', error);
      toast({
        title: "Error",
        description: "Failed to load company information",
        variant: "destructive",
      });
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId || !canEdit) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('buyers')
        .update({
          company_name: buyerData.company_name,
          industry: buyerData.industry,
          contact_email: buyerData.contact_email,
          phone: buyerData.phone,
          company_logo_url: buyerData.company_logo_url,
          address_line1: buyerData.address_line1,
          address_line2: buyerData.address_line2,
          city: buyerData.city,
          state: buyerData.state,
          postal_code: buyerData.postal_code,
          country: buyerData.country,
        })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company settings updated successfully",
      });
      
      // Call the callback to refresh parent component
      onSettingsUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update company settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpdate = async (url: string | null) => {
    if (!canEdit) {
      toast({
        title: "Permission Denied",
        description: "Only company admins can update the logo",
        variant: "destructive",
      });
      return;
    }

    setBuyerData(prev => ({ ...prev, company_logo_url: url || '' }));
    
    // Auto-save logo to database immediately
    if (!user || !companyId) return;
    
    try {
      const { error } = await supabase
        .from('buyers')
        .update({ company_logo_url: url || '' })
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Logo updated and saved successfully",
      });
      
      // Call the callback to refresh parent component
      onSettingsUpdated?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save logo",
        variant: "destructive",
      });
    }
  };

  const handleIndustryChange = (value: string) => {
    setBuyerData(prev => ({ ...prev, industry: value }));
  };

  // Determine default tab and grid columns based on ownership/admin status
  // Owner tabs: Company, Onboarding, Notifications, Account, Password (5 tabs - Logo is now in Company)
  // Admin tabs: Onboarding, Account, Password (3 tabs)
  // Other team members: Account, Password (2 tabs)
  const canAccessOnboarding = isOwner || isAdmin;
  const defaultTab = isOwner ? 'company' : (isAdmin ? 'defaults' : 'account');
  const gridCols = isOwner ? 'grid-cols-5' : (isAdmin ? 'grid-cols-3' : 'grid-cols-2');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className={`grid w-full ${gridCols} flex-shrink-0 sticky top-0 z-10 bg-background`}>
            {isOwner && (
              <>
                <TabsTrigger value="company">Company</TabsTrigger>
                <TabsTrigger value="defaults">Onboarding</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
              </>
            )}
            {/* Show Onboarding tab for admins who aren't owners */}
            {!isOwner && isAdmin && (
              <TabsTrigger value="defaults">Onboarding</TabsTrigger>
            )}
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            {/* Owner-only tabs */}
            {isOwner && (
              <>
                <TabsContent value="company" className="space-y-4 mt-0">
                  <Card>
                    <CardHeader>
                      <CardTitle>Company Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Company Logo Section */}
                      <div className="space-y-2">
                        <Label>Company Logo</Label>
                        <LogoUploadWidget
                          currentLogoUrl={buyerData.company_logo_url}
                          onLogoUpdate={canEdit ? handleLogoUpdate : () => {}}
                          embedded
                        />
                      </div>

                      <div className="border-t pt-6" />

                      <form onSubmit={handleCompanySubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="companyName">Company Name</Label>
                            <Input
                              id="companyName"
                              value={buyerData.company_name}
                              onChange={(e) => setBuyerData(prev => ({ ...prev, company_name: e.target.value }))}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="industry">Industry</Label>
                            <SafeSelect
                              value={buyerData.industry}
                              onValueChange={handleIndustryChange}
                              placeholder="Select an industry"
                            >
                              {VALID_INDUSTRIES.map((industry) => (
                                <SafeSelectItem key={industry} value={industry}>
                                  {industry}
                                </SafeSelectItem>
                              ))}
                            </SafeSelect>
                            {buyerData.industry === 'Auditor' && (
                              <p className="text-xs text-primary bg-primary/5 border border-primary/20 rounded p-2 mt-1">
                                Auditor workspace enabled. Your dashboard will use auditor terminology (Clients, Audit Risk, Engagement, Evidence) and unlock the Audit Findings tab on each client.
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="contactEmail">Contact Email</Label>
                            <Input
                              id="contactEmail"
                              type="email"
                              value={buyerData.contact_email}
                              onChange={(e) => setBuyerData(prev => ({ ...prev, contact_email: e.target.value }))}
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                              id="phone"
                              value={buyerData.phone}
                              onChange={(e) => setBuyerData(prev => ({ ...prev, phone: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-base font-medium">Address</Label>
                          <AddressFields
                            data={{
                              address_line1: buyerData.address_line1,
                              address_line2: buyerData.address_line2,
                              city: buyerData.city,
                              state: buyerData.state,
                              postal_code: buyerData.postal_code,
                              country: buyerData.country,
                            }}
                            onChange={(field, value) => setBuyerData(prev => ({ ...prev, [field]: value }))}
                          />
                        </div>

                        <Button type="submit" disabled={loading} className="w-full">
                          {loading ? "Updating..." : "Update Company Information"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notifications" className="mt-0">
                  <NotificationSettingsForm />
                </TabsContent>
              </>
            )}

            {/* Onboarding tab - accessible by owners AND admins */}
            {canAccessOnboarding && (
              <TabsContent value="defaults" className="mt-0">
                <DefaultOnboardingSettings />
              </TabsContent>
            )}

            <TabsContent value="account" className="mt-0">
              <AccountSettingsForm />
            </TabsContent>

            <TabsContent value="password" className="mt-0">
              <PasswordChangeForm />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
