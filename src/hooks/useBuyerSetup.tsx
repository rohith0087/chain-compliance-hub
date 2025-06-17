
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const useBuyerSetup = () => {
  const { user, profile } = useAuth();

  const createBuyerRecord = async (companyName: string, industry: string) => {
    if (!user || !profile) return;

    try {
      const { error: buyerError } = await supabase
        .from('buyers')
        .insert({
          profile_id: user.id,
          company_name: companyName,
          contact_email: profile.email,
          industry: industry,
          phone: '',
          address: ''
        });

      if (buyerError) {
        console.error('Error creating buyer record:', buyerError);
        throw buyerError;
      } else {
        console.log('Buyer record created for user');
      }
    } catch (error) {
      console.error('Error in createBuyerRecord:', error);
      throw error;
    }
  };

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

  return { createBuyerRecord, getBuyerProfile };
};
