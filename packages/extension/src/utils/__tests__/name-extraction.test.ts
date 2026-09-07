/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractSenderName, cleanAiDraft } from '../api-client.ts';

describe('Extension Name Extraction & Greeting Normalization', () => {
  test('extractSenderName: "Dear concern," returns "there"', () => {
    const input = 'Dear concern,\n\nI want to join you as a partner.';
    const result = extractSenderName(input);
    assert.strictEqual(result, 'there');
  });

  test('extractSenderName: "Dear sir/madam," returns "there"', () => {
    const input = 'Dear sir/madam,\n\nCould you check on this issue?';
    const result = extractSenderName(input);
    assert.strictEqual(result, 'there');
  });

  test('extractSenderName: "Hello customer," returns "there"', () => {
    const input = 'Hello customer,\n\nHere is the information you requested.';
    const result = extractSenderName(input);
    assert.strictEqual(result, 'there');
  });

  test('extractSenderName: parses personal name from greeting', () => {
    const input = 'Hi Rebecca,\n\nLooking forward to speaking with you.';
    const result = extractSenderName(input);
    assert.strictEqual(result, 'Rebecca');
  });

  test('cleanAiDraft: produces "Hi there," when customer name defaults to "there"', () => {
    const raw = 'Hi [Name],\n\nThank you for reaching out to DraftPilot!';
    const result = cleanAiDraft(raw, 'there');
    assert.strictEqual(result, 'Hi there,\n\nThank you for reaching out to DraftPilot!');
  });
});
