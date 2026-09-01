import { scrubPII } from './pii-scrubber';

describe('API Server-Side PII Scrubber Utility', () => {
  it('should redact email addresses', () => {
    const text = 'Customer email is alice@company.org in inquiry.';
    expect(scrubPII(text)).toBe('Customer email is [EMAIL_REDACTED] in inquiry.');
  });

  it('should redact credit card numbers', () => {
    const text = 'Card number 4111 2222 3333 4444 charged.';
    expect(scrubPII(text)).toContain('[CARD_REDACTED]');
    expect(scrubPII(text)).not.toContain('4111');
  });

  it('should redact SSNs', () => {
    const text = 'Tax ID SSN 123-45-6789 provided.';
    expect(scrubPII(text)).toBe('Tax ID SSN [SSN_REDACTED] provided.');
  });

  it('should redact phone numbers', () => {
    const text = 'Call support at +1 (555) 234-5678 now.';
    expect(scrubPII(text)).toContain('[PHONE_REDACTED]');
    expect(scrubPII(text)).not.toContain('234-5678');
  });

  it('should redact street addresses and PO boxes', () => {
    const text1 = 'Deliver to 123 Main Street Suite 400.';
    const text2 = 'Mail to P.O. Box 9999.';
    expect(scrubPII(text1)).toContain('[ADDRESS_REDACTED]');
    expect(scrubPII(text2)).toContain('[ADDRESS_REDACTED]');
  });

  it('should redact IPv4 addresses', () => {
    const text = 'Client connected from 10.15.20.25.';
    expect(scrubPII(text)).toBe('Client connected from [IP_REDACTED].');
  });

  it('should redact API keys and tokens', () => {
    const text1 = 'Authorization: Bearer mySecretToken1234567890';
    const text2 = 'api_key: sk-proj-testkey1234567890abcdef';
    expect(scrubPII(text1)).toContain('[TOKEN_REDACTED]');
    expect(scrubPII(text2)).toContain('[TOKEN_REDACTED]');
  });

  it('should redact passwords and secrets', () => {
    const text = 'Your temporary password: SuperSecretPass123! should be changed.';
    expect(scrubPII(text)).toContain('[SECRET_REDACTED]');
    expect(scrubPII(text)).not.toContain('SuperSecretPass123!');
  });

  it('should preserve regular support dialogue without PII', () => {
    const clean = 'Can you please explain your 14-day warranty policy on wireless headphones?';
    expect(scrubPII(clean)).toBe(clean);
  });

  it('should handle falsy values gracefully', () => {
    expect(scrubPII('')).toBe('');
    expect(scrubPII(null as any)).toBe('');
    expect(scrubPII(undefined as any)).toBe('');
  });
});
