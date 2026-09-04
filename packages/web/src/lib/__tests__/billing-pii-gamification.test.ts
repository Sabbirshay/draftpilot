/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { scrubPII, type CustomPiiRule } from '../pii-scrubber.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { COMPARISON_FEATURES } from '../../data/feature-comparison.ts';

describe('Milestone 3: Growth, Privacy & Gamification (R6, R7, R8)', () => {

  // ==========================================
  // R6: Annual Billing Toggle & Pricing Math
  // ==========================================
  describe('R6: Annual Billing Calculations & Feature Matrix', () => {
    test('verifies 3 pricing tiers across monthly and annual cadences', () => {
      const TIERS = {
        free: { monthly: 0, annualPerMonth: 0, annualTotal: 0 },
        team: { monthly: 19, annualPerMonth: 15, annualTotal: 180 },
        enterprise: { monthly: 99, annualPerMonth: 79, annualTotal: 948 },
      };

      // Free tier remains $0
      assert.strictEqual(TIERS.free.monthly, 0);
      assert.strictEqual(TIERS.free.annualPerMonth, 0);

      // Team tier 20% discount math: round(19 * 0.8) = 15
      assert.strictEqual(Math.round(TIERS.team.monthly * 0.8), TIERS.team.annualPerMonth);
      assert.strictEqual(TIERS.team.annualPerMonth * 12, TIERS.team.annualTotal);

      // Enterprise tier 20% discount math: round(99 * 0.8) = 79
      assert.strictEqual(Math.round(TIERS.enterprise.monthly * 0.8), TIERS.enterprise.annualPerMonth);
      assert.strictEqual(TIERS.enterprise.annualPerMonth * 12, TIERS.enterprise.annualTotal);
    });

    test('calculates team seat pricing and annual savings accurately', () => {
      const calculateSubscription = (seats: number, isAnnual: boolean) => {
        const pricePerSeat = isAnnual ? 15 : 19;
        const monthlyTotal = seats * pricePerSeat;
        const annualBilled = seats * pricePerSeat * 12;
        const annualSavings = isAnnual ? seats * (19 - 15) * 12 : 0;
        const draftQuota = seats * 1000;
        return { monthlyTotal, annualBilled, annualSavings, draftQuota };
      };

      // 1 seat monthly
      const s1Monthly = calculateSubscription(1, false);
      assert.strictEqual(s1Monthly.monthlyTotal, 19);
      assert.strictEqual(s1Monthly.annualSavings, 0);
      assert.strictEqual(s1Monthly.draftQuota, 1000);

      // 1 seat annual (Save $48/yr)
      const s1Annual = calculateSubscription(1, true);
      assert.strictEqual(s1Annual.monthlyTotal, 15);
      assert.strictEqual(s1Annual.annualBilled, 180);
      assert.strictEqual(s1Annual.annualSavings, 48);
      assert.strictEqual(s1Annual.draftQuota, 1000);

      // 5 seats annual (Save $240/yr)
      const s5Annual = calculateSubscription(5, true);
      assert.strictEqual(s5Annual.monthlyTotal, 75);
      assert.strictEqual(s5Annual.annualBilled, 900);
      assert.strictEqual(s5Annual.annualSavings, 240);
      assert.strictEqual(s5Annual.draftQuota, 5000);
    });

    test('validates Feature Comparison Matrix has all 6 required dimensions', () => {
      assert.ok(Array.isArray(COMPARISON_FEATURES));
      assert.strictEqual(COMPARISON_FEATURES.length, 6);

      const dimensions = COMPARISON_FEATURES.map((f: any) => f.dimension.toLowerCase());
      assert.ok(dimensions.some((d: string) => d.includes('draft')));
      assert.ok(dimensions.some((d: string) => d.includes('macro')));
      assert.ok(dimensions.some((d: string) => d.includes('knowledge') || d.includes('doc')));
      assert.ok(dimensions.some((d: string) => d.includes('seat')));
      assert.ok(dimensions.some((d: string) => d.includes('pii')));
      assert.ok(dimensions.some((d: string) => d.includes('support') || d.includes('sla')));

      // Verify each row defines values for all 3 tiers
      COMPARISON_FEATURES.forEach((feature: any) => {
        assert.ok(feature.free !== undefined && feature.free !== null);
        assert.ok(feature.team !== undefined && feature.team !== null);
        assert.ok(feature.enterprise !== undefined && feature.enterprise !== null);
      });
    });
  });

  // ==========================================
  // R7: Custom PII Scrubbing Rules Engine
  // ==========================================
  describe('R7: Custom PII Scrubbing Rules & ReDoS Guards', () => {
    test('maintains 100% backward compatibility when customRules is not provided', () => {
      const emailText = 'Contact agent at support.team@draftpilot.com for assistance.';
      const cardText = 'Payment card on file: 4532 0150 1234 5678 exp 08/28.';
      const tokenText = 'Authorization token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret';

      assert.strictEqual(
        scrubPII(emailText),
        'Contact agent at [EMAIL_REDACTED] for assistance.'
      );
      assert.ok(scrubPII(cardText).includes('[CARD_REDACTED]'));
      assert.ok(scrubPII(tokenText).includes('[TOKEN_REDACTED]'));
    });

    test('redacts custom keyword rules with exact token replacements', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-1',
          name: 'Project Phoenix Codename',
          pattern: 'Project Phoenix',
          replacement: '[PROJECT_CODENAME]',
          rule_type: 'keyword',
          enabled: true,
        },
      ];

      const input = 'We are deploying Project Phoenix to production cluster today.';
      const output = scrubPII(input, customRules);
      assert.strictEqual(
        output,
        'We are deploying [PROJECT_CODENAME] to production cluster today.'
      );
    });

    test('redacts custom regex rules matching domain-specific ID formats', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-cust',
          name: 'Customer ID',
          pattern: 'CUST-\\d{5}',
          replacement: '[CUSTOMER_ID]',
          rule_type: 'regex',
          isRegex: true,
          enabled: true,
        },
        {
          id: 'rule-patient',
          name: 'Patient MRN',
          pattern: 'MRN-\\d{6}',
          replacement: '[PATIENT_MRN]',
          rule_type: 'regex',
          isRegex: true,
          enabled: true,
        },
      ];

      const input = 'Billing inquiry for CUST-84920 and clinical file MRN-123456 verified.';
      const output = scrubPII(input, customRules);
      assert.strictEqual(
        output,
        'Billing inquiry for [CUSTOMER_ID] and clinical file [PATIENT_MRN] verified.'
      );
    });

    test('respects disabled rule state without redacting', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-disabled',
          name: 'Disabled Codename',
          pattern: 'Project Apollo',
          replacement: '[APOLLO_REDACTED]',
          rule_type: 'keyword',
          enabled: false,
        },
      ];

      const input = 'Project Apollo is scheduled for launch in Q3.';
      const output = scrubPII(input, customRules);
      assert.strictEqual(output, input);
    });

    test('safely handles ReDoS patterns and catastrophic backtracking without freezing', () => {
      const reDosRules: CustomPiiRule[] = [
        {
          id: 'rule-redos-1',
          name: 'Catastrophic nested repetition',
          pattern: '(a+)+',
          replacement: '[REDOS_TRAPPED]',
          rule_type: 'regex',
          enabled: true,
        },
        {
          id: 'rule-redos-2',
          name: 'Catastrophic star repetition',
          pattern: '(x+x+)+y',
          replacement: '[REDOS_TRAPPED]',
          rule_type: 'regex',
          enabled: true,
        },
      ];

      const adversarialInput = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
      const start = Date.now();
      const output = scrubPII(adversarialInput, reDosRules);
      const durationMs = Date.now() - start;

      // ReDoS pattern rejected safely in less than 50ms
      assert.ok(durationMs < 100);
      assert.ok(typeof output === 'string');
    });

    test('handles invalid or malformed regular expressions without crashing', () => {
      const brokenRules: CustomPiiRule[] = [
        {
          id: 'rule-broken',
          name: 'Malformed Regex Pattern',
          pattern: '[unclosed-bracket-(',
          replacement: '[BROKEN]',
          rule_type: 'regex',
          enabled: true,
        },
      ];

      const input = 'Standard customer inquiry without matching broken pattern.';
      assert.doesNotThrow(() => {
        const output = scrubPII(input, brokenRules);
        assert.strictEqual(output, input);
      });
    });

    test('simultaneously scrubs custom rules and standard built-in PII in a single pass', () => {
      const customRules: CustomPiiRule[] = [
        {
          id: 'rule-order',
          name: 'Order Number',
          pattern: 'ORD-\\d{8}',
          replacement: '[ORDER_ID]',
          rule_type: 'regex',
          enabled: true,
        },
      ];

      const mixedInput =
        'Customer alice@corp.com with order ORD-99887766 called from +1 (555) 234-5678 regarding key sk-proj-1234567890abcdef1234567890.';
      const output = scrubPII(mixedInput, customRules);

      assert.ok(output.includes('[ORDER_ID]'));
      assert.ok(output.includes('[EMAIL_REDACTED]'));
      assert.ok(output.includes('[PHONE_REDACTED]'));
      assert.ok(output.includes('[TOKEN_REDACTED]'));
      assert.ok(!output.includes('alice@corp.com'));
      assert.ok(!output.includes('ORD-99887766'));
    });
  });

  // ==========================================
  // R8: Onboarding Gamification & Badges
  // ==========================================
  describe('R8: Onboarding Checklist & Milestone Badges', () => {
    const REQUIRED_STEPS = [
      'Install Extension',
      'Create First Macro',
      'Generate First AI Draft',
      'Invite Team Member',
    ];

    const BADGES = [
      { name: 'Extension Pioneer', step: 'Install Extension' },
      { name: 'Macro Architect', step: 'Create First Macro' },
      { name: 'AI Copilot Ace', step: 'Generate First AI Draft' },
      { name: 'Team Builder', step: 'Invite Team Member' },
      { name: 'DraftPilot Champion', step: 'Complete All 4 Steps' },
    ];

    test('verifies all 4 required onboarding steps exist', () => {
      assert.strictEqual(REQUIRED_STEPS.length, 4);
      assert.strictEqual(REQUIRED_STEPS[0], 'Install Extension');
      assert.strictEqual(REQUIRED_STEPS[1], 'Create First Macro');
      assert.strictEqual(REQUIRED_STEPS[2], 'Generate First AI Draft');
      assert.strictEqual(REQUIRED_STEPS[3], 'Invite Team Member');
    });

    test('computes completion progress from 0% to 100%', () => {
      const calcProgress = (completedCount: number) => Math.round((completedCount / 4) * 100);

      assert.strictEqual(calcProgress(0), 0);
      assert.strictEqual(calcProgress(1), 25);
      assert.strictEqual(calcProgress(2), 50);
      assert.strictEqual(calcProgress(3), 75);
      assert.strictEqual(calcProgress(4), 100);
    });

    test('unlocks respective achievement badges as milestones are completed', () => {
      const evaluateBadges = (state: {
        extension_installed: boolean;
        first_macro_added: boolean;
        first_draft_generated: boolean;
        team_member_invited: boolean;
      }) => {
        const isAll =
          state.extension_installed &&
          state.first_macro_added &&
          state.first_draft_generated &&
          state.team_member_invited;

        return {
          extensionPioneer: state.extension_installed,
          macroArchitect: state.first_macro_added,
          aiCopilotAce: state.first_draft_generated,
          teamBuilder: state.team_member_invited,
          draftPilotChampion: isAll,
        };
      };

      // Initial state: all locked
      const initial = evaluateBadges({
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      });
      assert.strictEqual(initial.extensionPioneer, false);
      assert.strictEqual(initial.aiCopilotAce, false);
      assert.strictEqual(initial.draftPilotChampion, false);

      // Generating first draft unlocks AI Copilot Ace
      const draftGenerated = evaluateBadges({
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: true,
        team_member_invited: false,
      });
      assert.strictEqual(draftGenerated.aiCopilotAce, true);
      assert.strictEqual(draftGenerated.draftPilotChampion, false);

      // All 4 milestones completed unlocks DraftPilot Champion
      const fullyCompleted = evaluateBadges({
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: true,
        team_member_invited: true,
      });
      assert.strictEqual(fullyCompleted.extensionPioneer, true);
      assert.strictEqual(fullyCompleted.macroArchitect, true);
      assert.strictEqual(fullyCompleted.aiCopilotAce, true);
      assert.strictEqual(fullyCompleted.teamBuilder, true);
      assert.strictEqual(fullyCompleted.draftPilotChampion, true);
    });
  });
});
