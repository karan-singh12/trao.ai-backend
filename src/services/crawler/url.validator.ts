export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  reason?: string;
  isLocalOrPrivate?: boolean;
  parsedUrl?: URL;
}

const PRIVATE_IP_PATTERNS = [
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, // 127.0.0.0/8
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,  // 10.0.0.0/8
  /^192\.168\.\d{1,3}\.\d{1,3}$/,     // 192.168.0.0/16
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/, // 172.16.0.0/12
  /^169\.254\.\d{1,3}\.\d{1,3}$/,    // 169.254.0.0/16 (Link Local / Cloud Metadata)
  /^::1$/,                            // IPv6 localhost
  /^0\.0\.0\.0$/,
];

export class UrlValidator {
  /**
   * Validates and normalizes target URLs, guarding against SSRF in production.
   */
  static validate(rawUrl: string): UrlValidationResult {
    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return { isValid: false, reason: 'URL string is empty or missing' };
    }

    let parsed: URL;
    try {
      let normalizedInput = rawUrl.trim();
      // If no scheme present (e.g. "example.com" or "www.acme.com"), default to https://
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(normalizedInput)) {
        normalizedInput = `https://${normalizedInput}`;
      }

      parsed = new URL(normalizedInput);
    } catch {
      return { isValid: false, reason: 'Malformed URL format' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, reason: `Unsupported protocol: ${parsed.protocol}. Only http and https are allowed.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    const isLocal =
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));

    // In production, block SSRF unless explicitly allowed for assessment evaluation
    const isProduction = process.env.NODE_ENV === 'production';
    const allowLocal = process.env.ALLOW_LOCAL_URLS === 'true' || process.env.NODE_ENV === 'test';

    if (isLocal && isProduction && !allowLocal) {
      return {
        isValid: false,
        isLocalOrPrivate: true,
        reason: 'Access to private and loopback addresses is restricted in production',
      };
    }

    return {
      isValid: true,
      sanitizedUrl: parsed.toString(),
      isLocalOrPrivate: isLocal,
      parsedUrl: parsed,
    };
  }
}

export default UrlValidator;
