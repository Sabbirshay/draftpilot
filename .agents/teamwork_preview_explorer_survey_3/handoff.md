# Investigation Handoff: Requirement 3 (Mandatory Email Verification) & Requirement 4 (Monorepo Build & Test Architecture)

## 1. Observation

### 1.1 Monorepo Layout & Package Architecture
- **Root Configuration**:
  - `pnpm-workspace.yaml`:
    ```yaml
    packages:
      - "packages/*"
    ```
  - Root `package.json` (`/home/md-roni-ahamed/Test project/package.json`):
    - `dev`: `pnpm --filter @draftpilot/web dev`
    - `build`: `pnpm --filter @draftpilot/web build`
    - `build:api`: `pnpm --filter @draftpilot/api build`
    - `build:web`: `pnpm --filter @draftpilot/web build`
    - `build:ext`: `pnpm --filter @draftpilot/extension build`
    - `test`: `pnpm -r test`
    - `lint`: `pnpm -r lint`
- **Package Inventory**:
  1. **Web Application (`@draftpilot/web` at `packages/web`)**:
     - **Stack**: Next.js 14.2.35 (App Router), React 18.2.0, Tailwind CSS, Framer Motion (`framer-motion` ^11.0.0, `motion` ^13.1.1), `@supabase/supabase-js` (^2.38.0).
     - **Build Script**: `next build` (triggered via `pnpm build:web`).
     - **Test Script**: `node --experimental-strip-types --test src/lib/__tests__/*.test.ts` using Node 22 native test runner (`node:test`, `node:assert`).
     - **Active Tests**: 10 test suites in `packages/web/src/lib/__tests__/` (112 test cases currently passing).
  2. **Backend API (`@draftpilot/api` at `packages/api`)**:
     - **Stack**: NestJS 10.0.0, Express platform, `@supabase/supabase-js` (^2.38.0), Stripe (^14.0.0), Swagger, Throttler.
     - **Build Script**: `nest build` (triggered via `pnpm build:api`).
     - **Test Script**: `jest --passWithNoTests` using Jest 29.5.0 + `ts-jest` (13 tests across 2 suites currently passing).
  3. **Chrome Extension (`@draftpilot/extension` at `packages/extension`)**:
     - **Stack**: Manifest V3, Vite 5.0.0, TypeScript 5.0.0, Content Scripts & Background Service Worker.
     - **Build Script**: `vite build && cp manifest.json dist/ && cp -r icons dist/` (triggered via `pnpm build:ext`).
     - **Test Script**: `node --experimental-strip-types --test src/utils/__tests__/*.test.ts` using Node 22 native test runner (9 tests passing).

### 1.2 Monorepo Build & Test Command Execution Evidence
- Executed `pnpm test` with tool environment:
  - Command: `export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH" && export HOME="/home/md-roni-ahamed/Test project/.tmp_home" && pnpm test`
  - Result: **Exit Code 0** (Web: 112 passed, API: 13 passed, Extension: 9 passed, Total: 134 passed).
- Executed `pnpm build:web`:
  - Result: **Exit Code 0** (Compiled successfully, static pages generated).
- Executed `pnpm build:api`:
  - Result: **Exit Code 0** (Nest build successful).
- Executed `pnpm build:ext`:
  - Result: **Exit Code 0** (Vite build successful, bundle generated into `dist/`).

### 1.3 Registration, Login, and Email Verification Code Inspection
- **Registration & Login Pages**:
  - `packages/web/src/app/join/page.tsx`: Renders `<AuthForm initialMode="signup" />`.
  - `packages/web/src/app/login/page.tsx`: Renders `<AuthForm initialMode="signin" />`.
