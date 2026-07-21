/**
 * User-facing copy for integration failures.
 *
 * Two rules:
 *  1. Never show the user an HTTP status, a "non-2xx" string, or a raw provider
 *     message. Those are for logs, not people.
 *  2. Anything we don't specifically recognise becomes one calm, actionable
 *     line: something's wrong on our side, try again.
 */

const GENERIC = 'Something went wrong on our end. Please try again in a moment.';

/**
 * Extracts a friendly message from whatever `supabase.functions.invoke` throws.
 * On a non-2xx the SDK's `error.message` is the useless
 * "Edge Function returned a non-2xx status code", and the real body is on
 * `error.context`. We try the body, then fall back to generic — we never
 * surface the SDK's own string.
 */
export async function friendlyInvokeError(
  error: unknown,
  data: unknown,
  fallback = GENERIC,
): Promise<string> {
  // Some functions return 200 with { error } in the body.
  const inlineError = (data as { error?: unknown })?.error;
  if (typeof inlineError === 'string' && inlineError.trim()) {
    return humanize(inlineError, fallback);
  }

  // Non-2xx: dig the JSON body out of the SDK error context, if present.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (error as any)?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (typeof body?.error === 'string' && body.error.trim()) {
        return humanize(body.error, fallback);
      }
    } catch {
      /* body wasn't JSON — fall through */
    }
  }

  return fallback;
}

/**
 * Maps a known server message to friendly copy, otherwise returns the fallback.
 * Server messages that are already user-safe (e.g. validation like "toolkit is
 * required") are unlikely to reach here because the UI drives valid input, so
 * anything unrecognised is treated as an internal error, not shown raw.
 */
function humanize(serverMessage: string, fallback: string): string {
  const m = serverMessage.toLowerCase();
  if (m.includes('not configured')) {
    return 'Integrations aren’t set up yet. Please contact support.';
  }
  if (m.includes('revoke access at the provider')) {
    return 'We couldn’t fully disconnect this at the provider. Please try again.';
  }
  if (m.includes('authorization url')) {
    return 'We couldn’t start the connection. Please try again.';
  }
  if (m.includes('unauthorized') || m.includes('forbidden')) {
    return 'Your session may have expired. Refresh the page and try again.';
  }
  // A raw "Composio 401" / "Composio 502" style message must never reach a user.
  if (/composio\s+\d{3}/i.test(serverMessage) || /\b\d{3}\b/.test(serverMessage)) {
    return fallback;
  }
  return fallback;
}

/**
 * The codes composio-callback appends as `?composio_error=…`. Mapped to copy so
 * the OAuth return never shows a raw slug.
 */
export function friendlyCallbackError(code: string): string {
  switch (code) {
    case 'missing_connection':
    case 'unknown_connection':
      return 'The connection didn’t complete. Please try connecting again.';
    case 'verification_failed':
    case 'unexpected':
      return 'We couldn’t confirm the connection. Please try again.';
    case 'failed':
      return 'The provider didn’t grant access. Please try again.';
    case 'expired':
      return 'The connection expired before it finished. Please try again.';
    case 'not_configured':
      return 'Integrations aren’t set up yet. Please contact support.';
    default:
      return 'The connection didn’t complete. Please try again.';
  }
}
