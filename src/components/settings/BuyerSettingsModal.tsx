import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { VALID_INDUSTRIES } from '@/config/industries';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { LogoUploadWidget } from './LogoUploadWidget';

interface BuyerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyerSettingsModal: React.FC<BuyerSettingsModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [buyerData, setBuyerData] = useState({
    company_name: '',
    industry: '',
    contact_email: '',
    phone: '',
    address: '',
    company_logo_url: '',
  });
  const [loading, setLoading] = useState(false);
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
      const { data: buyer, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error) throw error;

      if (buyer) {
        setBuyerData({
          company_name: buyer.company_name || '',
          industry: buyer.industry || '',
          contact_email: buyer.contact_email || '',
          phone: buyer.phone || '',
          address: buyer.address || '',
          company_logo_url: buyer.company_logo_url || '',
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load company information",
        variant: "destructive",
      });
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('buyers')
        .update({
          company_name: buyerData.company_name,
          industry: buyerData.industry,
          contact_email: buyerData.contact_email,
          phone: buyerData.phone,
          address: buyerData.address,
          company_logo_url: buyerData.company_logo_url,
        })
        .eq('profile_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Company settings updated successfully",
      });
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

  const handleLogoUpdate = (url: string | null) => {
    setBuyerData(prev => ({ ...prev, company_logo_url: url || '' }));
  };

  const handleIndustryChange = (value: string) => {
    setBuyerData(prev => ({ ...prev, industry: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="logo">Logo</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent>
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
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={buyerData.address}
                      onChange={(e) => setBuyerData(prev => ({ ...prev, address: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Updating..." : "Update Company Information"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <AccountSettingsForm />
          </TabsContent>

          <TabsContent value="password">
            <PasswordChangeForm />
          </TabsContent>

          <TabsContent value="logo">
            <LogoUploadWidget
              currentLogoUrl={buyerData.company_logo_url}
              onLogoUpdate={handleLogoUpdate}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};