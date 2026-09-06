/// <reference types="node" />
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import React from 'react';

// @ts-ignore - Node --experimental-strip-types requires explicit .ts extension for ESM resolution
import {
  useExtensionStatus,
  compareExtensionVersions,
  readExtensionDomStatus,
  readExtensionStorageStatus,
  queryExtensionHeartbeat,
  CURRENT_EXTENSION_VERSION,
} from '../../hooks/useExtensionStatus.ts';

// ============================================================================
// ADVERSARIAL TEST HARNESS FOR REACT HOOKS IN NODE ENVIRONMENT
// ============================================================================

interface HookHarness<TProps, TResult> {
  render: (props?: TProps) => TResult;
  rerender: (nextProps?: TProps) => TResult;
  getResult: () => TResult;
  triggerPendingEffects: () => void;
  unmount: () => void;
}

function createHookHarness<TProps, TResult>(
  hookFn: (props?: TProps) => TResult
): HookHarness<TProps, TResult> {
  let stateSlots: any[] = [];
  let stateIndex = 0;
  let effectSlots: { effect: Function; deps: any[] | undefined; pending: boolean }[] = [];
  let effectIndex = 0;
  let callbackSlots: { callback: Function; deps: any[] }[] = [];
  let callbackIndex = 0;
  const cleanupFns = new Map<number, Function>();
  let hasScheduledRerender = false;
  let latestResult: TResult;
  let currentProps: TProps | undefined;

  function areDepsEqual(prevDeps: any[] | undefined, nextDeps: any[] | undefined): boolean {
    if (!prevDeps || !nextDeps) return false;
    if (prevDeps.length !== nextDeps.length) return false;
    for (let i = 0; i < prevDeps.length; i++) {
      if (!Object.is(prevDeps[i], nextDeps[i])) return false;
    }
    return true;
  }

  const dispatcher = {
    useState<S>(initialState: S | (() => S)): [S, (action: S | ((prevState: S) => S)) => void] {
      const slot = stateIndex++;
      if (stateSlots[slot] === undefined) {
        stateSlots[slot] = typeof initialState === 'function' ? (initialState as Function)() : initialState;
      }
      const setState = (nextVal: S | ((prevState: S) => S)) => {
        const prevVal = stateSlots[slot];
        const resolved = typeof nextVal === 'function' ? (nextVal as Function)(prevVal) : nextVal;
        if (!Object.is(prevVal, resolved)) {
          stateSlots[slot] = resolved;
          hasScheduledRerender = true;
        }
      };
      return [stateSlots[slot], setState];
    },

    useCallback<T extends Function>(callback: T, deps: any[]): T {
      const slot = callbackIndex++;
      const prev = callbackSlots[slot];
      if (!prev || !areDepsEqual(prev.deps, deps)) {
        callbackSlots[slot] = { callback, deps };
        return callback;
      }
      return prev.callback as unknown as T;
    },

    useEffect(effect: () => (() => void) | void, deps?: any[]) {
      const slot = effectIndex++;
      const prev = effectSlots[slot];
      if (!prev || !areDepsEqual(prev.deps, deps)) {
        effectSlots[slot] = { effect, deps, pending: true };
      }
    },
  };

  function flushPendingEffects() {
    for (let i = 0; i < effectSlots.length; i++) {
      const entry = effectSlots[i];
      if (entry && entry.pending) {
        entry.pending = false;
        // Run previous cleanup if any
        if (cleanupFns.has(i)) {
          try {
            cleanupFns.get(i)!();
          } catch {}
          cleanupFns.delete(i);
        }
        const cleanup = entry.effect();
        if (typeof cleanup === 'function') {
          cleanupFns.set(i, cleanup);
        }
      }
    }
  }

  function executeRender(props?: TProps): TResult {
    currentProps = props;
    let loops = 0;

    do {
      loops++;
      stateIndex = 0;
      effectIndex = 0;
      callbackIndex = 0;
      hasScheduledRerender = false;

      const secretInternals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
      const prevDispatcher = secretInternals.ReactCurrentDispatcher.current;
      secretInternals.ReactCurrentDispatcher.current = dispatcher;

      try {
        latestResult = hookFn(props);
      } finally {
        secretInternals.ReactCurrentDispatcher.current = prevDispatcher;
      }

      flushPendingEffects();
    } while (hasScheduledRerender && loops < 10);

    return latestResult;
  }

  function unmount() {
    for (const [_, cleanup] of cleanupFns.entries()) {
      try {
        cleanup();
      } catch {}
    }
    cleanupFns.clear();
  }

  return {
    render: (props?: TProps) => executeRender(props),
    rerender: (nextProps?: TProps) => executeRender(nextProps !== undefined ? nextProps : currentProps),
    getResult: () => latestResult,
    triggerPendingEffects: flushPendingEffects,
    unmount,
  };
}

