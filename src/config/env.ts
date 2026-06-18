import { z } from 'zod';

const legacyCompatibility = {
  VITE_SUPABASE_URL: 'https://edwerzutsknhuplidhsj.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkd2VyenV0c2tuaHVwbGlkaHNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwOTU3MzYsImV4cCI6MjA2NTY3MTczNn0.zlfoc_V7IyFzmseOgfuew9Mjks_U6hrlO8XwNc_GXbI',
} as const;

const publicEnvironmentSchema = z.object({
  VITE_SUPABASE_URL: z.string().url().refine((value) => value.startsWith('https://'), {
    message: 'Supabase URL must use HTTPS',
  }),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const configuredKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const usingLegacyCompatibility = !configuredUrl || !configuredKey;

export const publicEnvironment = publicEnvironmentSchema.parse({
  VITE_SUPABASE_URL: configuredUrl || legacyCompatibility.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: configuredKey || legacyCompatibility.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
});

if (usingLegacyCompatibility) {
  console.warn(
    '[configuration] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are not configured. ' +
      'Using the legacy public key compatibility path; configure environment-specific values before rollout.',
  );
}

export const environmentStatus = Object.freeze({
  usingLegacyCompatibility,
  appEnvironment: publicEnvironment.VITE_APP_ENV,
});
