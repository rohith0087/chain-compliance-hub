-- Create supplier notification settings table
CREATE TABLE public.supplier_notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  new_request_in_app_enabled boolean NOT NULL DEFAULT true,
  new_request_email_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id)
);

-- Enable RLS
ALTER TABLE public.supplier_notification_settings ENABLE ROW LEVEL SECURITY;

-- Suppliers can manage their own notification settings (owner or team member)
CREATE POLICY "Suppliers can manage their own notification settings"
  ON public.supplier_notification_settings
  FOR ALL
  USING (
    supplier_id IN (
      SELECT id FROM public.suppliers WHERE profile_id = auth.uid()
    ) OR
    supplier_id IN (
      SELECT company_id FROM public.company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'supplier' 
      AND status = 'active'
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_supplier_notification_settings_updated_at
  BEFORE UPDATE ON public.supplier_notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();