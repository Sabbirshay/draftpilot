## 2026-09-03T03:07:08Z
<USER_REQUEST>
You are a teamwork_preview_test_writer responsible for the E2E Testing Track (Milestone 4 test suite foundation).
Your working directory is: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_test_writer_e2e
The workspace root is: /home/md-roni-ahamed/Test project

MANDATORY: Read these files first:
- /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
- /home/md-roni-ahamed/Test project/PROJECT.md
- /home/md-roni-ahamed/Test project/TEST_INFRA.md

Task:
1. Design and write a comprehensive, requirement-driven opaque-box test suite across Tiers 1-4 in `packages/web/src/lib/__tests__/e2e-superadmin-auth.test.ts`.
2. Ensure full coverage of:
   - Tier 1: User deletion, banned emails access registry, root passkey vault, dynamic passkey resolution, signup email verification banner, unverified login block.
   - Tier 2: Case-insensitive email banning (`User@Example.com` vs `user@example.com`), empty/short passkey validation, unverified OAuth vs email accounts, session invalidation edge cases.
   - Tier 3: Pairwise combinations (e.g. banned user attempts passkey login vs normal login; passkey updated mid-session while performing ban action; unverified user requesting draft generation).
   - Tier 4: Real-world administrative lifecycles (super admin rotates root passkey -> bans compromised user -> confirms banned user blocked from AI generation and login -> restores permission -> verifies restored access).
3. Run `pnpm test` to verify the tests execute properly.
4. Create `/home/md-roni-ahamed/Test project/TEST_READY.md` containing the test runner command, coverage summary table (Tier 1-4 counts), and feature checklist.
5. Write your handoff report to: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_test_writer_e2e/handoff.md
6. Send a completion message when done.
</USER_REQUEST>
