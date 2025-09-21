-- Create subscription plans enum
CREATE TYPE subscription_plan_type AS ENUM (
  'buyer_basic',
  'buyer_professional', 
  'buyer_enterprise',
  'supplier_starter',
  'supplier_professional',
  'supplier_enterprise'
);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type subscription_plan_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  price_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create credits table for tracking user credit balances
CREATE TABLE public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_credits INTEGER NOT NULL DEFAULT 0,
  total_purchased_credits INTEGER NOT NULL DEFAULT 0,
  total_consumed_credits INTEGER NOT NULL DEFAULT 0,
  last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- Create credit transactions table for detailed tracking
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'purchase', 'consumption', 'monthly_allocation', 'refund'
  credits_amount INTEGER NOT NULL, -- positive for additions, negative for consumption
  description TEXT NOT NULL,
  reference_id UUID, -- reference to report, purchase, etc.
  reference_type TEXT, -- 'report', 'stripe_payment', 'monthly_reset'
  stripe_payment_intent_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create subscription plan configurations
CREATE TABLE public.subscription_plan_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_type subscription_plan_type NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  max_reports_per_month INTEGER,
  features JSONB NOT NULL DEFAULT '{}',
  stripe_price_id TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_audience TEXT NOT NULL, -- 'buyer' or 'supplier'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plan_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription" ON public.subscriptions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can manage subscriptions" ON public.subscriptions
  FOR ALL USING (true);

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits" ON public.user_credits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage user credits" ON public.user_credits
  FOR ALL USING (true);

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view their own credit transactions" ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert credit transactions" ON public.credit_transactions
  FOR INSERT WITH CHECK (true);

-- RLS Policies for subscription_plan_configs
CREATE POLICY "Anyone can view subscription plan configs" ON public.subscription_plan_configs
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage plan configs" ON public.subscription_plan_configs
  FOR ALL USING (is_admin(auth.uid()));

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscription_plan_configs_updated_at
  BEFORE UPDATE ON public.subscription_plan_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to initialize user credits when they sign up
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert initial credits record for new user
  INSERT INTO public.user_credits (user_id, available_credits)
  VALUES (NEW.id, 10) -- Give 10 free credits to start
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to initialize credits for new users
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

-- Function to consume credits with validation
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_credits_amount INTEGER,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_available_credits INTEGER;
BEGIN
  -- Get current available credits
  SELECT available_credits INTO v_available_credits
  FROM public.user_credits
  WHERE user_id = p_user_id;
  
  -- Check if user has enough credits
  IF v_available_credits < p_credits_amount THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE public.user_credits
  SET 
    available_credits = available_credits - p_credits_amount,
    total_consumed_credits = total_consumed_credits + p_credits_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    credits_amount,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    'consumption',
    -p_credits_amount,
    p_description,
    p_reference_id,
    p_reference_type
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to add credits (purchase or monthly allocation)
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_credits_amount INTEGER,
  p_transaction_type TEXT,
  p_description TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Add credits to user balance
  INSERT INTO public.user_credits (user_id, available_credits, total_purchased_credits)
  VALUES (p_user_id, p_credits_amount, CASE WHEN p_transaction_type = 'purchase' THEN p_credits_amount ELSE 0 END)
  ON CONFLICT (user_id)
  DO UPDATE SET
    available_credits = user_credits.available_credits + p_credits_amount,
    total_purchased_credits = CASE 
      WHEN p_transaction_type = 'purchase' THEN user_credits.total_purchased_credits + p_credits_amount
      ELSE user_credits.total_purchased_credits
    END,
    updated_at = now();
  
  -- Log the transaction
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    credits_amount,
    description,
    reference_id,
    reference_type,
    stripe_payment_intent_id
  ) VALUES (
    p_user_id,
    p_transaction_type,
    p_credits_amount,
    p_description,
    p_reference_id,
    p_reference_type,
    p_stripe_payment_intent_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;