# R1 User End Interactive Feature Diagnosis & Survey Analysis

## Executive Summary
This report presents a comprehensive diagnosis of all user-facing interactive components, routes, modals, forms, macro management, AI draft generation, one-click insertion, and settings panels across the Web Dashboard (`packages/web`) and the Chrome Extension (`packages/extension`).

Every interactive handler, API payload, state synchronization channel, and user feedback cycle was systematically traced. The diagnosis identified specific runtime defects, TypeScript compilation issues, unhandled error cases, UI hardcoding, and stubbed handlers with detailed root-cause analyses and exact code remediations.

---

## 1. User End Interactive Component Inventory

### A. Web Application Routes & Components (`packages/web`)

| Route / Component | Element / Control | Trigger / Handler | Intended Behavior | Observed Status / Audit Result |
|---|---|---|---|---|
| `/login` & `/join` (`AuthForm.tsx`) | **Continue with Google** Button | `onClick={handleGoogleSignIn}` | Initiates Supabase OAuth popup/redirect to `/auth/callback` | ✅ Verified functional; sets redirect origin cleanly. |
| `/login` & `/join` (`AuthForm.tsx`) | **Sign in / Create account with email** Form | `onSubmit={handleEmailSubmit}` | Calls `supabase.auth.signInWithPassword` or `supabase.auth.signUp` | ✅ Verified functional; sets user session and redirects to `/dashboard`. |
| `/login` & `/join` (`AuthForm.tsx`) | **Show/Hide Password** Button | `onClick={() => setShowPassword(!showPassword)}` | Toggles input type between password and text | ✅ Verified functional. |
| `/login` & `/join` (`AuthForm.tsx`) | **Remember for 30 days** Checkbox | `onChange={(e) => setRememberMe(e.target.checked)}` | Toggles session persistence flag | ✅ Verified functional. |
| `/login` & `/join` (`AuthForm.tsx`) | **Forgot password** Link | `onClick={() => alert(...)}` (Line 302) | Should send password reset email via Supabase Auth | ⚠️ **STUB ISSUE**: Static `alert()` call without calling `supabase.auth.resetPasswordForEmail(email)`. |
| `/login` & `/join` (`AuthForm.tsx`) | **Sign in / Sign up Mode Switcher** | `onClick={() => setMode(...)}` | Switches form mode, resets errors/success messages | ✅ Verified functional. |
| `/auth/callback` (`page.tsx`) | **OAuth Callback Handler** | Automatic `useEffect` hook | Retrieves OAuth session, calls `provisionUser`, caches tokens, redirects | ✅ Verified functional. |
| `/dashboard` (`OnboardingDashboard.tsx`) | **Install Chrome Extension** Primary CTA | `onClick={() => setIsInstallModalOpen(true)}` | Opens modal with download link & installation guide | ✅ Verified functional. |
| `/dashboard` (`OnboardingDashboard.tsx`) | **Install Modal Download .ZIP** Link | `href="/draftpilot-extension.zip"` | Downloads pre-built extension zip | ✅ Verified functional. |
| `/dashboard` (`OnboardingDashboard.tsx`) | **Done Installing -> Enter Dashboard** Button | `onClick={...}` | Sets `extension_installed` & `gmail_connected`, closes modal, navigates | ✅ Verified functional. |
| `/dashboard` (`OnboardingDashboard.tsx`) | **Demo Draft Preview Accordion** | `onClick={() => setExpandedDraft(!expandedDraft)}` | Expands / collapses sample AI draft preview | ✅ Verified functional. |
| `/dashboard` (`OnboardingDashboard.tsx`) | **Checklist Item Toggles** | `onClick={() => handleToggleStep(...)}` | Updates Supabase `onboarding_state` row | ✅ Verified functional. |
| `/dashboard` (`DashboardHeader.tsx`) | **Top Pill Navigation Tabs** | `onClick={() => onTabChange(tab)}` | Switches between Overview, Macros & KB, Team Seats, Billing, Gmail Sync | ✅ Verified functional. |
| `/dashboard` (`DashboardHeader.tsx`) | **+ New Macro** Button | `onClick={onAddMacroClick}` | Switches view to `macros` tab | ✅ Verified functional. |
| `/dashboard` (`DashboardHeader.tsx`) | **User Avatar & Profile Dropdown** | `onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}` | Opens menu with Team, Billing, Website links and Log out | ✅ Verified functional. |
| `/dashboard` (`DashboardHeader.tsx`) | **Log out** Button | `onClick={handleLogout}` | Calls `signOut()`, clears session/localStorage, redirects to `/login` | ✅ Verified functional. |
| `/dashboard` (`NotificationCenter.tsx`) | **Bell Icon Trigger** | `onClick={() => setIsOpen(!isOpen)}` | Toggles notification popover, displays unread count badge | ✅ Verified functional. |
| `/dashboard` (`NotificationCenter.tsx`) | **Filter Tabs (All/Unread/Founder/Billing)** | `onClick={() => setFilter(tab.id)}` | Filters active notifications by category | ✅ Verified functional. |
| `/dashboard` (`NotificationCenter.tsx`) | **Mark All Read** Button | `onClick={handleMarkAllRead}` | Clears all unread flags in local state | ✅ Verified functional. |
| `/dashboard` (`NotificationCenter.tsx`) | **Notification Action Link** | `onClick={() => handleActionClick(notif)}` | Navigates to relevant tab (`actionTab`) and marks read | ✅ Verified functional. |
| `/dashboard` (`NotificationCenter.tsx`) | **Dismiss Notification (✕)** | `onClick={() => handleDeleteNotif(notif.id)}` | Removes notification from list | ✅ Verified functional. |
| `/dashboard` (`DateRangePicker.tsx`) | **Date Range Pill** | `onClick={() => setIsOpen(!isOpen)}` | Opens dual-pane interactive calendar | ✅ Verified functional. |
| `/dashboard` (`DateRangePicker.tsx`) | **Granularity Dropdown** | `onClick={() => setIsGranularityOpen(...)}` | Selects Hourly, Daily, Weekly, Monthly interval | ✅ Verified functional. |
| `/dashboard` (`DateRangePicker.tsx`) | **Quick Presets (Today/7D/30D/Month/YTD)** | `onClick={() => handlePresetSelect(p)}` | Applies preset date bounds and comparison window | ✅ Verified functional. |
| `/dashboard` (`DateRangePicker.tsx`) | **Interactive Calendar Days & Month Nav** | `onClick={() => handleDayClick(day)}`, Prev/Next month | Calculates custom date interval and comparison window | ✅ Verified functional. |
| `/dashboard` (`OverviewBento.tsx`) | **Manage KB ->** Button | `onClick={onNavigateToMacros}` | Switches active tab to `macros` | ✅ Verified functional. |
| `/dashboard` (`OverviewBento.tsx`) | **Ask DraftPilot Support AI** Bar | `onSubmit={handleAiQuerySubmit}` | Simulates AI telemetry question answering based on live metrics | ✅ Verified functional. |
| `/dashboard` (`OverviewBento.tsx`) | **Card 6 Quota Progress Meter** | Visual display | Calculates percentage of draft quota used | ⚠️ **HARDCODED LIMIT**: Hardcodes `50` drafts limit instead of reading dynamic `monthly_draft_limit`. |
| `/dashboard` (`MacrosManager.tsx`) | **Sub-Tabs (Documents / Macros)** | `onClick={() => setActiveTab(...)}` | Toggles between Document Ingestion and Macro Library | ✅ Verified functional. |
| `/dashboard` (`MacrosManager.tsx`) | **Category Filter Pills** | `onClick={() => setSelectedCategory(cat)}` | Filters macro cards by category | ✅ Verified functional. |
| `/dashboard` (`MacrosManager.tsx`) | **Search Input** | `onChange={(e) => setSearchQuery(e.target.value)}` | Real-time text search across title, content, and tags | ✅ Verified functional. |
| `/dashboard` (`MacrosManager.tsx`) | **Import 5 Starter Templates** Button | `onClick={handleImportStarters}` | Bulk inserts 5 starter macros into Supabase DB | ✅ Verified functional. |
| `/dashboard` (`MacrosManager.tsx`) | **+ Create Macro** Button & Modal Form | `onSubmit={handleCreateMacro}` | Inserts new macro with team_id into Supabase DB | ✅ Verified functional; displays green sync banner. |
| `/dashboard` (`MacrosManager.tsx`) | **⚡ Sync with Gmail** Button | `onClick={handleSyncAllToGmail}` | Displays sync notification banner | ✅ Verified functional. |
| `/dashboard` (`MacrosManager.tsx`) | **Macro Delete Button** | `onClick={() => handleDelete(macro.id)}` | Deletes macro from Supabase DB | ⚠️ **UNHANDLED ERROR**: Optimistic UI delete without rollback on error. |
| `/dashboard` (`DocumentUploader.tsx`) | **File Dropzone / File Picker** | `onDrop`, `onChange={(e) => handleFileUpload(file)}` | Reads text, extracts Q&A/Markdown macros, stores doc chunks in DB | ⚠️ **LIMITATION**: Uses `FileReader.readAsText` which reads raw binary bytes for .pdf/.docx/.xlsx. |
| `/dashboard` (`DocumentUploader.tsx`) | **Document Delete Button (🗑️)** | `onClick={() => handleDelete(doc.id)}` | Deletes document record from Supabase DB | ✅ Verified functional. |
| `/dashboard` (`TeamManager.tsx`) | **Invite Team Member Form** | `onSubmit={handleInvite}` | Checks seat limits and queues member invite | ⚠️ **VOLATILE STATE**: Invites are only stored in local React state and disappear on page refresh. |
| `/dashboard` (`TeamManager.tsx`) | **Remove Member Button** | `onClick={() => handleRemove(member.id)}` | Removes invited member from list | ✅ Verified functional. |
| `/dashboard` (`BillingManager.tsx`) | **Monthly / Annual Billing Toggle** | `onClick={() => setIsAnnual(!isAnnual)}` | Toggles price per seat calculation ($19 vs $15/mo) | ✅ Verified functional. |
| `/dashboard` (`BillingManager.tsx`) | **Seat Count Counter (+ / -)** | `onClick={() => setSelectedSeats(...)}` | Increments/decrements seat count and updates calculated total | ✅ Verified functional. |
| `/dashboard` (`BillingManager.tsx`) | **Upgrade / Manage Invoices Button** | `onClick={handleOpenPortal}` | Opens Stripe Customer Portal or Checkout Session | ⚠️ **MOCK STUB**: Hardcoded `alert()` dialog instead of invoking backend Stripe session. |
| `/dashboard` (`GmailSyncManager.tsx`) | **Copy Secret Key Button** | `onClick={handleCopy}` | Copies `dp_live_<teamId>` to clipboard with visual confirmation | ✅ Verified functional. |
| `/dashboard` (`GmailSyncManager.tsx`) | **View Install Guide ->** Button | `onClick={() => alert(...)}` | Displays modal instruction alert | ✅ Verified functional. |
| `/dashboard` (`GmailSyncManager.tsx`) | **PII Scrubbing Checkboxes** | `onChange={(e) => setScrub...}` | Toggles client-side scrubbing rules | ✅ Verified functional. |

