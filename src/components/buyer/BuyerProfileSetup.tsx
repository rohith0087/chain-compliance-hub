import { useState, useEffect } from 'react';
import logger from '@/utils/logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2 } from 'lucide-react';
import { VALID_INDUSTRIES } from '@/config/industries';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { createSafeSelectValue } from '@/utils/selectValidation';
import { AddressFields, emptyAddressData } from '@/components/shared/AddressFields';

interface BuyerProfileSetupProps {
  onProfileCreated: () => void;
}

const BuyerProfileSetup = ({ onProfileCreated }: BuyerProfileSetupProps) => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    industry: 'Technology',
    contactEmail: '',
    phone: '',
    description: '',
    ...emptyAddressData(),
  });

  // Pre-populate form with user data from signup
  useEffect(() => {
    if (user || profile) {
      setFormData(prev => ({
        ...prev,
        companyName: user?.user_metadata?.company_name || profile?.company_name || prev.companyName,
        contactEmail: user?.email || profile?.email || prev.contactEmail,
      }));
    }
  }, [user, profile]);

  logger.debug('VALID_INDUSTRIES array in BuyerProfileSetup:', VALID_INDUSTRIES);
  logger.debug('Current industry value:', formData.industry);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    logger.debug('Starting buyer profile setup...', formData);
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
      let isNewProfile = false;
      
      if (existingBuyer) {
        logger.debug('Updating existing buyer profile:', existingBuyer.id);
        // Update existing buyer profile
        const { data, error } = await supabase
          .from('buyers')
          .update({
            company_name: formData.companyName,
            industry: formData.industry,
            contact_email: formData.contactEmail,
            phone: formData.phone,
            address_line1: formData.address_line1,
            address_line2: formData.address_line2,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingBuyer.id)
          .select()
          .single();

        if (error) throw error;
        buyerResult = data;
      } else {
        logger.debug('Creating new buyer profile...');
        isNewProfile = true;
        // Create new buyer profile
        const { data, error } = await supabase
          .from('buyers')
          .insert({
            profile_id: user.id,
            company_name: formData.companyName,
            industry: formData.industry,
            contact_email: formData.contactEmail,
            phone: formData.phone,
            address_line1: formData.address_line1,
            address_line2: formData.address_line2,
            city: formData.city,
            state: formData.state,
            postal_code: formData.postal_code,
            country: formData.country,
          })
          .select()
          .single();

        if (error) throw error;
        buyerResult = data;
      }

      logger.debug('Buyer profile saved successfully');

      // Initialize default onboarding settings for new profiles
      if (isNewProfile && formData.industry) {
        try {
          const { getTemplateForIndustry } = await import('@/config/defaultOnboardingTemplates');
          const template = getTemplateForIndustry(formData.industry);
          
          if (template) {
            // Create default onboarding settings
            const { error: settingsError } = await supabase
              .from('buyer_default_onboarding_settings')
              .insert({
                buyer_id: buyerResult.id,
                created_by: user.id,
                default_welcome_message: template.default_welcome_message,
                allow_branch_selection: template.allow_branch_selection,
                require_branch_selection: template.require_branch_selection,
                auto_approve_standard_docs: template.auto_approve_standard_docs,
                require_all_documents: template.require_all_documents,
                expires_days: template.expires_days
              });

            if (settingsError) {
              console.error('Error creating default settings:', settingsError);
            }

            // Create default document requirements
            if (template.document_requirements.length > 0) {
              const { error: docError } = await supabase
                .from('default_document_requirements')
                .insert(
                  template.document_requirements.map(req => ({
                    buyer_id: buyerResult.id,
                    ...req
                  }))
                );

              if (docError) {
                console.error('Error creating default document requirements:', docError);
              }
            }

            // Create default form fields
            if (template.form_fields.length > 0) {
              const { error: fieldsError } = await supabase
                .from('default_form_fields')
                .insert(
                  template.form_fields.map(field => ({
                    buyer_id: buyerResult.id,
                    ...field
                  }))
                );

              if (fieldsError) {
                console.error('Error creating default form fields:', fieldsError);
              }
            }

            toast({
              title: "Setup Complete",
              description: `Your ${formData.industry} industry defaults have been configured automatically!`,
            });
          }
        } catch (importError) {
          console.error('Error setting up defaults:', importError);
        }
      } else {
        toast({
          title: "Profile Updated",
          description: "Your buyer profile has been updated successfully.",
        });
      }

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

  const handleIndustryChange = (value: string) => {
    const safeValue = createSafeSelectValue(value, 'Technology');
    logger.debug('Industry changed to:', safeValue);
    setFormData({...formData, industry: safeValue});
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
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                {user?.user_metadata?.company_name && (
                  <p className="text-xs text-muted-foreground">
                    Pre-filled from your signup. You can edit if needed.
                  </p>
                )}
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
                <SafeSelect 
                  value={formData.industry} 
                  onValueChange={handleIndustryChange}
                  placeholder="Select your industry"
                >
                  {VALID_INDUSTRIES.map((industry) => {
                    logger.debug('Rendering industry SafeSelectItem in BuyerProfileSetup:', industry);
                    return (
                      <SafeSelectItem key={industry} value={industry}>
                        {industry}
                      </SafeSelectItem>
                    );
                  })}
                </SafeSelect>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                {user?.email && (
                  <p className="text-xs text-muted-foreground">
                    Pre-filled from your account. You can edit if needed.
                  </p>
                )}
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

            <div className="space-y-2">
              <Label className="text-base font-medium">Business Address</Label>
              <AddressFields
                data={{
                  address_line1: formData.address_line1,
                  address_line2: formData.address_line2,
                  city: formData.city,
                  state: formData.state,
                  postal_code: formData.postal_code,
                  country: formData.country,
                }}
                onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
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
