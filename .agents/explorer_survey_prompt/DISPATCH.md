## 2026-08-31T17:19:27Z
<USER_REQUEST>
You are an Explorer subagent (explorer_survey_prompt) for the DraftPilot AI system diagnosis and enhancement task.
Working Directory: /home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt
Project Root: /home/md-roni-ahamed/Test project
Original Request: /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md

Mission: Map and diagnose Requirements R1 & R3:
1. R1: Custom Instruction & Contextual Prompt Compilation across Next.js API (/api/drafts/generate) and NestJS backend (AiProviderService / DraftsService / PromptAssembly).
   - Trace how `macroHint`, custom prompt overrides, matched macros, and knowledge chunks are passed from the client (Extension / Web) and compiled into the final LLM prompt context in both Next.js and NestJS.
   - Check if user guidance directly and reliably shapes the output or if any parameter is ignored/dropped/malformed.
2. R3: Output Sanitization & Format Enforcement:
   - Trace draft post-processing and sanitization across all generation paths.
   - Check removal of `<think>...</think>` blocks, reasoning chains, analysis headers, and markdown code fences (e.g. ```markdown ... ```).
   - Check normalization of customer greetings (e.g. `Hi [Name],`) and professional sign-offs.
   - Identify missing regexes, edge cases, or unsanitized fallback paths.

Read /home/md-roni-ahamed/Test project/.agents/ORIGINAL_REQUEST.md first.
Investigate the actual codebase in packages/web, packages/api, and packages/extension.
Write your complete findings and verified evidence to:
`/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/report.md`
and write your handoff to:
`/home/md-roni-ahamed/Test project/.agents/explorer_survey_prompt/handoff.md`.
When finished, send a message to parent with a concise summary and pointer to your report.
</USER_REQUEST>
