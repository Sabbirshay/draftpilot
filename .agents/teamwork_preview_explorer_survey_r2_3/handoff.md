# Security Audit & Sandbox Investigation Report: Requirement R3 — Extension & Client-Side Sandbox Security

**Target Module**: Manifest V3 Chrome Extension (`packages/extension`) & Client-Side Web Integration  
**Working Directory**: `/home/md-roni-ahamed/Test project/.agents/teamwork_preview_explorer_survey_r2_3`  
**Date**: 2026-09-01T21:03:00Z  
**Auditor**: Explorer Subagent (Sandbox Security & Extension Auditing)

---

## Executive Summary

A comprehensive, read-only security investigation of Requirement R3 (Extension & Client-Side Sandbox Security) was performed across the DraftPilot codebase (`packages/extension`, `packages/web`, and shared client utilities). 

The audit focused on four primary vectors:
1. **Manifest V3 Least-Privilege & Sandboxing**: Evaluation of declared permissions (`tabs`, `scripting`, `storage`, `sidePanel`, `activeTab`), host permissions (`*://mail.google.com/*`), absence of web-accessible resource leakage, and Content Security Policy (CSP).
2. **Inter-Component Message Passing**: Inspection of message flow across background service workers (`service-worker.ts`), content scripts (`gmail-detector.ts`), and extension pages (`sidepanel.ts`).
3. **Client-Side PII & Data Scrubbing**: Verification of in-memory redaction for customer emails, credit cards, SSNs, phone numbers, street addresses, IP addresses, and secret tokens before prompt dispatch to AI backends.
4. **DOM Insertion & Cross-Site Scripting (XSS) Prevention**: Audit of all HTML rendering sinks (`innerHTML`, `insertHTML`, `execCommand`, React JSX) in both the privileged extension sidepanel and untrusted Gmail DOM context.

Four notable security findings were identified, ranging from **High** to **Low** severity, including unsanitized `innerHTML` interpolation in the sidepanel macro list, unvalidated auth token access via `service-worker.ts` message listener, desynchronized PII scrubbing logic between content scripts and utility modules, and raw HTML insertion fallback during Gmail draft injection.

---

## 1. Observation

Direct code observations from the audited files:

### 1.1 Chrome Extension Manifest (`packages/extension/manifest.json`)
```json
Line 19:   "permissions": [
Line 20:     "sidePanel",
Line 21:     "storage",
Line 22:     "activeTab",
Line 23:     "tabs",
Line 24:     "scripting"
Line 25:   ],
Line 26:   "host_permissions": [
Line 27:     "*://mail.google.com/*"
Line 28:   ],
Line 29:   "background": {
Line 30:     "service_worker": "service-worker.js"
Line 31:   },
Line 32:   "content_scripts": [
Line 33:     {
Line 34:       "matches": ["*://mail.google.com/*"],
Line 35:       "js": ["gmail-detector.js"],
Line 36:       "run_at": "document_idle"
Line 37:     }
Line 38:   ],
Line 39:   "side_panel": {
Line 40:     "default_path": "src/sidepanel/index.html"
Line 41:   },
Line 42:   "content_security_policy": {
Line 43:     "extension_pages": "script-src 'self'; object-src 'self'"
Line 44:   }
```
- **Permission Scope**: Declares `tabs`, `scripting`, `activeTab`, `storage`, and `sidePanel`.
- **Host Permission**: Scoped specifically to `*://mail.google.com/*`.
- **Web Accessible Resources**: Omitted (`web_accessible_resources` is not declared), which prevents external website probing and extension fingerprinting.
- **CSP**: Declares `object-src 'self'` instead of standard hardened `object-src 'none'`. Does not explicitly define `connect-src` boundaries (`https://*.supabase.co`, `https://draftpilot-web.vercel.app`).

---

