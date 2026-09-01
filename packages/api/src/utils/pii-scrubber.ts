/**
 * Server-Side PII & Sensitive Data Scrubber
 * Redacts personally identifiable information before storing in database or sending to LLM providers.
 */
export function scrubPII(text: string): string {
  if (!text) return '';

  let scrubbed = text;

  // 1. Credit Card Numbers (13-19 digits with optional hyphens/spaces)
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');

  // 2. Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

  // 3. API Keys, JWTs & Auth Tokens (Bearer, JWT, sk-, ghp_, AKIA, api_key, etc.)
  scrubbed = scrubbed.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bsk-[a-zA-Z0-9_\-\.]{20,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bgh[pousr]_[a-zA-Z0-9]{30,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[TOKEN_REDACTED]');

  // 4. Passwords / Passcodes mentioned in thread
  scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');

  // 5. Social Security Numbers (SSN - USA)
  scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');

  // 6. IP Addresses (IPv4)
  scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');

  // 7. Phone numbers (US, UK, International formats, with/without country codes)
  scrubbed = scrubbed.replace(/(?:\b|\+)(?:\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, (match) => {
    // Only redact if string contains at least 7 digits to prevent redacting single short numbers
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? '[PHONE_REDACTED]' : match;
  });

  // 8. Street Addresses & P.O. Boxes (e.g., 123 Main St, 456 Broadway Ave Apt 4B, P.O. Box 789)
  scrubbed = scrubbed.replace(/\b(?:\d{1,6}\s+[A-Za-z0-9\s.,#-]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Suite|Ste|Apt|Apartment|Floor|Fl)\b(?:[,\s]+(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?)/gi, '[ADDRESS_REDACTED]');
  scrubbed = scrubbed.replace(/\b(?:P\.?\s*O\.?\s*Box\s+\d+)\b/gi, '[ADDRESS_REDACTED]');

  return scrubbed;
}

export default scrubPII;
