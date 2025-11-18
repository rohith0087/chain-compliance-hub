import { FileText, Shield, AlertTriangle, File } from 'lucide-react';

export const BUYER_DOCUMENT_TYPES = {
  SOP: {
    label: 'Standard Operating Procedure',
    color: 'blue',
    icon: FileText,
    description: 'Standard operating procedures and protocols'
  },
  GMP: {
    label: 'Good Manufacturing Practice',
    color: 'green',
    icon: Shield,
    description: 'Good manufacturing practice documents'
  },
  HACCP: {
    label: 'HACCP',
    color: 'purple',
    icon: AlertTriangle,
    description: 'Hazard Analysis Critical Control Point documents'
  },
  OTHER: {
    label: 'Other',
    color: 'gray',
    icon: File,
    description: 'Other corporate documents'
  }
} as const;

export type BuyerDocumentType = keyof typeof BUYER_DOCUMENT_TYPES;

export const DOCUMENT_TYPE_OPTIONS = Object.entries(BUYER_DOCUMENT_TYPES).map(([key, value]) => ({
  value: key,
  label: value.label
}));
