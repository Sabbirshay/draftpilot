## 2026-09-01T21:14:31Z

You are a Worker subagent for Milestone 3: Extension Client Sandbox, Message Passing & DOM XSS Defense.
Working directory: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3_r2
Project root: /home/md-roni-ahamed/Test project
Parent orchestrator: 8fabfbde-14a6-45c2-92a6-be1ac01be3c1

Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md
PROJECT Plan: /home/md-roni-ahamed/Test project/PROJECT.md
Explorer Handoff: /home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_r2_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone 3:
1. Extension Sidepanel DOM XSS Defense:
   - In `packages/extension/src/sidepanel/sidepanel.ts`: Add `escapeHtml()` helper function and sanitize all dynamic database values (`m.name`, `m.content`, `m.id`) before interpolating into `innerHTML` for the macro list.
2. Extension Gmail Compose Safe Insertion:
   - In `packages/extension/src/content/gmail-detector.ts` and `packages/extension/src/sidepanel/sidepanel.ts`: Ensure that draft insertions into Gmail's contenteditable compose box HTML-entity-encode text (`escapeHtml(draft)`) before converting line breaks to `<br>` and calling `document.execCommand('insertHTML', ...)` or assigning to `target.innerHTML`.
3. Extension Background Service Worker Message Sender Verification:
   - In `packages/extension/src/background/service-worker.ts`:
     - Verify `sender.id === chrome.runtime.id`.
     - Restrict sensitive actions (`GET_AUTH_TOKEN`, `SET_AUTH_TOKEN`) strictly to extension internal pages (`if (sender.tab) { return reject / access denied }`), blocking untrusted web tabs or content scripts from accessing or mutating auth tokens.
     - Validate payload types (`typeof message.token === 'string' || message.token === null`, `typeof message.draft === 'string'`).
4. Unified Extension Client PII Scrubber & Manifest CSP:
   - In `packages/extension/src/utils/pii-scrubber.ts`: Add standalone JWT pattern (`\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b`) and API key patterns.
   - In `packages/extension/src/content/gmail-detector.ts`: Synchronize PII scrubbing rules to ensure street addresses, PO boxes, JWTs, and API tokens are all scrubbed before emitting `THREAD_DETECTED` or `GET_THREAD_CONTENT`.
   - In `packages/extension/manifest.json`: Harden CSP to `"extension_pages": "script-src 'self'; object-src 'none'; connect-src 'self' https://*.supabase.co https://draftpilot-web.vercel.app;"`.
5. Verification:
   - Run unit tests (`pnpm test`) and extension build (`pnpm build:ext`, `pnpm --filter @draftpilot/extension test` or `node --experimental-strip-types --test packages/extension/src/utils/__tests__/pii-scrubber.test.ts`).
   - Verify full builds succeed: `pnpm build:ext`, `pnpm build:web`, `pnpm build:api`.
   - Document all changes and verification outputs in your handoff report at `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_worker_m3_r2/handoff.md`.
   - Send a message back when complete.
