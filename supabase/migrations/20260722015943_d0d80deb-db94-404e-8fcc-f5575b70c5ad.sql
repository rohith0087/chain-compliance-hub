ALTER TABLE public.passkey_challenges ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS user_passkeys_credential_id_idx ON public.user_passkeys(credential_id);