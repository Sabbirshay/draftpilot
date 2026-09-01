# Comprehensive Survey & Diagnosis Report: Requirements R1 & R3

**Date:** 2026-08-31  
**Subagent:** `explorer_survey_prompt`  
**Targets:** Next.js API (`/api/drafts/generate`), NestJS Backend (`AiProviderService` / `DraftsService`), Super Admin AI (`AdminAIConfig`), Chrome Extension Client (`api-client.ts` / `sidepanel.ts`).

---

## Executive Summary

This investigation surveyed the end-to-end prompt compilation (Requirement **R1**) and output sanitization / format enforcement (Requirement **R3**) across all three packages in the DraftPilot monorepo (`packages/web`, `packages/api`, and `packages/extension`).

### Key Survey Findings
1. **Requirement R1 (Prompt Compilation & Custom Guidance) — Critical Defects Identified**:
   - **Next.js API Route (`/api/drafts/generate`)**: Accepts `macroHint` in the JSON request body (line 96), but **completely drops and ignores `macroHint`** during final LLM prompt construction (lines 131–140). Custom user instructions typed in the extension (e.g. *"Apologize and offer discount"*, *"State we are closed on weekends"*) never reach the AI model.
   - **Next.js Admin Directives Ignored**: The system prompt is hardcoded to a static string in `route.ts` (lines 118–124) and ignores the admin-configured `system_prompt` persisted in `platform_settings`.
   - **NestJS Backend (`DraftsService`)**: Uses `dto.macroHint` solely as a substring database search against `macros.name` (lines 28–41). If the hint is a custom instruction rather than an exact macro name match, it is **completely dropped** from the prompt (lines 87–95). Furthermore, the system prompt is duplicated in both the user prompt string and the OpenAI/OpenRouter system message.

2. **Requirement R3 (Output Sanitization & Format Enforcement) — Critical Defects Identified**:
   - **Next.js Multi-Paragraph Reasoning Leakage**: Next.js `cleanAiDraft` uses a non-greedy regex ending at `\n\n` for thinking process removal (lines 11–12). When reasoning models (DeepSeek R1, Gemma 4, Qwen 2.5) produce multi-paragraph reasoning chains, only the first paragraph is stripped; all subsequent reasoning steps leak directly into the user draft.
   - **NestJS OpenAI Bypass & Zero Normalization**: In `AiProviderService.generateText` (line 147), OpenAI completions **bypass `this.cleanDraft()` entirely**. Furthermore, NestJS `cleanDraft` lacks customer greeting normalization (`Hi [Name],`), template variable substitution (`{{name}}`, `[Customer]`), and sender extraction.
   - **Sign-Off Placeholder Gaps**: None of the sanitization pipelines scrub hallucinated sign-off tokens such as `[Your Name]`, `[Agent Name]`, `[Company Name]`, or `{agent_name}`.
   - **Code Fence Preamble/Trailing Text Failures**: The code fence regexes (`^```...` and `...```$`) fail when models prepend introductory remarks or append trailing meta-commentary around the code block.

---

## Detailed Investigation: Requirement R1 (Prompt Compilation & Custom Guidance)

### 1. Data Flow Trace: Client to Server Prompt Construction

