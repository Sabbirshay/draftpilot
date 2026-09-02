# Handoff Report: Requirement 2 (Root Passkey Viewer & Dynamic Updater)

## Executive Summary
This investigation surveys the current architecture of Super Admin passkey authentication, admin session management, and `platform_settings` persistence across `packages/web`, `packages/api`, and Supabase migrations. It delivers a comprehensive blueprint for implementing the **Root Passkey Viewer & Dynamic Updater (R2)**, enabling the authenticated Super Admin to view the current root passkey (with Show/Hide toggle), update it dynamically into `platform_settings` without server restarts, and seamlessly maintain active admin sessions.

---

## 1. Observation

### 1.1 Current Root Passkey Authentication Implementation
- **File**: `packages/web/src/lib/admin-auth.ts:47-54`
  ```typescript
  export async function verifySuperAdmin(req: Request): Promise<AdminAuthResult> {
    // 1. Check direct server-only admin passkey header (constant-time verification)
    const passkey = req.headers.get('x-admin-passkey')?.trim();
    const configuredPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim();
    if (passkey && configuredPasskey && timingSafeEqual(passkey, configuredPasskey)) {
      return { authorized: true };
    }
    // 2. Check Authorization Bearer token ...
  ```
  - `verifySuperAdmin` applies cryptographic constant-time comparison via `crypto.timingSafeEqual` (`admin-auth.ts:29-37`).
  - It currently reads the passkey solely from static process environment variables: `process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY`.
  - In a long-running Node/Next.js server, environment variables cannot be mutated dynamically without process restarts, meaning passkey updates cannot take effect dynamically unless a persistent database store is checked.

### 1.2 Admin Session Validation & Storage Across Web
- **File**: `packages/web/src/components/admin/AdminGuard.tsx:35-41, 53-64`
  - Unlocked status is checked from `sessionStorage.getItem('draftpilot_admin_unlocked') === 'true'`.
  - On passkey login or unlock, the passkey is saved to `sessionStorage`:
    ```typescript
    sessionStorage.setItem('draftpilot_admin_unlocked', 'true');
    sessionStorage.setItem('draftpilot_admin_passkey', passkeyClean);
    setIsAdminUnlocked(true);
    ```
- **File**: `packages/web/src/app/admin/login/page.tsx:43-62`
  - Validates passkey against `/api/admin/metrics` with `x-admin-passkey` header.
  - On success, sets `sessionStorage.setItem('draftpilot_admin_unlocked', 'true')` and `sessionStorage.setItem('draftpilot_admin_passkey', passkeyClean)`.
- **File**: Admin UI Components (`AdminOverview.tsx:38-43`, `AdminWorkspaces.tsx:39-44`, `AdminAIConfig.tsx:124-130, 303-310`, `AdminBillingAnalytics.tsx`, `AdminFeatureFlags.tsx`, `AdminGlobalMacros.tsx`)
  - All admin components extract `sessionStorage.getItem('draftpilot_admin_passkey')` and send it as header `x-admin-passkey` on all `fetch('/api/admin/*')` requests.

