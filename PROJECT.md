# Project: DraftPilot AI System Diagnosis & Enhancement (R1-R5)

## Architecture
DraftPilot is a monorepo consisting of:
- **`packages/web` (`@draftpilot/web`)**: Next.js 14 App Router, React 18, Tailwind CSS, Framer Motion, Supabase JS Client. Houses `/api/drafts/generate`, `/admin` (with `AdminAIConfig`), and dashboard.
- **`packages/api` (`@draftpilot/api`)**: NestJS 10 backend, Express, Supabase JS Client, Stripe.
- **`packages/extension` (`@draftpilot/extension`)**: Chrome Manifest V3 extension, Vite 5, TypeScript. Houses `api-client.ts` and `sidepanel/sidepanel.ts`.
- **`packages/api/supabase/migrations`**: PostgreSQL database migrations with Row Level Security (RLS).

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| F18 | Custom Instruction & Contextual Prompt Compilation | Support `macroHint` and aliases (`customInstruction`, `instruction`, `userPrompt`, `promptOverride`), prioritize agent guidance in system prompt, prevent PII over-scrubbing of legitimate support contacts, and expand `extractSenderName` | M1 | R1 | PLANNED |
| F19 | OpenRouter Fallback Cascade & Synthesizer Resilience | 7-tier model cascade with client-side `AbortSignal.timeout(12000)`, pass `kbSnippets` and `macroHint` to `synthesizeSmartSupportDraft` for grounded fallback responses | M2 | R2 | PLANNED |
| F20 | Output Sanitization & Honest Source Labeling | Strip unclosed `<think>` tags and markdown bold reasoning headers (`**Thinking Process:**`); ensure extension sidepanel displays authentic emoji badges (`✨ AI Generated`, `📐 Macro`, `📄 Template Reply`) | M3 | R3 | PLANNED |
| F21 | Super Admin AI Playground & Dynamic Routing | Align Admin Playground to call `/api/drafts/generate`, auto-hydrate key telemetry `/api/v1/auth/key`, respect `temperature: 0.0` and custom `max_tokens` (100-800) | M4 | R4 | PLANNED |
| F22 | Non-Destructive Integrity, Comprehensive Test & Build Verification | Pass 100% of monorepo unit tests (`pnpm test`), add unit tests for new AI resilience features, verify `build:web`, `build:ext`, and `build:api` compile cleanly | M5 | R5 | PLANNED |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core AI Pipeline, Resilience, Sanitization & Admin Playground | F18, F19, F20, F21 | none | IN_PROGRESS |
| M2 | Final Verification, Monorepo Test Suite & Production Builds | F22 | M1 | PLANNED |

## Interface Contracts

### 1. Draft Generation Request & Response (`/api/drafts/generate`)
```typescript
export interface DraftGenerateRequest {
  threadContent: string;
  macroHint?: string;
  customInstruction?: string;
  instruction?: string;
  userPrompt?: string;
  promptOverride?: string;
  matchedMacro?: { id?: string; title?: string; content?: string };
  kbSnippets?: string[];
  forceSource?: 'openrouter' | 'synthesizer';
}

export interface DraftGenerateResponse {
  draft: string;
  source: 'openrouter' | 'macro' | 'template';
  modelUsed?: string;
  macroUsed?: string;
  customerName: string;
  cached?: boolean;
  notice?: string;
  error?: string;
}
```

### 2. Domain Synthesizer Contract (`packages/web/src/app/api/drafts/generate/route.ts`)
```typescript
export function synthesizeSmartSupportDraft(
  promptOrThread: string,
  customerName = 'there',
  kbSnippets: string[] = [],
  macroHint = ''
): string;
```

### 3. Output Sanitizer Contract (`cleanAiDraft`)
```typescript
export function cleanAiDraft(rawText: string, customerName = 'there'): string;
// Must strip:
// - /<think>[\s\S]*?(?:<\/think>|$)/gi
// - /^(?:\*\*|\*|#{1,4}\s*)?(?:Thinking Process|Thought Process|Reasoning):?[\s\S]*?\n\n/i
// - Leading markdown code fences (```markdown, ```text, ```) and trailing ```
// - Normalizes greeting "Hi {customerName}," and closing sign-off
```

### 4. Extension Sidepanel Badge Contract (`packages/extension/src/sidepanel/sidepanel.ts`)
```typescript
// Authentic badges:
// 'openrouter' | 'ai' -> '✨ AI Generated'
// 'macro'             -> '📐 Macro' (or `📐 Macro: ${name}`)
// 'template'          -> '📄 Template Reply'
```

## Code Layout
- `packages/web/src/`:
  - `app/api/drafts/generate/route.ts`: Core AI draft generation pipeline, OpenRouter candidate cascade, domain synthesizer, output sanitizer.
  - `lib/pii-scrubber.ts`: PII detection & redaction engine, whitelisting support.
  - `components/admin/AdminAIConfig.tsx`: Super Admin AI Configuration, key telemetry, interactive playground.
  - `app/api/admin/ai-config/route.ts`: Admin settings persistence to `platform_settings`.
- `packages/extension/src/`:
  - `utils/api-client.ts`: Chrome Extension AI draft client, fetch timeout signal, client-side fallback synthesizer.
  - `sidepanel/sidepanel.ts`: Sidepanel UI, draft display, authentic badge rendering.
  - `utils/pii-scrubber.ts`: Shared PII scrubbing.
- `packages/api/src/`:
  - `drafts/ai-provider.service.ts`: Backend service model cascade and domain intent synchronization.

## Verification Commands
- `export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"`
- `pnpm test`
- `pnpm build:web`
- `pnpm build:ext`
- `pnpm build:api`