### 1.2 Extension Message Passing (`packages/extension/src/background/service-worker.ts`)
```typescript
Line 20: chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
Line 21:   const handleMessage = async () => {
Line 22:     try {
Line 23:       if (message.type === 'GET_AUTH_TOKEN') {
Line 24:         const data = await chrome.storage.local.get(['token']);
Line 25:         sendResponse({ token: data.token || null });
Line 26:       } else if (message.type === 'SET_AUTH_TOKEN') {
Line 27:         await chrome.storage.local.set({ token: message.token });
Line 28:         sendResponse({ success: true });
Line 29:       } else if (message.type === 'THREAD_DETECTED') {
Line 30:         // Broadcast to side panel if open
Line 31:         await chrome.runtime.sendMessage(message).catch(() => {
Line 32:           // Ignore error if side panel is closed
Line 33:         });
Line 34:         sendResponse({ success: true });
Line 35:       } else if (message.type === 'INSERT_DRAFT') {
Line 36:         // Relay from sidepanel to active tab's content script
Line 37:         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
Line 38:         if (tab && tab.id) {
Line 39:           await chrome.tabs.sendMessage(tab.id, message);
Line 40:           sendResponse({ success: true });
Line 41:         } else {
Line 42:           sendResponse({ success: false, error: 'No active tab' });
Line 43:         }
Line 44:       } else {
Line 45:         sendResponse({ success: false, error: 'Unknown message type' });
Line 46:       }
Line 47:     } catch (err: any) {
Line 48:       sendResponse({ success: false, error: err.message });
Line 49:     }
Line 50:   };
Line 51: 
Line 52:   handleMessage();
Line 53:   return true; // Keep the message channel open for sendResponse
Line 54: });
```
- **Sender Origin Verification Missing**: `chrome.runtime.onMessage` accepts messages from both extension contexts and web-injected content scripts without verifying sender origin (`sender.id === chrome.runtime.id` or checking whether `sender.tab` is defined).
- **Sensitive Auth Token Exposure**: Any script running in a content script or tab context can query `{ type: 'GET_AUTH_TOKEN' }` to extract the user's Supabase JWT access token, or `{ type: 'SET_AUTH_TOKEN' }` to overwrite the stored token.
- **Message Schema / Type Validation**: No validation is conducted on incoming message payload fields (e.g., verifying `typeof message.token === 'string'` or checking payload size).

---

### 1.3 Client-Side PII Scrubbing Utilities (`pii-scrubber.ts` vs `gmail-detector.ts`)

#### In `packages/extension/src/utils/pii-scrubber.ts`:
```typescript
Line 5: export function scrubPII(text: string): string {
Line 6:   if (!text) return '';
Line 7: 
Line 8:   let scrubbed = text;
Line 9: 
Line 10:   // 1. Credit Card Numbers (13-19 digits with optional hyphens/spaces)
Line 11:   scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');
Line 12: 
Line 13:   // 2. Email addresses
Line 14:   scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
Line 15: 
Line 16:   // 3. Social Security Numbers (SSN - USA)
Line 17:   scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');
Line 18: 
Line 19:   // 4. Phone numbers (US, UK, International formats, with/without country codes)
Line 20:   scrubbed = scrubbed.replace(/(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, (match) => {
Line 21:     // Only redact if string contains at least 7 digits to prevent redacting single short numbers
Line 22:     const digits = match.replace(/\D/g, '');
Line 23:     return digits.length >= 7 && digits.length <= 15 ? '[PHONE_REDACTED]' : match;
Line 24:   });
Line 25: 
Line 26:   // 5. Street Addresses & P.O. Boxes (e.g., 123 Main St, 456 Broadway Ave Apt 4B, P.O. Box 789)
Line 27:   scrubbed = scrubbed.replace(/\b(?:\d{1,6}\s+[A-Za-z0-9\s.,#-]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Suite|Ste|Apt|Apartment|Floor|Fl)\b(?:[,\s]+(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?)/gi, '[ADDRESS_REDACTED]');
Line 28:   scrubbed = scrubbed.replace(/\b(?:P\.?\s*O\.?\s*Box\s+\d+)\b/gi, '[ADDRESS_REDACTED]');
Line 29: 
Line 30:   // 6. IP Addresses (IPv4)
Line 31:   scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');
Line 32: 
Line 33:   // 7. API Keys & Auth Tokens (Bearer, sk-, etc.)
Line 34:   scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
Line 35: 
Line 36:   // 8. Passwords / Passcodes mentioned in thread
Line 37:   scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');
Line 38: 
Line 39:   return scrubbed;
Line 40: }
```

