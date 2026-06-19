import { describe, expect, it } from 'vitest';
import { generateSigningKeyPair, signDigest, verifySignature } from '../../supabase/functions/_shared/dossier/signing';

describe('dossier signing', () => {
  it('verifies a signature produced by the matching private key', async () => {
    const { privateKeyJwk, publicKeyJwk } = await generateSigningKeyPair();
    const digest = 'a'.repeat(64);
    const signature = await signDigest(privateKeyJwk, digest);
    expect(await verifySignature(publicKeyJwk, digest, signature)).toBe(true);
  });

  it('fails verification if the digest was tampered with after signing', async () => {
    const { privateKeyJwk, publicKeyJwk } = await generateSigningKeyPair();
    const digest = 'a'.repeat(64);
    const signature = await signDigest(privateKeyJwk, digest);
    const tamperedDigest = 'b'.repeat(64);
    expect(await verifySignature(publicKeyJwk, tamperedDigest, signature)).toBe(false);
  });

  it('fails verification against a different key pair', async () => {
    const { privateKeyJwk } = await generateSigningKeyPair();
    const { publicKeyJwk: otherPublicKeyJwk } = await generateSigningKeyPair();
    const digest = 'c'.repeat(64);
    const signature = await signDigest(privateKeyJwk, digest);
    expect(await verifySignature(otherPublicKeyJwk, digest, signature)).toBe(false);
  });
});
