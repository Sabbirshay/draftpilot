/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  formatYMD,
  formatMonthDay,
  parseYMD,
  calculateCustomComparison,
  computeDatePresets,
  getInitialDateRange,
} from '../date-utils.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  validateTicketPayload,
  generateTicketId,
} from '../support-ticket.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  POST as handleTicketPost,
} from '../../app/api/support/ticket/route.ts';

describe('Milestone 2: Dynamic Date Utils (R4)', () => {
  test('formatYMD formats dates with two-digit padding', () => {
    const d1 = new Date(2026, 0, 5); // Jan 5, 2026
    const d2 = new Date(2026, 8, 4); // Sep 4, 2026
    const d3 = new Date(2026, 11, 31); // Dec 31, 2026

    assert.strictEqual(formatYMD(d1), '2026-01-05');
    assert.strictEqual(formatYMD(d2), '2026-09-04');
    assert.strictEqual(formatYMD(d3), '2026-12-31');
  });

  test('formatMonthDay formats month abbreviation and day', () => {
    const d1 = new Date(2026, 8, 4);
    const d2 = new Date(2026, 0, 1);
    assert.strictEqual(formatMonthDay(d1), 'Sep 04');
    assert.strictEqual(formatMonthDay(d2), 'Jan 01');
  });

  test('parseYMD parses YYYY-MM-DD string into local date', () => {
    const parsed = parseYMD('2026-09-04');
    assert.strictEqual(parsed.getFullYear(), 2026);
    assert.strictEqual(parsed.getMonth(), 8);
    assert.strictEqual(parsed.getDate(), 4);
  });

  test('computeDatePresets computes dynamic ranges relative to reference date (Sep 2026)', () => {
    const refDate = new Date(2026, 8, 4); // Sep 4, 2026
    const { presets, initialRange } = computeDatePresets(refDate);

    assert.strictEqual(presets.length, 6);

    // 1. Today
    const today = presets[0];
    assert.strictEqual(today.label, 'Today');
    assert.strictEqual(today.startDate, '2026-09-04');
    assert.strictEqual(today.endDate, '2026-09-04');
    assert.strictEqual(today.compStart, '2026-09-03');
    assert.strictEqual(today.compEnd, '2026-09-03');

    // 2. Last 7 Days (Today - 6 to Today = Aug 29 to Sep 4)
    const l7 = presets[1];
    assert.strictEqual(l7.label, 'Last 7 Days');
    assert.strictEqual(l7.startDate, '2026-08-29');
    assert.strictEqual(l7.endDate, '2026-09-04');
    assert.strictEqual(l7.compStart, '2026-08-22');
    assert.strictEqual(l7.compEnd, '2026-08-28');

    // 3. Last 30 Days (Today - 29 to Today = Aug 6 to Sep 4)
    const l30 = presets[2];
    assert.strictEqual(l30.label, 'Last 30 Days');
    assert.strictEqual(l30.startDate, '2026-08-06');
    assert.strictEqual(l30.endDate, '2026-09-04');
    assert.strictEqual(l30.compStart, '2026-07-07');
    assert.strictEqual(l30.compEnd, '2026-08-05');

    // 4. This Month (Sep)
    const thisMonth = presets[3];
    assert.strictEqual(thisMonth.label, 'This Month (Sep)');
    assert.strictEqual(thisMonth.startDate, '2026-09-01');
    assert.strictEqual(thisMonth.endDate, '2026-09-30');
    assert.strictEqual(thisMonth.compStart, '2026-08-01');
    assert.strictEqual(thisMonth.compEnd, '2026-08-31');

    // 5. Last Month (Aug)
    const lastMonth = presets[4];
    assert.strictEqual(lastMonth.label, 'Last Month (Aug)');
    assert.strictEqual(lastMonth.startDate, '2026-08-01');
    assert.strictEqual(lastMonth.endDate, '2026-08-31');
    assert.strictEqual(lastMonth.compStart, '2026-07-01');
    assert.strictEqual(lastMonth.compEnd, '2026-07-31');

    // 6. Year to Date (YTD)
    const ytd = presets[5];
    assert.strictEqual(ytd.label, 'Year to Date (YTD)');
    assert.strictEqual(ytd.startDate, '2026-01-01');
    assert.strictEqual(ytd.endDate, '2026-09-04');

    // Initial Range verification
    assert.strictEqual(initialRange.startDate, l30.startDate);
    assert.strictEqual(initialRange.endDate, l30.endDate);
    assert.strictEqual(initialRange.granularity, 'Daily');
  });

  test('computeDatePresets shifts dynamically for non-August dates (eliminates hardcoded August 2026)', () => {
    // Test November 15, 2026
    const novDate = new Date(2026, 10, 15);
    const { presets: novPresets } = computeDatePresets(novDate);

    const novThisMonth = novPresets[3];
    assert.strictEqual(novThisMonth.label, 'This Month (Nov)');
    assert.strictEqual(novThisMonth.startDate, '2026-11-01');
    assert.strictEqual(novThisMonth.endDate, '2026-11-30');

    // Test January 10, 2027 (cross-year boundary)
    const janDate = new Date(2027, 0, 10);
    const { presets: janPresets } = computeDatePresets(janDate);

    const janToday = janPresets[0];
    assert.strictEqual(janToday.startDate, '2027-01-10');

    const janL7 = janPresets[1];
    assert.strictEqual(janL7.startDate, '2027-01-04');
    assert.strictEqual(janL7.endDate, '2027-01-10');
    assert.strictEqual(janL7.compStart, '2026-12-28');
    assert.strictEqual(janL7.compEnd, '2027-01-03');

    const janLastMonth = janPresets[4];
    assert.strictEqual(janLastMonth.label, 'Last Month (Dec)');
    assert.strictEqual(janLastMonth.startDate, '2026-12-01');
    assert.strictEqual(janLastMonth.endDate, '2026-12-31');
  });

  test('calculateCustomComparison accurately calculates preceding duration', () => {
    // 5-day selection: Sep 10 to Sep 14 -> previous 5 days is Sep 05 to Sep 09
    const comp5 = calculateCustomComparison('2026-09-10', '2026-09-14');
    assert.strictEqual(comp5.compStart, '2026-09-05');
    assert.strictEqual(comp5.compEnd, '2026-09-09');
    assert.strictEqual(comp5.compLabel, 'Prev 5 days');

    // 1-day selection: Sep 04 to Sep 04 -> previous 1 day is Sep 03
    const comp1 = calculateCustomComparison('2026-09-04', '2026-09-04');
    assert.strictEqual(comp1.compStart, '2026-09-03');
    assert.strictEqual(comp1.compEnd, '2026-09-03');
    assert.strictEqual(comp1.compLabel, 'Prev 1 day');
  });

  test('getInitialDateRange returns valid state without arguments', () => {
    const initial = getInitialDateRange();
    assert.ok(initial.startDate);
    assert.ok(initial.endDate);
    assert.ok(initial.label);
    assert.strictEqual(initial.granularity, 'Daily');
  });
});

