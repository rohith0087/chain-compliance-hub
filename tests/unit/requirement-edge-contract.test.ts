import { describe, expect, it } from 'vitest';
import { createRequestContext, jsonResponse } from '../../supabase/functions/_shared/requestContext';
import {
  parseIdempotencyKey,
  requirementRequestHash,
  stableJson,
} from '../../supabase/functions/_shared/requirements/requestContract';

describe('requirement Edge Function request contract', () => {
  it('requires an idempotency key between 8 and 128 characters', () => {
    expect(parseIdempotencyKey(new Request('https://example.test'))).toBeNull();
    expect(parseIdempotencyKey(new Request('https://example.test', {
      headers: { 'x-idempotency-key': 'short' },
    }))).toBeNull();
    expect(parseIdempotencyKey(new Request('https://example.test', {
      headers: { 'x-idempotency-key': ' request-123 ' },
    }))).toBe('request-123');
  });

  it('hashes semantically identical requests deterministically', async () => {
    expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
    expect(await requirementRequestHash({ b: 2, a: 1 }))
      .toBe(await requirementRequestHash({ a: 1, b: 2 }));
  });

  it('preserves a valid correlation ID in response headers', async () => {
    const context = createRequestContext(new Request('https://example.test', {
      headers: { 'x-correlation-id': 'phase1-test' },
    }));
    const response = jsonResponse(context, { ok: true });
    expect(response.headers.get('x-correlation-id')).toBe('phase1-test');
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('replaces oversized correlation IDs', () => {
    const context = createRequestContext(new Request('https://example.test', {
      headers: { 'x-correlation-id': 'x'.repeat(129) },
    }));
    expect(context.correlationId).not.toBe('x'.repeat(129));
  });
});