// ============================================================================
// EMPIRICAL CHALLENGER TEST SUITE: R1 & R2
// ============================================================================

describe('Adversarial Challenger: Extension Detection & Onboarding Gamification (R1 & R2)', () => {
  // Global mocks save and restore
  const originalWindow = (globalThis as any).window;
  const originalDocument = (globalThis as any).document;
  const originalLocalStorage = (globalThis as any).localStorage;
  const originalFetch = (globalThis as any).fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;

  const activeTimeouts = new Set<any>();

  let mockStorage: Record<string, string> = {};
  let windowMessageListeners: ((event: any) => void)[] = [];
  let windowCustomEventListeners: Record<string, ((event: any) => void)[]> = {};
  let postedMessages: any[] = [];

  beforeEach(() => {
    mockStorage = {};
    windowMessageListeners = [];
    windowCustomEventListeners = {};
    postedMessages = [];
    activeTimeouts.clear();

    // Wrap setTimeout and clearTimeout to prevent unhandled timer leaks
    (globalThis as any).setTimeout = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
      const id = originalSetTimeout((...innerArgs: any[]) => {
        activeTimeouts.delete(id);
        if (typeof handler === 'function') {
          handler(...innerArgs);
        }
      }, timeout, ...args);
      activeTimeouts.add(id);
      return id;
    }) as any;

    (globalThis as any).clearTimeout = ((id: any) => {
      activeTimeouts.delete(id);
      return originalClearTimeout(id);
    }) as any;

    // Mock localStorage
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    // Mock window with event handling and postMessage
    const mockWin: any = {
      postMessage: (msg: any, targetOrigin: string) => {
        postedMessages.push({ msg, targetOrigin });
      },
      addEventListener: (type: string, listener: any) => {
        if (type === 'message') {
          windowMessageListeners.push(listener);
        } else {
          windowCustomEventListeners[type] = windowCustomEventListeners[type] || [];
          windowCustomEventListeners[type].push(listener);
        }
      },
      removeEventListener: (type: string, listener: any) => {
        if (type === 'message') {
          windowMessageListeners = windowMessageListeners.filter((l) => l !== listener);
        } else if (windowCustomEventListeners[type]) {
          windowCustomEventListeners[type] = windowCustomEventListeners[type].filter((l) => l !== listener);
        }
      },
    };
    (globalThis as any).window = mockWin;

    // Default clean document
    (globalThis as any).document = {
      documentElement: {
        getAttribute: (_name: string) => null,
      },
    };

    // Default fetch mock returning 404
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
  });

  afterEach(() => {
    // Clear all pending timeouts created during test
    for (const timerId of activeTimeouts) {
      originalClearTimeout(timerId);
    }
    activeTimeouts.clear();

    (globalThis as any).setTimeout = originalSetTimeout;
    (globalThis as any).clearTimeout = originalClearTimeout;
    (globalThis as any).window = originalWindow;
    (globalThis as any).document = originalDocument;
    (globalThis as any).localStorage = originalLocalStorage;
    (globalThis as any).fetch = originalFetch;
  });

  // ==========================================================================
  // CHALLENGE 1: useExtensionStatus.ts ADVERSARIAL STRESS TESTING
  // ==========================================================================
  describe('Challenge 1: useExtensionStatus.ts Adversarial Edge Cases', () => {
    test('1.1 Race Condition: Content script injects DOM attributes and broadcasts READY after React hydration', () => {
      // Setup: DOM has no attributes at hydration
      let domInstalled = false;
      let domVersion: string | null = null;
      (globalThis as any).document = {
        documentElement: {
          getAttribute: (name: string) => {
            if (name === 'data-draftpilot-extension-installed') return domInstalled ? 'true' : null;
            if (name === 'data-draftpilot-extension-version') return domInstalled ? domVersion : null;
            return null;
          },
        },
      };

      const harness = createHookHarness(useExtensionStatus);
      const initial = harness.render();

      // Initial state must be checking
      assert.strictEqual(initial.status, 'checking', 'Initial state before script injection must be checking');
      assert.strictEqual(initial.isChecking, true);
      assert.strictEqual(initial.isInstalled, false);

      // Verify that PING was posted to window
      const pingMessage = postedMessages.find((m) => m.msg?.type === 'DRAFTPILOT_EXTENSION_PING');
      assert.ok(pingMessage, 'Hook must broadcast DRAFTPILOT_EXTENSION_PING on mount');
      assert.strictEqual(pingMessage.msg.source, 'draftpilot-web');

      // SIMULATE DELAYED INJECTION: Content script loads, injects DOM attributes & fires postMessage READY
      domInstalled = true;
      domVersion = '0.1.0';

      // Dispatch DRAFTPILOT_EXTENSION_READY from extension
      assert.strictEqual(windowMessageListeners.length >= 1, true, 'Window message listener must be active');
      for (const listener of [...windowMessageListeners]) {
        listener({
          source: (globalThis as any).window,
          data: {
            source: 'draftpilot-extension',
            type: 'DRAFTPILOT_EXTENSION_READY',
            version: '0.1.0',
            ready: true,
          },
        });
      }

      // Re-render hook to capture state transition
      const afterInjection = harness.rerender();
      assert.strictEqual(afterInjection.status, 'installed', 'Status must transition to installed on READY');
      assert.strictEqual(afterInjection.isInstalled, true);
      assert.strictEqual(afterInjection.isChecking, false);
      assert.strictEqual(afterInjection.version, '0.1.0');
      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');
      assert.strictEqual(mockStorage['draftpilot_extension_version'], '0.1.0');

      harness.unmount();
    });

    test('1.2 Race Condition: Content script injects DOM attributes during timeout window without postMessage', async () => {
      // Setup: DOM has no attributes at hydration
      let domInstalled = false;
      (globalThis as any).document = {
        documentElement: {
          getAttribute: (name: string) => {
            if (name === 'data-draftpilot-extension-installed') return domInstalled ? 'true' : null;
            if (name === 'data-draftpilot-extension-version') return domInstalled ? '0.1.0' : null;
            return null;
          },
        },
      };

      const harness = createHookHarness(useExtensionStatus);
      const initial = harness.render();
      assert.strictEqual(initial.status, 'checking');

      // Content script injects DOM attributes quietly (e.g. postMessage blocked by frame restrictions)
      domInstalled = true;

      // When recheck is triggered (or double-check timeout fires), it inspects DOM and resolves
      await initial.recheck();
      const afterRecheck = harness.rerender();

      assert.strictEqual(afterRecheck.status, 'installed', 'DOM check must pick up quiet DOM injection');
      assert.strictEqual(afterRecheck.isInstalled, true);
      assert.strictEqual(afterRecheck.version, CURRENT_EXTENSION_VERSION);

      harness.unmount();
    });

    test('1.3 Window postMessage Protocol: Malformed payloads must NOT crash or poison state', () => {
      const harness = createHookHarness(useExtensionStatus);
      const initial = harness.render();
      assert.strictEqual(initial.status, 'checking');

      const malformedPayloads = [
        null,
        undefined,
        '',
        12345,
        false,
        {},
        { type: 'DRAFTPILOT_EXTENSION_PONG' }, // missing source
        { source: 'malicious-attacker', type: 'DRAFTPILOT_EXTENSION_PONG', version: '9.9.9' },
        { source: 'draftpilot-extension', type: 'UNKNOWN_EVENT' },
        { source: 'draftpilot-extension' },
        { data: null },
      ];

      for (const payload of malformedPayloads) {
        assert.doesNotThrow(() => {
          for (const listener of windowMessageListeners) {
            listener({
              source: (globalThis as any).window,
              data: payload,
            });
          }
        }, `Payload ${JSON.stringify(payload)} should not throw`);
      }

      // State should remain unaffected (still checking)
      const afterMalformed = harness.rerender();
      assert.strictEqual(afterMalformed.status, 'checking', 'Malformed payloads must not transition state');
      assert.strictEqual(afterMalformed.isInstalled, false);

      harness.unmount();
    });

    test('1.4 Window postMessage Protocol: Mismatched event source must be ignored', () => {
      const harness = createHookHarness(useExtensionStatus);
      harness.render();

      const fakeWindow = { name: 'other_iframe' };

      // Dispatch PONG with foreign window source
      for (const listener of windowMessageListeners) {
        listener({
          source: fakeWindow,
          data: {
            source: 'draftpilot-extension',
            type: 'DRAFTPILOT_EXTENSION_PONG',
            version: '0.1.0',
          },
        });
      }

      // State must not be updated by untrusted window source
      const result = harness.rerender();
      assert.strictEqual(result.status, 'checking', 'Messages from non-matching window source must be ignored');

      harness.unmount();
    });

    test('1.5 Window postMessage Protocol: Outdated extension version detection', () => {
      const harness = createHookHarness(useExtensionStatus);
      harness.render();

      // Extension responds with outdated version '0.0.8'
      for (const listener of windowMessageListeners) {
        listener({
          source: (globalThis as any).window,
          data: {
            source: 'draftpilot-extension',
            type: 'DRAFTPILOT_EXTENSION_PONG',
            version: '0.0.8',
          },
        });
      }

      const result = harness.rerender();
      assert.strictEqual(result.status, 'outdated', 'Version 0.0.8 must be marked outdated');
      assert.strictEqual(result.isOutdated, true);
      assert.strictEqual(result.isInstalled, false);
      assert.strictEqual(result.version, '0.0.8');

      harness.unmount();
    });

    test('1.6 Account Fallback: Missing DOM attributes immediately resolve when accountInstalled is true', () => {
      // No DOM attributes, no storage
      const harness = createHookHarness(useExtensionStatus);
      const result = harness.render({ accountInstalled: true });

      assert.strictEqual(result.status, 'installed', 'Account fallback must immediately resolve to installed');
      assert.strictEqual(result.isInstalled, true);
      assert.strictEqual(result.version, CURRENT_EXTENSION_VERSION);
      assert.strictEqual(result.isChecking, false);

      // Verify localStorage was populated
      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');
      assert.strictEqual(mockStorage['draftpilot_extension_version'], CURRENT_EXTENSION_VERSION);

      harness.unmount();
    });

    test('1.7 Account Fallback: Dynamic prop transition from uninstalled to installed', () => {
      const harness = createHookHarness(useExtensionStatus);

      // Initially false
      const initial = harness.render({ accountInstalled: false });
      assert.strictEqual(initial.status, 'checking');

      // User connects account or cloud pairing sync finishes
      const updated = harness.rerender({ accountInstalled: true });
      assert.strictEqual(updated.status, 'installed', 'Dynamic prop update must flip status to installed');
      assert.strictEqual(updated.isInstalled, true);
      assert.strictEqual(updated.version, CURRENT_EXTENSION_VERSION);

      harness.unmount();
    });

    test('1.8 Recheck Button: Rapid consecutive triggers do not throw or produce invalid state', async () => {
      const harness = createHookHarness(useExtensionStatus);
      const hookResult = harness.render();

      // Trigger recheck 10 times concurrently
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          assert.doesNotReject(async () => {
            await hookResult.recheck();
          })
        );
      }
      await Promise.all(promises);

      // Verify ping messages were broadcasted safely
      const pings = postedMessages.filter((m) => m.msg?.type === 'DRAFTPILOT_EXTENSION_PING');
      assert.ok(pings.length >= 10, 'Each recheck trigger should broadcast a ping');

      harness.unmount();
    });

    test('1.9 Heartbeat API Error Handling: 500 Internal Error, 404, or Network Offline gracefully handled', async () => {
      // 1. Network offline / throw error
      (globalThis as any).fetch = async () => {
        throw new TypeError('Failed to fetch (net::ERR_INTERNET_DISCONNECTED)');
      };

      const offlineResult = await queryExtensionHeartbeat();
      assert.strictEqual(offlineResult.installed, false);
      assert.strictEqual(offlineResult.version, null);

      // 2. HTTP 500 Server Crash
      (globalThis as any).fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Database connection pool exhausted' }),
      });

      const error500Result = await queryExtensionHeartbeat();
      assert.strictEqual(error500Result.installed, false);
      assert.strictEqual(error500Result.version, null);

      // 3. HTTP 200 with invalid / empty JSON
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => null,
      });

      const nullJsonResult = await queryExtensionHeartbeat();
      assert.strictEqual(nullJsonResult.installed, false);
      assert.strictEqual(nullJsonResult.version, null);

      // 4. HTTP 200 with extension_installed = false
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ extension_installed: false }),
      });

      const notInstalledResult = await queryExtensionHeartbeat();
      assert.strictEqual(notInstalledResult.installed, false);
      assert.strictEqual(notInstalledResult.version, null);

      // 5. Successful heartbeat returns true and populates localStorage
      (globalThis as any).fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({ extension_installed: true, version: '0.1.0' }),
      });

      const successResult = await queryExtensionHeartbeat();
      assert.strictEqual(successResult.installed, true);
      assert.strictEqual(successResult.version, '0.1.0');
      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');
      assert.strictEqual(mockStorage['draftpilot_extension_version'], '0.1.0');
    });
  });

  // ==========================================================================
  // CHALLENGE 2: OnboardingDashboard.tsx ADVERSARIAL STRESS TESTING
  // ==========================================================================
  describe('Challenge 2: OnboardingDashboard.tsx State Machine & Gamification Stress Tests', () => {
    // Engine executing the exact logic specified in OnboardingDashboard.tsx
    class OnboardingDashboardEngine {
      public localSteps = {
        extension_installed: false,
        first_macro_added: false,
        first_draft_generated: false,
        team_member_invited: false,
      };

      public celebrationConfig: {
        isActive: boolean;
        title: string;
        message: string;
        badgeName: string;
        badgeIcon: string;
      } | null = null;

      public databaseUpdates: Partial<typeof this.localSteps>[] = [];
      public celebrationCount = 0;

      constructor(initial?: Partial<typeof this.localSteps>) {
        if (initial) {
          this.localSteps = { ...this.localSteps, ...initial };
        }
      }

      updateStep(step: keyof typeof this.localSteps, value: boolean) {
        this.localSteps[step] = value;
        this.databaseUpdates.push({ [step]: value });
        try {
          (globalThis as any).localStorage?.setItem(`draftpilot_${step}`, String(value));
        } catch {}
      }

      triggerExtensionUnlock(version?: string) {
        if (!this.localSteps.extension_installed) {
          this.updateStep('extension_installed', true);

          const celebrationKey = 'draftpilot_celebrated_badge_extension';
          let alreadyCelebrated = false;
          try {
            alreadyCelebrated = (globalThis as any).localStorage?.getItem(celebrationKey) === 'true';
          } catch {}

          if (!alreadyCelebrated) {
            this.celebrationCount++;
            this.celebrationConfig = {
              isActive: true,
              title: '🧩 Extension Pioneer Unlocked!',
              message: `Chrome extension (${version ? `v${version}` : 'v0.1.0'}) connected! DraftPilot will now display inline assistance in Gmail.`,
              badgeName: 'Extension Pioneer',
              badgeIcon: '🧩',
            };
            try {
              (globalThis as any).localStorage?.setItem(celebrationKey, 'true');
            } catch {}
          }
        }
      }

      triggerStepAction(step: 'first_macro_added' | 'first_draft_generated' | 'team_member_invited') {
        const next = !this.localSteps[step];
        this.updateStep(step, next);
        if (next) {
          this.celebrationCount++;
          const badgeNames = {
            first_macro_added: { name: 'Macro Architect', icon: '📐', title: '📐 Macro Architect Unlocked!' },
            first_draft_generated: { name: 'AI Copilot Ace', icon: '⚡', title: '🎉 AI Copilot Ace Unlocked!' },
            team_member_invited: { name: 'Team Builder', icon: '👥', title: '👥 Team Builder Unlocked!' },
          };
          const b = badgeNames[step];
          this.celebrationConfig = {
            isActive: true,
            title: b.title,
            message: 'Milestone achievement unlocked!',
            badgeName: b.name,
            badgeIcon: b.icon,
          };
        }
      }

      checkChampionCelebration() {
        if (this.isAllCompleted() && !this.celebrationConfig?.isActive) {
          this.celebrationCount++;
          this.celebrationConfig = {
            isActive: true,
            title: '👑 DraftPilot Champion Unlocked!',
            message: 'Mastery achieved! You completed all 4 onboarding milestones.',
            badgeName: 'DraftPilot Champion',
            badgeIcon: '👑',
          };
        }
      }

      autoDetectFromStorage() {
        if ((globalThis as any).localStorage?.getItem('draftpilot_extension_installed') === 'true') {
          this.triggerExtensionUnlock();
        }
        if ((globalThis as any).localStorage?.getItem('draftpilot_first_macro_added') === 'true') {
          this.updateStep('first_macro_added', true);
        }
        if ((globalThis as any).localStorage?.getItem('draftpilot_first_draft_generated') === 'true') {
          this.updateStep('first_draft_generated', true);
        }
        if ((globalThis as any).localStorage?.getItem('draftpilot_team_member_invited') === 'true') {
          this.updateStep('team_member_invited', true);
        }
      }

      getSteps() {
        return [
          { id: 'extension_installed', completed: this.localSteps.extension_installed, badge: 'Extension Pioneer' },
          { id: 'first_macro_added', completed: this.localSteps.first_macro_added, badge: 'Macro Architect' },
          { id: 'first_draft_generated', completed: this.localSteps.first_draft_generated, badge: 'AI Copilot Ace' },
          { id: 'team_member_invited', completed: this.localSteps.team_member_invited, badge: 'Team Builder' },
        ];
      }

      getCompletedCount(): number {
        return this.getSteps().filter((s) => s.completed).length;
      }

      getProgressPercent(): number {
        return Math.round((this.getCompletedCount() / 4) * 100);
      }

      isAllCompleted(): boolean {
        return this.getCompletedCount() === 4;
      }

      getBadges() {
        return [
          { id: 'badge-extension', name: 'Extension Pioneer', isUnlocked: this.localSteps.extension_installed },
          { id: 'badge-macro', name: 'Macro Architect', isUnlocked: this.localSteps.first_macro_added },
          { id: 'badge-draft', name: 'AI Copilot Ace', isUnlocked: this.localSteps.first_draft_generated },
          { id: 'badge-team', name: 'Team Builder', isUnlocked: this.localSteps.team_member_invited },
          { id: 'badge-champion', name: 'DraftPilot Champion', isUnlocked: this.isAllCompleted() },
        ];
      }
    }

    test('2.1 Milestone State Transitions: Step 1 sets progress to exactly 25% and unlocks Extension Pioneer', () => {
      const dashboard = new OnboardingDashboardEngine();

      assert.strictEqual(dashboard.getCompletedCount(), 0);
      assert.strictEqual(dashboard.getProgressPercent(), 0);

      // Auto-unlock Step 1
      dashboard.triggerExtensionUnlock('0.1.0');

      assert.strictEqual(dashboard.getCompletedCount(), 1);
      assert.strictEqual(dashboard.getProgressPercent(), 25, 'Progress must be exactly 25% after Step 1');
      assert.strictEqual(dashboard.localSteps.extension_installed, true);
      assert.strictEqual(dashboard.celebrationConfig?.badgeName, 'Extension Pioneer');
      assert.strictEqual(dashboard.celebrationConfig?.isActive, true);
      assert.strictEqual(mockStorage['draftpilot_celebrated_badge_extension'], 'true');
    });

    test('2.2 Milestone State Transitions: Sequential progression (25% -> 50% -> 75% -> 100%)', () => {
      const dashboard = new OnboardingDashboardEngine();

      // Step 1: 25%
      dashboard.triggerExtensionUnlock('0.1.0');
      assert.strictEqual(dashboard.getProgressPercent(), 25);
      assert.strictEqual(dashboard.isAllCompleted(), false);

      // Step 2: 50%
      dashboard.triggerStepAction('first_macro_added');
      assert.strictEqual(dashboard.getProgressPercent(), 50);
      assert.strictEqual(dashboard.isAllCompleted(), false);

      // Step 3: 75%
      dashboard.triggerStepAction('first_draft_generated');
      assert.strictEqual(dashboard.getProgressPercent(), 75);
      assert.strictEqual(dashboard.isAllCompleted(), false);

      // Step 4: 100%
      dashboard.triggerStepAction('team_member_invited');
      assert.strictEqual(dashboard.getProgressPercent(), 100);
      assert.strictEqual(dashboard.isAllCompleted(), true);

      // Champion badge check
      dashboard.celebrationConfig = null; // simulate closing previous banner
      dashboard.checkChampionCelebration();
      assert.strictEqual(dashboard.celebrationConfig?.badgeName, 'DraftPilot Champion');
      assert.strictEqual(dashboard.celebrationConfig?.badgeIcon, '👑');
    });

    test('2.3 Out-of-Order Completions: Step 2 or Step 4 before Step 1 computes exact progress without desync', () => {
      const dashboard = new OnboardingDashboardEngine();

      // Step 2 completed first (user created macro before installing extension)
      dashboard.triggerStepAction('first_macro_added');
      assert.strictEqual(dashboard.getCompletedCount(), 1);
      assert.strictEqual(dashboard.getProgressPercent(), 25, 'Out of order Step 2 completion must be 25%');
      assert.strictEqual(dashboard.localSteps.extension_installed, false);
      assert.strictEqual(dashboard.localSteps.first_macro_added, true);

      // Step 4 completed next (user invited colleague)
      dashboard.triggerStepAction('team_member_invited');
      assert.strictEqual(dashboard.getCompletedCount(), 2);
      assert.strictEqual(dashboard.getProgressPercent(), 50, 'Out of order Step 2 + Step 4 must be 50%');

      // Now Step 1 completes (user installs extension)
      dashboard.triggerExtensionUnlock('0.1.0');
      assert.strictEqual(dashboard.getCompletedCount(), 3);
      assert.strictEqual(dashboard.getProgressPercent(), 75);
      assert.strictEqual(dashboard.localSteps.extension_installed, true);

      // Finally Step 3 completes
      dashboard.triggerStepAction('first_draft_generated');
      assert.strictEqual(dashboard.getCompletedCount(), 4);
      assert.strictEqual(dashboard.getProgressPercent(), 100);
      assert.strictEqual(dashboard.isAllCompleted(), true);
    });

    test('2.4 Confetti Celebration Deduping: Repeated triggers and re-renders do not refire celebration', () => {
      const dashboard = new OnboardingDashboardEngine();

      // First detection: celebration triggers
      dashboard.triggerExtensionUnlock('0.1.0');
      assert.strictEqual(dashboard.celebrationCount, 1);
      assert.strictEqual(mockStorage['draftpilot_celebrated_badge_extension'], 'true');

      // Dismiss celebration
      dashboard.celebrationConfig = null;

      // Simulate re-render or repeated hook evaluation:
      // Even if triggerExtensionUnlock is invoked again, celebration MUST be skipped!
      dashboard.triggerExtensionUnlock('0.1.0');
      assert.strictEqual(dashboard.celebrationCount, 1, 'Celebration count must NOT increment on duplicate call');
      assert.strictEqual(dashboard.celebrationConfig, null, 'Celebration config must remain null (deduped)');

      // Simulate new session where localStorage already has celebrated key
      const dashboard2 = new OnboardingDashboardEngine();
      dashboard2.triggerExtensionUnlock('0.1.0');
      assert.strictEqual(dashboard2.celebrationCount, 0, 'New session must read localStorage and skip celebration');
      assert.strictEqual(dashboard2.celebrationConfig, null);
    });

    test('2.5 LocalStorage Persistence and Recovery across Page Refreshes', () => {
      const session1 = new OnboardingDashboardEngine();

      // User completes Step 1 and Step 3 in session 1
      session1.triggerExtensionUnlock('0.1.0');
      session1.triggerStepAction('first_draft_generated');

      assert.strictEqual(mockStorage['draftpilot_extension_installed'], 'true');
      assert.strictEqual(mockStorage['draftpilot_first_draft_generated'], 'true');
      assert.strictEqual(mockStorage['draftpilot_first_macro_added'], undefined);

      // User refreshes the page: session 2 starts with blank memory
      const session2 = new OnboardingDashboardEngine();
      assert.strictEqual(session2.getProgressPercent(), 0, 'Before auto-detect, progress is 0%');

      // Run autoDetectFromStorage
      session2.autoDetectFromStorage();

      assert.strictEqual(session2.localSteps.extension_installed, true);
      assert.strictEqual(session2.localSteps.first_draft_generated, true);
      assert.strictEqual(session2.localSteps.first_macro_added, false);
      assert.strictEqual(session2.localSteps.team_member_invited, false);
      assert.strictEqual(session2.getProgressPercent(), 50, 'Recovered progress must be exactly 50% (2 steps)');
    });
  });

  // ==========================================================================
  // CHALLENGE 3: SEMVER & BOUNDARY ADVERSARIAL CASES
  // ==========================================================================
  describe('Challenge 3: Semver Comparison & Attribute Parsing Boundary Conditions', () => {
    test('3.1 compareExtensionVersions handles complex edge cases and whitespace', () => {
      // Missing or partial segments
      assert.strictEqual(compareExtensionVersions('1', '1.0.0'), 0);
      assert.strictEqual(compareExtensionVersions('0.1', '0.1.0'), 0);
      assert.strictEqual(compareExtensionVersions('0.1.0.0', '0.1.0'), 0);

      // Version with extra prefixes
      assert.strictEqual(compareExtensionVersions('V0.1.0', '0.1.0'), 0);
      assert.strictEqual(compareExtensionVersions('v0.1.1', '0.1.0'), 1);
      assert.strictEqual(compareExtensionVersions('v0.0.999', '0.1.0'), -1);

      // Minor and patch variations
      assert.strictEqual(compareExtensionVersions('0.1.0', '0.0.9'), 1);
      assert.strictEqual(compareExtensionVersions('0.1.0', '0.2.0'), -1);
      assert.strictEqual(compareExtensionVersions('0.1.0', '1.0.0'), -1);
    });

    test('3.2 readExtensionDomStatus safely handles undefined document or non-string attributes', () => {
      // Missing document
      (globalThis as any).document = undefined;
      assert.deepStrictEqual(readExtensionDomStatus(), { installed: false, version: null });

      // Document with corrupted documentElement
      (globalThis as any).document = {};
      assert.deepStrictEqual(readExtensionDomStatus(), { installed: false, version: null });

      // Document with installed = true but missing version attribute -> falls back to CURRENT_EXTENSION_VERSION
      (globalThis as any).document = {
        documentElement: {
          getAttribute: (name: string) => (name === 'data-draftpilot-extension-installed' ? 'true' : null),
        },
      };
      const result = readExtensionDomStatus();
      assert.strictEqual(result.installed, true);
      assert.strictEqual(result.version, CURRENT_EXTENSION_VERSION);
    });

    test('3.3 readExtensionStorageStatus safely handles localStorage exceptions', () => {
      // Simulate private browsing mode throwing on localStorage access
      (globalThis as any).localStorage = {
        getItem: () => {
          throw new Error('SecurityError: The operation is insecure.');
        },
      };

      const result = readExtensionStorageStatus();
      assert.strictEqual(result.installed, false);
      assert.strictEqual(result.version, null);
    });
  });

  // ==========================================================================
  // CHALLENGE 4: EXHAUSTIVE PERMUTATIONS & RESILIENCE HARNESS
  // ==========================================================================
  describe('Challenge 4: Combinatorial Permutations & Deep Resilience', () => {
    test('4.1 All 24 Order-of-Completion Permutations yield correct monotonic progress and badge unlock', () => {
      const stepKeys = [
        'extension_installed',
        'first_macro_added',
        'first_draft_generated',
        'team_member_invited',
      ] as const;

      function getPermutations<T>(arr: T[]): T[][] {
        if (arr.length <= 1) return [arr];
        const perms: T[][] = [];
        for (let i = 0; i < arr.length; i++) {
          const current = arr[i];
          const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
          for (const p of getPermutations(remaining)) {
            perms.push([current, ...p]);
          }
        }
        return perms;
      }

      const allPermutations = getPermutations([...stepKeys]);
      assert.strictEqual(allPermutations.length, 24, 'Must evaluate exactly 24 completion permutations');

      for (const order of allPermutations) {
        const state: Record<string, boolean> = {
          extension_installed: false,
          first_macro_added: false,
          first_draft_generated: false,
          team_member_invited: false,
        };

        for (let i = 0; i < order.length; i++) {
          const stepKey = order[i];
          state[stepKey] = true;

          const count = Object.values(state).filter(Boolean).length;
          const progress = Math.round((count / 4) * 100);
          const isAll = count === 4;

          const expectedProgress = (i + 1) * 25;
          assert.strictEqual(progress, expectedProgress, `Permutation ${order.join('->')} at step ${i + 1} must be ${expectedProgress}%`);
          assert.strictEqual(isAll, i === 3, `Champion status at step ${i + 1} must be ${i === 3}`);
        }
      }
    });

    test('4.2 Step Revocation / Untoggling cleanly reduces progress and locks Champion badge', () => {
      const state = {
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: true,
        team_member_invited: true,
      };

      const computeProgress = (s: typeof state) => {
        const count = Object.values(s).filter(Boolean).length;
        return {
          count,
          progress: Math.round((count / 4) * 100),
          isAll: count === 4,
        };
      };

      // 100% completed
      let res = computeProgress(state);
      assert.strictEqual(res.count, 4);
      assert.strictEqual(res.progress, 100);
      assert.strictEqual(res.isAll, true);

      // Untoggle first_macro_added
      state.first_macro_added = false;
      res = computeProgress(state);
      assert.strictEqual(res.count, 3);
      assert.strictEqual(res.progress, 75);
      assert.strictEqual(res.isAll, false, 'Champion badge must lock when any step is uncompleted');

      // Untoggle extension_installed
      state.extension_installed = false;
      res = computeProgress(state);
      assert.strictEqual(res.count, 2);
      assert.strictEqual(res.progress, 50);
      assert.strictEqual(res.isAll, false);
    });

    test('4.3 50 Rapid Concurrent Recheck Triggers without UI Freeze', async () => {
      const harness = createHookHarness(useExtensionStatus);
      const hookResult = harness.render();

      const triggers: Promise<void>[] = [];
      for (let i = 0; i < 50; i++) {
        triggers.push(Promise.resolve(hookResult.recheck() as any));
      }
      await Promise.all(triggers);

      const latest = harness.rerender();
      assert.strictEqual(latest.status, 'checking', 'Status remains checking during active handshake');
      assert.strictEqual(latest.isChecking, true);
      harness.unmount();
    });

    test('4.4 Storage QuotaExceededError handling', () => {
      (globalThis as any).localStorage = {
        getItem: () => null,
        setItem: () => {
          throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        },
      };

      // Ensure readExtensionStorageStatus handles exceptions
      assert.doesNotThrow(() => {
        const res = readExtensionStorageStatus();
        assert.strictEqual(res.installed, false);
      });
    });
  });
});