```
+-----------------------------------------------------------------------------------+
| 1. Chrome Extension (sidepanel.ts / api-client.ts)                                 |
| - Captures user input: document.getElementById('macro-hint').value                |
| - Searches local macros with lowerHint                                            |
| - If match found: matchedMacro = macro                                            |
| - If NO match (e.g. custom instruction): matchedMacro = null                      |
| - POST payload: { threadContent, macroHint, matchedMacro, kbSnippets }            |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 2. Next.js API Route (packages/web/src/app/api/drafts/generate/route.ts)          |
| - Line 96: const { threadContent, macroHint, matchedMacro, kbSnippets } = body;   |
| - Lines 118-124: Hardcoded strictSystemPrompt (ignores settings.system_prompt!)   |
| - Lines 131-137: Appends matchedMacro.content and kbSnippets                      |
| - Line 139: userPrompt = `Customer Message:\n${threadContent}\n\n...`             |
|                                                                                   |
| [BUG]: macroHint is NEVER added to userPrompt or strictSystemPrompt!              |
| Result: Custom user guidance is 100% discarded.                                   |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
| 3. NestJS Alternative Backend (packages/api/src/drafts/drafts.service.ts)         |
| - DTO GenerateDraftDto: { threadContent, macroHint }                              |
| - Lines 28-35: supabase.from('macros').ilike('name', `%${dto.macroHint}%`)       |
| - If macro found -> macroContent = data.content                                   |
| - If macro NOT found -> macroContent = ''                                         |
| - Lines 87-94: prompt = `${systemPrompt}\n\n### Relevant Support Macro:...`       |
|                                                                                   |
| [BUG]: dto.macroHint is NEVER inserted into prompt if no DB macro name matches.   |
| [BUG]: systemPrompt is prepended to user prompt AND sent in system message.       |
| [BUG]: GenerateDraftDto does not accept matchedMacro or kbSnippets from client.   |
+-----------------------------------------------------------------------------------+
```

### 2. Code-Level Evidence: Next.js API Route (`packages/web/src/app/api/drafts/generate/route.ts`)

**Observed Code (Lines 96, 118–140):**
```typescript
96:  const { threadContent, macroHint, matchedMacro, kbSnippets } = body;
...
118: const strictSystemPrompt = `You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.
119: 
120: CRITICAL INSTRUCTIONS:
121: 1. Output ONLY the raw final email reply text.
122: 2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.
123: 3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nSupport Team".
124: 4. Do NOT wrap in markdown code blocks.`;
...
131: let knowledgeContext = '';
132: if (matchedMacro?.content) {
133:   knowledgeContext += `### Recommended Support Macro & Policy:\n${matchedMacro.content}\n\n`;
134: }
135: if (kbSnippets && kbSnippets.length > 0) {
136:   knowledgeContext += `### Knowledge Base & Documentation Context:\n${kbSnippets.join('\n---\n')}\n\n`;
137: }
138: 
139: const userPrompt = `Customer Message:\n${threadContent}\n\n${knowledgeContext}Write the clean, direct customer email reply now:`;
```

**Diagnostic Analysis:**
1. `macroHint` is destructured at line 96, but is not referenced in lines 97–251.
2. Even if a user enters specific instructions (e.g. *"Customer is very upset, offer full refund and 25% coupon code SORRY25"*), this guidance is discarded.
3. `settings.system_prompt` fetched from `platform_settings` (line 108) is ignored. The prompt assembly always uses the hardcoded `strictSystemPrompt`.

### 3. Code-Level Evidence: NestJS API (`packages/api/src/drafts/drafts.service.ts` & `ai-provider.service.ts`)

**Observed Code (`drafts.service.ts` Lines 28–41, 85–95):**
```typescript
28:  if (dto.macroHint) {
29:    const { data } = await this.supabase.getClient()
30:      .from('macros')
31:      .select('*')
32:      .eq('team_id', teamId)
33:      .ilike('name', `%${dto.macroHint}%`)
34:      .limit(1)
35:      .single();
36:
37:    if (data) {
38:      macroContent = data.content;
39:      macroId = data.id;
40:    }
41:  }
...
85:  const systemPrompt = settings?.system_prompt || 'You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.';
86:
87:  const prompt = `${systemPrompt}
88:
89:  ${macroContent ? `### Relevant Support Macro:\n${macroContent}\n\n` : ''}
90:  ${kbSnippets.length > 0 ? `### Knowledge Base Documentation:\n${kbSnippets.join('\n---\n')}\n\n` : ''}
91:  Customer message:
92:  ${dto.threadContent}
93:
94:  Draft a clean, friendly reply:`;
```

**Observed Code (`ai-provider.service.ts` Lines 63, 83–86):**
```typescript
63:  const systemPrompt = settings?.system_prompt || 'You are a helpful customer support assistant. Draft a professional, friendly reply. Be concise.';
...
83:  messages: [
84:    { role: 'system', content: systemPrompt },
85:    { role: 'user', content: prompt }
86:  ],
```

