/**
 * DraftPilot — Outlook Web App Content Script
 * Detects email threads, compose boxes, and inserts AI-generated drafts
 * in Outlook Web (outlook.office.com, outlook.office365.com, outlook.live.com).
 *
 * Architecture mirrors gmail-detector.ts with Outlook-specific DOM selectors.
 * PII scrubber is inlined to prevent ES module chunk splitting in content scripts.
 */

/**
 * Client-Side PII Scrubber (Inlined to prevent ES module chunk splitting in Chrome content script)
 */
function scrubPII(text: string, customRules?: any[]): string {
  if (!text) return '';
  let scrubbed = text;

  // 0. Custom Rules
  if (customRules && Array.isArray(customRules)) {
    for (const rule of customRules) {
      if (!rule || rule.enabled === false || !rule.pattern || typeof rule.pattern !== 'string') continue;
      const replacement = rule.replacement?.trim() || '[CUSTOM_REDACTED]';
      try {
        const isKeyword = rule.rule_type === 'keyword' || (!rule.rule_type && rule.isRegex === false);
        if (isKeyword) {
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const isWord = /^\w+(?:[\s-]+\w+)*$/.test(rule.pattern.trim());
          const keywordRegex = new RegExp(isWord ? `\\b${escaped}\\b` : escaped, 'gi');
          scrubbed = scrubbed.replace(keywordRegex, replacement);
        } else {
          if (rule.pattern.length <= 500 && !/(\([^\)]*[\+\*][^\)]*\))[\+\*]/.test(rule.pattern)) {
            const customRegex = new RegExp(rule.pattern, 'gi');
            scrubbed = scrubbed.replace(customRegex, replacement);
          }
        }
      } catch (err) {
        // Safe catch
      }
    }
  }

  // 1. Credit Card Numbers (13-19 digits with optional hyphens/spaces)
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');

  // 2. Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');

  // 3. Social Security Numbers (SSN - USA)
  scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');

  // 4. Phone numbers (US, UK, International formats, with/without country codes)
  scrubbed = scrubbed.replace(/(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}\b/g, (match) => {
    const digits = match.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 ? '[PHONE_REDACTED]' : match;
  });

  // 5. Street Addresses & P.O. Boxes
  scrubbed = scrubbed.replace(/\b(?:\d{1,6}\s+[A-Za-z0-9\s.,#-]+?\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Highway|Hwy|Suite|Ste|Apt|Apartment|Floor|Fl)\b(?:[,\s]+(?:Apt|Apartment|Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?)/gi, '[ADDRESS_REDACTED]');
  scrubbed = scrubbed.replace(/\b(?:P\.?\s*O\.?\s*Box\s+\d+)\b/gi, '[ADDRESS_REDACTED]');

  // 6. IP Addresses (IPv4)
  scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');

  // 7. API Keys & Auth Tokens (Bearer, sk-, ghp-, AKIA, etc.)
  scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bsk-[a-zA-Z0-9_\-\.]{20,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bgh[pousr]_[a-zA-Z0-9]{36,}\b/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/\bAKIA[0-9A-Z]{16,}\b/g, '[TOKEN_REDACTED]');

  // 8. Standalone JWTs (JSON Web Tokens)
  scrubbed = scrubbed.replace(/\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, '[TOKEN_REDACTED]');

  // 9. Passwords / Passcodes mentioned in thread
  scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');

  return scrubbed;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

class OutlookDetector {
  private composeBox: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private lastDetectedText: string = '';

  constructor() {
    this.initObserver();
    this.listenForMessages();
    this.startPeriodicScan();
    console.log('[DraftPilot] Outlook Web content script active and monitoring inbox.');
  }

  private initObserver() {
    this.observer = new MutationObserver(() => {
      requestAnimationFrame(() => this.checkForEmailAndCompose());
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private startPeriodicScan() {
    setTimeout(() => this.checkForEmailAndCompose(), 500);
    setTimeout(() => this.checkForEmailAndCompose(), 1500);

    setInterval(() => {
      this.checkForEmailAndCompose();
    }, 2000);

    document.addEventListener('click', () => {
      setTimeout(() => this.checkForEmailAndCompose(), 300);
    });
  }

  /**
   * Finds the active Outlook compose box (inline reply or new message).
   * Outlook Web uses React-based contenteditable divs.
   */
  private findComposeBox(): HTMLElement | null {
    const selectors = [
      // Outlook Web modern React compose box
      'div[role="textbox"][aria-label="Message body"]',
      'div[role="textbox"][aria-label="Message body, press Alt+F10 to exit"]',
      'div[role="textbox"][aria-multiline="true"]',
      // Outlook contenteditable compose areas
      'div[data-testid="TextEditor"]',
      'div.dFCbN[contenteditable="true"]',
      'div.elementToProof[contenteditable="true"]',
      // Generic contenteditable in compose region
      'div[aria-label*="message body" i][contenteditable="true"]',
      'div[aria-label*="Message Body" i][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (let i = 0; i < els.length; i++) {
        const el = els[i] as HTMLElement;
        if (el.offsetParent !== null) {
          return el;
        }
      }
    }
    return null;
  }

  /**
   * Extracts email thread text from the Outlook Web reading pane.
   * Outlook's DOM structure varies between the new React-based UI and classic views.
   */
  private extractThreadText(): string {
    let result = '';

    // Extract Subject from Outlook reading pane
    const subjectSelectors = [
      'span[role="heading"][aria-level]',
      'div[role="heading"][aria-level]',
      'span.lpc-hoverTarget-subject',
      'div[data-app-section="ConversationContainer"] h2',
      'div[role="main"] h2',
      'input[aria-label="Add a subject"]',
    ];

    for (const sel of subjectSelectors) {
      const subjectEl = document.querySelector(sel);
      if (subjectEl) {
        const text = (subjectEl as HTMLElement).innerText?.trim() || (subjectEl as HTMLInputElement).value?.trim();
        if (text && text.length > 1) {
          result += `Subject: ${text}\n\n`;
          break;
        }
      }
    }

    // Extract Sender from Outlook reading pane header
    const senderSelectors = [
      'span.OZZZK',
      'span.lpc-hoverTarget',
      'button[aria-label] span.OZZZK',
      'div[role="heading"] + div span[title]',
      'span[data-testid="SenderPersona"]',
      'div[aria-label*="Message header"] span[title]',
    ];

    for (const sel of senderSelectors) {
      const senderEl = document.querySelector(sel);
      if (senderEl) {
        const name = senderEl.getAttribute('title') || senderEl.textContent?.trim() || '';
        if (name && name.length > 1 && !name.includes('@')) {
          result += `From: ${name}\n\n`;
          break;
        }
      }
    }

    // Extract Message Bodies from Outlook reading pane
    const compose = this.findComposeBox();
    const bodySelectors = [
      'div[role="document"]',
      'div[data-testid="MessageBody"]',
      'div.allowTextSelection',
      'div[aria-label="Message body"]',
      'div[data-app-section="ConversationContainer"] div[role="document"]',
      'div[uniqueid] div[role="document"]',
    ];

    let foundBodies = false;
    for (const sel of bodySelectors) {
      const messageBodies = document.querySelectorAll(sel);
      if (messageBodies.length > 0) {
        messageBodies.forEach((body) => {
          // Exclude compose box from extracted text
          if (!compose || !compose.contains(body)) {
            const text = (body as HTMLElement).innerText?.trim();
            if (text && text.length > 5) {
              result += text + '\n\n';
              foundBodies = true;
            }
          }
        });
        if (foundBodies) break;
      }
    }

    // Fallback: Check main content region
    if (!result.trim()) {
      const mainSelectors = [
        'div[role="main"]',
        'div[data-app-section="ConversationContainer"]',
        'div[aria-label="Reading Pane"]',
      ];

      for (const sel of mainSelectors) {
        const mainContainer = document.querySelector(sel);
        if (mainContainer) {
          const text = (mainContainer as HTMLElement).innerText;
          if (text && text.length > 20) {
            result = text.slice(0, 2500);
            break;
          }
        }
      }
    }

    return result.trim();
  }

  private checkForEmailAndCompose() {
    const compose = this.findComposeBox();
    const threadText = this.extractThreadText();

    if (compose) {
      this.composeBox = compose;
    }

    if (threadText && threadText !== this.lastDetectedText) {
      this.lastDetectedText = threadText;
      const scrubbed = scrubPII(threadText);

      chrome.runtime.sendMessage({
        type: 'THREAD_DETECTED',
        text: scrubbed,
        hasCompose: !!compose,
        provider: 'outlook',
      }).catch(() => {
        // Ignore extension context errors
      });
    }
  }

  private listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_THREAD_CONTENT' || message.type === 'POLL_THREAD') {
        const text = this.extractThreadText();
        const compose = this.findComposeBox();
        if (compose) this.composeBox = compose;

        sendResponse({
          text: text ? scrubPII(text) : '',
          hasCompose: !!compose,
          provider: 'outlook',
        });
      } else if (message.type === 'INSERT_DRAFT') {
        const success = this.insertDraft(message.draft);
        sendResponse({ success });
      }
      return true;
    });
  }

  /**
   * Inserts draft text into the Outlook compose box.
   * Handles both inline reply and standalone compose windows.
   */
  private insertDraft(draft: string): boolean {
    let target = this.composeBox || this.findComposeBox();

    if (!target) {
      // Try to click Reply button if no compose box is open
      const replySelectors = [
        'button[aria-label="Reply"]',
        'button[name="Reply"]',
        'button[title="Reply"]',
        'button[aria-label="Reply all"]',
        'span[role="button"][title="Reply"]',
      ];

      for (const sel of replySelectors) {
        const replyBtn = document.querySelector(sel) as HTMLElement;
        if (replyBtn && replyBtn.offsetParent !== null) {
          replyBtn.click();
          break;
        }
      }

      // Wait briefly for compose box to appear, then re-query
      setTimeout(() => {
        target = this.findComposeBox();
        if (target) {
          this.performInsertion(target, draft);
        }
      }, 500);

      // Also try to find it immediately
      target = this.findComposeBox();
    }

    if (target) {
      return this.performInsertion(target, draft);
    }
    return false;
  }

  /**
   * Performs the actual text insertion into the target contenteditable element.
   * Uses Selection/Range API and execCommand with React-compatible event dispatching.
   */
  private performInsertion(target: HTMLElement, draft: string): boolean {
    target.focus();

    // Position cursor at end of compose box
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

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

    // Dispatch event sequence for Outlook's React framework to register the change
    target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: draft }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
    return true;
  }
}

// Initialize on page load
new OutlookDetector();

export {};