- **Current `AuthForm.tsx` Logic (`packages/web/src/components/AuthForm.tsx`)**:
  - **Signup (`mode === 'signup'`)** lines 93–122:
    ```typescript
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: teamName ? teamName.split("'")[0] : email.split('@')[0],
          team_name: teamName || `${email.split('@')[0]}'s Team`,
        },
        emailRedirectTo: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : undefined,
      },
    });

    if (error) throw error;

    if (signUpData.session) {
      // Instant session available — auto redirect to onboarding dashboard
      setSuccessMessage('Account created! Setting up your dashboard...');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }, 800);
    } else {
      // Email confirmation is required by Supabase
      setSuccessMessage('Account created! If email confirmation is enabled in your Supabase project, please check your inbox (and spam) to confirm your email before signing in.');
    }
    ```
    *Observation*: If Supabase returns a session or auto-confirms in dev, it currently redirects to `/dashboard`. When email confirmation is enabled or required, `signUpData.session` is null, and the message does not match the exact banner requirement: `"Check your inbox! Please verify your email before logging in."`.
  - **Sign In (`mode === 'signin'`)** lines 124–146:
    ```typescript
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. (If you just signed up, please check your email inbox to confirm your email address, or disable "Confirm email" in Supabase settings).');
      }
      throw error;
    }

    if (data.session) {
      setSuccessMessage('Signed in successfully! Redirecting...');
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/dashboard';
        }
      }, 800);
    }
    ```
    *Observation*:
    1. If a user has `email_confirmed_at === null` or Supabase returns error `"Email not confirmed"`, there is no dedicated unverified state handler or actionable "Resend Verification Email" button.
    2. If `signInWithPassword` returns `data.user` where `data.user.email_confirmed_at === null`, it does not block the `/dashboard` redirect or tear down the unverified session with `supabase.auth.signOut()`.
- **Auth Provider & Dashboard Gate**:
  - `packages/web/src/components/providers/AuthProvider.tsx`: In `handleProvision`, `session.user` is processed without verifying `user.email_confirmed_at`.
  - `packages/web/src/app/dashboard/page.tsx`: Checks only `!session` to redirect to `/login`.
- **Auth Callback Handler**:
  - `packages/web/src/app/auth/callback/page.tsx`: Captures the token from email confirmation redirect, provisions the user via `provisionUser(session.access_token)`, and navigates to `/dashboard`.

---

## 2. Logic Chain

1. **R3.1 & R3.2 (Signup Verification Enforcement & Confirmation Banner)**:
   - *Premise*: New user accounts created via `/join` (or signup mode) must require email verification before any dashboard access is permitted.
   - *Logic*: In `AuthForm.tsx` (`mode === 'signup'`), when `supabase.auth.signUp()` succeeds:
     - Check `signUpData.user`. Even if a session is returned, if `user.email_confirmed_at === null` (or in all new email signups under mandatory verification policy), the client must immediately invalidate/sign out any temporary session (`await supabase.auth.signOut()`).
     - The client must display the clear confirmation banner: `"Check your inbox! Please verify your email before logging in."`.
     - The dashboard auto-redirect must be suppressed.
2. **R3.3 (Unverified Account Detection & Resend Action on Sign-in)**:
   - *Premise*: When an unverified user attempts to sign in via `/login` (`mode === 'signin'`), the system must detect their unverified status, block access, and offer a one-click resend action.
   - *Logic*: In `AuthForm.tsx` (`mode === 'signin'`):
     - Catch case 1: `supabase.auth.signInWithPassword` throws error with `error.message` matching `/email not confirmed/i` (standard Supabase Auth error).
     - Catch case 2: `supabase.auth.signInWithPassword` succeeds and returns `data.user`, but `data.user.email_confirmed_at === null`.
     - In either case:
       - Block dashboard redirect.
       - Immediately execute `await supabase.auth.signOut()`.
       - Set unverified warning state (`isUnverified = true`, `unverifiedEmail = email`).
       - Display a warning message: `"Your email address is not verified yet. Please check your inbox or click below to resend the verification email."`.
       - Render a button: `Resend Verification Email`.
       - When clicked, trigger `supabase.auth.resend({ type: 'signup', email: unverifiedEmail, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })`.
       - Show feedback: `"Verification email resent! Please check your inbox (and spam folder)."`
3. **R3.4 (Supabase Auth Project Configuration Documentation)**:
   - *Premise*: Administrators need precise instructions on the Supabase project configuration to ensure verification emails are dispatched properly.
   - *Logic*: Document the Supabase dashboard settings, SMTP mailer configuration, rate limits, and redirect URLs.
4. **R4 (Multi-Package Integrity & Test Suite Integration)**:
   - *Premise*: Existing builds and tests must remain green across `@draftpilot/web`, `@draftpilot/api`, and `@draftpilot/extension`.
   - *Logic*: Monorepo scripts and testing harnesses are verified. New tests verifying email verification detection and resend flows should be added to `packages/web/src/lib/__tests__/email-verification.test.ts`.

---

## 3. Caveats

- **Supabase Local vs Cloud Auth Behavior**:
  - In local development or mock environments without active SMTP, Supabase may either auto-confirm emails or fail to send outbound SMTP emails unless custom SMTP credentials are provided in Supabase Project Settings. The client-side checks for `user.email_confirmed_at === null` and `error.message.includes('Email not confirmed')` handle both Supabase cloud responses and local/mock responses robustly.
- **Google OAuth Providers**:
  - Google OAuth users authenticated via `signInWithOAuth` have their email addresses verified by Google, so Supabase automatically populates `email_confirmed_at` with an ISO timestamp. OAuth flows via `/auth/callback` will continue directly to `/dashboard`.
- **No Source Code Modified During Survey**:
  - This survey was performed in read-only mode in accordance with agent constraints.

---

## 4. Conclusion & Required Changes

### Summary of Changes Required

| Component | Target File | Line(s) | Description of Changes |
|-----------|-------------|---------|------------------------|
| **Signup Confirmation Banner** | `packages/web/src/components/AuthForm.tsx` | 93–122 | On signup, clear temporary session (`supabase.auth.signOut()`), block dashboard redirect, and display banner: `"Check your inbox! Please verify your email before logging in."`. Provide option to resend if needed. |
| **Login Unverified Detection & Warning** | `packages/web/src/components/AuthForm.tsx` | 124–150 | On signin, check if `error.message` includes `"email not confirmed"` or `data.user?.email_confirmed_at === null`. Block redirect, sign out, set `isUnverified` state, and show warning. |
| **Resend Verification Button & Flow** | `packages/web/src/components/AuthForm.tsx` | New method & JSX | Implement `handleResendVerification()`, invoking `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: ... } })`. Render `"Resend Verification Email"` button with loading and success states. |
| **AuthProvider Protection** | `packages/web/src/components/providers/AuthProvider.tsx` | 55–80, 210–245 | Guard `handleProvision`: verify `session.user.email_confirmed_at` is non-null for email auth users; if null, prevent profile provisioning and sign out. |
| **Dashboard Gate Protection** | `packages/web/src/app/dashboard/page.tsx` | 31–37 | If `user && user.email_confirmed_at === null`, block dashboard view and redirect to `/login?unverified=true`. |
| **Automated Unit & Flow Tests** | `packages/web/src/lib/__tests__/email-verification.test.ts` | New file | Comprehensive test suite covering unverified user detection, signup banner requirement, login error interception, resend payload construction, and session teardown. |

---

## 5. Supabase Auth Configuration Guide

To enforce mandatory email verification in Supabase:

1. **Enable Email Confirmations in Supabase Dashboard**:
   - Go to **Supabase Dashboard** > **Authentication** > **Providers** > **Email**.
   - Set **"Enable Email provider"** to `ON`.
   - Set **"Confirm email"** to `ON` (Enabled).
   - *(Optional)* Set **"Secure email change"** to `ON`.
2. **Configure Redirect URLs**:
   - Go to **Authentication** > **URL Configuration**.
   - Set **Site URL**: `https://draftpilot-web.vercel.app` (or production domain).
   - In **Redirect URLs**, add:
     - `https://draftpilot-web.vercel.app/auth/callback`
     - `http://localhost:3000/auth/callback`
