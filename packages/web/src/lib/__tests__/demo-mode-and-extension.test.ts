/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  DEMO_TICKETS,
  DEMO_MACROS,
  synthesizeDemoDraft,
  type DemoTicket,
} from '../../data/demo-data.ts';
import {
  compareExtensionVersions,
  readExtensionDomStatus,
  CURRENT_EXTENSION_VERSION,
} from '../../hooks/useExtensionStatus.ts';

describe('Milestone 1: Activation & Pairing (R1: Demo Mode & R2: Extension Handshake)', () => {
  describe('R1: Interactive Demo Data & Ticket Fixtures', () => {
    test('provides exactly 4 realistic support ticket fixtures', () => {
      assert.strictEqual(DEMO_TICKETS.length, 4);
    });

    test('covers all 4 mandatory customer support categories', () => {
      const categories = DEMO_TICKETS.map((t) => t.category);
      assert.ok(categories.includes('return_refund'), 'Must include return_refund');
      assert.ok(categories.includes('shipping_status'), 'Must include shipping_status');
      assert.ok(categories.includes('password_reset'), 'Must include password_reset');
      assert.ok(categories.includes('billing_question'), 'Must include billing_question');
    });

    test('each ticket contains required fields: id, customer info, thread, and unredacted PII snippet', () => {
      for (const ticket of DEMO_TICKETS) {
        assert.ok(ticket.id && typeof ticket.id === 'string', 'Ticket id must be non-empty string');
        assert.ok(ticket.customerName && typeof ticket.customerName === 'string', 'Customer name must be non-empty string');
        assert.ok(ticket.customerEmail && ticket.customerEmail.includes('@'), 'Customer email must be valid email format');
        assert.ok(ticket.subject && typeof ticket.subject === 'string', 'Subject must be non-empty');
        assert.ok(Array.isArray(ticket.thread) && ticket.thread.length > 0, 'Thread must contain at least 1 message');
        assert.ok(ticket.thread[0].sender, 'Message must have sender');
        assert.ok(ticket.thread[0].body, 'Message must have body');
        assert.ok(ticket.unredactedPiiSnippet && typeof ticket.unredactedPiiSnippet === 'string', 'Unredacted PII snippet must exist');
      }
    });

    test('Return/Refund ticket contains realistic unredacted credit card and email PII', () => {
      const refundTicket = DEMO_TICKETS.find((t) => t.category === 'return_refund');
      assert.ok(refundTicket, 'Refund ticket must exist');
      const threadBody = refundTicket.thread[0].body;
      assert.ok(threadBody.includes('4111-2222-3333-4444'), 'Must contain unredacted Visa card number');
      assert.ok(threadBody.includes('sarah.martinez@acmecorp.com'), 'Must contain unredacted customer email');
      assert.ok(refundTicket.unredactedPiiSnippet.includes('4111-2222-3333-4444'));
    });

    test('Shipping Status ticket contains realistic address and phone number PII', () => {
      const shippingTicket = DEMO_TICKETS.find((t) => t.category === 'shipping_status');
      assert.ok(shippingTicket, 'Shipping ticket must exist');
      const threadBody = shippingTicket.thread[0].body;
      assert.ok(threadBody.includes('742 Evergreen Terrace'), 'Must contain unredacted address');
      assert.ok(threadBody.includes('555-832-1920'), 'Must contain unredacted phone number');
      assert.ok(shippingTicket.unredactedPiiSnippet.includes('742 Evergreen Terrace'));
    });

    test('Password Reset ticket contains realistic secret passcode and IP address PII', () => {
      const passwordTicket = DEMO_TICKETS.find((t) => t.category === 'password_reset');
      assert.ok(passwordTicket, 'Password ticket must exist');
      const threadBody = passwordTicket.thread[0].body;
      assert.ok(threadBody.includes('SecretReset2026!'), 'Must contain unredacted passcode');
      assert.ok(threadBody.includes('192.168.1.105'), 'Must contain unredacted IP address');
      assert.ok(passwordTicket.unredactedPiiSnippet.includes('192.168.1.105'));
    });

    test('Billing Question ticket contains invoice ID and card ending PII', () => {
      const billingTicket = DEMO_TICKETS.find((t) => t.category === 'billing_question');
      assert.ok(billingTicket, 'Billing ticket must exist');
      const threadBody = billingTicket.thread[0].body;
      assert.ok(threadBody.includes('INV-2026-908'), 'Must contain invoice reference');
      assert.ok(threadBody.includes('5412-7512-3412-9012'), 'Must contain card number');
      assert.ok(billingTicket.unredactedPiiSnippet.includes('INV-2026-908'));
    });
  });

  describe('R1: synthesizeDemoDraft Functionality & Modulations', () => {
    test('synthesizes draft with zero auth and realistic simulated speed (~0.3s)', () => {
      const ticket = DEMO_TICKETS[0];
      const result = synthesizeDemoDraft(ticket, 'empathetic');

      assert.ok(result.draft && typeof result.draft === 'string', 'Must produce draft text');
      assert.ok(result.generationTimeMs >= 250 && result.generationTimeMs <= 400, `Speed should simulate ~0.3s, got: ${result.generationTimeMs}ms`);
      assert.strictEqual(result.appliedTone, 'empathetic');
    });

    test('applies client-side PII scrubbing and returns redacted thread and count', () => {
      const refundTicket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const result = synthesizeDemoDraft(refundTicket, 'empathetic');

      assert.ok(result.scrubbedCount > 0, 'Must record scrubbed PII entities count');
      assert.ok(result.redactedThread.includes('[CARD_REDACTED]'), 'Credit card must be redacted');
      assert.ok(result.redactedThread.includes('[EMAIL_REDACTED]'), 'Customer email must be redacted');
      assert.ok(!result.redactedThread.includes('4111-2222-3333-4444'), 'Raw card number must not appear in redacted thread');
    });

    test('redacts secrets and IP addresses in password reset ticket', () => {
      const passwordTicket = DEMO_TICKETS.find((t) => t.category === 'password_reset')!;
      const result = synthesizeDemoDraft(passwordTicket, 'concise');

      assert.ok(result.redactedThread.includes('[SECRET_REDACTED]'), 'Passcode must be redacted');
      assert.ok(result.redactedThread.includes('[IP_REDACTED]'), 'IP address must be redacted');
      assert.ok(!result.redactedThread.includes('192.168.1.105'), 'Raw IP must not appear in redacted thread');
    });

    test('tone modulation: produces distinct phrasing for Empathetic tone', () => {
      const ticket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const result = synthesizeDemoDraft(ticket, 'empathetic');

      assert.strictEqual(result.appliedTone, 'empathetic');
      const lowerDraft = result.draft.toLowerCase();
      assert.ok(lowerDraft.includes('sorry') || lowerDraft.includes('apologize') || lowerDraft.includes('disappointing'), 'Empathetic tone must express warmth/apology');
      assert.ok(result.draft.includes('Sarah'), 'Must personalize draft with customer name');
    });

    test('tone modulation: produces compact action bullets for Concise tone', () => {
      const ticket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const result = synthesizeDemoDraft(ticket, 'concise');

      assert.strictEqual(result.appliedTone, 'concise');
      assert.ok(result.draft.includes('•') || result.draft.includes('-') || result.draft.includes(':'), 'Concise tone must use bulleted or direct syntax');
      assert.ok(result.draft.length < 500, 'Concise tone draft must be brief');
    });

    test('tone modulation: produces formal enterprise structure for Formal tone', () => {
      const ticket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const result = synthesizeDemoDraft(ticket, 'formal');

      assert.strictEqual(result.appliedTone, 'formal');
      assert.ok(result.draft.includes('Dear') || result.draft.includes('Sincerely'), 'Formal tone must include formal salutation or sign-off');
      assert.ok(result.draft.includes('regret') || result.draft.includes('authorized') || result.draft.includes('Customer Operations'));
    });

    test('tone modulation: produces escalation language for Urgent tone', () => {
      const ticket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const result = synthesizeDemoDraft(ticket, 'urgent');

      assert.strictEqual(result.appliedTone, 'urgent');
      const lowerDraft = result.draft.toLowerCase();
      assert.ok(lowerDraft.includes('priority') || lowerDraft.includes('escalat') || lowerDraft.includes('immediate'), 'Urgent tone must include priority/urgency markers');
    });

    test('tone modulation: defaults safely to empathetic when unrecognized tone provided', () => {
      const ticket = DEMO_TICKETS[0];
      const result = synthesizeDemoDraft(ticket, 'unknown_tone_xyz');
      assert.strictEqual(result.appliedTone, 'empathetic');
    });

    test('macro application: seamlessly incorporates knowledge macro into synthesized draft', () => {
      const ticket = DEMO_TICKETS.find((t) => t.category === 'return_refund')!;
      const macro = DEMO_MACROS[0]; // Refund Request macro
      const result = synthesizeDemoDraft(ticket, 'empathetic', macro.id);

      assert.strictEqual(result.appliedMacroId, macro.id);
      assert.ok(result.draft.includes(macro.content), 'Draft must contain macro content');
    });

    test('macro application: handles invalid or undefined macroId gracefully', () => {
      const ticket = DEMO_TICKETS[1];
      const resultWithoutMacro = synthesizeDemoDraft(ticket, 'concise');
      assert.strictEqual(resultWithoutMacro.appliedMacroId, undefined);

      const resultWithInvalidMacro = synthesizeDemoDraft(ticket, 'concise', 'non-existent-macro-id');
      assert.strictEqual(resultWithInvalidMacro.appliedMacroId, 'non-existent-macro-id');
      assert.ok(resultWithInvalidMacro.draft.length > 50);
    });
  });

  describe('R2: Authentic Extension Detection & Version Comparison', () => {
    test('compares extension versions accurately', () => {
      // Equal versions
      assert.strictEqual(compareExtensionVersions('0.1.0', '0.1.0'), 0);
      assert.strictEqual(compareExtensionVersions('v0.1.0', '0.1.0'), 0);

      // Outdated versions (< 0.1.0)
      assert.strictEqual(compareExtensionVersions('0.0.9', '0.1.0'), -1);
      assert.strictEqual(compareExtensionVersions('0.0.1', '0.1.0'), -1);
      assert.strictEqual(compareExtensionVersions('0.0.99', '0.1.0'), -1);

      // Newer versions (> 0.1.0)
      assert.strictEqual(compareExtensionVersions('0.1.1', '0.1.0'), 1);
      assert.strictEqual(compareExtensionVersions('0.2.0', '0.1.0'), 1);
      assert.strictEqual(compareExtensionVersions('1.0.0', '0.1.0'), 1);
    });

    test('detects extension installation from DOM attributes (synchronous handshake)', () => {
      // Simulate DOM element in node test environment
      const fakeDoc = {
        documentElement: {
          getAttribute(attr: string) {
            if (attr === 'data-draftpilot-extension-installed') return 'true';
            if (attr === 'data-draftpilot-extension-version') return '0.1.0';
            if (attr === 'data-draftpilot-extension-status') return 'ready';
            return null;
          },
        },
      };

      const originalDoc = (globalThis as any).document;
      try {
        (globalThis as any).document = fakeDoc;
        const domStatus = readExtensionDomStatus();
        assert.strictEqual(domStatus.installed, true);
        assert.strictEqual(domStatus.version, '0.1.0');
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    test('detects outdated extension version from DOM attributes', () => {
      const fakeDoc = {
        documentElement: {
          getAttribute(attr: string) {
            if (attr === 'data-draftpilot-extension-installed') return 'true';
            if (attr === 'data-draftpilot-extension-version') return '0.0.8';
            return null;
          },
        },
      };

      const originalDoc = (globalThis as any).document;
      try {
        (globalThis as any).document = fakeDoc;
        const domStatus = readExtensionDomStatus();
        assert.strictEqual(domStatus.installed, true);
        assert.strictEqual(domStatus.version, '0.0.8');
        assert.ok(compareExtensionVersions(domStatus.version, CURRENT_EXTENSION_VERSION) < 0, 'Should be flagged as outdated');
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    test('reports not installed when DOM attributes are missing', () => {
      const fakeDoc = {
        documentElement: {
          getAttribute() {
            return null;
          },
        },
      };

      const originalDoc = (globalThis as any).document;
      try {
        (globalThis as any).document = fakeDoc;
        const domStatus = readExtensionDomStatus();
        assert.strictEqual(domStatus.installed, false);
        assert.strictEqual(domStatus.version, null);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    test('CURRENT_EXTENSION_VERSION constant matches 0.1.0', () => {
      assert.strictEqual(CURRENT_EXTENSION_VERSION, '0.1.0');
    });
  });
});
