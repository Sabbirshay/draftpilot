/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scrubPII } from '../pii-scrubber.ts';

describe('P2-Finding 5: PII Scrubber Redaction Gaps', () => {
  test('redacts email addresses', () => {
    const input = 'Please contact me at customer.john@example.com for order updates.';
    const output = scrubPII(input);
    assert.strictEqual(output, 'Please contact me at [EMAIL_REDACTED] for order updates.');
  });

  test('redacts credit card numbers', () => {
    const input = 'My Visa card is 4532 0150 1234 5678 and exp is 12/28.';
    const output = scrubPII(input);
    assert.ok(output.includes('[CARD_REDACTED]'));
    assert.ok(!output.includes('4532'));
  });

  test('redacts US Social Security Numbers', () => {
    const input = 'SSN is 123-45-6789 on the form.';
    const output = scrubPII(input);
    assert.strictEqual(output, 'SSN is [SSN_REDACTED] on the form.');
  });

  test('redacts domestic and international phone numbers (with & without country code)', () => {
    const usPhone = 'Call me at 555-123-4567 or (800) 555-0199.';
    const intlPhone = 'UK mobile is +44 7911 123456 or 07911 123456.';
    
    assert.ok(scrubPII(usPhone).includes('[PHONE_REDACTED]'));
    assert.ok(scrubPII(intlPhone).includes('[PHONE_REDACTED]'));
  });

  test('redacts street addresses and PO boxes', () => {
    const address1 = 'Ship my parcel to 742 Evergreen Terrace Apt 4B please.';
    const address2 = 'Our office is located at 1600 Amphitheatre Pkwy Suite 200.';
    const poBox = 'Send returns to P.O. Box 4567.';

    assert.ok(scrubPII(address1).includes('[ADDRESS_REDACTED]'));
    assert.ok(scrubPII(address2).includes('[ADDRESS_REDACTED]'));
    assert.ok(scrubPII(poBox).includes('[ADDRESS_REDACTED]'));
  });

  test('redacts API keys, bearer tokens and passwords', () => {
    const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and password: mysecretpassword123';
    const output = scrubPII(input);
    assert.ok(output.includes('[TOKEN_REDACTED]'));
    assert.ok(output.includes('[SECRET_REDACTED]'));
  });

  test('redacts standalone JWT tokens without Bearer prefix', () => {
    const jwt = 'Here is the raw token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c for verification';
    const output = scrubPII(jwt);
    assert.strictEqual(output, 'Here is the raw token: [TOKEN_REDACTED] for verification');
    assert.ok(!output.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
  });

  test('redacts standalone OpenAI sk- keys, GitHub tokens, and AWS keys', () => {
    const openAi = 'My key is sk-proj-12345678901234567890abcdef1234567890 in config.';
    const ghp = 'GitHub token is ghp_1234567890abcdefghijklmnopqrstuvwxyz12.';
    const aws = 'AWS key is AKIAIOSFODNN7EXAMPLE in config.';

    assert.ok(scrubPII(openAi).includes('[TOKEN_REDACTED]'));
    assert.ok(scrubPII(ghp).includes('[TOKEN_REDACTED]'));
    assert.ok(scrubPII(aws).includes('[TOKEN_REDACTED]'));
    assert.ok(!scrubPII(openAi).includes('1234567890abcdef1234567890'));
  });

  test('preserves clean non-PII support inquiry text untouched', () => {
    const clean = 'Hi, what is your standard 30-day refund policy for medium t-shirts?';
    assert.strictEqual(scrubPII(clean), clean);
  });
});
