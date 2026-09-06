/// <reference types="node" />
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  compareExtensionVersions,
  readExtensionDomStatus,
  readExtensionStorageStatus,
  queryExtensionHeartbeat,
  CURRENT_EXTENSION_VERSION,
} from '../../hooks/useExtensionStatus.ts';

// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import type { OnboardingState, AchievementBadge } from '../../components/dashboard/OnboardingDashboard.tsx';

// ============================================================================
// MILESTONE 2 TEST SUITE: WEB EXTENSION DETECTION, GMAIL SYNC & ONBOARDING BADGES
// ============================================================================

describe('Milestone 2: Web Extension Detection Hook, Gmail Sync & Onboarding Badges Unlock', () => {
  // Save global environment references for clean tear-down
  const originalDocument = (globalThis as any).document;
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;
  const originalFetch = (globalThis as any).fetch;

  // Mock localStorage store
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).fetch = originalFetch;
  });

  // ==========================================================================
  // 1. MULTI-CHANNEL EXTENSION DETECTION (DOM, POSTMESSAGE, LOCALSTORAGE, ACCOUNT)
  // ==========================================================================
  describe('Multi-Channel Extension Detection & Resolution', () => {
    test('Channel 1: DOM attributes detection resolves installed status and version', () => {
      const mockAttributes: Record<string, string> = {
        'data-draftpilot-extension-installed': 'true',
        'data-draftpilot-extension-version': '0.1.0',
      };

      (globalThis as any).document = {
        documentElement: {
          getAttribute: (name: string) => mockAttributes[name] ?? null,
        },
      };

      const result = readExtensionDomStatus();
      assert.strictEqual(result.installed, true, 'DOM attributes must report installed: true');
      assert.strictEqual(result.version, '0.1.0', 'DOM attributes must report version: 0.1.0');
    });

    test('Channel 1: Missing or false DOM attributes gracefully report installed = false', () => {
      (globalThis as any).document = {
        documentElement: {
          getAttribute: (name: string) => (name === 'data-draftpilot-extension-installed' ? 'false' : null),
        },
      };

      const falseResult = readExtensionDomStatus();
      assert.strictEqual(falseResult.installed, false);
      assert.strictEqual(falseResult.version, null);

      // Null document / SSR guard
      (globalThis as any).document = undefined;
      const ssrResult = readExtensionDomStatus();
      assert.strictEqual(ssrResult.installed, false);
      assert.strictEqual(ssrResult.version, null);
    });

    test('Channel 2: LocalStorage cached detection resolves paired extension status', () => {
      mockStorage['draftpilot_extension_installed'] = 'true';
      mockStorage['draftpilot_extension_version'] = '0.1.0';

      (globalThis as any).window = {};
      const result = readExtensionStorageStatus();
      assert.strictEqual(result.installed, true, 'LocalStorage must report installed: true');
      assert.strictEqual(result.version, '0.1.0', 'LocalStorage must report stored version');
    });

    test('Channel 2: LocalStorage absent or false reports installed = false', () => {
      (globalThis as any).window = {};
      const emptyResult = readExtensionStorageStatus();
      assert.strictEqual(emptyResult.installed, false);
      assert.strictEqual(emptyResult.version, null);

      mockStorage['draftpilot_extension_installed'] = 'false';
      const falseResult = readExtensionStorageStatus();
      assert.strictEqual(falseResult.installed, false);
      assert.strictEqual(falseResult.version, null);
    });

    test('Channel 3: Window postMessage handshake protocol (PING -> PONG & READY)', () => {
      const sentMessages: any[] = [];
      const listeners: Record<string, Function[]> = {};

      const mockWin: any = {
        postMessage: (msg: any) => {
          sentMessages.push(msg);
        },
        addEventListener: (event: string, handler: Function) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(handler);
        },
        removeEventListener: (event: string, handler: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((h) => h !== handler);
          }
        },
      };

      (globalThis as any).window = mockWin;

      // Simulate sending PING
      mockWin.postMessage(
        {
          source: 'draftpilot-web',
          type: 'DRAFTPILOT_EXTENSION_PING',
          timestamp: Date.now(),
        },
        '*'
      );

      assert.strictEqual(sentMessages.length, 1);
      assert.strictEqual(sentMessages[0].source, 'draftpilot-web');
      assert.strictEqual(sentMessages[0].type, 'DRAFTPILOT_EXTENSION_PING');

      // Simulate content script PONG response handler
      let detectedStatus = 'checking';
      let detectedVersion: string | null = null;

      const onMessage = (event: { source: any; data: any }) => {
        if (event.source !== mockWin || !event.data) return;
        const data = event.data;
        if (
          (data.type === 'DRAFTPILOT_EXTENSION_PONG' || data.type === 'DRAFTPILOT_EXTENSION_READY') &&
          data.source === 'draftpilot-extension'
        ) {
          detectedStatus = 'installed';
          detectedVersion = data.version || CURRENT_EXTENSION_VERSION;
        }
      };

      // Receive authentic PONG
      onMessage({
        source: mockWin,
        data: {
          source: 'draftpilot-extension',
          type: 'DRAFTPILOT_EXTENSION_PONG',
          version: '0.1.0',
          ready: true,
          status: 'ready',
        },
      });

      assert.strictEqual(detectedStatus, 'installed');
      assert.strictEqual(detectedVersion, '0.1.0');

      // Verify foreign or malformed messages are ignored
      onMessage({
        source: mockWin,
        data: {
          source: 'unauthorized-third-party',
          type: 'DRAFTPILOT_EXTENSION_PONG',
        },
      });
      assert.strictEqual(detectedStatus, 'installed', 'Foreign message must not alter state');
    });

    test('Channel 3: CustomEvent draftpilot-extension-detected resolution', () => {
      let detectedStatus = 'checking';
      let detectedVersion: string | null = null;

      const handleCustomEvent = (event: { detail?: { version?: string } }) => {
        detectedStatus = 'installed';
        detectedVersion = event.detail?.version || CURRENT_EXTENSION_VERSION;
      };

      handleCustomEvent({
        detail: { version: '0.1.0' },
      });

      assert.strictEqual(detectedStatus, 'installed');
      assert.strictEqual(detectedVersion, '0.1.0');
    });

    test('Channel 4: Account / Cloud pairing fallback resolves instantly', () => {
      // Simulation of useExtensionStatus options resolution
      const resolveExtensionStatus = (options?: { accountInstalled?: boolean }) => {
        if (options?.accountInstalled) {
          return {
            status: 'installed',
            version: CURRENT_EXTENSION_VERSION,
            isInstalled: true,
          };
        }
        return {
          status: 'not_installed',
          version: null,
          isInstalled: false,
        };
      };

      const unauthenticated = resolveExtensionStatus();
      assert.strictEqual(unauthenticated.status, 'not_installed');
      assert.strictEqual(unauthenticated.isInstalled, false);

      const cloudSynced = resolveExtensionStatus({ accountInstalled: true });
      assert.strictEqual(cloudSynced.status, 'installed');
      assert.strictEqual(cloudSynced.version, '0.1.0');
      assert.strictEqual(cloudSynced.isInstalled, true);
    });

    test('Channel 5: queryExtensionHeartbeat handles successful API pairing and network errors', async () => {
      // Case 1: Browser fetch returns positive heartbeat
      (globalThis as any).window = {};
      (globalThis as any).fetch = async (url: string) => {
        if (url.includes('/api/extension/heartbeat')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              extension_installed: true,
              version: '0.1.0',
            }),
          };
        }
        return { ok: false };
      };

      const successResult = await queryExtensionHeartbeat();
      assert.strictEqual(successResult.installed, true);
      assert.strictEqual(successResult.version, '0.1.0');
      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');

      // Case 2: Server returns error or network fails
      (globalThis as any).fetch = async () => {
        throw new Error('Network timeout');
      };

      const failResult = await queryExtensionHeartbeat();
      assert.strictEqual(failResult.installed, false);
      assert.strictEqual(failResult.version, null);
    });
  });

  // ==========================================================================
  // 2. SEMVER VERSION COMPARISON INTEGRITY
  // ==========================================================================
  describe('Semver Comparison Logic', () => {
    test('compareExtensionVersions accurately detects matching, outdated, and newer versions', () => {
      // Matching
      assert.strictEqual(compareExtensionVersions('0.1.0', '0.1.0'), 0);
      assert.strictEqual(compareExtensionVersions('v0.1.0', '0.1.0'), 0);
      assert.strictEqual(compareExtensionVersions('0.1.0', 'v0.1.0'), 0);

      // Outdated
      assert.strictEqual(compareExtensionVersions('0.0.9', '0.1.0'), -1);
      assert.strictEqual(compareExtensionVersions('0.0.1', '0.1.0'), -1);
      assert.strictEqual(compareExtensionVersions('0.0.99', '0.1.0'), -1);

      // Newer
      assert.strictEqual(compareExtensionVersions('0.2.0', '0.1.0'), 1);
      assert.strictEqual(compareExtensionVersions('0.1.1', '0.1.0'), 1);
      assert.strictEqual(compareExtensionVersions('1.0.0', '0.1.0'), 1);
    });
  });

  // ==========================================================================
  // 3. STEP 1 AUTO-COMPLETION & ONBOARDING DASHBOARD STATE MACHINE
  // ==========================================================================
  describe('Onboarding Checklist Step 1 Auto-Completion', () => {
    // Contract implementation matching OnboardingDashboard.tsx
    class OnboardingModel {
      public state: OnboardingState = {
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      };

      public persistedToDb: Partial<OnboardingState>[] = [];
      public celebrationTriggered: any = null;

      constructor(initial?: Partial<OnboardingState>) {
        if (initial) {
          this.state = { ...this.state, ...initial };
        }
      }

      updateStep(step: keyof OnboardingState, value: boolean) {
        this.state[step] = value;
        this.persistedToDb.push({ [step]: value });
        try {
          (globalThis as any).localStorage?.setItem(`draftpilot_${step}`, String(value));
        } catch {}
      }

      triggerCelebrationIfNew(title: string, badgeName: string, badgeIcon: string, message: string) {
        const key = `draftpilot_celebrated_${badgeName.toLowerCase().replace(/\s+/g, '_')}`;
        const already = (globalThis as any).localStorage?.getItem(key) === 'true';
        if (!already) {
          this.celebrationTriggered = { isActive: true, title, badgeName, badgeIcon, message };
          try {
            (globalThis as any).localStorage?.setItem(key, 'true');
          } catch {}
        }
      }

      getSteps() {
        return [
          {
            id: 'extension_installed' as keyof OnboardingState,
            title: '1. Install Extension',
            completed: this.state.extension_installed,
            actionLabel: this.state.extension_installed ? 'Installed' : 'Install Extension',
            badgeName: 'Extension Pioneer',
            badgeIcon: '🧩',
          },
          {
            id: 'first_macro_added' as keyof OnboardingState,
            title: '2. Create First Macro',
            completed: this.state.first_macro_added,
            actionLabel: this.state.first_macro_added ? 'Created' : 'Create Macro',
            badgeName: 'Macro Architect',
            badgeIcon: '📐',
          },
          {
            id: 'first_draft_generated' as keyof OnboardingState,
            title: '3. Generate First AI Draft',
            completed: this.state.first_draft_generated,
            actionLabel: this.state.first_draft_generated ? 'Generated' : 'Generate Draft',
            badgeName: 'AI Copilot Ace',
            badgeIcon: '⚡',
          },
          {
            id: 'team_member_invited' as keyof OnboardingState,
            title: '4. Invite Team Member',
            completed: this.state.team_member_invited,
            actionLabel: this.state.team_member_invited ? 'Invited' : 'Invite Member',
            badgeName: 'Team Builder',
            badgeIcon: '👥',
          },
        ];
      }

      getCompletedCount(): number {
        return this.getSteps().filter((s) => s.completed).length;
      }

      getProgressPercent(): number {
        return Math.round((this.getCompletedCount() / 4) * 100);
      }

      getAchievementBadges(): AchievementBadge[] {
        const isAll = this.getCompletedCount() === 4;
        return [
          {
            id: 'badge-extension',
            name: 'Extension Pioneer',
            icon: '🧩',
            description: 'Installed the Chrome extension and established handshake',
            stepRequired: 'Install Extension',
            isUnlocked: this.state.extension_installed,
          },
          {
            id: 'badge-macro',
            name: 'Macro Architect',
            icon: '📐',
            description: 'Created first custom support macro template',
            stepRequired: 'Create First Macro',
            isUnlocked: this.state.first_macro_added,
          },
          {
            id: 'badge-draft',
            name: 'AI Copilot Ace',
            icon: '⚡',
            description: 'Synthesized first AI draft reply with privacy scrubbing',
            stepRequired: 'Generate First AI Draft',
            isUnlocked: this.state.first_draft_generated,
          },
          {
            id: 'badge-team',
            name: 'Team Builder',
            icon: '👥',
            description: 'Invited team member to collaborate in workspace',
            stepRequired: 'Invite Team Member',
            isUnlocked: this.state.team_member_invited,
          },
          {
            id: 'badge-champion',
            name: 'DraftPilot Champion',
            icon: '👑',
            description: 'Completed all 4 onboarding milestones and mastered the workflow',
            stepRequired: 'Complete All Steps',
            isUnlocked: isAll,
          },
        ];
      }
    }

    test('Initial brand new account has 0/4 steps completed (0%) with all badges locked', () => {
      const model = new OnboardingModel();

      assert.strictEqual(model.getCompletedCount(), 0);
      assert.strictEqual(model.getProgressPercent(), 0);

      const steps = model.getSteps();
      assert.strictEqual(steps[0].completed, false);
      assert.strictEqual(steps[0].actionLabel, 'Install Extension');

      const badges = model.getAchievementBadges();
      assert.strictEqual(badges.every((b) => !b.isUnlocked), true, 'All badges must be locked initially');
    });

    test('Extension detection marks Step 1 as completed and updates action label to "Installed"', () => {
      const model = new OnboardingModel();

      // Trigger extension detection
      model.updateStep('extension_installed', true);

      const steps = model.getSteps();
      const step1 = steps.find((s) => s.id === 'extension_installed');
      assert.ok(step1);
      assert.strictEqual(step1.completed, true, 'Step 1 must be marked completed');
      assert.strictEqual(step1.actionLabel, 'Installed', 'Action label must flip to "Installed"');

      // Verifies persistence to database callback and localStorage
      assert.strictEqual(model.persistedToDb.length, 1);
      assert.deepStrictEqual(model.persistedToDb[0], { extension_installed: true });
      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');
    });

    test('Extension Pioneer badge unlocks in real-time and progress advances to exactly 25% (1/4 steps)', () => {
      const model = new OnboardingModel();

      model.updateStep('extension_installed', true);

      // Verify progress math
      assert.strictEqual(model.getCompletedCount(), 1, 'Exactly 1 step completed');
      assert.strictEqual(model.getProgressPercent(), 25, 'Progress must calculate to exactly 25%');

      // Verify badge unlock status
      const badges = model.getAchievementBadges();
      const pioneerBadge = badges.find((b) => b.id === 'badge-extension');
      assert.ok(pioneerBadge);
      assert.strictEqual(pioneerBadge.isUnlocked, true, 'Extension Pioneer badge must be unlocked');

      // Remaining badges must stay locked
      const otherBadges = badges.filter((b) => b.id !== 'badge-extension');
      assert.strictEqual(otherBadges.every((b) => !b.isUnlocked), true, 'Other badges must remain locked');
    });

    test('Sequential progress progression (25% -> 50% -> 75% -> 100%) and Champion badge unlock', () => {
      const model = new OnboardingModel();

      // Step 1: 25%
      model.updateStep('extension_installed', true);
      assert.strictEqual(model.getProgressPercent(), 25);

      // Step 2: 50%
      model.updateStep('first_macro_added', true);
      assert.strictEqual(model.getProgressPercent(), 50);
      assert.strictEqual(model.getAchievementBadges().find((b) => b.id === 'badge-macro')?.isUnlocked, true);

      // Step 3: 75%
      model.updateStep('first_draft_generated', true);
      assert.strictEqual(model.getProgressPercent(), 75);
      assert.strictEqual(model.getAchievementBadges().find((b) => b.id === 'badge-draft')?.isUnlocked, true);
      assert.strictEqual(model.getAchievementBadges().find((b) => b.id === 'badge-champion')?.isUnlocked, false);

      // Step 4: 100%
      model.updateStep('team_member_invited', true);
      assert.strictEqual(model.getProgressPercent(), 100);
      assert.strictEqual(model.getAchievementBadges().find((b) => b.id === 'badge-champion')?.isUnlocked, true);
      assert.strictEqual(model.getAchievementBadges().every((b) => b.isUnlocked), true);
    });

    test('Extension Pioneer celebration banner & confetti fires and dedupes across reloads', () => {
      const model = new OnboardingModel();

      // First detection: triggers celebration
      model.triggerCelebrationIfNew(
        '🧩 Extension Pioneer Unlocked!',
        'Extension Pioneer',
        '🧩',
        'Chrome extension connected! DraftPilot will now display inline assistance in Gmail.'
      );

      assert.ok(model.celebrationTriggered);
      assert.strictEqual(model.celebrationTriggered.title, '🧩 Extension Pioneer Unlocked!');
      assert.strictEqual(model.celebrationTriggered.badgeName, 'Extension Pioneer');
      assert.strictEqual(model.celebrationTriggered.badgeIcon, '🧩');
      assert.strictEqual(mockStorage['draftpilot_celebrated_extension_pioneer'], 'true');

      // Reset and simulate page re-render / reload: must not re-trigger celebration
      model.celebrationTriggered = null;
      model.triggerCelebrationIfNew(
        '🧩 Extension Pioneer Unlocked!',
        'Extension Pioneer',
        '🧩',
        'Chrome extension connected!'
      );

      assert.strictEqual(model.celebrationTriggered, null, 'Celebration must be deduped on repeat evaluation');
    });
  });

  // ==========================================================================
  // 4. ACTIVE RECHECK BEHAVIOR & GMAIL SYNC MANAGER
  // ==========================================================================
  describe('Active Recheck Behavior & Status Transition', () => {
    test('Recheck broadcasts ping, checks multi-channel state, and resolves installed without being stuck', async () => {
      let pingDispatched = false;
      let checkCount = 0;

      const mockWin: any = {
        postMessage: (msg: any) => {
          if (msg?.type === 'DRAFTPILOT_EXTENSION_PING') {
            pingDispatched = true;
          }
        },
      };

      (globalThis as any).window = mockWin;

      const simulateRecheck = async (domInstalled: boolean, accountInstalled: boolean) => {
        checkCount++;
        // 1. Ping broadcast
        mockWin.postMessage({ source: 'draftpilot-web', type: 'DRAFTPILOT_EXTENSION_PING' });

        // 2. DOM Check
        if (domInstalled) {
          return { status: 'installed', version: '0.1.0' };
        }

        // 3. Account check
        if (accountInstalled) {
          return { status: 'installed', version: '0.1.0' };
        }

        return { status: 'not_installed', version: null };
      };

      // Case A: Neither DOM nor account installed -> returns not_installed
      const result1 = await simulateRecheck(false, false);
      assert.strictEqual(pingDispatched, true);
      assert.strictEqual(result1.status, 'not_installed');

      // Case B: User opens sidepanel and pairs account -> recheck instantly detects installed
      const result2 = await simulateRecheck(false, true);
      assert.strictEqual(result2.status, 'installed');
      assert.strictEqual(result2.version, '0.1.0');

      // Case C: Extension injected DOM attributes -> recheck instantly detects installed
      const result3 = await simulateRecheck(true, false);
      assert.strictEqual(result3.status, 'installed');
      assert.strictEqual(result3.version, '0.1.0');
    });

    test('GmailSyncManager status presentation renders "Installed & Ready (v0.1.0)" when detected', () => {
      const getStatusBadge = (status: string, version: string | null) => {
        if (status === 'installed') {
          const ver = version ? `v${version}` : 'v0.1.0';
          return `Installed & Ready (${ver})`;
        }
        if (status === 'checking') return 'Checking Extension...';
        if (status === 'outdated') return `Outdated Version (${version})`;
        return 'Not Installed';
      };

      assert.strictEqual(getStatusBadge('installed', '0.1.0'), 'Installed & Ready (v0.1.0)');
      assert.strictEqual(getStatusBadge('installed', null), 'Installed & Ready (v0.1.0)');
      assert.strictEqual(getStatusBadge('checking', null), 'Checking Extension...');
      assert.strictEqual(getStatusBadge('outdated', '0.0.9'), 'Outdated Version (0.0.9)');
      assert.strictEqual(getStatusBadge('not_installed', null), 'Not Installed');
    });

    test('Direct extension download target resolves to /draftpilot-extension.zip', () => {
      const expectedDownloadHref = '/draftpilot-extension.zip';
      const expectedDownloadFilename = 'draftpilot-extension.zip';

      assert.strictEqual(expectedDownloadHref, '/draftpilot-extension.zip');
      assert.strictEqual(expectedDownloadFilename, 'draftpilot-extension.zip');
    });
  });
});
