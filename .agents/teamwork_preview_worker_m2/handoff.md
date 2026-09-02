# Milestone 2 Handoff Report: Root Passkey Vault & Dynamic Platform Settings

## 1. Observation

### 1.1 Database Migration Schema
- **File**: `packages/api/supabase/migrations/008_platform_settings_root_passkey.sql`
- **Observed Content**:
  ```sql
  -- Migration 008: Add root_passkey column to platform_settings singleton table
  -- Allows dynamic in-panel viewing and changing of the Super Admin Root Passkey without server restarts.

  ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS root_passkey TEXT;

  COMMENT ON COLUMN platform_settings.root_passkey IS 'Dynamic Root Passkey for Super Admin access. Takes precedence over ADMIN_PASSKEY env var when set.';
  ```

### 1.2 Dynamic Root Passkey Engine & Constant-Time Verification
- **File**: `packages/web/src/lib/admin-auth.ts:31-105`
- **Observed Exports**:
  - `timingSafeEqual(a: string, b: string): boolean`: Constant-time string comparison using `crypto.timingSafeEqual` over UTF-8 buffers.
  - `getActiveRootPasskey(): Promise<string | null>`: Dynamic resolution hierarchy:
    1. Checks in-memory cache for dynamic DB passkey (30s TTL).
    2. Queries `platform_settings.root_passkey` using `supabaseAdmin`.
    3. Falls back to `process.env.ADMIN_PASSKEY` or `process.env.SUPERADMIN_PASSKEY`.
  - `setCachedRootPasskey(passkey: string | null): void`: Immediate in-memory cache invalidation and update.
  - `clearCachedRootPasskey(): void`: Cache purge utility.
  - `verifySuperAdmin(req: Request): Promise<AdminAuthResult>`: Evaluates `x-admin-passkey` against `getActiveRootPasskey()` using `timingSafeEqual`, with fallback to Supabase token verification and superadmin directory check.

### 1.3 Super Admin Passkey API Routes
- **File**: `packages/web/src/app/api/admin/passkey/route.ts:1-98`
- **Observed Routes**:
  - `GET /api/admin/passkey`: Guarded by `verifySuperAdmin(req)`. Calls `getActiveRootPasskey()` and returns `{ success: true, passkey: activePasskey || '' }`.
  - `POST /api/admin/passkey`: Guarded by `verifySuperAdmin(req)`. Validates input passkey (string with length >= 6), persists to `platform_settings.root_passkey` using `supabaseAdmin.upsert`, immediately invalidates/updates cache via `setCachedRootPasskey(cleanedPasskey)`, and returns `{ success: true, message: 'Root passkey updated dynamically in platform_settings' }`.

### 1.4 Admin Passkey Vault UI Component & Session Synchronization
- **File**: `packages/web/src/components/admin/AdminPasskeyVault.tsx:1-240`
- **Observed Features**:
  - Header with shield/key badge and real-time sync button.
  - Current Active Passkey viewer with read-only masked field, Show/Hide toggle (`type="password"` vs `type="text"`), and Copy button with 2s visual feedback ("Copied!").
  - Update form with validation (minimum 6 characters), Show/Hide toggle, and Save button.
  - Saves to `POST /api/admin/passkey` with `x-admin-passkey` and Bearer token headers.
  - On successful response: updates `sessionStorage.setItem('draftpilot_admin_passkey', clean)` so active session remains authorized without 401 errors.
- **File**: `packages/web/src/components/admin/AdminOverview.tsx:3-228`
  - Integrated `<AdminPasskeyVault />` into the Super Admin Command Center overview screen.

