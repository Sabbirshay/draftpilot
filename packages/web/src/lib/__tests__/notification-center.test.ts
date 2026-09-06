/// <reference types="node" />
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Dynamically transpile and load live exports from NotificationCenter.tsx
function loadNotificationCenterModule() {
  const ts = require('typescript');
  const componentPath = path.resolve(__dirname, '../../components/dashboard/NotificationCenter.tsx');
  const source = fs.readFileSync(componentPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });

  const moduleExports: any = {};
  const customRequire = (id: string) => {
    if (id === 'react' || id.startsWith('react/')) {
      return {
        default: { createElement: () => null },
        createContext: () => ({}),
        useContext: () => ({}),
        useState: (v: any) => [v, () => {}],
        useEffect: () => {},
        useMemo: (fn: any) => fn(),
        useRef: () => ({ current: null }),
        useCallback: (fn: any) => fn,
      };
    }
    if (id === 'framer-motion') {
      return {
        motion: { div: 'div' },
        AnimatePresence: ({ children }: any) => children,
      };
    }
    if (id === '@/components/providers/AuthProvider') {
      return {
        useAuth: () => ({
          onboardingState: {
            extension_installed: false,
            first_macro_added: false,
            first_draft_generated: false,
            team_member_invited: false,
          },
        }),
      };
    }
    return {};
  };

  const fn = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    transpiled.outputText
  );
  fn(moduleExports, customRequire, { exports: moduleExports }, componentPath, path.dirname(componentPath));

  return {
    source,
    exports: moduleExports,
  };
}