**Diagnostic Analysis:**
1. `dto.macroHint` is only used for `ilike` lookup on `macros.name`. If a user passes an imperative prompt instruction (e.g. *"Keep reply under 50 words"*), no macro is found, and `dto.macroHint` is not appended to the prompt.
2. `systemPrompt` is concatenated to the user `prompt` string (line 87) and then also supplied as `{ role: 'system', content: systemPrompt }` in `ai-provider.service.ts` (line 84), causing token redundancy and messy message roles.

### 4. Compilation Matrix: Parameter Tracking Across Layers

| Parameter | Origin | Next.js API (`/api/drafts/generate`) | NestJS Backend (`DraftsService`) | Status | Impact / Failure Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `threadContent` | Extension / Web | Injected into `userPrompt` | Injected into `prompt` | **Passed** | Thread text is present in user message. |
| `macroHint` / Custom Guidance | Extension / Web UI | Extracted on line 96, **NOT compiled** | Used only as SQL ilike on macro name; **dropped if custom** | **FAILED** | Custom user instructions do not shape the output in either backend. |
| `matchedMacro` | Extension / Pre-match | Injected if `content` exists | Ignored (re-queries DB via `macroHint` only) | **PARTIAL** | Next.js uses client-matched macro; NestJS ignores client object. |
| `kbSnippets` | Extension / Embeddings | Injected via `join('\n---\n')` | Scored locally via keyword search from `document_chunks` | **Passed** | Documentation chunks are included when present. |
| `system_prompt` | `platform_settings` | Fetched on line 108, but **ignored in favor of hardcoded string** | Fetched on line 79, but **duplicated in user & system roles** | **FAILED** | Admin AI Config system prompt changes have no effect on Next.js. |
| `customerName` | Sender Extraction | Injected into `strictSystemPrompt` | Not extracted; omitted | **PARTIAL** | Next.js guides model with name; NestJS leaves it unguided. |

---

## Detailed Investigation: Requirement R3 (Output Sanitization & Format Enforcement)

### 1. Comparison of Sanitization Logic Across 4 System Surfaces

```
+----------------------------------------------------------------------------------------------------------+
| Pipeline Location                                  | Think Tag | Multi-Para Reasoning | Fences | Name Sub | Sign-Off Scrub |
+----------------------------------------------------+-----------+----------------------+--------+----------+----------------+
| 1. Next.js API (/api/drafts/generate)              | YES       | BROKEN (\n\n bug)    | PARTIAL| YES      | NO             |
| 2. NestJS Backend (AiProviderService.cleanDraft)   | YES       | GREEDY REGEX         | PARTIAL| NO       | NO             |
| 3. Chrome Extension (api-client.ts cleanAiDraft)   | YES       | ANCHOR MATCH         | PARTIAL| YES      | NO             |
| 4. Admin AI Config (AdminAIConfig.tsx)             | YES       | ANCHOR MATCH         | PARTIAL| NO       | NO             |
+----------------------------------------------------------------------------------------------------------+
```

### 2. Deep Dive: Sanitization Vulnerabilities & Edge Cases

#### Defect R3.1: Multi-Paragraph Reasoning Chain Leakage in Next.js
- **File:** `packages/web/src/app/api/drafts/generate/route.ts` (Lines 11–12)
```typescript
11: text = text.replace(/^(?:Here's a thinking process:?|Thinking:?|Here is the thinking process:?)[\s\S]*?\n\n/i, '').trim();
12: text = text.replace(/^\d+\.\s+\*\*Analyze User Input:\*\*[\s\S]*?\n\n/i, '').trim();
```
- **Vulnerability:** The pattern `[\s\S]*?\n\n` is non-greedy and terminates at the **first** double newline.
- **Trigger Scenario:**
  ```
  Here's a thinking process:
  1. Analyze user request: The user wants an invoice copy.

  2. Determine appropriate macro: Check billing history.

  3. Formulate response: Greet customer and provide billing link.

  Hi Sarah,
  Here is your invoice link...
  ```