### 1.5 Automated Verification Suite
- **File**: `packages/web/src/lib/__tests__/admin-passkey-vault.test.ts:1-248`
- **Observed Test Suites**:
  - `timingSafeEqual`: Identical ASCII strings, Unicode strings, differing lengths, differing characters, non-string handling.
  - `getActiveRootPasskey & Cache Invalidation`: Fallback to `ADMIN_PASSKEY`, fallback to `SUPERADMIN_PASSKEY`, `setCachedRootPasskey` instant override, `clearCachedRootPasskey` purge.
  - `GET /api/admin/passkey`: 401 on missing auth, 401 on invalid passkey, 200 with active passkey when authorized.
  - `POST /api/admin/passkey`: 401 on unauthorized, 400 on short/invalid passkeys (< 6 chars), 200 on valid update with cache invalidation, and immediate authorization of subsequent `verifySuperAdmin` requests with new passkey and rejection of old passkey.

---

## 2. Logic Chain

1. **Database Singleton Extension**: Adding `root_passkey TEXT` to `platform_settings` allows dynamic storage of the active master key while keeping row-level security restricted to `service_role` (via `005_secure_platform_settings.sql`).
2. **Resolution Hierarchy & Caching**: Querying the DB singleton first ensures dynamic changes take precedence over static environment variables. The 30-second TTL in-memory cache guarantees high-performance request evaluation with sub-millisecond overhead.
3. **Immediate Cache Invalidation**: When `POST /api/admin/passkey` is invoked, calling `setCachedRootPasskey(newPasskey)` immediately updates the in-memory cache, eliminating any TTL delay across subsequent API calls.
4. **Active Session Persistence**: When the Super Admin changes the root passkey from the UI, updating `sessionStorage.setItem('draftpilot_admin_passkey', newPasskey)` prevents `401 Unauthorized` errors on subsequent telemetry and settings API calls in the current browser tab.
5. **Constant-Time Timing-Attack Protection**: Retaining and exporting `timingSafeEqual` with buffer length checks prevents substring/timing side-channel attacks during passkey authentication.

---

## 3. Caveats

- **Multi-Server Clustering / Scaling**: In-memory cache is local to each Node.js process. In a horizontally scaled multi-instance cluster, instances that did not receive the POST request will pick up the updated database value when their 30-second cache TTL expires.
- **Database Connectivity Fallback**: If the database is temporarily unreachable or running in an isolated test environment, `getActiveRootPasskey()` safely falls back to `process.env.ADMIN_PASSKEY || process.env.SUPERADMIN_PASSKEY`.

---

## 4. Conclusion

Milestone 2 (Root Passkey Vault & Dynamic Platform Settings) is fully implemented, verified, and integrated into the DraftPilot codebase:
- Migration `008_platform_settings_root_passkey.sql` creates the database schema column.
- Dynamic passkey loader, in-memory cache, cache invalidator, and `timingSafeEqual` comparisons are live in `admin-auth.ts`.
- Dedicated `GET` and `POST /api/admin/passkey` API endpoints are guarded and functional.
- `<AdminPasskeyVault />` provides a secure, intuitive UI for viewing and changing the passkey with Show/Hide toggles, copy feedback, and session synchronization.
- All 195 unit and integration tests across the monorepo pass cleanly (`pnpm test`), and all production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`) succeed with zero errors.

---

## 5. Verification Method

### 5.1 Automated Test Execution
Run the full monorepo test suite:
```bash
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"
export PNPM_HOME="/home/md-roni-ahamed/Test project/.tmp_home/share/pnpm"

pnpm test
```
*Expected Result*: 195/195 tests pass across 40 test suites in `@draftpilot/web`, `@draftpilot/api`, and `@draftpilot/extension`.

### 5.2 Production Monorepo Builds
Run all production builds:
```bash
pnpm build:web
pnpm build:api
pnpm build:ext
```
*Expected Result*: All builds exit with code 0.

### 5.3 Files to Inspect
- `packages/api/supabase/migrations/008_platform_settings_root_passkey.sql`
- `packages/web/src/lib/admin-auth.ts`
- `packages/web/src/app/api/admin/passkey/route.ts`
- `packages/web/src/components/admin/AdminPasskeyVault.tsx`
- `packages/web/src/components/admin/AdminOverview.tsx`
- `packages/web/src/lib/__tests__/admin-passkey-vault.test.ts`
