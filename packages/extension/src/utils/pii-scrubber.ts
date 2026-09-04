/**
 * Client-Side PII & Sensitive Data Scrubber
 * Redacts personally identifiable information before any thread snippet leaves the browser.
 * Supports custom workspace/team rules with ReDoS safe execution guards.
 */

export interface CustomPiiRule {
  id: string;
  team_id?: string;
  name?: string;
  pattern: string;
  replacement?: string;
  isRegex?: boolean;
  rule_type?: 'regex' | 'keyword';
  enabled?: boolean;
  created_at?: string;
}

export function scrubPII(text: string, customRules?: CustomPiiRule[]): string {
  if (!text) return '';

  let scrubbed = text;

  // 1. Evaluate Custom User/Workspace Rules First (with ReDoS safeguards)
  if (customRules && Array.isArray(customRules)) {
    for (const rule of customRules) {
      if (!rule || rule.enabled === false) continue;
      if (!rule.pattern || typeof rule.pattern !== 'string' || !rule.pattern.trim()) continue;

      const replacement = rule.replacement && rule.replacement.trim() ? rule.replacement.trim() : '[CUSTOM_REDACTED]';

      try {
        const isKeyword = rule.rule_type === 'keyword' || (!rule.rule_type && rule.isRegex === false);

        if (isKeyword) {
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const isWord = /^\w+(?:[\s-]+\w+)*$/.test(rule.pattern.trim());
          const keywordRegex = new RegExp(isWord ? `\\b${escaped}\\b` : escaped, 'gi');
          scrubbed = scrubbed.replace(keywordRegex, replacement);
        } else {
          // Regex rule: ReDoS vulnerability guard
          if (rule.pattern.length > 500) {
            console.warn(`[PII Scrubber] Custom rule pattern exceeds maximum safe length: "${rule.pattern.slice(0, 50)}..."`);
            continue;
          }

          // Reject patterns with dangerous nested quantifiers prone to catastrophic backtracking
          if (/(\([^\)]*[\+\*][^\)]*\))[\+\*]/.test(rule.pattern)) {
            console.warn(`[PII Scrubber] Potential ReDoS pattern rejected: "${rule.pattern}"`);
            continue;
          }

          const customRegex = new RegExp(rule.pattern, 'gi');
          scrubbed = scrubbed.replace(customRegex, replacement);
        }
      } catch (err) {
        // Safely catch invalid regex syntax without crashing execution
        console.warn(`[PII Scrubber] Invalid custom rule pattern: "${rule.pattern}"`, err);
      }
    }
  }

  // 2. Built-in Rule: Credit Card Numbers (13-19 digits with optional hyphens/spaces)
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');

  // 3. Built-in Rule: Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

  // 4. Built-in Rule: API Keys, JWTs & Auth Tokens (Bearer, JWT, sk-, ghp_, AKIA, api_key, etc.)
  scrubbed = scrubbed.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bsk-[a-zA-Z0-9_\-\.]{20,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bgh[pousr]_[a-zA-Z0-9]{30,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[TOKEN_REDACTED]');

  // 5. Built-in Rule: Passwords / Passcodes mentioned in thread
  scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');

  // 6. Built-in Rule: Social Security Numbers (SSN - USA)
  scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');

  // 7. Built-in Rule: IP Addresses (IPv4)
  scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');

  // 8. Built-in Rule: Phone numbers (US, UK, International formats, with/without country codes)
  scrubbed = scrubbed.replace(/(?:\b|\+)(?:\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, (match) => {
    // Only redact if string contains at least 7 digits to prevent redacting single short numbers
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? '[PHONE_REDACTED]' : match;
  });

  // 9. Built-in Rule: Street Addresses & P.O. Boxes
  scrubbed = scrubbed.replace(/\b(?:\d{1,6}\s+[A-Za-z0-9\s.,#-]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Suite|Ste|Apt|Apartment|Floor|Fl)\b(?:[,\s]+(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?)/gi, '[ADDRESS_REDACTED]');
  scrubbed = scrubbed.replace(/\b(?:P\.?\s*O\.?\s*Box\s+\d+)\b/gi, '[ADDRESS_REDACTED]');

  return scrubbed;
}

export default scrubPII;
