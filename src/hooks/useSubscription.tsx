import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface SubscriptionData {
  subscribed: boolean;
  plan_type: string | null;
  subscription_end: string | null;
  credits: number;
  stripe_customer_exists: boolean;
  total_purchased_credits: number;
  total_consumed_credits: number;
}

export interface SubscriptionPlan {
  id: string;
  plan_type: string;
  plan_name: string;
  monthly_price_cents: number;
  monthly_credits: number;
  max_reports_per_month: number;
  features: any; // Using any since it comes from JSON field
  stripe_price_id: string;
  stripe_product_id: string;
  target_audience: string; // Allow string instead of strict union
}

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscriptionData, setSubscriptionData] = useState<SubscriptionData | null>(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const { data, error } = await supabase.functions.invoke('check-subscription-status');

      if (error) {
        console.error('Error checking subscription status:', error);
        setError('Failed to check subscription status');
        // Set safe fallback data
        setSubscriptionData({
          subscribed: false,
          plan_type: null,
          subscription_end: null,
          credits: 0,
          stripe_customer_exists: false,
          total_purchased_credits: 0,
          total_consumed_credits: 0
        });
        return;
      }

      setSubscriptionData(data);
    } catch (err) {
      console.error('Error in checkSubscriptionStatus:', err);
      setError('Failed to check subscription status');
      // Set safe fallback data
      setSubscriptionData({
        subscribed: false,
        plan_type: null,
        subscription_end: null,
        credits: 0,
        stripe_customer_exists: false,
        total_purchased_credits: 0,
        total_consumed_credits: 0
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchSubscriptionPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plan_configs')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price_cents', { ascending: true });

      if (error) {
        console.error('Error fetching subscription plans:', error);
        return;
      }

      setSubscriptionPlans(data || []);
    } catch (err) {
      console.error('Error in fetchSubscriptionPlans:', err);
    }
  }, []);

  const createSubscriptionCheckout = useCallback(async (priceId: string, planType: string) => {
    if (!user) {
      toast.error('Please log in to subscribe');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: { priceId, planType }
      });

      if (error) {
        console.error('Error creating subscription checkout:', error);
        toast.error('Failed to create checkout session');
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in createSubscriptionCheckout:', err);
      toast.error('Failed to create checkout session');
      return null;
    }
  }, [user]);

  const createCreditPurchase = useCallback(async (priceId: string, quantity: number = 1) => {
    if (!user) {
      toast.error('Please log in to purchase credits');
      return null;
    }

    try {
      // Verify we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error('Your session has expired. Please log in again.');
        return null;
      }

      const { data, error } = await supabase.functions.invoke('create-credit-purchase', {
        body: { priceId, quantity }
      });

      if (error) {
        console.error('Error creating credit purchase:', error);
        
        // Check if it's an auth error
        if (error.message?.includes('Authentication') || error.message?.includes('session')) {
          toast.error('Your session has expired. Please log in again.');
        } else {
          toast.error('Failed to create checkout session');
        }
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in createCreditPurchase:', err);
      toast.error('Failed to create checkout session');
      return null;
    }
  }, [user]);

  const manageSubscription = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to manage subscription');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription');

      if (error) {
        console.error('Error accessing customer portal:', error);
        toast.error('Failed to access customer portal');
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error in manageSubscription:', err);
      toast.error('Failed to access customer portal');
      return null;
    }
  }, [user]);

  const consumeCredits = useCallback(async (
    reportType: 'standard' | 'detailed' | 'comparison' | 'ai_enhanced',
    description?: string,
    referenceId?: string,
    referenceType?: string
  ) => {
    if (!user) {
      toast.error('Please log in to generate reports');
      return null;
    }

    try {
      const { data, error } = await supabase.functions.invoke('consume-credits', {
        body: { reportType, description, referenceId, referenceType }
      });

      if (error) {
        console.error('Error consuming credits:', error);
        return null;
      }

      if (!data.success) {
        if (data.error === 'Insufficient credits') {
          toast.error(`Not enough credits. You need ${data.credits_needed} credits for this report.`);
        } else {
          toast.error(data.error || 'Failed to consume credits');
        }
        return null;
      }

      // Refresh subscription data to update credit balance
      checkSubscriptionStatus();
      
      return data;
    } catch (err) {
      console.error('Error in consumeCredits:', err);
      toast.error('Failed to consume credits');
      return null;
    }
  }, [user, checkSubscriptionStatus]);

  const isFeatureAvailable = useCallback((feature: string): boolean => {
    if (!subscriptionData?.subscribed || !subscriptionData.plan_type) {
      return false;
    }

    const plan = subscriptionPlans.find(p => p.plan_type === subscriptionData.plan_type);
    return plan?.features[feature] === true;
  }, [subscriptionData, subscriptionPlans]);

  const hasEnoughCredits = useCallback((requiredCredits: number): boolean => {
    if (!subscriptionData) return false;
    
    // Enterprise users have unlimited credits
    if (subscriptionData.plan_type?.includes('enterprise')) {
      return true;
    }
    
    return subscriptionData.credits >= requiredCredits;
  }, [subscriptionData]);

  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
      fetchSubscriptionPlans();
    }
  }, [user, checkSubscriptionStatus, fetchSubscriptionPlans]);

  return {
    subscriptionData,
    subscriptionPlans,
    loading,
    error,
    checkSubscriptionStatus,
    createSubscriptionCheckout,
    createCreditPurchase,
    manageSubscription,
    consumeCredits,
    isFeatureAvailable,
    hasEnoughCredits,
    refreshSubscription: checkSubscriptionStatus,
  };
};