---

### B. Chrome Extension Layer (`packages/extension`)

| Component / Script | Element / Feature | Trigger / Handler | Intended Behavior | Observed Status / Audit Result |
|---|---|---|---|---|
| `sidepanel.ts` (Login View) | **Login Form** | `login-form.addEventListener('submit')` | Authenticates via `apiClient.login`, caches token in `chrome.storage.local` | ✅ Verified functional. |
| `sidepanel.ts` (Login View) | **Register Form** | `register-form.addEventListener('submit')` | Creates account via `apiClient.register`, provisions team/user | ✅ Verified functional. |
| `sidepanel.ts` (Login View) | **Create Account / Back to Login Links** | Click listeners | Toggles between login and register forms | ✅ Verified functional. |
| `sidepanel.ts` (Header) | **Logout Button** | `logout-btn.addEventListener('click')` | Clears `token`, `user`, `teamId` from `chrome.storage.local`, returns to login | ✅ Verified functional. |
| `sidepanel.ts` (Header) | **Usage Progress Bar** | `loadUsage()` | Queries monthly quota and current draft count, updates fill width | ✅ Verified functional. |
| `sidepanel.ts` (Tabs) | **Tab Switchers (Draft/Macros/Settings)** | `tab.addEventListener('click')` | Toggles active pane and triggers data reload | ✅ Verified functional. |
| `sidepanel.ts` (Draft Tab) | **🔄 Scan Email Button** | `scan-email-btn.addEventListener('click')` | Manually triggers thread scan on active Gmail tab | ✅ Verified functional. |
| `sidepanel.ts` (Draft Tab) | **✨ Generate Contextual AI Draft Button** | `generate-btn.addEventListener('click')` | Invokes `apiClient.generateDraft(thread, hint)` | 🚨 **CRITICAL BUG (Line 560 in `api-client.ts`)**: Variable `hint` is undefined in `api-client.ts` scope, throwing `ReferenceError` and breaking server AI draft generation. |
| `sidepanel.ts` (Draft Tab) | **Editable Draft Content Box** | `contenteditable="true"`, `input` event | Allows inline editing of AI reply before insertion, updates `currentDraft` | ✅ Verified functional. |
| `sidepanel.ts` (Draft Tab) | **⚡ Insert into Gmail Reply Button** | `insert-btn.addEventListener('click')` | Sends `INSERT_DRAFT` to content script; fallback script execution injects text | ✅ Verified functional. |
| `sidepanel.ts` (Draft Tab) | **Copy to Clipboard Button** | `copy-btn.addEventListener('click')` | Copies draft text to clipboard with "✓ Copied!" feedback | ✅ Verified functional. |
| `sidepanel.ts` (Macros Tab) | **+ Add Custom Macro Button & Form** | `add-macro-form.addEventListener('submit')` | Inserts macro via `apiClient.createMacro`, refreshes list | ✅ Verified functional. |
| `sidepanel.ts` (Macros Tab) | **Macro Search Input** | `macro-search.addEventListener('input')` | Instant client-side filtering by name, content, or tags | ✅ Verified functional. |
| `sidepanel.ts` (Macros Tab) | **⚡ Insert Macro into Gmail Reply Button** | `.btn-use-macro.addEventListener('click')` | Replaces template tags with sender name, inserts directly into compose box | ✅ Verified functional. |
| `sidepanel.ts` (Macros Tab) | **Macro Delete Button (✕)** | `.delete-macro.addEventListener('click')` | Prompts confirmation, deletes macro via `apiClient.deleteMacro` | ✅ Verified functional. |
| `sidepanel.ts` (Settings Tab) | **Open Web Dashboard -> Button** | `billing-btn.addEventListener('click')` | Opens web dashboard in new browser tab | ✅ Verified functional. |
| `gmail-detector.ts` (Content Script) | **DOM Thread & Compose Observer** | `MutationObserver` + 2s interval + click listener | Identifies Gmail reply boxes and thread text, redacting PII before emitting | ✅ Verified functional. |
| `gmail-detector.ts` (Content Script) | **Message Listeners** | `chrome.runtime.onMessage` (`GET_THREAD_CONTENT`, `INSERT_DRAFT`) | Returns scrubbed thread text or injects HTML/text into active compose element | ✅ Verified functional. |
| `service-worker.ts` (Background) | **Message Router** | `GET_AUTH_TOKEN`, `SET_AUTH_TOKEN`, `THREAD_DETECTED`, `INSERT_DRAFT` | Relays messages between sidepanel, background storage, and active Gmail tab | ✅ Verified functional. |

