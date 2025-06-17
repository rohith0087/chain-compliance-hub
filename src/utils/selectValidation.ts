
/**
 * Validation utilities for Select components to prevent empty string errors
 */

export const validateSelectValue = (value: unknown): string => {
  if (typeof value !== 'string') {
    console.warn('validateSelectValue: Non-string value detected', value);
    return 'fallback';
  }
  
  if (value.trim() === '') {
    console.warn('validateSelectValue: Empty string detected');
    return 'fallback';
  }
  
  return value;
};

export const sanitizeSelectOptions = <T extends { value?: string }>(options: T[]): T[] => {
  return options.filter(option => {
    if (!option.value || option.value.trim() === '') {
      console.warn('sanitizeSelectOptions: Filtered out empty option', option);
      return false;
    }
    return true;
  });
};

export const createSafeSelectValue = (value: string | undefined, fallback: string = 'all'): string => {
  if (!value || value.trim() === '') {
    return fallback;
  }
  return value;
};
