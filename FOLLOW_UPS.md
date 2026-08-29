# DraftPilot Security Remediation — Follow-Up Items & Notes

## P1-3: Credential Rotation Operations
1. **GitHub Personal Access Token (PAT)**:
   - Git remote origin has been stripped of embedded PAT token and restored to `https://github.com/Sabbirshay/draftpilot.git`.
   - Action for Repository Administrator: Revoke and regenerate the GitHub PAT in GitHub Settings ➔ Developer Settings ➔ Personal Access Tokens.
2. **Supabase Service Role Key**:
   - The Supabase `service_role` key must only be placed in server-side deployment environment variables (`SUPABASE_SERVICE_ROLE_KEY` in Vercel project settings).
   - If rotated in the Supabase Dashboard (`Settings ➔ API`), update the Vercel production environment variable and redeploy.

## P0-1: Superadmin Role Migration
- Currently superadmin authorization checks `users.role = 'superadmin'` or `users.role = 'admin'` with `SUPERADMIN_EMAILS` environment variable fallback.
- Migration to a dedicated boolean column `users.is_superadmin` is recommended in future database refactors.
