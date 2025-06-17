
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useDemoData = () => {
  const { user, profile } = useAuth();

  const createCompanySupplierRecord = async () => {
    if (!user || !profile) return;

    try {
      // Only create supplier record if user has supplier role and doesn't have one yet
      if (profile.roles?.includes('supplier')) {
        const { data: existingSupplier } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (!existingSupplier) {
          const { error: supplierError } = await supabase
            .from('suppliers')
            .insert({
              profile_id: user.id,
              company_name: profile.company_name || `${profile.full_name}'s Company`,
              contact_email: profile.email,
              industry: 'General Business',
              phone: '555-0100',
              address: '123 Business Street, Business City, CA 90210'
            });

          if (supplierError) {
            console.error('Error creating supplier record:', supplierError);
          } else {
            console.log('Supplier record created for user');
          }
        }
      }
    } catch (error) {
      console.error('Error in createCompanySupplierRecord:', error);
    }
  };

  useEffect(() => {
    if (user && profile) {
      // Small delay to ensure profile is fully loaded
      const timer = setTimeout(() => {
        createCompanySupplierRecord();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  return { createCompanySupplierRecord };
};