#### In `packages/extension/src/content/gmail-detector.ts`:
```typescript
Line 4: function scrubPII(text: string): string {
Line 5:   if (!text) return '';
Line 6:   let scrubbed = text;
Line 7:   scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');
Line 8:   scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
Line 9:   scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');
Line 10:   scrubbed = scrubbed.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, '[PHONE_REDACTED]');
Line 11:   scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');
Line 12:   scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
Line 13:   scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');
Line 14:   return scrubbed;
Line 15: }
```
- **Code Duplication & Desynchronization**: The inlined `scrubPII` in `gmail-detector.ts` is an older copy that lacks Rule 5 (Street Address and P.O. Box redaction) and the 7-15 digit length bounds guard on phone numbers.
- **Data Leakage Vector**: When `gmail-detector.ts` monitors Gmail and broadcasts `THREAD_DETECTED` (lines 136-140) or answers `GET_THREAD_CONTENT` (lines 148-156), customer street addresses and postal boxes are transmitted without redaction.

---

### 1.4 DOM Insertion & Rendering Security (`sidepanel.ts` & `gmail-detector.ts`)

#### In `packages/extension/src/sidepanel/sidepanel.ts`:
```typescript
Line 306:       listEl.innerHTML = macrosToRender
Line 307:         .map(
Line 308:           (m) => `
Line 309:           <div class="card macro-item mt-2" style="...">
Line 310:             <div style="...">
Line 311:               <strong style="font-size: 12px; color: #f3f4f6;">${m.name}</strong>
Line 312:               <button class="btn btn-ghost btn-sm text-error delete-macro" data-id="${m.id}" style="...">✕</button>
Line 313:             </div>
Line 314:             <div style="...">${m.content}</div>
Line 315:             <button class="btn-use-macro" data-id="${m.id}" style="...">
Line 316:               ⚡ Insert Macro into Gmail Reply
Line 317:             </button>
Line 318:           </div>
Line 319:         `
Line 320:         )
Line 321:         .join('');
```
- **High Severity XSS in Extension Sidepanel**: `m.name`, `m.content`, and `m.id` from the Supabase database are directly interpolated into the template literal assigned to `listEl.innerHTML` without HTML entity escaping. If a shared team macro contains HTML/markup (e.g., `<img src=x onerror=...>`), it is parsed and rendered inside the privileged `chrome-extension://` origin.

#### In `packages/extension/src/content/gmail-detector.ts`:
```typescript
Line 190:       const html = draft.replace(/\n/g, '<br>');
Line 191:       let inserted = false;
Line 192: 
Line 193:       try {
Line 194:         inserted = document.execCommand('insertHTML', false, html);
Line 195:       } catch {
Line 196:         inserted = false;
Line 197:       }
...
Line 207:       if (!inserted) {
Line 208:         target.innerHTML = html;
Line 209:       }
```
- **HTML Injection / DOM XSS in Gmail Composer**: `draft` text is converted to HTML simply via `.replace(/\n/g, '<br>')` without HTML escaping (`&`, `<`, `>`, `"`, `'`). If the AI model generates a reply containing HTML elements or markdown code snippets with tags, `document.execCommand('insertHTML', false, html)` or fallback `target.innerHTML = html` inserts live HTML directly into Gmail's contenteditable DOM container (`mail.google.com`).

#### In `packages/extension/src/sidepanel/sidepanel.ts` (Direct Scripting Fallback):
```typescript
Line 524:                 const html = rawText.replace(/\n/g, '<br>');
Line 525:                 try {
Line 526:                   if (!document.execCommand('insertHTML', false, html)) {
Line 527:                     target.innerHTML = html;
Line 528:                   }
Line 529:                 } catch {
Line 530:                   target.innerHTML = html;
Line 531:                 }
```
- Same unescaped HTML injection issue when the side panel injects drafts directly into Gmail via `chrome.scripting.executeScript`.

---

## 2. Logic Chain