- **Observed Result:** Only *"Here's a thinking process:\n1. Analyze user request: The user wants an invoice copy."* is removed. Paragraphs 2 and 3 remain in the user-visible output.
- **Contrast with Extension:** `packages/extension/src/utils/api-client.ts` uses an anchor regex to find the start of the greeting:
  `/(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b...)([\s\S]+)$/i` or splits on `\*\*(?:Final Response|Reply|Draft|Email):\*\*`.

#### Defect R3.2: NestJS OpenAI Generation Bypasses `cleanDraft`
- **File:** `packages/api/src/drafts/ai-provider.service.ts` (Lines 146–148)
```typescript
146: const content = response.choices[0]?.message?.content?.trim();
147: if (content) return content;
```
- **Vulnerability:** When `provider === 'openai'`, `content` is returned immediately without executing `this.cleanDraft(content)`. Any markdown code fences (```markdown ... ```) or preamble emitted by OpenAI models pass uncleaned to the client.

#### Defect R3.3: NestJS Missing Customer Name & Template Variable Replacement
- **File:** `packages/api/src/drafts/ai-provider.service.ts` (Lines 157–183)
- **Vulnerability:** Unlike Next.js and the Extension, NestJS `cleanDraft` does not accept `customerName`.
- **Result:** Template placeholders like `{{name}}`, `{{customer_name}}`, `[Customer]`, and `[Name]` are left unreplaced in drafts generated through NestJS.

#### Defect R3.4: Code Fence Stripping Edge Cases
- **Current Pattern in All Files:**
  `text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();`
- **Edge Case 1 (Leading Preamble):**
  If the model outputs:
  ```
  Here is your draft reply:
  ```markdown
  Hi Alex,
  ...
  ```
  ```
  The leading `^```...` fails because the string starts with `"Here is your draft reply:"`.
- **Edge Case 2 (Trailing Commentary):**
  If the model outputs:
  ```
  ```markdown
  Hi Alex,
  ...
  ```
  Hope this helps! Let me know if you need any edits.
  ```
  The trailing `...```$` fails because the string ends with `"edits."`.

#### Defect R3.5: Sign-Off Placeholder & Hallucination Leakage
- **Issue:** Models frequently append unpopulated placeholder sign-offs when generating support replies:
  - `Best regards,\n[Your Name]`
  - `Sincerely,\n[Agent Name]\n[Company Name]`
  - `Thanks,\n[Support Representative]`
  - `Best,\n{agent_name}`
- **Current Status:** None of the sanitization pipelines detect or replace `[Your Name]`, `[Agent Name]`, `[Company Name]`, or `[Support Team Name]` with standard team signatures.

#### Defect R3.6: Degenerate Fallback Discrepancy
- In Next.js `route.ts` (lines 210–225), if OpenRouter fails and no macro was matched, it always falls back to a single generic template:
  ```typescript
  draftText = `Hi ${customerName},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
  ```
- In contrast, Extension (`api-client.ts` lines 592–600) and NestJS (`ai-provider.service.ts` lines 188–258) execute a domain-aware smart synthesizer matching refunds, tracking, account access, and billing intents.

---

## Architectural & Code Enhancement Blueprint

### 1. Proposed Prompt Compilation Architecture (Resolves R1)

#### A. Unified Next.js API Route Prompt Assembly (`packages/web/src/app/api/drafts/generate/route.ts`)
```typescript
// 1. Resolve System Directives from Admin Settings + Strict Email Rules
const baseSystemPrompt = settings?.system_prompt?.trim() || 
  'You are DraftPilot, an intelligent customer support assistant. You write concise, friendly, and professional email replies directly to customers based on company knowledge.';

const strictSystemPrompt = `${baseSystemPrompt}

CRITICAL OPERATIONAL RULES:
1. Output ONLY the raw final email reply text ready to send.
2. Absolutely DO NOT include any internal thoughts, reasoning steps, analysis headers, or markdown bullets.
3. Begin directly with "Hi ${customerName}," and conclude with a professional sign-off (e.g. "Best regards,\nSupport Team").
4. DO NOT wrap output in markdown code blocks (\`\`\`).`;