describe('Milestone 3: Clean, Realistic Notification Center (R3)', () => {
  let mod: ReturnType<typeof loadNotificationCenterModule>;
  let mockStorage: Record<string, string>;

  // Mock browser globals for localStorage and DOM
  beforeEach(() => {
    mod = loadNotificationCenterModule();
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

    // Mock document.documentElement
    (globalThis as any).document = {
      documentElement: {
        getAttribute: (name: string) => null,
      },
    };
    (globalThis as any).window = globalThis;
  });

  afterEach(() => {
    delete (globalThis as any).localStorage;
    delete (globalThis as any).document;
    delete (globalThis as any).window;
  });

  // ============================================================================
  // Requirement 1: Authentic First-Run Welcome Notification
  // ============================================================================
  describe('Requirement 1: Authentic Welcome Notification for New Users', () => {
    test('initial notifications for a new user contain only the authentic welcome notification', () => {
      const { buildNotificationList, WELCOME_NOTIFICATION } = mod.exports;

      const newMilestones = {
        extensionInstalled: false,
        firstMacroAdded: false,
        firstDraftGenerated: false,
        teamMemberInvited: false,
      };
      const readIds: string[] = [];
      const dismissedIds: string[] = [];

      const initialList = buildNotificationList(newMilestones, readIds, dismissedIds);

      assert.strictEqual(initialList.length, 1, 'New user must receive exactly 1 initial notification');
      const welcome = initialList[0];

      assert.strictEqual(welcome.id, 'notif-welcome');
      assert.strictEqual(welcome.type, 'welcome');
      assert.strictEqual(welcome.title, 'Welcome to DraftPilot!');
      assert.strictEqual(
        welcome.message,
        'Your AI drafting workspace is ready. Install the extension, create your first macro, and start drafting responses in seconds.'
      );
      assert.strictEqual(welcome.actionTab, 'overview');
      assert.strictEqual(welcome.actionLabel, 'Explore Workspace');
      assert.strictEqual(welcome.badge, 'Getting Started 🚀');
      assert.strictEqual(welcome.unread, true, 'Initial welcome notification must be unread');
    });

    test('WELCOME_NOTIFICATION constant matches mandatory specification', () => {
      const { WELCOME_NOTIFICATION } = mod.exports;
      assert.ok(WELCOME_NOTIFICATION, 'WELCOME_NOTIFICATION must be exported');
      assert.strictEqual(WELCOME_NOTIFICATION.id, 'notif-welcome');
      assert.strictEqual(WELCOME_NOTIFICATION.title, 'Welcome to DraftPilot!');
      assert.ok(WELCOME_NOTIFICATION.message.includes('AI drafting workspace is ready'));
      assert.strictEqual(WELCOME_NOTIFICATION.actionTab, 'overview');
      assert.strictEqual(WELCOME_NOTIFICATION.actionLabel, 'Explore Workspace');
    });
  });

  // ============================================================================
  // Requirement 2: Absolute Absence of Fake Demo Notifications
  // ============================================================================
  describe('Requirement 2: Purge of Fake Demo Notifications', () => {
    test('NO fake demo notification strings exist anywhere in NotificationCenter.tsx source code', () => {
      const { source } = mod;

      const prohibitedStrings = [
        'Sarah Jenkins',
        'sarah@company.com',
        'Customer_Support_Policy_&_Refunds_2026.pdf',
        '$76.00 / 4 active seats',
        '$76',
        '500 bonus AI draft tokens',
        'Personal Welcome from DraftPilot Founder',
        'Founder Message 👑',
        'Upcoming Subscription Renewal Notice',
        '84 vector chunks are now active',
      ];

      for (const prohibited of prohibitedStrings) {
        assert.ok(
          !source.includes(prohibited),
          `NotificationCenter.tsx must not contain prohibited demo string: "${prohibited}"`
        );
      }
    });

    test('generated notifications across all milestone states never contain fake demo strings', () => {
      const { buildNotificationList } = mod.exports;

      const allMilestonesTrue = {
        extensionInstalled: true,
        firstMacroAdded: true,
        firstDraftGenerated: true,
        teamMemberInvited: true,
      };

      const notifications = buildNotificationList(allMilestonesTrue, [], []);
      const serialized = JSON.stringify(notifications);

      assert.ok(!serialized.includes('Sarah Jenkins'), 'Output must not contain Sarah Jenkins');
      assert.ok(!serialized.includes('Customer_Support_Policy_&_Refunds_2026.pdf'), 'Output must not contain refund PDF');
      assert.ok(!serialized.includes('$76.00 / 4 active seats'), 'Output must not contain $76 seats');
      assert.ok(!serialized.includes('500 bonus AI draft tokens'), 'Output must not contain 500 bonus tokens');
    });
  });

  // ============================================================================
  // Requirement 3: Event-Driven Milestone Notification Activation
  // ============================================================================
  describe('Requirement 3: Event-Driven Milestone Notifications', () => {
    test('derives Extension Pioneer Unlocked notification when extension is paired', () => {
      const { getMilestoneNotifications } = mod.exports;

      const items = getMilestoneNotifications({ extensionInstalled: true });
      assert.strictEqual(items.length, 1);

      const extItem = items[0];
      assert.strictEqual(extItem.id, 'notif-milestone-extension');
      assert.strictEqual(extItem.type, 'milestone');
      assert.strictEqual(extItem.title, 'Extension Pioneer Unlocked');
      assert.strictEqual(
        extItem.message,
        'DraftPilot Chrome Extension is paired and ready for inline Gmail drafting.'
      );
      assert.strictEqual(extItem.actionTab, 'gmail');
      assert.strictEqual(extItem.actionLabel, 'Check Gmail Sync');
      assert.strictEqual(extItem.badge, 'Extension Pioneer 🧩');
      assert.strictEqual(extItem.unread, true);
    });

    test('derives Macro Architect Unlocked notification when first macro is added', () => {
      const { getMilestoneNotifications } = mod.exports;

      const items = getMilestoneNotifications({ firstMacroAdded: true });
      assert.strictEqual(items.length, 1);

      const macroItem = items[0];
      assert.strictEqual(macroItem.id, 'notif-milestone-macro');
      assert.strictEqual(macroItem.type, 'milestone');
      assert.strictEqual(macroItem.title, 'Macro Architect Unlocked');
      assert.strictEqual(
        macroItem.message,
        'Your custom support macro was saved. You can now trigger canned templates in 1 click.'
      );
      assert.strictEqual(macroItem.actionTab, 'macros');
      assert.strictEqual(macroItem.actionLabel, 'View Macros');
      assert.strictEqual(macroItem.badge, 'Macro Architect 📐');
      assert.strictEqual(macroItem.unread, true);
    });

    test('derives AI Copilot Ace Unlocked notification when first AI draft is generated', () => {
      const { getMilestoneNotifications } = mod.exports;

      const items = getMilestoneNotifications({ firstDraftGenerated: true });
      assert.strictEqual(items.length, 1);

      const draftItem = items[0];
      assert.strictEqual(draftItem.id, 'notif-milestone-draft');
      assert.strictEqual(draftItem.type, 'milestone');
      assert.strictEqual(draftItem.title, 'AI Copilot Ace Unlocked');
      assert.strictEqual(
        draftItem.message,
        'First AI reply generated! Context-aware reply synthesized with PII privacy scrubbing.'
      );
      assert.strictEqual(draftItem.actionTab, 'overview');
      assert.strictEqual(draftItem.actionLabel, 'View Activity');
      assert.strictEqual(draftItem.badge, 'AI Copilot Ace ⚡');
      assert.strictEqual(draftItem.unread, true);
    });

    test('derives Team Builder Unlocked notification when teammate is invited', () => {
      const { getMilestoneNotifications } = mod.exports;

      const items = getMilestoneNotifications({ teamMemberInvited: true });
      assert.strictEqual(items.length, 1);

      const teamItem = items[0];
      assert.strictEqual(teamItem.id, 'notif-milestone-team');
      assert.strictEqual(teamItem.title, 'Team Builder Unlocked');
      assert.strictEqual(
        teamItem.message,
        'New teammate invited to collaborate in your shared AI drafting workspace.'
      );
      assert.strictEqual(teamItem.actionTab, 'team');
      assert.strictEqual(teamItem.actionLabel, 'Manage Team');
      assert.strictEqual(teamItem.badge, 'Team Builder 👥');
      assert.strictEqual(teamItem.unread, true);
    });

    test('activates all 4 milestone notifications when all user milestones are unlocked', () => {
      const { buildNotificationList } = mod.exports;

      const allMilestones = {
        extensionInstalled: true,
        firstMacroAdded: true,
        firstDraftGenerated: true,
        teamMemberInvited: true,
      };

      const notifications = buildNotificationList(allMilestones, [], []);
      // 1 Welcome + 4 Milestones = 5 notifications
      assert.strictEqual(notifications.length, 5);

      const ids = notifications.map((n: any) => n.id);
      assert.ok(ids.includes('notif-welcome'));
      assert.ok(ids.includes('notif-milestone-extension'));
      assert.ok(ids.includes('notif-milestone-macro'));
      assert.ok(ids.includes('notif-milestone-draft'));
      assert.ok(ids.includes('notif-milestone-team'));
    });

    test('readCurrentMilestones correctly derives status from useAuth onboardingState', () => {
      const { readCurrentMilestones } = mod.exports;

      const authState = {
        extension_installed: true,
        first_macro_added: true,
        first_draft_generated: false,
        team_member_invited: true,
      };

      const derived = readCurrentMilestones(authState);
      assert.strictEqual(derived.extensionInstalled, true);
      assert.strictEqual(derived.firstMacroAdded, true);
      assert.strictEqual(derived.firstDraftGenerated, false);
      assert.strictEqual(derived.teamMemberInvited, true);
    });

    test('readCurrentMilestones derives status from localStorage and DOM attributes', () => {
      const { readCurrentMilestones } = mod.exports;

      mockStorage['draftpilot_first_macro_added'] = 'true';
      mockStorage['draftpilot_first_draft_generated'] = 'true';

      // DOM attribute mock
      (globalThis as any).document.documentElement.getAttribute = (name: string) => {
        if (name === 'data-draftpilot-extension-installed') return 'true';
        return null;
      };

      const derived = readCurrentMilestones();
      assert.strictEqual(derived.extensionInstalled, true, 'Must detect extension via DOM attribute');
      assert.strictEqual(derived.firstMacroAdded, true, 'Must detect macro via localStorage');
      assert.strictEqual(derived.firstDraftGenerated, true, 'Must detect draft via localStorage');
      assert.strictEqual(derived.teamMemberInvited, false);
    });
  });

  // ============================================================================
  // Requirement 4: Mark All Read & Toggle Read Persistence
  // ============================================================================
  describe('Requirement 4: Mark Read & Persistence Engine', () => {
    test('STORAGE_KEY_READ is exactly draftpilot_read_notifications', () => {
      const { STORAGE_KEY_READ } = mod.exports;
      assert.strictEqual(STORAGE_KEY_READ, 'draftpilot_read_notifications');
    });

    test('mark all read updates all notifications to unread: false and persists IDs in localStorage', () => {
      const { buildNotificationList, saveStoredIds, getStoredIds, STORAGE_KEY_READ } = mod.exports;

      const milestones = {
        extensionInstalled: true,
        firstMacroAdded: true,
        firstDraftGenerated: false,
        teamMemberInvited: false,
      };

      // 1 welcome + 2 milestones = 3 notifications
      const initial = buildNotificationList(milestones, [], []);
      assert.strictEqual(initial.length, 3);
      assert.strictEqual(initial.filter((n: any) => n.unread).length, 3);

      // Simulate mark all read
      const allIds = initial.map((n: any) => n.id);
      saveStoredIds(STORAGE_KEY_READ, allIds);

      // Verify localStorage persistence
      const savedInStorage = getStoredIds(STORAGE_KEY_READ);
      assert.deepStrictEqual(savedInStorage, allIds);

      // Simulate re-render with persisted readIds
      const updated = buildNotificationList(milestones, savedInStorage, []);
      assert.strictEqual(updated.length, 3);
      assert.strictEqual(updated.filter((n: any) => n.unread).length, 0, 'All notifications must now be read');
    });

    test('toggle read toggles individual item unread status and updates localStorage', () => {
      const { buildNotificationList, saveStoredIds, getStoredIds, STORAGE_KEY_READ } = mod.exports;

      const milestones = { extensionInstalled: true };
      let readIds: string[] = [];

      // Initially unread
      const list1 = buildNotificationList(milestones, readIds, []);
      const extItem1 = list1.find((n: any) => n.id === 'notif-milestone-extension');
      assert.strictEqual(extItem1.unread, true);

      // Toggle to read
      readIds = [...readIds, 'notif-milestone-extension'];
      saveStoredIds(STORAGE_KEY_READ, readIds);

      const list2 = buildNotificationList(milestones, getStoredIds(STORAGE_KEY_READ), []);
      const extItem2 = list2.find((n: any) => n.id === 'notif-milestone-extension');
      assert.strictEqual(extItem2.unread, false);

      // Toggle back to unread
      readIds = readIds.filter((id) => id !== 'notif-milestone-extension');
      saveStoredIds(STORAGE_KEY_READ, readIds);

      const list3 = buildNotificationList(milestones, getStoredIds(STORAGE_KEY_READ), []);
      const extItem3 = list3.find((n: any) => n.id === 'notif-milestone-extension');
      assert.strictEqual(extItem3.unread, true);
    });
  });

  // ============================================================================
  // Requirement 5: Dismiss Notification Filtering & LocalStorage Persistence
  // ============================================================================
  describe('Requirement 5: Dismiss Notification Filtering & Persistence', () => {
    test('STORAGE_KEY_DISMISSED is exactly draftpilot_dismissed_notifications', () => {
      const { STORAGE_KEY_DISMISSED } = mod.exports;
      assert.strictEqual(STORAGE_KEY_DISMISSED, 'draftpilot_dismissed_notifications');
    });

    test('dismissing a notification removes it from the list and persists ID to localStorage', () => {
      const { buildNotificationList, saveStoredIds, getStoredIds, STORAGE_KEY_DISMISSED } = mod.exports;

      const milestones = {
        extensionInstalled: true,
        firstMacroAdded: false,
        firstDraftGenerated: false,
        teamMemberInvited: false,
      };

      // 1 Welcome + 1 Extension = 2 notifications
      const initial = buildNotificationList(milestones, [], []);
      assert.strictEqual(initial.length, 2);

      // Dismiss the welcome notification
      const dismissedIds = ['notif-welcome'];
      saveStoredIds(STORAGE_KEY_DISMISSED, dismissedIds);

      // Verify persistence in localStorage
      const storedDismissed = getStoredIds(STORAGE_KEY_DISMISSED);
      assert.deepStrictEqual(storedDismissed, ['notif-welcome']);

      // Rebuild notification list with dismissed ID
      const filtered = buildNotificationList(milestones, [], storedDismissed);
      assert.strictEqual(filtered.length, 1);
      assert.strictEqual(filtered[0].id, 'notif-milestone-extension');
    });

    test('dismissing all notifications leaves an empty list that persists across reloads', () => {
      const { buildNotificationList, saveStoredIds, getStoredIds, STORAGE_KEY_DISMISSED } = mod.exports;

      const milestones = { extensionInstalled: false };
      // New user only has notif-welcome
      const dismissedIds = ['notif-welcome'];
      saveStoredIds(STORAGE_KEY_DISMISSED, dismissedIds);

      const remaining = buildNotificationList(milestones, [], getStoredIds(STORAGE_KEY_DISMISSED));
      assert.strictEqual(remaining.length, 0);
    });

    test('saveStoredIds and getStoredIds handle invalid or corrupt localStorage data gracefully', () => {
      const { getStoredIds, saveStoredIds } = mod.exports;

      mockStorage['corrupt_key'] = 'not-json{{{';
      const retrieved = getStoredIds('corrupt_key');
      assert.deepStrictEqual(retrieved, [], 'Corrupt JSON in storage must gracefully return empty array');

      saveStoredIds('test_key', ['id-1', 'id-2']);
      assert.deepStrictEqual(getStoredIds('test_key'), ['id-1', 'id-2']);
    });
  });

  // ============================================================================
  // Requirement 6: Clean Empty State Text Verification
  // ============================================================================
  describe('Requirement 6: Clean Empty State Specification', () => {
    test('EMPTY_STATE_TEXT constant matches exact required copy', () => {
      const { EMPTY_STATE_TEXT } = mod.exports;
      assert.strictEqual(EMPTY_STATE_TEXT, "No new notifications. You're all caught up! ✨");
    });

    test('exact empty state copy is present in NotificationCenter.tsx component source', () => {
      const { source } = mod;
      assert.ok(
        source.includes("No new notifications. You're all caught up! ✨"),
        "NotificationCenter.tsx must render exact copy: No new notifications. You're all caught up! ✨"
      );
    });
  });

  // ============================================================================
  // Requirement 7: Filter Categories (All, Unread, Milestones, System)
  // ============================================================================
  describe('Requirement 7: Realistic Filter Tabs', () => {
    test('NotificationCenter.tsx configures realistic filter tabs', () => {
      const { source } = mod;
      assert.ok(source.includes("{ id: 'all', label: 'All' }"), 'Must have All tab');
      assert.ok(source.includes("id: 'unread'"), 'Must have Unread tab');
      assert.ok(source.includes("{ id: 'milestones', label: '🏆 Milestones' }"), 'Must have Milestones tab');
      assert.ok(source.includes("{ id: 'system', label: '⚡ System' }"), 'Must have System tab');

      // Prohibited fake filter categories
      assert.ok(!source.includes("label: '👑 Founder'"), 'Must not have Founder filter tab');
      assert.ok(!source.includes("label: '💳 Billing'"), 'Must not have Billing filter tab');
    });

    test('filter behavior correctly segments notifications by realistic category', () => {
      const { buildNotificationList } = mod.exports;

      const milestones = {
        extensionInstalled: true,
        firstMacroAdded: true,
        teamMemberInvited: true,
      };

      // 1 welcome (system/welcome) + 3 milestones
      const readIds = ['notif-milestone-extension']; // extension is read
      const notifications = buildNotificationList(milestones, readIds, []);

      // Filter: Unread
      const unread = notifications.filter((n: any) => n.unread);
      assert.strictEqual(unread.length, 3);
      assert.ok(!unread.some((n: any) => n.id === 'notif-milestone-extension'));

      // Filter: Milestones
      const milestoneItems = notifications.filter(
        (n: any) => n.type === 'milestone' || n.type === 'team' || n.id.startsWith('notif-milestone')
      );
      assert.strictEqual(milestoneItems.length, 3);
      assert.ok(!milestoneItems.some((n: any) => n.id === 'notif-welcome'));

      // Filter: System
      const systemItems = notifications.filter(
        (n: any) => n.type === 'system' || n.type === 'welcome' || n.id === 'notif-welcome'
      );
      assert.strictEqual(systemItems.length, 1);
      assert.strictEqual(systemItems[0].id, 'notif-welcome');
    });
  });
});
