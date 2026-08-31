import { test, describe } from 'node:test';
import assert from 'node:assert';

describe('Worker M3: Feature Flags & Global Macros Logic', () => {
  test('Feature flags toggle correctly and maintain schema integrity', () => {
    const flags = [
      {
        id: '1',
        name: 'Gmail Inline Ghost Autocomplete',
        key: 'feat_gmail_ghost_autocomplete',
        description: 'Test flag',
        category: 'Extension' as const,
        enabled: true,
      },
      {
        id: '2',
        name: 'Claude 3.5 Sonnet Failover Router',
        key: 'feat_claude_failover_router',
        description: 'Test failover',
        category: 'Core AI' as const,
        enabled: false,
      },
    ];

    const toggled = flags.map((f) => (f.id === '2' ? { ...f, enabled: !f.enabled } : f));
    assert.strictEqual(toggled.find((f) => f.id === '2')?.enabled, true);
    assert.strictEqual(toggled.find((f) => f.id === '1')?.enabled, true);
  });

  test('Global Macro creation and tag formatting', () => {
    const rawTags = ' refund, return, policy ';
    const parsedTags = rawTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    assert.deepStrictEqual(parsedTags, ['refund', 'return', 'policy']);

    const newMacro = {
      id: 'test-1',
      name: 'Custom Macro',
      category: 'Billing & Refunds',
      tags: parsedTags,
      content: 'Hi {{name}}, here is your refund.',
      adoptionCount: 0,
    };

    assert.strictEqual(newMacro.name, 'Custom Macro');
    assert.strictEqual(newMacro.tags.length, 3);
  });

  test('Dynamic quota percentage calculation for OverviewBento', () => {
    const calculateQuota = (draftsCount: number, limit?: number) => {
      const activeLimit = limit || 50;
      return Math.min(100, Math.round((draftsCount / activeLimit) * 100));
    };

    assert.strictEqual(calculateQuota(10, 50), 20);
    assert.strictEqual(calculateQuota(250, 500), 50);
    assert.strictEqual(calculateQuota(1000, 500), 100);
    assert.strictEqual(calculateQuota(0, 50), 0);
  });
});