### 1.3 Platform Settings Table Schema & Security
- **File**: `packages/api/supabase/migrations/004_platform_settings.sql:1-14`
  ```sql
  CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_provider TEXT NOT NULL DEFAULT 'openrouter' CHECK (ai_provider IN ('openrouter', 'openai', 'anthropic', 'offline')),
    openrouter_api_key TEXT,
    openrouter_model TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct:free',
    openai_api_key TEXT,
    anthropic_api_key TEXT,
    selected_model TEXT DEFAULT 'meta-llama/llama-3.1-8b-instruct:free',
    system_prompt TEXT DEFAULT '...',
    temperature NUMERIC(3,2) DEFAULT 0.4,
    max_tokens INTEGER DEFAULT 300,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- **File**: `packages/api/supabase/migrations/005_secure_platform_settings.sql:8-13`
  - Row Level Security (RLS) is strictly restricted to `service_role` only. Public and anon/authenticated clients cannot read `platform_settings` directly.
- **Current Limitation**: `platform_settings` does **not** currently have a `root_passkey` column.

### 1.4 Guarded Server API Endpoints
All existing admin API endpoints under `packages/web/src/app/api/admin/` call `await verifySuperAdmin(req)`:
1. `GET /api/admin/metrics` (`metrics/route.ts:7-10`)
2. `GET, POST /api/admin/ai-config` (`ai-config/route.ts:7, 30`)
3. `GET, PATCH /api/admin/workspaces` (`workspaces/route.ts:7, 65`)
4. `GET, PATCH /api/admin/billing` (`billing/route.ts:13, 103`)
5. `GET, POST /api/admin/feature-flags` (`feature-flags/route.ts:112, 126`)
6. `GET, POST, DELETE /api/admin/global-macros` (`global-macros/route.ts`)

---

## 2. Logic Chain

1. **Root Passkey Hierarchy & Dynamic Resolution**:
   - To allow passkeys to update dynamically without server restarts, the server must resolve the active root passkey by inspecting the persistent database singleton in `platform_settings.root_passkey`.
   - If `platform_settings.root_passkey` is present and non-empty, it takes precedence as the active dynamic root passkey.
   - If `platform_settings.root_passkey` is not configured, the server falls back to `process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY`.
   - If neither DB nor env is configured, passkey authorization is disabled and falls back to Supabase Bearer token verification.

2. **In-Memory Caching with Immediate Cache Invalidation**:
   - Calling Supabase on every single API request could add latency. An in-memory cache in `admin-auth.ts` (`cachedRootPasskey`, `cachedAt`, TTL: 30s) ensures high throughput (sub-millisecond evaluation).
   - When a passkey update is requested via `POST /api/admin/passkey`, it writes to `platform_settings` and immediately updates/invalidates the local cache (`setCachedRootPasskey(newPasskey)`).

3. **Session Synchronization**:
   - When a Super Admin updates the root passkey from the UI:
     - The client sends `POST /api/admin/passkey` with `headers: { 'x-admin-passkey': currentPasskey }` (or active Bearer token).
     - Upon receiving `200 OK`, the client updates `sessionStorage.setItem('draftpilot_admin_passkey', newPasskey)`.
     - This guarantees that subsequent API requests in the existing session continue to succeed without 401 Unauthorized errors or requiring re-login.

4. **Super Admin UI / Root Passkey Vault Card**:
   - The Root Passkey Vault should be presented in the Super Admin Command Center (in `AdminOverview.tsx` and/or `AdminPasskeyVault.tsx`).
   - The component provides:
     - Current Passkey display with a Show/Hide toggle (`type="password"` vs `type="text"`).
     - Copy-to-clipboard button with visual feedback.
     - New Passkey input field with validation (minimum length 6 characters, trimmed).
     - Save button that persists to `/api/admin/passkey` and syncs `sessionStorage`.

---

## 3. Caveats & Edge Cases

1. **Security & RLS Integrity**:
   - `platform_settings` is protected by `005_secure_platform_settings.sql` which enforces `TO service_role` only. Under no circumstances should public/anon SELECT policy be re-introduced. All access must flow through `supabaseAdmin` in server API routes guarded by `verifySuperAdmin`.
2. **Timing Side-Channel Protection**:
   - `crypto.timingSafeEqual` must continue to be used for dynamic passkey comparison. Length checks and truthiness validation must occur before calling `timingSafeEqual`.
3. **Empty / Whitespace String Rejection**:
   - An attacker attempting to pass `""` or `"   "` when no passkey is set in DB/env must be rejected immediately (`401 Unauthorized`).
4. **Multi-Tab / Multi-Admin Invalidation**:
   - If Admin A changes the passkey, Admin B's old passkey in `sessionStorage` will fail on the next request with `401`. `AdminGuard` will catch this and prompt Admin B to enter the new passkey.

---

## 4. Conclusion & Implementation Plan

### 4.1 Database Migration
- **File to create**: `packages/api/supabase/migrations/007_platform_settings_root_passkey.sql`
  ```sql
  -- Migration 007: Add root_passkey column to platform_settings singleton table
  ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS root_passkey TEXT;
  ```

### 4.2 Server Core Library: `packages/web/src/lib/admin-auth.ts`
- Add dynamic passkey loader and cache:
  ```typescript
  let cachedDynamicPasskey: string | null = null;
  let cacheTimestamp: number = 0;
  const CACHE_TTL_MS = 30000;

  export function setCachedRootPasskey(passkey: string | null): void {
    cachedDynamicPasskey = passkey;
    cacheTimestamp = Date.now();
  }

  export async function getActiveRootPasskey(): Promise<string | null> {
    const now = Date.now();
    if (cachedDynamicPasskey !== null && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedDynamicPasskey;
    }

    try {
      const { data } = await supabaseAdmin
        .from('platform_settings')
        .select('root_passkey')
        .limit(1)
        .maybeSingle();

      if (data?.root_passkey && typeof data.root_passkey === 'string' && data.root_passkey.trim()) {
        cachedDynamicPasskey = data.root_passkey.trim();
        cacheTimestamp = now;
        return cachedDynamicPasskey;
      }
    } catch {
      // Fall through to environment variables on database query error
    }

    const envPasskey = (process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY)?.trim() || null;
    cachedDynamicPasskey = envPasskey;
    cacheTimestamp = now;
    return envPasskey;
  }
  ```
- Update `verifySuperAdmin(req: Request)`:
  ```typescript
  const passkey = req.headers.get('x-admin-passkey')?.trim();
  const configuredPasskey = await getActiveRootPasskey();
  if (passkey && configuredPasskey && timingSafeEqual(passkey, configuredPasskey)) {
    return { authorized: true };
  }
  ```

### 4.3 New Dedicated Server API Route: `packages/web/src/app/api/admin/passkey/route.ts`
- **GET**:
  - Validates caller with `await verifySuperAdmin(req)`.
  - Calls `await getActiveRootPasskey()`.
  - Returns `NextResponse.json({ success: true, passkey: activePasskey || '' })`.
- **POST**:
  - Validates caller with `await verifySuperAdmin(req)`.
  - Parses body `{ newPasskey: string }`.
  - Validates: `typeof newPasskey === 'string' && newPasskey.trim().length >= 6`.
  - Upserts into `platform_settings`:
    ```typescript
    const { data: existing } = await supabaseAdmin.from('platform_settings').select('id').limit(1).maybeSingle();
    const id = existing?.id || crypto.randomUUID();
    await supabaseAdmin.from('platform_settings').upsert({
      id,
      root_passkey: newPasskey.trim(),
      updated_at: new Date().toISOString()
    });
    setCachedRootPasskey(newPasskey.trim());
    return NextResponse.json({ success: true, message: 'Root passkey updated dynamically in platform_settings' });
    ```

### 4.4 UI Component: `packages/web/src/components/admin/AdminPasskeyVault.tsx`
- **Props**: none (self-contained).
- **State**:
  - `currentPasskey`: string (fetched from `GET /api/admin/passkey`).
  - `showCurrentPasskey`: boolean (default `false`).
  - `newPasskeyInput`: string.
  - `showNewPasskey`: boolean (default `false`).
  - `isLoading`: boolean.
  - `isSaving`: boolean.
  - `copied`: boolean (temporary 2s state).
  - `statusMessage`: string | null.
  - `errorMessage`: string | null.
- **Card Features**:
  1. Header with shield icon, "Root Passkey Vault", and "Dynamic & Synced" status badge.
  2. "Current Active Passkey" field:
     - Read-only input with masked / unmasked toggle button.
     - "Copy Passkey" button.
  3. "Update Root Passkey" form:
     - Input field with Show/Hide toggle.
     - "Update & Propagate Passkey" submit button.
     - On save: updates `sessionStorage.setItem('draftpilot_admin_passkey', newPasskey)` and reloads vault state.
  4. Security Advisory footer noting immediate effect across all server routes without restart.

### 4.5 Integration in Super Admin Console
- Include `<AdminPasskeyVault />` in `packages/web/src/components/admin/AdminOverview.tsx` (right column or dedicated section) so it is immediately accessible upon entering `/admin`.

---

## 5. Verification Method

### 5.1 Automated Unit & Integration Tests
Create test file `packages/web/src/lib/__tests__/admin-passkey-vault.test.ts`:
1. `GET /api/admin/passkey` requires valid superadmin authorization (returns 401 without auth).
2. `GET /api/admin/passkey` returns the active root passkey when authorized.
3. `POST /api/admin/passkey` rejects empty or short passkeys (< 6 chars) with 400 Bad Request.
4. `POST /api/admin/passkey` updates `platform_settings.root_passkey` and invalidates in-memory cache.
5. Immediate authorization with the new passkey across all admin routes (`/api/admin/metrics`, `/api/admin/ai-config`, `/api/admin/workspaces`, `/api/admin/billing`, etc.).
6. Rejection of previous old passkey once updated.
7. Verification that environment variables (`ADMIN_PASSKEY` / `SUPERADMIN_PASSKEY`) continue to work seamlessly as fallback when DB field is null.

### 5.2 Verification Commands
Run in workspace root:
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
export PNPM_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share/pnpm"

# 1. Run all unit test suites
pnpm test

# 2. Verify web production build
pnpm build:web

# 3. Verify API production build
pnpm build:api

# 4. Verify Chrome extension build
pnpm build:ext
```