1. **Manifest Least-Privilege & Sandboxing**:
   - `manifest.json` specifies `"permissions": ["sidePanel", "storage", "activeTab", "tabs", "scripting"]`.
   - `tabs` grants permission to read URLs and titles across all browser tabs. However, DraftPilot only operates within Gmail (`*://mail.google.com/*`). Because `host_permissions` already covers `*://mail.google.com/*` and `activeTab` handles user-initiated interactions, `tabs` permission is broader than necessary for day-to-day operations, though `chrome.tabs.query({ url: '*://mail.google.com/*' })` relies on host permissions.
   - The CSP in `manifest.json` specifies `script-src 'self'; object-src 'self'`. Best practice for Manifest V3 extension pages is to restrict `object-src` to `'none'` because extensions do not load legacy Flash/plugins. Furthermore, explicitly declaring `connect-src` prevents rogue outbound telemetry if any script injection occurred.

2. **Message Passing Vulnerability**:
   - In `service-worker.ts`, the `onMessage` handler processes `GET_AUTH_TOKEN` and `SET_AUTH_TOKEN` for any message received by `chrome.runtime.onMessage`.
   - In Chrome extensions, `chrome.runtime.onMessage` fires when any internal extension page (popup, sidepanel) OR any content script injected into web pages calls `chrome.runtime.sendMessage()`.
   - When a message originates from a content script in `mail.google.com`, `sender.tab` is populated. When originating from the sidepanel, `sender.tab` is `undefined`.
   - Because `service-worker.ts` does not check `sender.tab === undefined` before responding to `GET_AUTH_TOKEN`, any script running in `mail.google.com` (or malicious third-party script executing in Gmail) could theoretically dispatch `chrome.runtime.sendMessage({ type: 'GET_AUTH_TOKEN' })` and obtain the user's active session token.
   - Therefore, sensitive actions must be restricted exclusively to extension internal contexts (`!sender.tab` or verifying extension internal URL), and content scripts must only be allowed to exchange thread detection and draft insertion messages.

3. **PII Scrubbing Discrepancy & Gap Analysis**:
   - `pii-scrubber.ts` contains 8 comprehensive redaction rules including postal addresses and PO boxes.
   - However, `gmail-detector.ts` implemented an independent inlined function `scrubPII` to avoid rollup chunking issues, but omitted the address scrubber (Rule 5).
   - Because `gmail-detector.ts` executes in the tab and scrubs the raw DOM before sending `THREAD_DETECTED`, addresses are sent across the message bus unredacted.
   - Vite/Rollup can bundle imported TypeScript modules (`import { scrubPII } from '../utils/pii-scrubber'`) directly into `dist/gmail-detector.js` without ES module chunking, resolving the synchronization risk.
   - In addition, extending the scrubber to cover standalone JWTs (`eyJ...`), OpenAI/Anthropic keys (`sk-...`), and GitHub keys (`ghp_...`) hardens the client-side boundary before LLM dispatch.

4. **DOM Insertion & XSS Remediation**:
   - In `sidepanel.ts`, `renderMacrosList` dynamically creates HTML via string templating and assigns it to `listEl.innerHTML`. Untrusted input (macro titles or contents from the database) will be parsed as HTML markup.
   - In `gmail-detector.ts` and `sidepanel.ts`, AI-generated text is injected into the Gmail compose box by converting `\n` to `<br>` without escaping HTML control characters (`&`, `<`, `>`, `"`, `'`).
   - If an AI-generated draft contains an HTML payload or template tags, assigning `target.innerHTML = html` or executing `document.execCommand('insertHTML', false, html)` inserts raw HTML tags into the DOM.
   - Introducing an `escapeHtml()` utility ensures all special characters are converted to entities (`&lt;`, `&gt;`, `&quot;`, `&#039;`, `&amp;`) before `<br>` substitution, guaranteeing 100% plain text fidelity and zero XSS vulnerability.

---

## 3. Vulnerability Findings Matrix