3. **Configure Custom SMTP Mailer**:
   - Go to **Authentication** > **Email Templates** / **SMTP Settings**.
   - Toggle **"Enable Custom SMTP"** to use production transactional email provider (Resend, SendGrid, Postmark, AWS SES).
   - Provide Sender Name (`DraftPilot`), Sender Email (`no-reply@draftpilot.app`), Host, Port (587/465), User, and Password.
   - Adjust rate limits under **Authentication** > **Rate Limits** (default is 30 emails/hour per project for free tier).

---

## 6. Verification Method

### 6.1 Automated Suite Verification Commands
Run the following commands in the workspace root to independently verify the changes:

```bash
# Set environment tools
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"

# 1. Run all unit and integration tests across the monorepo
pnpm test

# 2. Run dedicated web test runner (including new email verification tests)
pnpm --filter @draftpilot/web test

# 3. Verify production builds across all 3 packages
pnpm build:web
pnpm build:api
pnpm build:ext
```

### 6.2 Inspection Points & Invalidation Conditions
- **Invalidation Condition 1**: If a newly registered user on `/join` is automatically redirected to `/dashboard` without verifying their email address.
- **Invalidation Condition 2**: If an unverified user logs in and does not see a clear warning banner with an actionable `"Resend Verification Email"` button.
- **Invalidation Condition 3**: If clicking `"Resend Verification Email"` fails to call `supabase.auth.resend` or does not display confirmation feedback.
- **Invalidation Condition 4**: If any of `pnpm test`, `pnpm build:web`, `pnpm build:api`, or `pnpm build:ext` fail.
