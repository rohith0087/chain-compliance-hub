
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useCompanySetup = () => {
  const { user, profile } = useAuth();

  const createSupplierRecord = async () => {
    if (!user || !profile) {
      console.log('No user or profile available for supplier record creation');
      return;
    }

    try {
      console.log('Checking for existing supplier record...');
      // Only create supplier record if user has supplier role and doesn't have one yet
      if (profile.roles?.includes('supplier')) {
        const { data: existingSuppliers, error: fetchError } = await supabase
          .from('suppliers')
          .select('id')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error checking for existing supplier:', fetchError);
          return;
        }

        if (!existingSuppliers || existingSuppliers.length === 0) {
          console.log('Creating new supplier record...');
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
            console.log('Supplier record created successfully');
          }
        } else {
          console.log('Supplier record already exists');
        }
      }
    } catch (error) {
      console.error('Error in createSupplierRecord:', error);
    }
  };

  const createBuyerRecord = async () => {
    if (!user || !profile) {
      console.log('No user or profile available for buyer record creation');
      return;
    }

    try {
      console.log('Checking for existing buyer record...');
      // Only create buyer record if user has buyer role and doesn't have one yet
      if (profile.roles?.includes('buyer')) {
        const { data: existingBuyers, error: fetchError } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error checking for existing buyer:', fetchError);
          return;
        }

        if (!existingBuyers || existingBuyers.length === 0) {
          console.log('Creating new buyer record...');
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
            console.log('Buyer record created successfully');
          }
        } else {
          console.log('Buyer record already exists');
        }
      }
    } catch (error) {
      console.error('Error in createBuyerRecord:', error);
    }
  };

  const getSupplierProfile = async () => {
    if (!user) return null;

    try {
      console.log('Fetching supplier profile for user:', user.id);
      const { data: suppliers, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching supplier profile:', error);
        return null;
      }

      const result = suppliers && suppliers.length > 0 ? suppliers[0] : null;
      console.log('Supplier profile result:', result);
      return result;
    } catch (error) {
      console.error('Error in getSupplierProfile:', error);
      return null;
    }
  };

  const getBuyerProfile = async () => {
    if (!user) return null;

    try {
      console.log('Fetching buyer profile for user:', user.id);
      const { data: buyers, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('profile_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching buyer profile:', error);
        return null;
      }

      const result = buyers && buyers.length > 0 ? buyers[0] : null;
      console.log('Buyer profile result:', result);
      return result;
    } catch (error) {
      console.error('Error in getBuyerProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    if (user && profile) {
      console.log('User and profile available, setting up company records...');
      // Small delay to ensure profile is fully loaded
      const timer = setTimeout(() => {
        if (profile.roles?.includes('supplier')) {
          createSupplierRecord();
        }
        if (profile.roles?.includes('buyer')) {
          createBuyerRecord();
        }
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
