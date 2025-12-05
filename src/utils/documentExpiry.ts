export type ExpiryStatus = 'expired' | 'expiring_soon' | 'normal';

export interface ExpiryResult {
  status: ExpiryStatus;
  days: number;
}

/**
 * Get the expiry status and days for a document
 * @param expirationDate - The expiration date string
 * @param thresholdDays - Number of days to consider as "expiring soon" (default: 30)
 * @returns ExpiryResult or null if no expiration date
 */
export const getDocumentExpiryStatus = (
  expirationDate: string | null | undefined,
  thresholdDays = 30
): ExpiryResult | null => {
  if (!expirationDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(expirationDate);
  expDate.setHours(0, 0, 0, 0);
  
  const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilExpiry < 0) {
    return { status: 'expired', days: Math.abs(daysUntilExpiry) };
  }
  if (daysUntilExpiry <= thresholdDays) {
    return { status: 'expiring_soon', days: daysUntilExpiry };
  }
  return { status: 'normal', days: daysUntilExpiry };
};

/**
 * Check if a document is expired
 */
export const isExpired = (expirationDate: string | null | undefined): boolean => {
  const result = getDocumentExpiryStatus(expirationDate);
  return result?.status === 'expired';
};

/**
 * Check if a document is expiring soon
 */
export const isExpiringSoon = (
  expirationDate: string | null | undefined,
  thresholdDays = 30
): boolean => {
  const result = getDocumentExpiryStatus(expirationDate, thresholdDays);
  return result?.status === 'expiring_soon';
};

/**
 * Check if a document needs renewal (expired or expiring soon)
 */
export const needsRenewal = (
  expirationDate: string | null | undefined,
  thresholdDays = 30
): boolean => {
  const result = getDocumentExpiryStatus(expirationDate, thresholdDays);
  return result?.status === 'expired' || result?.status === 'expiring_soon';
};
