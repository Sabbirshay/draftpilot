# Changes Report — Worker M1 (Extension AI Pipeline & Dashboard Interactive Polish)

## Summary of Changes
Worker M1 was tasked with addressing 6 key interactive and pipeline defects across `@draftpilot/extension` and `@draftpilot/web`.

### 1. `packages/extension/src/utils/api-client.ts`
- **Location**: Line 560
- **Modification**: Replaced `macroHint: hint` with `macroHint: macroHint || ''`.
- **Rationale**: The method signature declared `macroHint?: string` as parameter, but the payload builder referenced `hint` which was undefined in the scope, causing a runtime `ReferenceError: hint is not defined` and TypeScript compile error `TS2304`.

### 2. `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`
- **Location**: Line 1-4
- **Modification**: Replaced `.ts` extension import `import { scrubPII } from '../pii-scrubber.ts'` with `import { scrubPII } from '../pii-scrubber'`, and added `/// <reference types="node" />`.
- **Rationale**: Resolves `TS5097` (import path cannot end with .ts) and `TS2307` (node:test/node:assert types). Unit test suite executes 7/7 tests cleanly.

### 3. `packages/web/src/components/AuthForm.tsx`
- **Location**: Line 20-50, 330-338
- **Modification**: Replaced static `alert('Password reset link sent to your registered email.')` with an asynchronous `handleForgotPassword` handler.
- **Rationale**: Provides real integration with `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })`, including email validation, loading spinner state (`resetLoading`), and inline success/error banners.

### 4. `packages/web/src/components/dashboard/TeamManager.tsx`
- **Location**: State management & `handleInvite` / `handleRemove` handlers
- **Modification**: 
  - Added regex email validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
  - Added duplicate member check across existing workspace roster.
  - Added plan seat quota enforcement with actionable upgrade feedback.
  - Added `localStorage` caching keyed by workspace `team_id` so invited members persist across page reloads.
  - Added confirmation feedback message and removal confirmation.

### 5. `packages/web/src/components/dashboard/BillingManager.tsx`
- **Location**: `handleOpenPortal`, `handleConfirmUpgrade`, and UI JSX
- **Modification**:
  - Replaced static `alert()` dialog with interactive portal connection feedback.
  - Added dismissible animated notification banner (`portalNotice`) for billing actions.
  - Added interactive Plan Upgrade Modal with real-time seat adjustment, price calculation, and direct database mutation in Supabase `teams` table (`plan: 'team'`, `monthly_draft_limit: quota`).

### 6. `packages/web/src/components/dashboard/MacrosManager.tsx`
- **Location**: `handleDelete` and notification JSX
- **Modification**:
  - Added snapshot of previous macros array before optimistic deletion.
  - If `supabase.from('macros').delete().eq('id', id)` fails, the optimistic delete is automatically rolled back with `setMacros(previousMacros)` and a red alert banner is displayed with the exact error message.
