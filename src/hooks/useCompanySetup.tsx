
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useCompanySetup = () => {
  const { user, profile } = useAuth();

  const createSupplierRecord = async () => {
    if (!user || !profile) return;

    try {
      // Only create supplier record if user has supplier role and doesn't have one yet
      if (profile.roles?.includes('supplier')) {
        const { data: existingSuppliers } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!existingSuppliers || existingSuppliers.length === 0) {
          const { error: supplierError } = await supabase
            .from('suppliers')
            .insert({
              profile_id: user.id,
              company_name: profile.company_name || `${profile.full_name}'s Company`,
              contact_email: profile.email,
              industry: 'General Business',
              phone: '',
              address: '',
              auto_approve_connections: false,
              description: ''
            });

          if (supplierError) {
            console.error('Error creating supplier record:', supplierError);
          } else {
            console.log('Supplier record created for user');
          }
        }
      }
    } catch (error) {
      console.error('Error in createSupplierRecord:', error);
    }
  };

  const createBuyerRecord = async () => {
    if (!user || !profile) return;

    try {
      // Only create buyer record if user has buyer role and doesn't have one yet
      if (profile.roles?.includes('buyer')) {
        const { data: existingBuyers } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!existingBuyers || existingBuyers.length === 0) {
          const { error: buyerError } = await supabase
            .from('buyers')
            .insert({
              profile_id: user.id,
              company_name: profile.company_name || `${profile.full_name}'s Company`,
              contact_email: profile.email,
              industry: 'General Business',
              phone: '',
              address: ''
            });

          if (buyerError) {
            console.error('Error creating buyer record:', buyerError);
          } else {
            console.log('Buyer record created for user');
          }
        }
      }
    } catch (error) {
      console.error('Error in createBuyerRecord:', error);
    }
  };

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

  const getBuyerProfile = async () => {
    if (!user) return null;

    try {
      const { data: buyers, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching buyer profile:', error);
        return null;
      }

      return buyers && buyers.length > 0 ? buyers[0] : null;
    } catch (error) {
      console.error('Error in getBuyerProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    if (user && profile) {
      // Small delay to ensure profile is fully loaded
      const timer = setTimeout(() => {
        createSupplierRecord();
        createBuyerRecord();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, profile]);

  return { 
    createSupplierRecord, 
    createBuyerRecord, 
    getSupplierProfile, 
    getBuyerProfile 
  };
};
