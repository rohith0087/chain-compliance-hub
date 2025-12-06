-- Fix missing user_roles entries for users who signed up during trigger deployment

-- Insert missing user_roles for nugitiqe@denipl.net (supplier signup)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'supplier'::app_role
FROM profiles WHERE email = 'nugitiqe@denipl.net'
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill ALL missing user_roles entries from profiles.roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, (p.roles[1])::text::app_role
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id)
AND array_length(p.roles, 1) > 0
ON CONFLICT (user_id, role) DO NOTHING;