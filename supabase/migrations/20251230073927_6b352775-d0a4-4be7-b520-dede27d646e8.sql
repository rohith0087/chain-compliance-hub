-- Add structured address fields to buyers table
ALTER TABLE public.buyers
ADD COLUMN IF NOT EXISTS address_line1 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS address_line2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- Add structured address fields to suppliers table
ALTER TABLE public.suppliers
ADD COLUMN IF NOT EXISTS address_line1 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS address_line2 TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS state TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS country TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.buyers.address_line1 IS 'Street address, P.O. box';
COMMENT ON COLUMN public.buyers.address_line2 IS 'Apartment, suite, unit, building, floor, etc.';
COMMENT ON COLUMN public.buyers.city IS 'City or district';
COMMENT ON COLUMN public.buyers.state IS 'State, province, or region';
COMMENT ON COLUMN public.buyers.postal_code IS 'ZIP or postal code';
COMMENT ON COLUMN public.buyers.country IS 'Country name';

COMMENT ON COLUMN public.suppliers.address_line1 IS 'Street address, P.O. box';
COMMENT ON COLUMN public.suppliers.address_line2 IS 'Apartment, suite, unit, building, floor, etc.';
COMMENT ON COLUMN public.suppliers.city IS 'City or district';
COMMENT ON COLUMN public.suppliers.state IS 'State, province, or region';
COMMENT ON COLUMN public.suppliers.postal_code IS 'ZIP or postal code';
COMMENT ON COLUMN public.suppliers.country IS 'Country name';