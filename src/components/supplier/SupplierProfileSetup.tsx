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

interface SupplierProfileSetupProps {
  onProfileCreated?: () => void;
}

const SupplierProfileSetup = ({ onProfileCreated }: SupplierProfileSetupProps) => {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [autoApproveConnections, setAutoApproveConnections] = useState(false);
  const [description, setDescription] = useState('');
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const industries = [
    'Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Retail',
    'Construction', 'Food & Beverage', 'Automotive', 'Energy', 'Education',
    'Telecommunications', 'Agriculture', 'Transportation', 'Real Estate',
    'Entertainment', 'Consulting', 'Legal Services', 'Marketing'
  ];

  useEffect(() => {
    if (user) {
      loadExistingProfile();
    }
  }, [user]);

  const loadExistingProfile = async () => {
    try {
      const { data: supplier, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading supplier profile:', error);
      } else if (supplier) {
        setExistingProfile(supplier);
        setCompanyName(supplier.company_name || '');
        setIndustry(supplier.industry || '');
        setPhone(supplier.phone || '');
        setAddress(supplier.address || '');
        setAutoApproveConnections(supplier.auto_approve_connections || false);
        setDescription(supplier.description || '');
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
            address,
            auto_approve_connections: autoApproveConnections,
            description,
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
            address,
            auto_approve_connections: autoApproveConnections,
            description
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
                {industries.map((ind) => (
                  <SelectItem key={ind} value={ind}>
                    {ind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="description">Company Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your company and services"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="autoApprove"
              checked={autoApproveConnections}
              onCheckedChange={setAutoApproveConnections}
            />
            <Label htmlFor="autoApprove" className="text-sm">
              Auto-approve buyer connection requests
            </Label>
          </div>
          <p className="text-xs text-gray-600">
            When enabled, buyers can connect to your company without waiting for approval
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