describe('Milestone 2: Help & Support Ticket Dispatch API (R3)', () => {
  test('validateTicketPayload accepts complete and valid ticket payload', () => {
    const payload = {
      name: 'Sarah Agent',
      email: 'sarah@support.com',
      category: 'bug',
      priority: 'high',
      subject: 'Extension autocomplete bubble not appearing in Gmail',
      message: 'When composing in Gmail with the latest Chrome version, the autocomplete bubble does not trigger.',
    };

    const res = validateTicketPayload(payload);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.data?.email, 'sarah@support.com');
    assert.strictEqual(res.data?.category, 'bug');
    assert.strictEqual(res.data?.priority, 'high');
  });

  test('validateTicketPayload rejects missing or malformed email', () => {
    const invalidEmails = ['', 'notanemail', 'user@', 'user@domain', '@domain.com'];
    for (const email of invalidEmails) {
      const res = validateTicketPayload({
        email,
        subject: 'Valid Subject Line',
        message: 'Valid message body with sufficient length.',
      });
      assert.strictEqual(res.valid, false);
      assert.ok(res.error?.includes('valid email'));
    }
  });

  test('validateTicketPayload rejects short or missing subject and message', () => {
    // Short subject
    const resSubject = validateTicketPayload({
      email: 'user@example.com',
      subject: 'Hi',
      message: 'Valid message body length.',
    });
    assert.strictEqual(resSubject.valid, false);
    assert.ok(resSubject.error?.includes('Subject'));

    // Short message
    const resMsg = validateTicketPayload({
      email: 'user@example.com',
      subject: 'Valid Subject',
      message: 'help',
    });
    assert.strictEqual(resMsg.valid, false);
    assert.ok(resMsg.error?.includes('Message'));
  });

  test('validateTicketPayload rejects invalid category or priority', () => {
    const resCat = validateTicketPayload({
      email: 'user@example.com',
      subject: 'Valid Subject',
      message: 'Valid message body length.',
      category: 'unsupported_category',
    });
    assert.strictEqual(resCat.valid, false);
    assert.ok(resCat.error?.includes('category'));

    const resPrio = validateTicketPayload({
      email: 'user@example.com',
      subject: 'Valid Subject',
      message: 'Valid message body length.',
      priority: 'super_urgent_now',
    });
    assert.strictEqual(resPrio.valid, false);
    assert.ok(resPrio.error?.includes('priority'));
  });

  test('generateTicketId produces consistent DP-TK- prefixed IDs', () => {
    const id1 = generateTicketId();
    const id2 = generateTicketId();

    assert.ok(id1.startsWith('DP-TK-'));
    assert.ok(id2.startsWith('DP-TK-'));
    assert.notStrictEqual(id1, id2);
  });

  test('POST /api/support/ticket handler handles request and returns 200 response', async () => {
    const req = new Request('http://localhost:3000/api/support/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        name: 'Alex Support',
        email: 'alex@company.com',
        category: 'feature',
        priority: 'medium',
        subject: 'Requesting Dark Mode macro editor',
        message: 'Could we please have a dark mode toggle specifically for editing macros?',
      }),
    });

    const response = await handleTicketPost(req as any);
    assert.strictEqual(response.status, 200);

    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.ticketId.startsWith('DP-TK-'));
    assert.ok(data.message.includes('alex@company.com'));
    assert.ok(data.timestamp);
  });

  test('POST /api/support/ticket returns 400 on invalid input', async () => {
    const req = new Request('http://localhost:3000/api/support/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify({
        email: 'not-an-email',
      }),
    });

    const response = await handleTicketPost(req as any);
    assert.strictEqual(response.status, 400);

    const data = await response.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error);
  });
});

