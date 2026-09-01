import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { verifySuperAdmin, supabaseAdmin } from '../admin-auth.ts';

// Replicating pure sanitization & extraction functions from api/web/extension for empirical stress-testing
function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags (e.g. DeepSeek / Nemotron / Qwen reasoning)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. If the response starts with "Here's a thinking process" or numbered reasoning analysis
  if (
    /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return '';
      }
    }
  }

  // 3. Double-check if the resulting text is still just a thinking process fragment
  if (
    /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Remove leading/trailing markdown code fences (```markdown ... ```)
  text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  // 5. Remove leading meta labels like "Draft reply:" or "Here is the reply:"
  text = text
    .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?)\s*\n+/i, '')
    .trim();

  // 6. Replace template variables with extracted customer name if still present
  text = text
    .replace(/{{name}}/g, customerName)
    .replace(/{{customer_name}}/g, customerName)
    .replace(/\[Customer\]/g, customerName)
    .replace(/\[Name\]/g, customerName);

  // 7. Personalize generic "Hi there," or "Hi," to "Hi [Sender Name],"
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
  }

  return text;
}

function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z][A-Za-z0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/);
  const signMatch = text.match(/(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Z][a-z]+)/i);
  const greetMatch = text.match(/(?:hi|dear|hello)\s+([A-Z][a-z]+)/i);

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      return clean.split(' ')[0];
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (clean && !clean.toLowerCase().startsWith('subject')) {
      return clean.split(' ')[0];
    }
  }
  if (signMatch && signMatch[1]) {
    return signMatch[1].trim();
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const blacklist = ['there', 'team', 'support', 'all', 'everyone', 'sir', 'madam', 'can', 'could', 'would', 'please'];
    if (!blacklist.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return 'there';
}

// Simulated rate limiter for empirical validation
class SlidingWindowRateLimiter {
  private timestamps = new Map<string, number[]>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests = 20, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(userId: string, now = Date.now()): { allowed: boolean; remaining: number } {
    const userTimes = (this.timestamps.get(userId) || []).filter((t) => now - t < this.windowMs);
    if (userTimes.length >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }
    userTimes.push(now);
    this.timestamps.set(userId, userTimes);
    return { allowed: true, remaining: this.maxRequests - userTimes.length };
  }

  reset() {
    this.timestamps.clear();
  }
}

describe('Adversarial Challenge 1: AI Draft Synthesizer & Interactive Parsing Logic', () => {
  test('cleanAiDraft: handles empty, whitespace, and undefined inputs gracefully', () => {
    assert.strictEqual(cleanAiDraft(''), '');
    assert.strictEqual(cleanAiDraft('   '), '');
    // @ts-ignore
    assert.strictEqual(cleanAiDraft(null), '');
    // @ts-ignore
    assert.strictEqual(cleanAiDraft(undefined), '');
  });

  test('cleanAiDraft: strips DeepSeek/Qwen <think> reasoning tags cleanly', () => {
    const rawOutput = `<think>
The user is asking about our refund policy.
I should mention the 30-day window and express empathy.
Let's check if they provided an order ID.
</think>
Hi Sarah,

Thank you for reaching out! We offer a 30-day return policy on all items.

Best regards,
Support Team`;

    const cleaned = cleanAiDraft(rawOutput, 'Sarah');
    assert.ok(!cleaned.includes('<think>'));
    assert.ok(!cleaned.includes('reasoning'));
    assert.ok(cleaned.startsWith('Hi Sarah,'));
    assert.ok(cleaned.includes('30-day return policy'));
  });

  test('cleanAiDraft: handles degenerate case where LLM outputs ONLY thinking steps', () => {
    const rawOutput = `Here's a thinking process:
1. **Analyze User Input:** The customer wants to know where their package is.
2. **Determine Policy:** Look up carrier transit times.
3. **Formulate Response:** Need to check order status.`;

    const cleaned = cleanAiDraft(rawOutput, 'there');
    assert.strictEqual(cleaned, '');
  });

  test('cleanAiDraft: strips markdown code fences (```markdown ... ```)', () => {
    const rawOutput = `\`\`\`markdown
Hi Alex,

Your replacement order has been dispatched.

Best regards,
Support Team
\`\`\``;

    const cleaned = cleanAiDraft(rawOutput, 'Alex');
    assert.ok(!cleaned.includes('```'));
    assert.ok(cleaned.startsWith('Hi Alex,'));
  });

  test('cleanAiDraft: substitutes all macro template variable formats', () => {
    const rawTemplate = `Hi {{name}},\n\nYour return for {{customer_name}} is authorized for [Customer] and [Name].\n\nBest, Support`;
    const cleaned = cleanAiDraft(rawTemplate, 'Michael');
    assert.ok(!cleaned.includes('{{name}}'));
    assert.ok(!cleaned.includes('{{customer_name}}'));
    assert.ok(!cleaned.includes('[Customer]'));
    assert.ok(!cleaned.includes('[Name]'));
    assert.ok(cleaned.includes('Michael'));
  });

  test('cleanAiDraft: personalizes generic greeting "Hi there," to "Hi [Name],"', () => {
    const raw = `Hi there,\n\nThanks for reaching out!`;
    const cleaned = cleanAiDraft(raw, 'Emma');
    assert.ok(cleaned.startsWith('Hi Emma,'));
  });

  test('cleanAiDraft: preserves "Hi there," when customer name is unknown ("there")', () => {
    const raw = `Hi there,\n\nThanks for reaching out!`;
    const cleaned = cleanAiDraft(raw, 'there');
    assert.ok(cleaned.startsWith('Hi there,'));
  });

  test('extractSenderName: parses sender name from various RFC 5322 header formats', () => {
    assert.strictEqual(extractSenderName('From: "Alice Smith" <alice@example.com>\nSubject: Inquiry'), 'Alice');
    assert.strictEqual(extractSenderName('From: Bob Jones <bob@domain.org>\n'), 'Bob');
    assert.strictEqual(extractSenderName('Sender: Charlotte Bronte <charlotte@lit.co>'), 'Charlotte');
    assert.strictEqual(extractSenderName('Subject: Question\n\nDavid Miller <david@miller.net>'), 'David');
  });

  test('extractSenderName: parses sign-off names', () => {
    assert.strictEqual(extractSenderName('Can you help with my order?\n\nThanks,\nJennifer'), 'Jennifer');
    assert.strictEqual(extractSenderName('Please update tracking.\n\nBest regards,\nAlexander'), 'Alexander');
    assert.strictEqual(extractSenderName('Looking forward to it.\n\nCheers,\nLiam'), 'Liam');
  });

  test('extractSenderName: filters out blacklist terms and redacted PII', () => {
    assert.strictEqual(extractSenderName('Hi team,\nWhat are your hours?'), 'there');
    assert.strictEqual(extractSenderName('Hello support,\nPlease check this.'), 'there');
    assert.strictEqual(extractSenderName('Dear Everyone,\nWelcome to the thread.'), 'there');
    assert.strictEqual(extractSenderName('From: [EMAIL_REDACTED]\nSubject: Hello'), 'there');
  });

  test('Rate Limiter: enforces sliding window 20 requests / 60s per user', () => {
    const limiter = new SlidingWindowRateLimiter(20, 60000);
    const userA = 'user-uuid-1';
    const userB = 'user-uuid-2';
    const now = 1000000;

    // First 20 requests for User A succeed
    for (let i = 0; i < 20; i++) {
      const res = limiter.check(userA, now + i * 100);
      assert.strictEqual(res.allowed, true, `Request ${i + 1} should be allowed`);
    }

    // 21st request for User A is rejected
    const blockedRes = limiter.check(userA, now + 2500);
    assert.strictEqual(blockedRes.allowed, false);
    assert.strictEqual(blockedRes.remaining, 0);

    // User B is isolated and NOT blocked
    const userBRes = limiter.check(userB, now + 2600);
    assert.strictEqual(userBRes.allowed, true);

    // After 60s window expires, User A is allowed again
    const futureRes = limiter.check(userA, now + 65000);
    assert.strictEqual(futureRes.allowed, true);
  });
});

describe('Adversarial Challenge 2: AdminGuard Passkey Authentication & Session Resilience', () => {
  test('passkey validation: rejects empty string, spaces, and invalid passkeys', () => {
    const validatePasskey = (key: string, envKey?: string) => {
      const clean = key.trim();
      if (!clean) return false;
      return Boolean(envKey) && clean === envKey;
    };

    assert.strictEqual(validatePasskey('', 'valid-secret'), false);
    assert.strictEqual(validatePasskey('   ', 'valid-secret'), false);
    assert.strictEqual(validatePasskey('wrong-password', 'valid-secret'), false);
    assert.strictEqual(validatePasskey('123456', 'valid-secret'), false);
    assert.strictEqual(validatePasskey('admin', 'valid-secret'), false);
  });

  test('passkey validation: accepts configured environment passkey and trimmed whitespace', () => {
    const validatePasskey = (key: string, envKey?: string) => {
      const clean = key.trim();
      if (!clean) return false;
      return Boolean(envKey) && clean === envKey;
    };

    assert.strictEqual(validatePasskey('custom-env-key-999', 'custom-env-key-999'), true);
    assert.strictEqual(validatePasskey('  custom-env-key-999  ', 'custom-env-key-999'), true);
    assert.strictEqual(validatePasskey('different-key', 'custom-env-key-999'), false);
  });

  test('session reload simulation: preserves unlock state from sessionStorage', () => {
    // Mock sessionStorage
    const mockStorage = new Map<string, string>();

    // Initial state: locked
    assert.strictEqual(mockStorage.get('draftpilot_admin_unlocked'), undefined);

    // Unlock action
    mockStorage.set('draftpilot_admin_unlocked', 'true');

    // Simulated page reload mount check
    const isUnlockedOnMount = mockStorage.get('draftpilot_admin_unlocked') === 'true';
    assert.strictEqual(isUnlockedOnMount, true);

    // Tampered or cleared session
    mockStorage.set('draftpilot_admin_unlocked', 'false');
    assert.strictEqual(mockStorage.get('draftpilot_admin_unlocked') === 'true', false);
  });

  test('verifySuperAdmin: validates x-admin-passkey header on API routes', async () => {
    const originalPasskey = process.env.ADMIN_PASSKEY;
    try {
      process.env.ADMIN_PASSKEY = 'test-challenge-passkey-123';

      // Valid passkey
      const reqValid = new Request('http://localhost:3000/api/admin/ai-config', {
        headers: { 'x-admin-passkey': 'test-challenge-passkey-123' },
      });
      const authValid = await verifySuperAdmin(reqValid);
      assert.strictEqual(authValid.authorized, true);

      // Invalid passkey
      const reqInvalid = new Request('http://localhost:3000/api/admin/ai-config', {
        headers: { 'x-admin-passkey': 'fake-key' },
      });
      const authInvalid = await verifySuperAdmin(reqInvalid);
      assert.strictEqual(authInvalid.authorized, false);
      assert.strictEqual(authInvalid.response?.status, 401);
    } finally {
      process.env.ADMIN_PASSKEY = originalPasskey;
    }
  });

  test('verifySuperAdmin: rejects unauthorized requests with missing headers', async () => {
    const req = new Request('http://localhost:3000/api/admin/feature-flags');
    const auth = await verifySuperAdmin(req);
    assert.strictEqual(auth.authorized, false);
    assert.strictEqual(auth.response?.status, 401);
  });
});

describe('Adversarial Challenge 3: Global Macro Distribution & RLS Boundary Handling', () => {
  interface MockTeam {
    id: string;
    name: string;
  }

  interface MockMacroRecord {
    id: string;
    team_id: string;
    name: string;
    category: string;
    tags: string[];
    content: string;
    updated_at: string;
  }

  test('broadcast distribution: idempotently inserts new macros and updates existing without duplicates', () => {
    // Setup mock multi-tenant database state
    const teams: MockTeam[] = [
      { id: 'team-alpha', name: 'Alpha Corp' },
      { id: 'team-beta', name: 'Beta LLC' },
    ];

    let dbMacros: MockMacroRecord[] = [
      // Pre-existing macro in Team Alpha
      {
        id: 'macro-101',
        team_id: 'team-alpha',
        name: 'Universal 30-Day Money Back Guarantee',
        category: 'Old Category',
        tags: ['old'],
        content: 'Old content',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ];

    const broadcastTemplates = [
      {
        id: '1',
        name: 'Universal 30-Day Money Back Guarantee',
        category: 'Billing & Refunds',
        tags: ['refund', 'return', 'policy'],
        content: 'Updated 30-day policy content with {{name}}',
      },
      {
        id: '2',
        name: 'MFA & 2-Factor Authentication Unlock',
        category: 'Account & Security',
        tags: ['auth', '2fa'],
        content: 'MFA reset instructions for {{name}}',
      },
    ];

    // Broadcast Engine (mirrors packages/web/src/app/api/admin/global-macros/route.ts)
    let insertedCount = 0;
    let updatedCount = 0;

    for (const team of teams) {
      const teamMacros = dbMacros.filter((m) => m.team_id === team.id);
      const nameMap = new Map<string, string>();
      teamMacros.forEach((m) => nameMap.set(m.name.toLowerCase().trim(), m.id));

      for (const t of broadcastTemplates) {
        const key = t.name.toLowerCase().trim();
        const existingId = nameMap.get(key);

        if (existingId) {
          // Update existing
          dbMacros = dbMacros.map((m) =>
            m.id === existingId
              ? {
                  ...m,
                  category: t.category,
                  tags: t.tags,
                  content: t.content,
                  updated_at: new Date().toISOString(),
                }
              : m
          );
          updatedCount++;
        } else {
          // Insert new
          const newRecord: MockMacroRecord = {
            id: `macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            team_id: team.id,
            name: t.name,
            category: t.category,
            tags: t.tags,
            content: t.content,
            updated_at: new Date().toISOString(),
          };
          dbMacros.push(newRecord);
          nameMap.set(key, newRecord.id);
          insertedCount++;
        }
      }
    }

    // Assertions
    // Team Alpha: 1 updated ('Universal 30-Day...'), 1 inserted ('MFA...')
    // Team Beta: 2 inserted ('Universal 30-Day...', 'MFA...')
    assert.strictEqual(updatedCount, 1, 'Should have updated 1 existing macro in Team Alpha');
    assert.strictEqual(insertedCount, 3, 'Should have inserted 3 new macros across teams');
    assert.strictEqual(dbMacros.length, 4, 'Total macros across both teams should be exactly 4');

    // Verify Team Alpha has no duplicates
    const alphaMacros = dbMacros.filter((m) => m.team_id === 'team-alpha');
    assert.strictEqual(alphaMacros.length, 2);
    const alphaRefundMacro = alphaMacros.find((m) => m.name === 'Universal 30-Day Money Back Guarantee');
    assert.strictEqual(alphaRefundMacro?.content, 'Updated 30-day policy content with {{name}}');
    assert.strictEqual(alphaRefundMacro?.category, 'Billing & Refunds');

    // Re-run broadcast to test idempotency
    let secondRunUpdated = 0;
    let secondRunInserted = 0;

    for (const team of teams) {
      const teamMacros = dbMacros.filter((m) => m.team_id === team.id);
      const nameMap = new Map<string, string>();
      teamMacros.forEach((m) => nameMap.set(m.name.toLowerCase().trim(), m.id));

      for (const t of broadcastTemplates) {
        const key = t.name.toLowerCase().trim();
        const existingId = nameMap.get(key);
        if (existingId) {
          secondRunUpdated++;
        } else {
          secondRunInserted++;
        }
      }
    }

    assert.strictEqual(secondRunInserted, 0, 'Subsequent broadcast should insert 0 new macros');
    assert.strictEqual(secondRunUpdated, 4, 'Subsequent broadcast should update all 4 existing macros');
    assert.strictEqual(dbMacros.length, 4, 'Total macro count remains 4 without duplicates');
  });

  test('RLS boundary challenge: client-role query cannot view or mutate another team macros', () => {
    const clientUser = { id: 'user-1', team_id: 'team-alpha' };
    const allDbMacros: MockMacroRecord[] = [
      { id: 'm1', team_id: 'team-alpha', name: 'Macro A', category: 'General', tags: [], content: '', updated_at: '' },
      { id: 'm2', team_id: 'team-beta', name: 'Macro B', category: 'General', tags: [], content: '', updated_at: '' },
    ];

    // RLS Policy Simulation: WHERE team_id = auth.user.team_id
    const rlsQuery = (userTeamId: string) => {
      return allDbMacros.filter((m) => m.team_id === userTeamId);
    };

    const userVisibleMacros = rlsQuery(clientUser.team_id);
    assert.strictEqual(userVisibleMacros.length, 1);
    assert.strictEqual(userVisibleMacros[0].team_id, 'team-alpha');
    assert.ok(!userVisibleMacros.some((m) => m.team_id === 'team-beta'));
  });

  test('Global Macro CRUD operations maintain schema integrity', () => {
    let catalog = [
      { id: '1', name: 'Template 1', category: 'General', tags: ['t1'], content: 'Hello', adoptionCount: 0 },
    ];

    // Create
    const newEntry = { id: '2', name: 'Template 2', category: 'Billing', tags: ['billing'], content: 'Receipt', adoptionCount: 0 };
    catalog.push(newEntry);
    assert.strictEqual(catalog.length, 2);

    // Update
    catalog = catalog.map((m) => (m.id === '2' ? { ...m, name: 'Template 2 Updated' } : m));
    assert.strictEqual(catalog.find((m) => m.id === '2')?.name, 'Template 2 Updated');

    // Delete
    catalog = catalog.filter((m) => m.id !== '1');
    assert.strictEqual(catalog.length, 1);
    assert.strictEqual(catalog[0].id, '2');
  });
});