---

## 2. Detailed Bug & Defect Catalogue

### Bug 1: ReferenceError in `packages/extension/src/utils/api-client.ts` (Critical P0)
- **File**: `packages/extension/src/utils/api-client.ts`
- **Line Number**: 560
- **Code**:
  ```typescript
  506: async generateDraft(threadContent: string, macroHint?: string) {
  ...
  552: const genRes = await fetch('https://draftpilot-web.vercel.app/api/drafts/generate', {
  ...
  558:   body: JSON.stringify({
  559:     threadContent: scrubbed,
  560:     macroHint: hint, // <--- ERROR: 'hint' is undefined in this function scope
  561:     matchedMacro,
  562:     kbSnippets,
  563:   }),
  ```
- **Root Cause**: The method parameter is named `macroHint`, but line 560 attempts to access an undeclared identifier `hint`.
- **Consequence**: When a user in the side panel clicks "Generate Contextual AI Draft", JavaScript throws `ReferenceError: hint is not defined`. The `try/catch` intercepts this and triggers the offline static fallback heuristics every single time.
- **Recommended Remediation**:
  ```typescript
  body: JSON.stringify({
    threadContent: scrubbed,
    macroHint: macroHint || '',
    matchedMacro,
    kbSnippets,
  }),
  ```

---

