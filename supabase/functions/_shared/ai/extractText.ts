import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { extractText as pdfExtractText, getDocumentProxy } from 'npm:unpdf@0.12.1';

type SupabaseAdmin = ReturnType<typeof createClient>;

// Extracts readable text from a document so AI features can read specs and
// evidence, not just structured status. PDFs go through unpdf (Deno/edge
// friendly); text/markdown/csv are decoded directly. Binary/scanned images
// aren't OCR'd here (that would need Vision) — callers get empty text and can
// fall back.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await pdfExtractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text) ?? '';
}

function looksTextual(mime: string | null, path: string): boolean {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('text/') || m.includes('json') || m.includes('csv') || m.includes('markdown')) return true;
  return /\.(txt|md|csv|json)$/i.test(path);
}

/**
 * Downloads a stored document and returns its extracted text, capped to
 * maxChars. Returns '' when the format can't be read (e.g. a scanned image).
 */
export async function extractTextFromStorage(
  admin: SupabaseAdmin,
  bucket: string,
  path: string,
  mimeType: string | null,
  maxChars = 40000,
): Promise<string> {
  const { data, error } = await admin.storage.from(bucket).download(path);
  if (error || !data) return '';
  const bytes = new Uint8Array(await data.arrayBuffer());

  let text = '';
  const isPdf = (mimeType ?? '').toLowerCase().includes('pdf') || /\.pdf$/i.test(path);
  if (isPdf) {
    try { text = await extractPdfText(bytes); } catch { text = ''; }
  } else if (looksTextual(mimeType, path)) {
    try { text = new TextDecoder().decode(bytes); } catch { text = ''; }
  }
  return text.slice(0, maxChars);
}
