import { describe, expect, it, vi } from 'vitest';
import { isAuthorizedCronRequest } from '../../supabase/functions/_shared/systemAuth';

function bearerFor(role: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ role })}.signature`;
}

describe('scheduled processor authorization', () => {
  it('accepts an explicit service-role bearer token without a database lookup', async () => {
    const rpc = vi.fn();
    const request = new Request('https://example.test/process', {
      headers: { Authorization: `Bearer ${bearerFor('service_role')}` },
    });

    await expect(isAuthorizedCronRequest(request, { rpc })).resolves.toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('verifies a Vault-backed system secret through the privileged RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const request = new Request('https://example.test/process', {
      headers: { 'X-System-Secret': 'cron-secret' },
    });

    await expect(isAuthorizedCronRequest(request, { rpc })).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith('verify_system_cron_secret_v1', {
      p_secret: 'cron-secret',
    });
  });

  it('rejects missing and invalid system credentials', async () => {
    const invalidRpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const missingRpc = vi.fn();

    await expect(isAuthorizedCronRequest(
      new Request('https://example.test/process', { headers: { 'X-System-Secret': 'wrong' } }),
      { rpc: invalidRpc },
    )).resolves.toBe(false);
    await expect(isAuthorizedCronRequest(
      new Request('https://example.test/process'),
      { rpc: missingRpc },
    )).resolves.toBe(false);
    expect(missingRpc).not.toHaveBeenCalled();
  });
});
