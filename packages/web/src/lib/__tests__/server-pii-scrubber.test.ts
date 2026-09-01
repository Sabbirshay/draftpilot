/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scrubPII } from '../pii-scrubber.ts';

describe('Milestone 2: Server-Side PII & Sensitive Data Scrubber', () => {
  test('redacts email addresses in customer inquiries', () => {
    const input = 'Please contact me at customer.john.doe+support@example.co.uk or admin@startup.io for account assistance.';
    const output = scrubPII(input);
    assert.strictEqual(output, 'Please contact me at [EMAIL_REDACTED] or [EMAIL_REDACTED] for account assistance.');
  });

  test('redacts credit card numbers (Visa, Mastercard, Amex, formatted with spaces/hyphens or raw)', () => {
    const input1 = 'My Visa card is 4532 0150 1234 5678 and exp is 12/28.';
    const input2 = 'Card number: 4532-0150-1234-5678.';
    const input3 = 'Amex 378282246310005 on file.';
    
    assert.ok(scrubPII(input1).includes('[CARD_REDACTED]'));
    assert.ok(!scrubPII(input1).includes('4532'));
    assert.ok(scrubPII(input2).includes('[CARD_REDACTED]'));
    assert.ok(scrubPII(input3).includes('[CARD_REDACTED]'));
  });

  test('redacts US Social Security Numbers (SSN)', () => {
    const input = 'My SSN is 123-45-6789 and my spouse SSN is 987 65 4321 on tax forms.';
    const output = scrubPII(input);
    assert.ok(output.includes('[SSN_REDACTED]'));
    assert.ok(!output.includes('123-45-6789'));
    assert.ok(!output.includes('987 65 4321'));
  });

  test('redacts US and international phone numbers', () => {
    const usPhone = 'Reach us at 555-123-4567 or +1 (800) 555-0199.';
    const ukPhone = 'UK direct line is +44 7911 123456 or 07911 123456.';
    
    const scrubbedUs = scrubPII(usPhone);
    const scrubbedUk = scrubPII(ukPhone);
    
    assert.ok(scrubbedUs.includes('[PHONE_REDACTED]'));
    assert.ok(!scrubbedUs.includes('555-123-4567'));
    assert.ok(scrubbedUk.includes('[PHONE_REDACTED]'));
  });

  test('redacts physical street addresses and PO Boxes', () => {
    const address1 = 'Please ship the replacement to 742 Evergreen Terrace Apt 4B, Springfield.';
    const address2 = 'Our headquarters is at 1600 Amphitheatre Pkwy Suite 200, Mountain View.';
    const poBox = 'Return all damaged items to P.O. Box 4567.';
    const poBox2 = 'Send mail to PO Box 8890.';

    assert.ok(scrubPII(address1).includes('[ADDRESS_REDACTED]'));
    assert.ok(scrubPII(address2).includes('[ADDRESS_REDACTED]'));
    assert.ok(scrubPII(poBox).includes('[ADDRESS_REDACTED]'));
    assert.ok(scrubPII(poBox2).includes('[ADDRESS_REDACTED]'));
  });

  test('redacts IPv4 network addresses', () => {
    const input = 'Originating server IP is 192.168.1.105 and client gateway 10.0.0.1.';
    const output = scrubPII(input);
    assert.strictEqual(output, 'Originating server IP is [IP_REDACTED] and client gateway [IP_REDACTED].');
  });

  test('redacts API tokens, bearer keys, and sk- prefixes', () => {
    const input1 = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret';
    const input2 = 'api_key: sk-proj-1234567890abcdef1234567890';
    const input3 = 'Using key sk-or-v1-abcdef12345678901234567890abcdef for testing';

    assert.ok(scrubPII(input1).includes('[TOKEN_REDACTED]'));
    assert.ok(scrubPII(input2).includes('[TOKEN_REDACTED]'));
    assert.ok(scrubPII(input3).includes('[TOKEN_REDACTED]'));
    assert.ok(!scrubPII(input3).includes('sk-or-v1-'));
  });

  test('redacts passwords, passcodes, and secrets', () => {
    const input = 'Temporary credentials: password: MySuperSecretPassword123! passcode=998811 pin: 4321';
    const output = scrubPII(input);
    assert.ok(output.includes('[SECRET_REDACTED]'));
    assert.ok(!output.includes('MySuperSecretPassword123!'));
    assert.ok(!output.includes('998811'));
  });

  test('preserves clean non-PII customer inquiries and support questions', () => {
    const inquiry = 'Hello team, how do I configure dark mode and export draft history as CSV in DraftPilot?';
    const output = scrubPII(inquiry);
    assert.strictEqual(output, inquiry);
  });

  test('handles null, undefined, or empty string gracefully', () => {
    assert.strictEqual(scrubPII(''), '');
    assert.strictEqual(scrubPII(null as any), '');
    assert.strictEqual(scrubPII(undefined as any), '');
  });
});