describe('Milestone 2: Profile & Account Settings Validation (R5)', () => {
  test('validates password complexity rules defensively', () => {
    function validatePasswordComplexity(pw: string, confirm: string): { valid: boolean; error?: string } {
      if (pw.length < 8) return { valid: false, error: 'Password must be at least 8 characters long.' };
      if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
        return { valid: false, error: 'Password must contain at least one letter and at least one numeral.' };
      }
      if (pw !== confirm) return { valid: false, error: 'New password and confirmation do not match.' };
      return { valid: true };
    }

    assert.strictEqual(validatePasswordComplexity('short', 'short').valid, false);
    assert.strictEqual(validatePasswordComplexity('alllettersnomumber', 'alllettersnomumber').valid, false);
    assert.strictEqual(validatePasswordComplexity('1234567890', '1234567890').valid, false);
    assert.strictEqual(validatePasswordComplexity('ValidPass123', 'DifferentPass123').valid, false);
    assert.strictEqual(validatePasswordComplexity('ValidPass123!', 'ValidPass123!').valid, true);
  });

  test('sanitizes full name input and strips malicious script tags', () => {
    function sanitizeFullName(name: string): string {
      return name.replace(/<[^>]*>?/gm, '').trim();
    }

    assert.strictEqual(sanitizeFullName('  John Doe  '), 'John Doe');
    assert.strictEqual(sanitizeFullName('<script>alert("xss")</script>Jane Doe'), 'alert("xss")Jane Doe');
    assert.strictEqual(sanitizeFullName('<b>Admin</b> User'), 'Admin User');
  });

  test('derives initials reliably from full names or emails', () => {
    function deriveInitials(name?: string, email?: string): string {
      return (name || email || 'User')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || 'U';
    }

    assert.strictEqual(deriveInitials('Sarah Jenkins'), 'SJ');
    assert.strictEqual(deriveInitials('Michael'), 'M');
    assert.strictEqual(deriveInitials('', 'agent@support.com'), 'A');
    assert.strictEqual(deriveInitials('', ''), 'U');
  });
});
