import { describe, expect, it } from 'vitest';
import { buildEvidenceInputContent } from '../../supabase/functions/_shared/evidence/openAiInput';

describe('evidence model input', () => {
  it('sends PDFs as supported file inputs instead of image URLs', () => {
    expect(buildEvidenceInputContent('Extract evidence', 'cGRm', 'application/pdf', 'certificate.pdf')).toEqual([
      {
        type: 'file',
        file: {
          filename: 'certificate.pdf',
          file_data: 'data:application/pdf;base64,cGRm',
        },
      },
      { type: 'text', text: 'Extract evidence' },
    ]);
  });

  it('keeps image uploads on the image input path', () => {
    expect(buildEvidenceInputContent('Extract evidence', 'aW1hZ2U=', 'image/png', 'certificate.png')).toEqual([
      { type: 'text', text: 'Extract evidence' },
      {
        type: 'image_url',
        image_url: {
          url: 'data:image/png;base64,aW1hZ2U=',
          detail: 'high',
        },
      },
    ]);
  });

  it('rejects unsupported binary formats explicitly', () => {
    expect(() => buildEvidenceInputContent('Extract evidence', 'eA==', 'application/zip', 'archive.zip'))
      .toThrow('Unsupported evidence MIME type: application/zip');
  });
});
