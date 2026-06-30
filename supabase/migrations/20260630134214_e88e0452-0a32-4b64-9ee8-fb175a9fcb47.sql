
CREATE TABLE public.user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key bytea NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text[] NOT NULL DEFAULT '{}',
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  nickname text NOT NULL DEFAULT 'Passkey',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_passkeys_user_id ON public.user_passkeys(user_id);

GRANT SELECT, UPDATE, DELETE ON public.user_passkeys TO authenticated;
GRANT ALL ON public.user_passkeys TO service_role;

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own passkeys" ON public.user_passkeys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own passkeys" ON public.user_passkeys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own passkeys" ON public.user_passkeys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_passkeys()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_user_passkeys_updated_at
  BEFORE UPDATE ON public.user_passkeys
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_passkeys();

CREATE TABLE public.passkey_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  ceremony_type text NOT NULL CHECK (ceremony_type IN ('registration','authentication')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_passkey_challenges_user ON public.passkey_challenges(user_id, ceremony_type, created_at DESC);

GRANT ALL ON public.passkey_challenges TO service_role;

ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
-- No policies: service_role bypasses RLS; no client access.
