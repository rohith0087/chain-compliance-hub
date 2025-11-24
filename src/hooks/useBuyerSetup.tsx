
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
      // Check if user is a team member first
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', user.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (teamMember) {
        // Team member - fetch company using company_id
        const { data: buyer, error } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', teamMember.company_id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching buyer profile for team member:', error);
        }

        return buyer;
      } else {
        // Company owner - fetch using profile_id
        const { data: buyer, error } = await supabase
          .from('buyers')
          .select('*')
          .eq('profile_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching buyer profile for owner:', error);
        }

        return buyer;
      }
    } catch (error) {
      console.error('Error in getBuyerProfile:', error);
      return null;
    }
  };

  return { createBuyerRecord, getBuyerProfile };
};
