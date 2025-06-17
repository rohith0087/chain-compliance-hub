
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { INDUSTRIES } from '@/config/industries';
import SupplierSelection from './SupplierSelection';

interface BuyerProfileSetupProps {
  onProfileCreated?: () => void;
}

const BuyerProfileSetup = ({ onProfileCreated }: BuyerProfileSetupProps) => {
  const [step, setStep] = useState(1); // 1 = Profile Setup, 2 = Supplier Selection
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const { user, profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && profile) {
      console.log('User and profile loaded, checking for buyer profile...');
      loadExistingProfile();
    }
  }, [user, profile]);

  const getBuyerProfile = async () => {
    if (!user) {
      console.log('No user found');
      return null;
    }

    try {
      console.log('Fetching buyer profile for user:', user.id);
      const { data: buyers, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching buyer profile:', error);
        // Don't throw error for PGRST116 (no rows found)
        if (error.code !== 'PGRST116') {
          throw error;
        }
        return null;
      }

      console.log('Buyer profile query result:', buyers);
      return buyers && buyers.length > 0 ? buyers[0] : null;
    } catch (error) {
      console.error('Error in getBuyerProfile:', error);
      return null;
    }
  };

  const loadExistingProfile = async () => {
    try {
      console.log('Loading existing buyer profile...');
      const buyer = await getBuyerProfile();
      console.log('Found buyer profile:', buyer);
      
      if (buyer) {
        setExistingProfile(buyer);
        setCompanyName(buyer.company_name || '');
        setIndustry(buyer.industry || '');
        setPhone(buyer.phone || '');
        setAddress(buyer.address || '');
        // If profile exists, skip to supplier selection
        setStep(2);
      } else {
        console.log('No buyer profile found, using profile data for pre-fill');
        // Pre-fill with profile data if available
        setCompanyName(profile?.company_name || '');
        // Stay on step 1 for profile creation
        setStep(1);
      }
    } catch (error) {
      console.error('Error loading buyer profile:', error);
      toast({
        title: "Error",
        description: "Failed to load buyer profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setInitialLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!companyName.trim() || !industry) {
      toast({
        title: "Missing Information",
        description: "Please fill in company name and select an industry.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Submitting buyer profile...');
      
      if (existingProfile) {
        console.log('Updating existing buyer profile:', existingProfile.id);
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

        if (error) {
          console.error('Error updating buyer profile:', error);
          throw error;
        }

        toast({
          title: "Profile Updated",
          description: "Your buyer profile has been updated successfully.",
        });
      } else {
        console.log('Creating new buyer profile for user:', user?.id);
        // Create new profile
        const { data, error } = await supabase
          .from('buyers')
          .insert({
            profile_id: user?.id,
            company_name: companyName,
            contact_email: profile?.email || user?.email,
            industry,
            phone,
            address
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating buyer profile:', error);
          throw error;
        }

        console.log('Buyer profile created successfully:', data);
        setExistingProfile(data);

        toast({
          title: "Profile Created",
          description: "Your buyer profile has been created successfully.",
        });
      }

      // Move to supplier selection step
      setStep(2);
    } catch (error: any) {
      console.error('Error in handleProfileSubmit:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    console.log('Buyer profile setup completed');
    if (onProfileCreated) {
      onProfileCreated();
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (step === 2 && existingProfile) {
    return (
      <SupplierSelection
        selectedIndustry={industry}
        buyerProfile={existingProfile}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          {existingProfile ? 'Update Buyer Profile' : 'Setup Buyer Profile'}
        </CardTitle>
        <p className="text-sm text-gray-600">
          Step 1 of 2: Set up your company information
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <Label htmlFor="companyName">Company Name *</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter your company name"
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
                {INDUSTRIES.map((ind) => (
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
              placeholder="Enter your phone number"
            />
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter your company address"
              rows={3}
            />
          </div>

          <Button type="submit" disabled={loading || !companyName.trim() || !industry} className="w-full">
            {loading ? (
              <>
                <Save className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-2" />
                {existingProfile ? "Update & Continue" : "Create Profile & Continue"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default BuyerProfileSetup;
