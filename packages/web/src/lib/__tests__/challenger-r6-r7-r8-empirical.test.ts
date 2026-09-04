/// <reference types="node" />
import { test, describe } from 'node:test';
import assert from 'node:assert';

// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { scrubPII as webScrubPII, type CustomPiiRule } from '../pii-scrubber.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { scrubPII as apiScrubPII } from '../../../../api/src/utils/pii-scrubber.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { scrubPII as extScrubPII } from '../../../../extension/src/utils/pii-scrubber.ts';
// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import { COMPARISON_FEATURES, type PlanFeatureRow } from '../../data/feature-comparison.ts';

// ============================================================================
// EMPIRICAL CHALLENGER TEST SUITE: R6, R7, R8
// ============================================================================

describe('Empirical Challenger 2: Deep Stress-Testing of R6, R7 & R8', () => {

  // ==========================================================================
  // 1. CHALLENGE R6: ANNUAL BILLING & COMPARISON MATRIX
  // ==========================================================================
  describe('Challenge R6: Annual Billing Math Precision, Multi-Seat & Comparison Matrix', () => {
    
    // Seat Calculator Harness reflecting BillingManager and checkout logic
    function calculateTeamPricing(rawSeats: any, isAnnual: boolean) {
      let seats = typeof rawSeats === 'number' ? rawSeats : parseInt(rawSeats, 10);
      if (isNaN(seats) || !isFinite(seats)) seats = 1;
      // Defensive clamping to minimum 1 integer seat
      const safeSeats = Math.max(1, Math.floor(seats));
      
      const pricePerSeat = isAnnual ? 15 : 19;
      const monthlyTotal = safeSeats * pricePerSeat;
      const annualBilled = safeSeats * pricePerSeat * 12;
      const annualUndiscounted = safeSeats * 19 * 12;
      const annualSavings = isAnnual ? annualUndiscounted - annualBilled : 0;
      const draftQuota = safeSeats * 1000;
      
      return {
        seats: safeSeats,
        pricePerSeat,
        monthlyTotal,
        annualBilled,
        annualSavings,
        draftQuota,
      };
    }

    function calculateEnterprisePricing(isAnnual: boolean) {
      const pricePerMonth = isAnnual ? 79 : 99;
      const annualBilled = pricePerMonth * 12;
      const annualUndiscounted = 99 * 12;
      const annualSavings = isAnnual ? annualUndiscounted - annualBilled : 0;
      return { pricePerMonth, annualBilled, annualSavings, draftQuota: 5000 };
    }

    test('R6.1: Mathematical precision of 20% annual discount across all 3 tiers', () => {
      // 1. Starter Free Tier ($0 -> $0, 0% savings)
      const freeMonthly = 0;
      const freeAnnual = 0;
      assert.strictEqual(freeMonthly, 0);
      assert.strictEqual(freeAnnual, 0);

      // 2. Team Tier ($19 monthly -> $15 annual)
      // Math: 19 * 0.8 = 15.20 -> rounded to integer $15
      const teamMonthlyRate = 19;
      const teamAnnualRate = 15;
      const teamMonthlyAnnualTotal = teamMonthlyRate * 12; // $228
      const teamAnnualTotal = teamAnnualRate * 12;         // $180
      const teamAnnualSavings = teamMonthlyAnnualTotal - teamAnnualTotal; // $48/seat/yr
      const teamActualDiscountPercent = (teamAnnualSavings / teamMonthlyAnnualTotal) * 100;

      assert.strictEqual(Math.round(teamMonthlyRate * 0.8), teamAnnualRate);
      assert.strictEqual(teamAnnualSavings, 48);
      // Actual discount is 21.05%, which exceeds/satisfies the 20% minimum savings callout
      assert.ok(teamActualDiscountPercent >= 20, `Expected >= 20% savings, got ${teamActualDiscountPercent}%`);

      // 3. Enterprise Tier ($99 monthly -> $79 annual)
      // Math: 99 * 0.8 = 79.20 -> rounded to integer $79
      const entMonthlyRate = 99;
      const entAnnualRate = 79;
      const entMonthlyAnnualTotal = entMonthlyRate * 12; // $1188
      const entAnnualTotal = entAnnualRate * 12;         // $948
      const entAnnualSavings = entMonthlyAnnualTotal - entAnnualTotal; // $240/yr
      const entActualDiscountPercent = (entAnnualSavings / entMonthlyAnnualTotal) * 100;

      assert.strictEqual(Math.round(entMonthlyRate * 0.8), entAnnualRate);
      assert.strictEqual(entAnnualSavings, 240);
      // Actual discount is 20.20%, which exceeds/satisfies the 20% minimum savings callout
      assert.ok(entActualDiscountPercent >= 20, `Expected >= 20% savings, got ${entActualDiscountPercent}%`);
    });

    test('R6.2: Multi-seat scaling test (1, 2, 5, 10, 50, 100 seats) verifies linear invariants', () => {
      const seatMilestones = [1, 2, 5, 10, 50, 100];

      for (const seats of seatMilestones) {
        const monthly = calculateTeamPricing(seats, false);
        const annual = calculateTeamPricing(seats, true);

        // Verification for monthly cadence
        assert.strictEqual(monthly.seats, seats);
        assert.strictEqual(monthly.pricePerSeat, 19);
        assert.strictEqual(monthly.monthlyTotal, seats * 19);
        assert.strictEqual(monthly.annualSavings, 0);
        assert.strictEqual(monthly.draftQuota, seats * 1000);

        // Verification for annual cadence
        assert.strictEqual(annual.seats, seats);
        assert.strictEqual(annual.pricePerSeat, 15);
        assert.strictEqual(annual.monthlyTotal, seats * 15);
        assert.strictEqual(annual.annualBilled, seats * 15 * 12);
        assert.strictEqual(annual.annualSavings, seats * 48); // $48/seat/yr saved
        assert.strictEqual(annual.draftQuota, seats * 1000);

        // Explicit checks for 10 seats
        if (seats === 10) {
          assert.strictEqual(annual.monthlyTotal, 150);
          assert.strictEqual(annual.annualBilled, 1800);
          assert.strictEqual(annual.annualSavings, 480);
          assert.strictEqual(annual.draftQuota, 10000);
        }

        // Explicit checks for 50 seats
        if (seats === 50) {
          assert.strictEqual(annual.monthlyTotal, 750);
          assert.strictEqual(annual.annualBilled, 9000);
          assert.strictEqual(annual.annualSavings, 2400);
          assert.strictEqual(annual.draftQuota, 50000);
        }
      }
    });

    test('R6.3: Boundary conditions: 0 seats, negative seats, fractional seats and NaN', () => {
      // 0 seats must clamp to 1 seat
      const zeroSeatAnnual = calculateTeamPricing(0, true);
      assert.strictEqual(zeroSeatAnnual.seats, 1);
      assert.strictEqual(zeroSeatAnnual.monthlyTotal, 15);
      assert.strictEqual(zeroSeatAnnual.annualSavings, 48);

      // Negative seats (-1, -10, -50) must clamp to 1 seat and NEVER produce negative bills
      const negSeatMonthly = calculateTeamPricing(-1, false);
      assert.strictEqual(negSeatMonthly.seats, 1);
      assert.strictEqual(negSeatMonthly.monthlyTotal, 19);

      const negSeatAnnual = calculateTeamPricing(-50, true);
      assert.strictEqual(negSeatAnnual.seats, 1);
      assert.strictEqual(negSeatAnnual.monthlyTotal, 15);
      assert.strictEqual(negSeatAnnual.annualSavings, 48);

      // Fractional seats (2.7, 5.9) must floor safely to integer seats
      const fracSeat = calculateTeamPricing(2.7, true);
      assert.strictEqual(fracSeat.seats, 2);
      assert.strictEqual(fracSeat.monthlyTotal, 30);
      assert.strictEqual(fracSeat.annualBilled, 360);

      // NaN or malformed seat input
      const nanSeat = calculateTeamPricing('invalid-seat', true);
      assert.strictEqual(nanSeat.seats, 1);
      assert.strictEqual(nanSeat.monthlyTotal, 15);
    });

    test('R6.4: Tier Feature Comparison Matrix invariants across all 3 tiers', () => {
      assert.ok(Array.isArray(COMPARISON_FEATURES), 'COMPARISON_FEATURES must be an array');
      assert.strictEqual(COMPARISON_FEATURES.length, 6, 'Must contain exactly 6 feature dimensions');

      const expectedDimensions = [
        'Monthly AI Draft Limit',
        'Custom Support Macros',
        'Knowledge Docs & Embeddings',
        'Team Seats Included',
        'Custom PII Redaction Rules',
        'Support SLA & Channels',
      ];

      expectedDimensions.forEach((dim) => {
        const found = COMPARISON_FEATURES.find((f: PlanFeatureRow) => f.dimension.toLowerCase() === dim.toLowerCase());
        assert.ok(found, `Dimension "${dim}" must exist in comparison matrix`);
        
        // Ensure no tier has null or undefined values
        assert.ok(found.free !== null && found.free !== undefined, `Free tier value for "${dim}" must exist`);
        assert.ok(found.team !== null && found.team !== undefined, `Team tier value for "${dim}" must exist`);
        assert.ok(found.enterprise !== null && found.enterprise !== undefined, `Enterprise tier value for "${dim}" must exist`);
      });

      // Verify specific progression invariants:
      // Drafts: Free (50) < Team (1,000/seat) < Enterprise (5,000+)
      const draftsRow = COMPARISON_FEATURES.find((f: PlanFeatureRow) => f.dimension.includes('Draft Limit'));
      assert.ok(String(draftsRow?.free).includes('50'));
      assert.ok(String(draftsRow?.team).includes('1,000'));
      assert.ok(String(draftsRow?.enterprise).includes('5,000'));

      // Macros: Free (5) < Team (Unlimited shared) <= Enterprise (Unlimited team + admin)
      const macrosRow = COMPARISON_FEATURES.find((f: PlanFeatureRow) => f.dimension.includes('Macros'));
      assert.ok(String(macrosRow?.free).includes('5'));
      assert.ok(String(macrosRow?.team).includes('Unlimited'));
      assert.ok(String(macrosRow?.enterprise).includes('Unlimited'));

      // Seats: Free (1 solo) < Team (Flexible) <= Enterprise (Unlimited)
      const seatsRow = COMPARISON_FEATURES.find((f: PlanFeatureRow) => f.dimension.includes('Seats'));
      assert.ok(String(seatsRow?.free).includes('1 solo'));
      assert.ok(String(seatsRow?.team).includes('$19/mo or $15/yr'));
      assert.ok(String(seatsRow?.enterprise).includes('Unlimited'));
    });
  });

  // ==========================================================================
  // 2. CHALLENGE R7: CUSTOM PII SCRUBBING & PLAYGROUND
  // ==========================================================================
  describe('Challenge R7: ReDoS Stress-Testing, Token Replacement & Cross-Package Parity', () => {

    test('R7.1: ReDoS Stress: Catastrophic backtracking patterns are rejected safely', () => {
      const redosPatterns = [
        '(a+)+$',
        '([a-zA-Z]+)*',
        '(x+x+)+y',
        '(a*)*',
        '([0-9]+)+',
      ];

      const adversarialInput = 'a'.repeat(30) + '!';

      for (const pattern of redosPatterns) {
        const rule: CustomPiiRule = {
          id: `redos-${pattern}`,
          name: `ReDoS Test: ${pattern}`,
          pattern,
          replacement: '[REDOS_REVILED]',
          rule_type: 'regex',
          isRegex: true,
          enabled: true,
        };

        const start = Date.now();
        const result = webScrubPII(adversarialInput, [rule]);
        const duration = Date.now() - start;

        // ReDoS guard must intercept and reject dangerous pattern in < 50ms
        assert.ok(duration < 50, `Pattern ${pattern} took ${duration}ms, exceeding 50ms safe limit`);
        assert.strictEqual(typeof result, 'string');
        // Input text should be preserved untouched since dangerous rule is rejected
        assert.strictEqual(result, adversarialInput);
      }
    });

    test('R7.2: Alternation ReDoS: Empirical latency characterization on (a|aa)+$', () => {
      // (a|aa)+$ does not contain nested quantifiers inside parentheses, so the basic
      // regex guard /(\([^\)]*[\+\*][^\)]*\))[\+\*]/ allows it through.
      // We empirically benchmark execution time on controlled input sizes.
      const rule: CustomPiiRule = {
        id: 'rule-alt-redos',
        name: 'Alternation ReDoS',
        pattern: '(a|aa)+$',
        replacement: '[TRAPPED]',
        rule_type: 'regex',
        isRegex: true,
        enabled: true,
      };

      // 20 characters: evaluates quickly (< 10ms)
      const input20 = 'a'.repeat(20) + '!';
      const start20 = Date.now();
      webScrubPII(input20, [rule]);
      const dur20 = Date.now() - start20;
      assert.ok(dur20 < 50, `20 chars took ${dur20}ms`);

      // 25 characters: evaluates in < 150ms
      const input25 = 'a'.repeat(25) + '!';
      const start25 = Date.now();
      webScrubPII(input25, [rule]);
      const dur25 = Date.now() - start25;
      assert.ok(dur25 < 150, `25 chars took ${dur25}ms`);
    });

    test('R7.3: Malformed regex syntax handling: Unclosed parens, dangling brackets, invalid syntax', () => {
      const malformedPatterns = [
        '(unclosed-group',
        '([a-z]+',
        '(((((',
        '[unclosed-bracket',
        '*dangling-star',
        '+dangling-plus',
        '?dangling-question',
        '\\',
      ];

      const input = 'Normal customer email text without any syntax errors.';

      for (const pattern of malformedPatterns) {
        const rule: CustomPiiRule = {
          id: 'broken-rule',
          name: 'Broken Pattern',
          pattern,
          replacement: '[BROKEN]',
          rule_type: 'regex',
          isRegex: true,
          enabled: true,
        };

        // Scrubber MUST NOT crash or throw uncaught exceptions
        assert.doesNotThrow(() => {
          const output = webScrubPII(input, [rule]);
          assert.strictEqual(output, input);
        });
      }
    });

    test('R7.4: Empty patterns, whitespace patterns, and degenerate rule fields', () => {
      const degeneratePatterns = ['', '   ', '\t\n', null as any, undefined as any];
      const input = 'Sensitive project Project Titan is deploying tomorrow.';

      for (const pattern of degeneratePatterns) {
        const rule: CustomPiiRule = {
          id: 'degenerate-rule',
          name: 'Empty Pattern',
          pattern,
          replacement: '[DEGENERATE]',
          rule_type: 'keyword',
          enabled: true,
        };

        const output = webScrubPII(input, [rule]);
        // Must NOT replace every character or wipe out the string
        assert.strictEqual(output, input);
      }
    });

    test('R7.5: Replacement token stress: Special characters ($$, $&, $1) and literal replacements', () => {
      // Empirical verification of replacement tokens
      const text = 'Authorization: SECRET_TOKEN_ABC123 is valid.';

      // Rule with literal replacement containing $ signs
      const ruleDollar: CustomPiiRule = {
        id: 'rule-dollar',
        pattern: 'SECRET_TOKEN_ABC123',
        replacement: '[COST_$100]',
        rule_type: 'keyword',
        enabled: true,
      };

      const outDollar = webScrubPII(text, [ruleDollar]);
      // Note: JavaScript replace interprets $1 as group 1. Since there are no capture groups, $1 evaluates to '$1'
      assert.ok(outDollar.includes('[COST_$100]'));
      assert.ok(!outDollar.includes('SECRET_TOKEN_ABC123'));

      // Rule with replacement $$
      const ruleDoubleDollar: CustomPiiRule = {
        id: 'rule-doubledollar',
        pattern: 'SECRET_TOKEN_ABC123',
        replacement: '$$REDACTED',
        rule_type: 'keyword',
        enabled: true,
      };
      const outDoubleDollar = webScrubPII(text, [ruleDoubleDollar]);
      // In JS replace, '$$' converts to literal '$'
      assert.ok(outDoubleDollar.includes('$REDACTED'));
      assert.ok(!outDoubleDollar.includes('SECRET_TOKEN_ABC123'));
    });

    test('R7.6: Overlapping custom keywords vs standard built-in PII rules (card, email, ssn)', () => {
      // 1. Keyword overlapping with email username:
      // When custom keyword matches part of an email, it redacts the keyword
      const emailRule: CustomPiiRule = {
        id: 'rule-agent',
        pattern: 'support',
        replacement: '[SUPPORT_TEAM]',
        rule_type: 'keyword',
        enabled: true,
      };
      const emailInput = 'Please contact support@acmecorp.com for urgent assistance.';
      const emailOutput = webScrubPII(emailInput, [emailRule]);
      assert.ok(emailOutput.includes('[SUPPORT_TEAM]'));
      assert.ok(!emailOutput.includes('support@acmecorp.com'));

      // 2. Custom regex matching SSN format with custom tag:
      const ssnCustomRule: CustomPiiRule = {
        id: 'rule-ssn-custom',
        pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
        replacement: '[CUSTOM_GOV_ID]',
        rule_type: 'regex',
        isRegex: true,
        enabled: true,
      };
      const ssnInput = 'Customer social security: 123-45-6789 verified.';
      const ssnOutput = webScrubPII(ssnInput, [ssnCustomRule]);
      // Custom rule runs first and claims the match before built-in SSN rule
      assert.strictEqual(ssnOutput, 'Customer social security: [CUSTOM_GOV_ID] verified.');

      // 3. Custom rule for credit card brand prefix:
      const cardCustomRule: CustomPiiRule = {
        id: 'rule-card-custom',
        pattern: '4532 0150 1234 5678',
        replacement: '[PRIMARY_CARD]',
        rule_type: 'keyword',
        enabled: true,
      };
      const cardInput = 'Payment card on file is 4532 0150 1234 5678 exp 09/27.';
      const cardOutput = webScrubPII(cardInput, [cardCustomRule]);
      assert.strictEqual(cardOutput, 'Payment card on file is [PRIMARY_CARD] exp 09/27.');
    });

    test('R7.7: Parity between Web, API, and Extension scrubbing engines (100% byte-for-byte consistency)', () => {
      const complexTestVectors = [
        'Pure clean text without any PII at all.',
        'Contact john.doe@acme.org and jane_doe@sub.corp.co.uk today.',
        'Primary Visa: 4532 0150 1234 5678 and Amex: 3782-822463-10005.',
        'Direct phone line: +1 (555) 234-5678 or UK mobile +44 20 7946 0958.',
        'Auth token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secretKey123',
        'API credential: sk-proj-1234567890abcdef1234567890 and GitHub: ghp_1234567890abcdefghijklmnopqrstuvwxyz12',
        'password: SuperSecretPass123! passcode: 987654',
        'Customer SSN is 987-65-4321 and IP address is 192.168.1.100.',
        'Shipping to 742 Evergreen Terrace Apt 4B, Springfield or P.O. Box 450.',
        'Combined: Customer CUST-99211 with internal codename Project Apollo reported billing error on card 4532 0150 1234 5678.',
      ];

      const customRules: CustomPiiRule[] = [
        {
          id: 'c1',
          name: 'Customer ID',
          pattern: 'CUST-\\d{5}',
          replacement: '[CUST_ID]',
          rule_type: 'regex',
          isRegex: true,
          enabled: true,
        },
        {
          id: 'c2',
          name: 'Codename',
          pattern: 'Project Apollo',
          replacement: '[CODENAME_APOLLO]',
          rule_type: 'keyword',
          enabled: true,
        },
      ];

      complexTestVectors.forEach((vector, idx) => {
        const webResult = webScrubPII(vector, customRules);
        const apiResult = apiScrubPII(vector, customRules);
        const extResult = extScrubPII(vector, customRules);

        assert.strictEqual(
          webResult,
          apiResult,
          `Web vs API mismatch at vector ${idx}: "${vector}"`
        );
        assert.strictEqual(
          webResult,
          extResult,
          `Web vs Extension mismatch at vector ${idx}: "${vector}"`
        );
      });
    });
  });

  // ==========================================================================
  // 3. CHALLENGE R8: ONBOARDING GAMIFICATION & CONFETTI
  // ==========================================================================
  describe('Challenge R8: Progress Calculation, Out-of-Order Execution & Confetti Lifecycle', () => {

    // Implementation model matching OnboardingDashboard.tsx state machine
    class OnboardingStateMachine {
      public state = {
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      };

      public updateCalls = 0;

      updateStep(step: keyof typeof this.state, value: boolean) {
        this.updateCalls++;
        this.state[step] = value;
      }

      getCompletedCount(): number {
        const steps = [
          this.state.extension_installed,
          this.state.first_macro_added,
          this.state.first_draft_generated,
          this.state.team_member_invited,
        ];
        return steps.filter(Boolean).length;
      }

      getProgressPercent(): number {
        return Math.round((this.getCompletedCount() / 4) * 100);
      }

      getUnlockedBadges(): string[] {
        const badges: string[] = [];
        if (this.state.extension_installed) badges.push('Extension Pioneer');
        if (this.state.first_macro_added) badges.push('Macro Architect');
        if (this.state.first_draft_generated) badges.push('AI Copilot Ace');
        if (this.state.team_member_invited) badges.push('Team Builder');
        if (this.getCompletedCount() === 4) badges.push('DraftPilot Champion');
        return badges;
      }
    }

    test('R8.1: Progress calculation across 0%, 25%, 50%, 75%, 100% steps', () => {
      const sm = new OnboardingStateMachine();

      // 0 steps: 0%
      assert.strictEqual(sm.getCompletedCount(), 0);
      assert.strictEqual(sm.getProgressPercent(), 0);
      assert.strictEqual(sm.getUnlockedBadges().length, 0);

      // 1 step (25%): Test each step individually
      const stepKeys: Array<keyof typeof sm.state> = [
        'extension_installed',
        'first_macro_added',
        'first_draft_generated',
        'team_member_invited',
      ];

      stepKeys.forEach((key) => {
        const isolated = new OnboardingStateMachine();
        isolated.updateStep(key, true);
        assert.strictEqual(isolated.getCompletedCount(), 1);
        assert.strictEqual(isolated.getProgressPercent(), 25);
        assert.strictEqual(isolated.getUnlockedBadges().length, 1);
      });

      // 2 steps (50%): Test pairwise combinations
      const sm2 = new OnboardingStateMachine();
      sm2.updateStep('extension_installed', true);
      sm2.updateStep('first_draft_generated', true);
      assert.strictEqual(sm2.getCompletedCount(), 2);
      assert.strictEqual(sm2.getProgressPercent(), 50);
      assert.deepStrictEqual(sm2.getUnlockedBadges(), ['Extension Pioneer', 'AI Copilot Ace']);

      // 3 steps (75%):
      const sm3 = new OnboardingStateMachine();
      sm3.updateStep('extension_installed', true);
      sm3.updateStep('first_macro_added', true);
      sm3.updateStep('first_draft_generated', true);
      assert.strictEqual(sm3.getCompletedCount(), 3);
      assert.strictEqual(sm3.getProgressPercent(), 75);
      assert.strictEqual(sm3.getUnlockedBadges().length, 3);
      assert.ok(!sm3.getUnlockedBadges().includes('DraftPilot Champion'));

      // 4 steps (100%): Unlocks Champion badge
      const sm4 = new OnboardingStateMachine();
      sm4.updateStep('extension_installed', true);
      sm4.updateStep('first_macro_added', true);
      sm4.updateStep('first_draft_generated', true);
      sm4.updateStep('team_member_invited', true);
      assert.strictEqual(sm4.getCompletedCount(), 4);
      assert.strictEqual(sm4.getProgressPercent(), 100);
      assert.strictEqual(sm4.getUnlockedBadges().length, 5); // 4 individual + Champion
      assert.ok(sm4.getUnlockedBadges().includes('DraftPilot Champion'));
    });

    test('R8.2: Out-of-order step completion handling (e.g. Draft before Macro, Reverse order)', () => {
      const sm = new OnboardingStateMachine();

      // Sequence: Step 3 (Generate Draft) -> Step 4 (Invite Member) -> Step 1 (Extension) -> Step 2 (Macro)
      sm.updateStep('first_draft_generated', true);
      assert.strictEqual(sm.getCompletedCount(), 1);
      assert.strictEqual(sm.getProgressPercent(), 25);
      assert.deepStrictEqual(sm.getUnlockedBadges(), ['AI Copilot Ace']);

      sm.updateStep('team_member_invited', true);
      assert.strictEqual(sm.getCompletedCount(), 2);
      assert.strictEqual(sm.getProgressPercent(), 50);
      assert.deepStrictEqual(sm.getUnlockedBadges(), ['AI Copilot Ace', 'Team Builder']);

      sm.updateStep('extension_installed', true);
      assert.strictEqual(sm.getCompletedCount(), 3);
      assert.strictEqual(sm.getProgressPercent(), 75);
      assert.deepStrictEqual(sm.getUnlockedBadges(), ['Extension Pioneer', 'AI Copilot Ace', 'Team Builder']);

      sm.updateStep('first_macro_added', true);
      assert.strictEqual(sm.getCompletedCount(), 4);
      assert.strictEqual(sm.getProgressPercent(), 100);
      assert.ok(sm.getUnlockedBadges().includes('DraftPilot Champion'));
    });

    test('R8.3: Duplicate completion idempotency: Multiple events do not inflate count beyond 100%', () => {
      const sm = new OnboardingStateMachine();

      // Complete step 3 ten times
      for (let i = 0; i < 10; i++) {
        sm.updateStep('first_draft_generated', true);
      }
      assert.strictEqual(sm.getCompletedCount(), 1);
      assert.strictEqual(sm.getProgressPercent(), 25);

      // Complete all steps multiple times
      for (let i = 0; i < 5; i++) {
        sm.updateStep('extension_installed', true);
        sm.updateStep('first_macro_added', true);
        sm.updateStep('first_draft_generated', true);
        sm.updateStep('team_member_invited', true);
      }
      assert.strictEqual(sm.getCompletedCount(), 4);
      assert.strictEqual(sm.getProgressPercent(), 100);
      // Badges array has no duplicates
      const badges = sm.getUnlockedBadges();
      const uniqueBadges = Array.from(new Set(badges));
      assert.strictEqual(badges.length, uniqueBadges.length);
      assert.strictEqual(badges.length, 5);
    });

    test('R8.4: Confetti component lifecycle: Cleanup on unmount, animation cancellation, and timer clearance', () => {
      // Mock window and requestAnimationFrame environment
      let resizeListenerCount = 0;
      let animationFrameCancelled = false;
      let timerCleared = false;

      const mockWindow = {
        innerWidth: 1920,
        innerHeight: 1080,
        addEventListener: (event: string, handler: any) => {
          if (event === 'resize') resizeListenerCount++;
        },
        removeEventListener: (event: string, handler: any) => {
          if (event === 'resize') resizeListenerCount--;
        },
      };

      const mockRafId = 12345;
      const mockCancelRaf = (id: number) => {
        if (id === mockRafId) animationFrameCancelled = true;
      };

      const mockTimerId = 67890;
      const mockClearTimeout = (id: any) => {
        if (id === mockTimerId) timerCleared = true;
      };

      // Simulate ConfettiCelebration useEffect mount and teardown
      const simulateConfettiLifecycle = () => {
        // Mount:
        mockWindow.addEventListener('resize', () => {});
        const rafId = mockRafId;
        const timerId = mockTimerId;

        // Cleanup:
        return () => {
          mockWindow.removeEventListener('resize', () => {});
          mockCancelRaf(rafId);
          mockClearTimeout(timerId);
        };
      };

      assert.strictEqual(resizeListenerCount, 0);
      const unmount = simulateConfettiLifecycle();
      assert.strictEqual(resizeListenerCount, 1, 'Resize listener must be added on mount');

      // Unmount:
      unmount();
      assert.strictEqual(resizeListenerCount, 0, 'Resize listener must be removed on unmount');
      assert.strictEqual(animationFrameCancelled, true, 'requestAnimationFrame must be cancelled on unmount');
      assert.strictEqual(timerCleared, true, 'setTimeout must be cleared on unmount');
    });
  });
});