### Bug 2: Test Import TypeScript Compilation Errors (P1)
- **Files**:
  - `packages/extension/src/utils/__tests__/pii-scrubber.test.ts:1-3`
  - `packages/web/src/lib/__tests__/admin-auth.test.ts:3`
- **Error Description**:
  1. `TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled.` (Importing `../pii-scrubber.ts` and `../admin-auth.ts`).
  2. `TS2307: Cannot find module 'node:test' or its corresponding type declarations.`
- **Recommended Remediation**:
  - Update imports to omit `.ts` extension:
    `import { scrubPII } from '../pii-scrubber';`
    `import { verifySuperAdmin } from '../admin-auth';`
  - Configure `tsconfig.json` to exclude `__tests__` from production emit or install `@types/node`.

---

### Bug 3: Forgot Password Action Is a Non-Functional Stub (P2)
- **File**: `packages/web/src/components/AuthForm.tsx`
- **Line Number**: 302
- **Code**:
  ```typescript
  <button
    type="button"
    onClick={() => alert('Password reset link sent to your registered email.')}
    className="text-xs font-medium text-accent hover:text-accent-light transition-colors"
  >
    Forgot password
  </button>
  ```
- **Root Cause**: Hardcoded alert dialog does not perform email validation or invoke Supabase Auth password reset API.
- **Recommended Remediation**: Implement an asynchronous handler:
  ```typescript
  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter your email address in the field above first.');
      return;
    }
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login?reset=true` : undefined,
      });
      if (error) throw error;
      setSuccessMessage('Password reset link sent to your email address!');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    }
  };
  ```

---

### Bug 4: Volatile Team Invitations in `TeamManager.tsx` (P2)
- **File**: `packages/web/src/components/dashboard/TeamManager.tsx`
- **Line Numbers**: 97, 120-144
- **Code**:
  ```typescript
  const [invitedMembers, setInvitedMembers] = useState<TeamMember[]>([]);
  ...
  setInvitedMembers([...invitedMembers, newMember]);
  ```
- **Root Cause**: Team invites are stored exclusively in temporary React component state and are lost whenever the dashboard is refreshed.
- **Recommended Remediation**: Persist invites to Supabase (e.g. `team_members` table with status `invited` or `localStorage` cache with teamId key) so invited agents persist across page reloads.

---

### Bug 5: Stripe Billing Portal / Checkout Button Stub (P2)
- **File**: `packages/web/src/components/dashboard/BillingManager.tsx`
- **Line Numbers**: 83-89
- **Code**:
  ```typescript
  const handleOpenPortal = () => {
    setIsLoadingPortal(true);
    setTimeout(() => {
      alert('Stripe Billing: In live production with Stripe connected, this redirects to your customer billing checkout / portal.');
      setIsLoadingPortal(false);
    }, 500);
  };
  ```
- **Root Cause**: Hardcoded alert without initiating Stripe checkout session or billing portal URL dispatch.
- **Recommended Remediation**: Wire `handleOpenPortal` to call the backend Stripe endpoint or Next.js route `/api/admin/billing` / `/api/billing` to generate a session URL and navigate via `window.location.href`.

---

### Bug 6: Hardcoded Quota Cap in Overview Bento Card (P3)
- **File**: `packages/web/src/components/dashboard/OverviewBento.tsx`
- **Line Numbers**: 398-405
- **Code**:
  ```typescript
  <span>Monthly Free Quota ({draftsCount} / 50 drafts)</span>
  <span className="font-mono font-bold text-emerald-400">{Math.min(100, Math.round((draftsCount / 50) * 100))}%</span>
  ```
- **Root Cause**: The limit `50` is hardcoded, causing Team Tier accounts (1,000+ quota) to display "50 drafts".
- **Recommended Remediation**: Dynamically compute from `dbUser?.teams?.monthly_draft_limit || 50`.

---

### Bug 7: Macro Delete Optimistic Update Lacks Error Reversion (P3)
- **File**: `packages/web/src/components/dashboard/MacrosManager.tsx`
- **Line Numbers**: 291-298
- **Code**:
  ```typescript
  const handleDelete = async (id: string) => {
    setMacros((prev) => prev.filter((m) => m.id !== id));
    try {
      await supabase.from('macros').delete().eq('id', id);
    } catch (err) {
      console.error('Failed to delete macro in Supabase:', err);
    }
  };
  ```
- **Recommended Remediation**: Store previous state and restore if deletion fails:
  ```typescript
  const handleDelete = async (id: string) => {
    const previous = [...macros];
    setMacros((prev) => prev.filter((m) => m.id !== id));
    try {
      const { error } = await supabase.from('macros').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      setMacros(previous);
      alert('Failed to delete macro: ' + err.message);
    }
  };
  ```

---

## 3. Cross-Party State Synchronization Architecture

### Data Flow Diagram:
```
[ Chrome Extension Sidepanel / Content Script ]
        │
        ├── 1. PII Scrubbing (Local Regex Engine)
        ├── 2. Draft Generation: Calls Web API (/api/drafts/generate) or Server
        ├── 3. Telemetry: Writes directly to Supabase 'draft_history' table
        └── 4. Insertion: Uses Selection API & execCommand to inject into Gmail
                     │
                     ▼
             [ Supabase Database ]
           (tables: macros, draft_history, teams, users)
                     ▲
                     │ (Real-time Postgres Changes Subscription)
                     │
