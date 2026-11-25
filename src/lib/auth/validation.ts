export interface CountryDialCode {
  code: string;
  iso: string;
  flag: string;
  name: string;
  minDigits: number;
  maxDigits: number;
}

export const COUNTRY_CODES: CountryDialCode[] = [
  { code: '+91', iso: 'IN', flag: '🇮🇳', name: 'India', minDigits: 10, maxDigits: 10 },
  { code: '+1', iso: 'US', flag: '🇺🇸', name: 'United States', minDigits: 10, maxDigits: 10 },
  { code: '+44', iso: 'GB', flag: '🇬🇧', name: 'United Kingdom', minDigits: 10, maxDigits: 11 },
  { code: '+971', iso: 'AE', flag: '🇦🇪', name: 'United Arab Emirates', minDigits: 9, maxDigits: 9 },
  { code: '+65', iso: 'SG', flag: '🇸🇬', name: 'Singapore', minDigits: 8, maxDigits: 8 },
  { code: '+61', iso: 'AU', flag: '🇦🇺', name: 'Australia', minDigits: 9, maxDigits: 9 },
  { code: '+49', iso: 'DE', flag: '🇩🇪', name: 'Germany', minDigits: 10, maxDigits: 12 },
];

export interface MobileValidationResult {
  valid: boolean;
  sanitizedDigits: string;
  e164: string;
  error?: string;
}

/**
 * Normalizes and validates mobile numbers strictly against selected country rules.
 * For India (+91), requires exactly 10 digits starting with 6, 7, 8, or 9.
 */
export function validateMobileNumber(dialCode: string, rawInput: string): MobileValidationResult {
  const digits = rawInput.replace(/\D/g, '');
  const country = COUNTRY_CODES.find((c) => c.code === dialCode) || COUNTRY_CODES[0];

  if (!digits) {
    return {
      valid: false,
      sanitizedDigits: '',
      e164: '',
      error: 'Please enter your mobile number.',
    };
  }

  if (country.code === '+91') {
    if (!/^[6-9]\d{9}$/.test(digits)) {
      return {
        valid: false,
        sanitizedDigits: digits,
        e164: '',
        error: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      };
    }
    return {
      valid: true,
      sanitizedDigits: digits,
      e164: `+91${digits}`,
    };
  }

  if (digits.length < country.minDigits || digits.length > country.maxDigits) {
    return {
      valid: false,
      sanitizedDigits: digits,
      e164: '',
      error: `Enter a valid ${country.name} mobile number (${country.minDigits}${
        country.minDigits === country.maxDigits ? '' : `–${country.maxDigits}`
      } digits).`,
    };
  }

  return {
    valid: true,
    sanitizedDigits: digits,
    e164: `${country.code}${digits}`,
  };
}

export function validateEmailAddress(rawEmail: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = rawEmail.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, normalized: '', error: 'Please enter your email address.' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(normalized)) {
    return { valid: false, normalized, error: 'Please enter a valid email address.' };
  }
  return { valid: true, normalized };
}

export function evaluatePasswordStrength(password: string): {
  isMinLength: boolean;
  hasNumberOrSpecial: boolean;
  score: 0 | 1 | 2 | 3;
} {
  const isMinLength = password.length >= 6;
  const hasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const rawScore =
    (isMinLength ? 1 : 0) + (password.length >= 8 ? 1 : 0) + (hasNumberOrSpecial ? 1 : 0);
  return {
    isMinLength,
    hasNumberOrSpecial,
    score: rawScore as 0 | 1 | 2 | 3,
  };
}

/**
 * Prevents client-side CWE-601 open redirects from query strings such as `?redirectTo=`.
 */
export function sanitizeNextRedirect(
  nextUrl: string | null | undefined,
  defaultPath = '/'
): string {
  if (!nextUrl || typeof nextUrl !== 'string') return defaultPath;
  const trimmed = nextUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return defaultPath;
  }
  if (/^[a-zA-Z0-9+.-]+:/.test(trimmed)) {
    return defaultPath;
  }
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return defaultPath;
  }
  return trimmed;
}
