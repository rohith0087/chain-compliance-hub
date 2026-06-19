const SIGNING_ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const;

function base64Encode(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64Decode(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

/**
 * Signs the UTF-8 bytes of a content_hash hex string (not the original
 * content) -- the content_hash is the canonical fingerprint of the
 * dossier's content_snapshot, computed via stableJson()+SHA-256, and the
 * signature is a separate cryptographic proof over that fingerprint.
 */
export async function signDigest(privateKeyJwk: JsonWebKey, digestHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', privateKeyJwk, SIGNING_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign(SIGN_PARAMS, key, new TextEncoder().encode(digestHex));
  return base64Encode(signature);
}

export async function verifySignature(publicKeyJwk: JsonWebKey, digestHex: string, signatureBase64: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('jwk', publicKeyJwk, SIGNING_ALGORITHM, false, ['verify']);
  return crypto.subtle.verify(SIGN_PARAMS, key, base64Decode(signatureBase64), new TextEncoder().encode(digestHex));
}

export async function generateSigningKeyPair(): Promise<{ privateKeyJwk: JsonWebKey; publicKeyJwk: JsonWebKey }> {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(SIGNING_ALGORITHM, true, ['sign', 'verify']);
  const [privateKeyJwk, publicKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', privateKey),
    crypto.subtle.exportKey('jwk', publicKey),
  ]);
  return { privateKeyJwk, publicKeyJwk };
}