[ Web Dashboard (/dashboard) ]
        ├── OverviewBento: Reads draft_history count & macro count
        ├── BillingManager: Subscribed via 'user-billing-live' channel (auto-updates quota)
        ├── TeamManager: Subscribed to 'teams' table changes (auto-updates plan & seats)
        └── MacrosManager: Real-time CRUD on 'macros' and 'knowledge_documents'
```

### Verification of Real-Time Consistency:
1. **Draft Generation & Quota Synchronization**:
   When the Chrome Extension generates a draft, it records a row in `draft_history` with `team_id`. `BillingManager.tsx` in the user dashboard immediately receives the Postgres change event over the `user-billing-live` Supabase channel and refetches the count, updating the quota bar in real time.
2. **Macro Library Synchronization**:
   Macros created or deleted in `MacrosManager.tsx` are written directly to the Supabase `macros` table. In the Chrome Extension, switching to the Macros tab or refreshing queries `apiClient.getMacros()` scoped to `team_id`, ensuring immediate availability in Gmail.
3. **Plan Tier & Seat Upgrade Synchronization**:
   When a team plan or quota is updated in the database, `AuthProvider.tsx` and `TeamManager.tsx` receive live notifications via Postgres replication channels, immediately adjusting seat limits and available features without requiring logout.
