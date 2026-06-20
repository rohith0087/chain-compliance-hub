type EvidenceInputContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } }
  | { type: 'file'; file: { filename: string; file_data: string } };

export function buildEvidenceInputContent(
  prompt: string,
  base64Data: string,
  mimeType: string,
  filename: string,
): EvidenceInputContent[] {
  if (mimeType === 'application/pdf') {
    return [
      {
        type: 'file',
        file: {
          filename,
          file_data: `data:application/pdf;base64,${base64Data}`,
        },
      },
      { type: 'text', text: prompt },
    ];
  }

  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)) {
    return [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: { url: `data:${mimeType};base64,${base64Data}`, detail: 'high' },
      },
    ];
  }

  throw new Error(`Unsupported evidence MIME type: ${mimeType}`);
}