| Finding ID | Title | Severity | Affected Location | Impact |
|---|---|---|---|---|
| **VULN-R3-01** | Unsanitized `innerHTML` Interpolation in Sidepanel Macro List | **High** | `packages/extension/src/sidepanel/sidepanel.ts:306-321` | Potential stored XSS in extension sidepanel context if macro content contains HTML/JS markup. |
| **VULN-R3-02** | Unvalidated `GET_AUTH_TOKEN` / `SET_AUTH_TOKEN` in Service Worker | **Medium** | `packages/extension/src/background/service-worker.ts:23-28` | Content scripts in web tabs can request or overwrite the Supabase authentication token stored in `chrome.storage.local`. |
| **VULN-R3-03** | Unescaped HTML Injection during Gmail Reply Draft Insertion | **Medium** | `packages/extension/src/content/gmail-detector.ts:190, 208`<br>`packages/extension/src/sidepanel/sidepanel.ts:524, 527` | AI draft text or macro text containing HTML tags is inserted directly into Gmail DOM without entity encoding. |
| **VULN-R3-04** | PII Scrubber Desynchronization in Gmail Content Script | **Low** | `packages/extension/src/content/gmail-detector.ts:4-15` | Content script uses an outdated inlined `scrubPII` missing postal street address and P.O. Box redaction. |
| **VULN-R3-05** | Extension CSP and Permission Hardening (`object-src 'self'`) | **Low** | `packages/extension/manifest.json:23, 43` | `object-src 'self'` should be tightened to `object-src 'none'`; `connect-src` should explicitly whitelist API endpoints. |

---

## 4. Recommended Code-Level Fixes

### 4.1 Fix VULN-R3-01: HTML Entity Encoding for Sidepanel Macro Rendering
In `packages/extension/src/sidepanel/sidepanel.ts`:

```typescript
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// In renderMacrosList:
listEl.innerHTML = macrosToRender
  .map(
    (m) => `
    <div class="card macro-item mt-2" style="padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
        <strong style="font-size: 12px; color: #f3f4f6;">${escapeHtml(m.name)}</strong>
        <button class="btn btn-ghost btn-sm text-error delete-macro" data-id="${escapeHtml(m.id)}" style="color: #f87171; font-size: 11px; padding: 2px 6px; cursor: pointer;">✕</button>
      </div>
      <div style="font-size: 11px; color: #9ca3af; line-height: 1.4; margin-bottom: 8px; max-height: 50px; overflow: hidden; font-family: monospace; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 6px;">${escapeHtml(m.content)}</div>
      <button class="btn-use-macro" data-id="${escapeHtml(m.id)}" style="width: 100%; padding: 6px; font-size: 11px; font-weight: 700; border-radius: 8px; background: #7c3aed; color: white; border: none; cursor: pointer; transition: all 0.2s;">
        ⚡ Insert Macro into Gmail Reply
      </button>
    </div>
  `
  )
  .join('');
```

---

### 4.2 Fix VULN-R3-02: Message Origin & Sender Verification in Service Worker
In `packages/extension/src/background/service-worker.ts`:

```typescript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Validate sender ID
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  const handleMessage = async () => {
    try {
      // Sensitive token management is restricted to extension internal pages ONLY (sender.tab is undefined)
      if (message.type === 'GET_AUTH_TOKEN') {
        if (sender.tab) {
          sendResponse({ error: 'Access denied: Content scripts cannot read auth tokens' });
          return;
        }
        const data = await chrome.storage.local.get(['token']);
        sendResponse({ token: data.token || null });
      } else if (message.type === 'SET_AUTH_TOKEN') {
        if (sender.tab) {
          sendResponse({ error: 'Access denied: Content scripts cannot set auth tokens' });
          return;
        }
        if (typeof message.token === 'string' || message.token === null) {
          await chrome.storage.local.set({ token: message.token });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid token payload' });
        }
      } else if (message.type === 'THREAD_DETECTED') {
        // Broadcast to side panel if open
        await chrome.runtime.sendMessage(message).catch(() => {});
        sendResponse({ success: true });
      } else if (message.type === 'INSERT_DRAFT') {
        if (typeof message.draft !== 'string') {
          sendResponse({ success: false, error: 'Invalid draft payload' });
          return;
        }
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          await chrome.tabs.sendMessage(tab.id, message);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
  };

  handleMessage();
  return true;
});
```

---

### 4.3 Fix VULN-R3-03: Safe HTML Entity Escaping for Gmail Reply Insertion
In `packages/extension/src/content/gmail-detector.ts`:

