import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Building2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { VALID_INDUSTRIES } from '@/config/industries';
import { AddressFields, AddressData, emptyAddressData } from '@/components/shared/AddressFields';

interface SupplierProfileSetupProps {
  onProfileCreated?: () => void;
}

const SupplierProfileSetup = ({ onProfileCreated }: SupplierProfileSetupProps) => {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [autoApproveConnections, setAutoApproveConnections] = useState(false);
  const [addressData, setAddressData] = useState<AddressData>(emptyAddressData());
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Log industries to debug
  console.log('VALID_INDUSTRIES array:', VALID_INDUSTRIES);
  console.log('Current industry value:', industry);

  useEffect(() => {
    if (user) {
      loadExistingProfile();
    }
  }, [user]);

  const getSupplierProfile = async () => {
    if (!user) return null;

    try {
      const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching supplier profile:', error);
        return null;
      }

      return suppliers && suppliers.length > 0 ? suppliers[0] : null;
    } catch (error) {
      console.error('Error in getSupplierProfile:', error);
      return null;
    }
  };

  const loadExistingProfile = async () => {
    try {
      const supplier = await getSupplierProfile();
      if (supplier) {
        setExistingProfile(supplier);
        setCompanyName(supplier.company_name || '');
        setIndustry(supplier.industry || '');
        setPhone(supplier.phone || '');
        setDescription(supplier.description || '');
        setAutoApproveConnections(supplier.auto_approve_connections || false);
        setAddressData({
          address_line1: supplier.address_line1 || '',
          address_line2: supplier.address_line2 || '',
          city: supplier.city || '',
          state: supplier.state || '',
          postal_code: supplier.postal_code || '',
          country: supplier.country || '',
        });
      } else {
        // Pre-fill with profile data if available
        setCompanyName(profile?.company_name || '');
      }
    } catch (error) {
      console.error('Error loading supplier profile:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (existingProfile) {
        // Update existing profile
        const { error } = await supabase
          .from('suppliers')
          .update({
            company_name: companyName,
            industry,
            phone,
            description,
            auto_approve_connections: autoApproveConnections,
            address_line1: addressData.address_line1,
            address_line2: addressData.address_line2,
            city: addressData.city,
            state: addressData.state,
            postal_code: addressData.postal_code,
            country: addressData.country,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id);

        if (error) throw error;

        toast({
          title: "Profile Updated",
          description: "Your supplier profile has been updated successfully.",
        });
      } else {
        // Create new profile
        const { error } = await supabase
          .from('suppliers')
          .insert({
            profile_id: user?.id,
            company_name: companyName,
            contact_email: profile?.email || user?.email,
            industry,
            phone,
            description,
            auto_approve_connections: autoApproveConnections,
            address_line1: addressData.address_line1,
            address_line2: addressData.address_line2,
            city: addressData.city,
            state: addressData.state,
            postal_code: addressData.postal_code,
            country: addressData.country,
          });

        if (error) throw error;

        toast({
          title: "Profile Created",
          description: "Your supplier profile has been created successfully.",
        });

        // Notify parent component that profile was created
        if (onProfileCreated) {
          onProfileCreated();
        }
      }

      // Reload the profile
      loadExistingProfile();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {existingProfile ? 'Update Supplier Profile' : 'Setup Supplier Profile'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="industry">Industry *</Label>
            <Select value={industry} onValueChange={setIndustry} required>
              <SelectTrigger>
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent>
                {VALID_INDUSTRIES.map((ind) => {
                  console.log('Rendering industry SelectItem:', ind);
                  return (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your company and services..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium">Address</Label>
            <AddressFields
              data={addressData}
              onChange={(field, value) => setAddressData(prev => ({ ...prev, [field]: value }))}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="autoApprove"
              checked={autoApproveConnections}
              onCheckedChange={setAutoApproveConnections}
            />
            <Label htmlFor="autoApprove">
              Auto-approve buyer connection requests
            </Label>
          </div>
          <p className="text-sm text-gray-600">
            When enabled, buyers can connect with you instantly without requiring approval.
          </p>

          <Button type="submit" disabled={loading} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : existingProfile ? "Update Profile" : "Create Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SupplierProfileSetup;
