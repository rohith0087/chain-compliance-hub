import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface BuyerProfileSetupProps {
  onProfileCreated?: () => void;
}

const BuyerProfileSetup = ({ onProfileCreated }: BuyerProfileSetupProps) => {
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const industries = [
    'Technology', 'Manufacturing', 'Healthcare', 'Finance', 'Retail',
    'Construction', 'Food & Beverage', 'Automotive', 'Energy', 'Education'
  ];

  useEffect(() => {
    if (user) {
      loadExistingProfile();
    }
  }, [user]);

  const getBuyerProfile = async () => {
    if (!user) return null;

    try {
      const { data: buyer, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching buyer profile:', error);
      }

      return buyer;
    } catch (error) {
      console.error('Error in getBuyerProfile:', error);
      return null;
    }
  };

  const loadExistingProfile = async () => {
    try {
      const buyer = await getBuyerProfile();
      if (buyer) {
        setExistingProfile(buyer);
        setCompanyName(buyer.company_name || '');
        setIndustry(buyer.industry || '');
        setPhone(buyer.phone || '');
        setAddress(buyer.address || '');
      } else {
        // Pre-fill with profile data if available
        setCompanyName(profile?.company_name || '');
      }
    } catch (error) {
      console.error('Error loading buyer profile:', error);
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
          .from('buyers')
          .update({
            company_name: companyName,
            industry,
            phone,
            address,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingProfile.id);

        if (error) throw error;

        toast({
          title: "Profile Updated",
          description: "Your buyer profile has been updated successfully.",
        });
      } else {
        // Create new profile
        const { error } = await supabase
          .from('buyers')
          .insert({
            profile_id: user?.id,
            company_name: companyName,
            contact_email: profile?.email || user?.email,
            industry,
            phone,
            address
          });

        if (error) throw error;

        toast({
          title: "Profile Created",
          description: "Your buyer profile has been created successfully.",
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
          {existingProfile ? 'Update Buyer Profile' : 'Setup Buyer Profile'}
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

          <Button type="submit" disabled={loading} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : existingProfile ? "Update Profile" : "Create Profile"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BuyerProfileSetup;