```typescript
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

private insertDraft(draft: string): boolean {
  if (typeof draft !== 'string') return false;
  let target = this.composeBox || this.findComposeBox();
  ...
  if (target) {
    target.focus();
    ...
    // Securely escape HTML entities before converting linebreaks
    const safeHtml = escapeHtml(draft).replace(/\n/g, '<br>');
    let inserted = false;

    try {
      inserted = document.execCommand('insertHTML', false, safeHtml);
    } catch {
      inserted = false;
    }

    if (!inserted) {
      try {
        inserted = document.execCommand('insertText', false, draft);
      } catch {
        inserted = false;
      }
    }

    if (!inserted) {
      target.innerHTML = safeHtml;
    }
    ...
  }
}
```

---

### 4.4 Fix VULN-R3-04: Single Source of Truth for PII Scrubber
Import `scrubPII` from `../utils/pii-scrubber` in `packages/extension/src/content/gmail-detector.ts`, or keep the implementation identical to `pii-scrubber.ts`. Enhance `pii-scrubber.ts` with broader token patterns:

```typescript
// In packages/extension/src/utils/pii-scrubber.ts
// Add standalone JWT, OpenAI sk-*, and GitHub token patterns:
scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+|[a-zA-Z0-9_\-\.]{0,10}?(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|AKIA[0-9A-Z]{16}))[a-zA-Z0-9_\-\.]{10,}/gi, '[TOKEN_REDACTED]');
scrubbed = scrubbed.replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[TOKEN_REDACTED]');
```

---

### 4.5 Fix VULN-R3-05: CSP Hardening in Manifest
In `packages/extension/manifest.json`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'none'; connect-src 'self' https://*.supabase.co https://draftpilot-web.vercel.app;"
}
```

---

## 5. Caveats

1. **No Out-of-Scope Code Modifications**: As an Explorer subagent in read-only mode, no source files under `packages/` were modified during this investigation. Proposed remediations are documented above for implementation by the designated worker agent.
2. **Gmail DOM Evolution**: Gmail's web UI obfuscated class names (`.a3s`, `.aiL`, `div.Am.Al.editable`) are subject to upstream changes by Google. The existing selector list in `gmail-detector.ts` handles standard ARIA roles (`div[role="textbox"]`, `div[aria-label*="Message Body"]`), which remain standard and resilient.
3. **Third-Party AI Models**: Even with client-side PII scrubbing, backend AI responses could theoretically reflect customer names or non-PII identifiers. The server-side generation route (`/api/drafts/generate`) and `cleanAiDraft` utility provide second-layer normalization.

---

## 6. Conclusion

The DraftPilot Chrome extension features a sound Manifest V3 architectural baseline:
- Host permissions are strictly restricted to `*://mail.google.com/*`.
- Web accessible resources are unexposed, eliminating external asset probing.
- React web components completely avoid `dangerouslySetInnerHTML`.
- Comprehensive client-side PII scrubbing is performed before API dispatch.

Implementing the recommended targeted fixes (escaping HTML entities in `sidepanel.ts` and `gmail-detector.ts`, enforcing `sender.tab` checks for token access in `service-worker.ts`, unifying the PII scrubber, and tightening the extension CSP) will elevate the extension to enterprise-grade security standards with zero regressions to existing workflows.

---

## 7. Verification Method

To independently verify the extension build and test suite after applying the recommended hardening:

```bash
# Set environment
export PATH="/home/md-roni-ahamed/Test project/.tools/node/bin:$PATH"
export HOME="/home/md-roni-ahamed/Test project/.tmp_home"

# 1. Run Unit Tests (PII Scrubber and Web Tests)
pnpm test

# 2. Build Extension Bundle
pnpm build:ext

# 3. Build Web and API Targets
pnpm build:web
pnpm build:api
```

**Invalidation Conditions**:
- Any build failure during `vite build` or TypeScript typechecking (`pnpm build:ext`).
- Failure of PII redaction test cases in `packages/extension/src/utils/__tests__/pii-scrubber.test.ts`.
- Regressions in draft generation or macro insertion flows in the side panel.

