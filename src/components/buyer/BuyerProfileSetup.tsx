import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';
import { VALID_INDUSTRIES } from '@/config/industries';

interface BuyerProfileSetupProps {
  onProfileCreated: () => void;
}

const BuyerProfileSetup = ({ onProfileCreated }: BuyerProfileSetupProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    industry: 'Technology', // Set a default value instead of empty string
    contactEmail: '',
    phone: '',
    address: '',
    description: ''
  });

  const { user } = useAuth();
  const { toast } = useToast();

  console.log('VALID_INDUSTRIES array in BuyerProfileSetup:', VALID_INDUSTRIES);
  console.log('Current industry value:', formData.industry);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    console.log('Starting buyer profile setup...', formData);
    setLoading(true);

    try {
      // First check if buyer profile already exists
      const { data: existingBuyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('profile_id', user.id)
        .limit(1)
        .maybeSingle();

      let buyerResult;
      
      if (existingBuyer) {
        console.log('Updating existing buyer profile:', existingBuyer.id);
        // Update existing buyer profile
        const { data, error } = await supabase
          .from('buyers')
          .update({
            company_name: formData.companyName,
            industry: formData.industry,
            contact_email: formData.contactEmail,
            phone: formData.phone,
            address: formData.address,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBuyer.id)
          .select()
          .single();

        if (error) throw error;
        buyerResult = data;
      } else {
        console.log('Creating new buyer profile...');
        // Create new buyer profile
        const { data, error } = await supabase
          .from('buyers')
          .insert({
            profile_id: user.id,
            company_name: formData.companyName,
            industry: formData.industry,
            contact_email: formData.contactEmail,
            phone: formData.phone,
            address: formData.address
          })
          .select()
          .single();

        if (error) throw error;
        buyerResult = data;
      }

      console.log('Buyer profile saved successfully:', buyerResult);

      toast({
        title: "Profile Created",
        description: "Your buyer profile has been set up successfully.",
      });

      // Call the callback to refresh parent component
      onProfileCreated();
      
    } catch (error: any) {
      console.error('Error creating buyer profile:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Complete Your Buyer Profile</CardTitle>
          <p className="text-gray-600">Let's set up your company information to get started.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  placeholder="Enter your company name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="industry">Industry *</Label>
                <Select 
                  value={formData.industry} 
                  onValueChange={(value) => setFormData({...formData, industry: value})}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_INDUSTRIES.map((industry) => {
                      console.log('Rendering industry SelectItem in BuyerProfileSetup:', industry, 'length:', industry.length);
                      return (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({...formData, contactEmail: e.target.value})}
                  placeholder="Enter contact email"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="Enter phone number"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Business Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                placeholder="Enter your business address"
              />
            </div>

            <div>
              <Label htmlFor="description">Company Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Tell us about your company..."
                rows={3}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Setting up..." : "Complete Setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BuyerProfileSetup;
