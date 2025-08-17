export type ResolvedStoragePath = {
  bucket: string;
  key: string;
};

// Resolve various forms of stored file paths into a bucket + key pair
// - Accepts raw keys ("user/123/file.pdf")
// - Accepts keys that mistakenly include the bucket prefix ("compliance-documents/file.pdf")
// - Accepts full public/signed URLs from Supabase storage
export function resolveStoragePath(input: string | null | undefined): ResolvedStoragePath | null {
  if (!input) return null;
  let value = input.trim();

  // If it's a full URL, try to parse bucket and key
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);
      // Patterns we may see:
      // /storage/v1/object/public/<bucket>/<key>
      // /storage/v1/object/sign/<bucket>/<key>
      const idx = parts.findIndex((p) => p === 'object');
      if (idx !== -1 && parts[idx + 1]) {
        // object/<visibility>/<bucket>/<...key>
        const visibilityOrBucket = parts[idx + 1];
        if (visibilityOrBucket === 'public' || visibilityOrBucket === 'sign' || visibilityOrBucket === 'auth') {
          const bucket = parts[idx + 2];
          const key = parts.slice(idx + 3).join('/');
          if (bucket && key) return { bucket, key };
        } else {
          // object/<bucket>/<...key>
          const bucket = visibilityOrBucket;
          const key = parts.slice(idx + 2).join('/');
          if (bucket && key) return { bucket, key };
        }
      }
    }
  } catch {
    // fallthrough to key normalization
  }

  // Normalize leading slashes
  value = value.replace(/^\/+/, '');

  // If the value includes the bucket name as a prefix, strip it
  if (value.startsWith('compliance-documents/')) {
    return { bucket: 'compliance-documents', key: value.replace(/^compliance-documents\//, '') };
  }

  // Default to compliance-documents bucket
  return { bucket: 'compliance-documents', key: value };
}
