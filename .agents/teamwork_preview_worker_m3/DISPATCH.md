## 2026-09-02T21:07:08Z

You are a teamwork_preview_worker implementing Milestone 3: Mandatory Email Verification Flow.
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3
The workspace root is: /home/md-roni-ahamed/Test project

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY: Read these files first:
- /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
- /home/md-roni-ahamed/Test project/PROJECT.md
- /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_3/handoff.md

Your exclusive write ownership:
1. `packages/web/src/components/AuthForm.tsx`:
   - On signup (`mode === 'signup'`): Enforce email verification before dashboard entry. Invalidate temporary session via `await supabase.auth.signOut()`, suppress auto-redirect to `/dashboard`, and display the confirmation banner: `"Check your inbox! Please verify your email before logging in."`.
   - On signin (`mode === 'signin'`): Detect unverified accounts (`user.email_confirmed_at === null` or error message containing `"email not confirmed"`). Block dashboard redirect, sign out temporary session, display warning message, and render an actionable `"Resend Verification Email"` button that triggers `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${origin}/auth/callback` } })` with visual loading and confirmation states.
2. `packages/web/src/components/providers/AuthProvider.tsx`: Guard `handleProvision` to ensure users with unverified emails are not provisioned or treated as active sessions.
3. `packages/web/src/app/dashboard/page.tsx`: Guard unverified users and redirect to `/login` if unconfirmed.
4. `packages/web/src/lib/__tests__/email-verification.test.ts`: Write comprehensive automated tests for unverified user detection, signup banner, login block, resend flow, and session teardown.

Run test and build commands to verify:
`pnpm test`
`pnpm build:web`
`pnpm build:api`
`pnpm build:ext`

Write your comprehensive handoff report to: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3/handoff.md
Send a completion message when done.
