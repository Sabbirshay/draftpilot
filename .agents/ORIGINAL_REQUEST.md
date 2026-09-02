# Original User Request

## 2026-09-02T21:01:35Z

<USER_REQUEST>
Implement a complete Super Admin User Deletion & Permission Registry (preventing deleted users from using DraftPilot until explicitly restored), an in-panel Root Passkey Viewer & Changer, and Mandatory Email Verification for new registrations.

Working directory: /home/md-roni-ahamed/Test project
Integrity mode: development

## Requirements

### R1. Super Admin User Deletion & Access Control Registry
Provide an intuitive user management section in the Super Admin dashboard:
1. Allow the Super Admin to delete/deactivate any user account.
2. When deleted/banned, record the user's email into a persistent access restriction registry (`banned_emails` table).
3. The banned user must be strictly blocked from signing in, signing up with that email, accessing `/dashboard`, and generating AI drafts via API or Chrome extension.
4. Display the list of banned/deactivated users with a 1-click "Restore Permission" action that removes the restriction and permits them to use DraftPilot again.

### R2. Root Passkey Viewer & Dynamic Updater
Provide a secure "Root Passkey Vault" card in the Super Admin control panel:
1. Allow the authenticated Super Admin to view the current root passkey (with Show/Hide visibility toggle).
2. Allow the Super Admin to enter and save a new root passkey.
3. Persist the updated passkey dynamically in `platform_settings` so it takes effect across all guarded server API routes and updates the current admin session without requiring server restarts.

### R3. Mandatory Email Verification for New User Registrations
Re-enable and enforce email verification for new account registrations:
1. When a new user registers on `/join` or `/login`, enforce email verification before granting access to `/dashboard`.
2. Display a clear confirmation banner on signup: "Check your inbox! Please verify your email before logging in."
3. On sign-in, detect unverified accounts (`user.email_confirmed_at === null`), block dashboard redirect, and provide an actionable "Resend Verification Email" button.
4. Document the Supabase Auth "Confirm email" project setting so administrators can verify email dispatch configuration.

### R4. Multi-Package Integrity & Non-Destructive Verification
Preserve all existing features, UI styles, and security mechanisms. Verify changes across the monorepo using automated tests (`pnpm test`) and complete production builds (`pnpm build:web`, `pnpm build:api`, `pnpm build:ext`).

## Acceptance Criteria

### User Deletion & Permission Control
- [ ] Super Admin can delete/deactivate any user from the admin dashboard.
- [ ] Deleted/banned users cannot log in, sign up, or generate drafts with that email.
- [ ] Super Admin can view banned users and click "Restore Permission" to allow access again.

### Root Passkey Management
- [ ] Super Admin can view the active root passkey with a Show/Hide toggle.
- [ ] Super Admin can change the passkey; updated passkey immediately authorizes future admin API requests and sessions.

### Mandatory Email Verification
- [ ] New user registrations require email verification before dashboard entry.
- [ ] Unverified users are blocked at login with a clean warning and a functional "Resend Verification Email" button.

### Build & Test Health
- [ ] `pnpm test`, `pnpm build:web`, `pnpm build:api`, and `pnpm build:ext` all succeed with zero errors.

</USER_REQUEST>