// 2. Compile Contextual Knowledge & Explicit User Guidance
let knowledgeContext = '';
if (matchedMacro?.content) {
  knowledgeContext += `### Relevant Support Policy / Macro (${matchedMacro.name || 'Standard'}):\n${matchedMacro.content}\n\n`;
}
if (kbSnippets && kbSnippets.length > 0) {
  knowledgeContext += `### Knowledge Base Context:\n${kbSnippets.join('\n---\n')}\n\n`;
}

// 3. User Guidance / Custom Instruction Injection
let customInstructionSection = '';
const trimmedHint = (macroHint || '').trim();
if (trimmedHint) {
  customInstructionSection = `### User Custom Instruction / Guidance:\nIMPORTANT: ${trimmedHint}\n\n`;
}

const userPrompt = `Customer Message:\n${threadContent}\n\n${knowledgeContext}${customInstructionSection}Draft the clean, direct customer email reply now:`;
```

#### B. Unified NestJS Backend Prompt Assembly (`packages/api/src/drafts/drafts.service.ts`)
- Update `GenerateDraftDto` to optionally accept `customInstruction?: string`, `matchedMacro?: any`, and `kbSnippets?: string[]`.
- Inject `dto.macroHint` (or `dto.customInstruction`) into the prompt under `### Agent Guidance / Instructions:` regardless of whether a matching database macro ID was found.
- Clean up role separation so `system_prompt` is only provided in the system role message in `AiProviderService`.

---

### 2. Hardened Universal Sanitization Pipeline (Resolves R3)

```typescript
export function cleanAiDraft(rawText: string, customerName = 'there', teamName = 'Support Team'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Strip Reasoning Chains & Thinking Process Headers (DeepSeek R1 / Gemma 4 / Qwen)
  if (
    /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        return ''; // Pure reasoning with no final email draft generated
      }
    }
  }

  // 3. Fallback check for residual thinking analysis fragments
  if (
    /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
  const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
    text = codeBlockMatch[1].trim();
  } else {
    text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // 5. Remove Meta Headers & Label Lines
  text = text
    .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?|Suggested Reply:?)\s*\n+/i, '')
    .trim();

  // 6. Template Variable Normalization
  text = text
    .replace(/{{name}}/gi, customerName)
    .replace(/{{customer_name}}/gi, customerName)
    .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

  // 7. Sign-off Placeholder Scrubbing
  text = text
    .replace(/\[Your Name\]/gi, teamName)
    .replace(/\[Agent Name\]/gi, teamName)
    .replace(/\[Representative Name\]/gi, teamName)
    .replace(/\[Company Name\]/gi, 'DraftPilot Support')
    .replace(/\[Support Team\]/gi, teamName)
    .replace(/{{agent_name}}/gi, teamName);

  // 8. Greeting Normalization
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
  }

  return text;
}
```

---

## Verification & Test Plan

1. **Unit Test Coverage for Prompt Compilation (`packages/web/src/lib/__tests__/`)**:
   - Assert `macroHint` appears in generated user prompt.
   - Assert custom instructions alter AI response or prompt payload.
   - Assert `settings.system_prompt` is merged with default directives.

2. **Adversarial Unit Tests for Sanitization (`packages/web/src/lib/__tests__/challenger-interactive.test.ts`)**:
   - Multi-paragraph thinking process stripping test (DeepSeek R1 format).
   - Code fence with preamble (`"Here is the reply:\n```markdown\nHi Alex...\n```"`) and trailing commentary.
   - Placeholder sign-off scrubbing (`[Your Name]`, `[Agent Name]`).
   - Case-insensitive template variables (`{{Name}}`, `[Customer name]`).

3. **Build & Type Checking**:
   - `packages/web`: `next build` -> clean compilation (verified).
   - `packages/api`: `nest build` -> clean compilation (verified).
   - `packages/extension`: `vite build` -> clean compilation (verified).

---

## Conclusion & Readiness

The diagnosis of Requirements R1 and R3 is complete. All observations are verified with exact file paths and line numbers. The concrete blueprints provided above can be directly utilized during the implementation phase.
