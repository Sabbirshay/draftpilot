/**
 * Client-Side PII Scrubber (Inlined to prevent ES module chunk splitting in Chrome content script)
 */
function scrubPII(text: string): string {
  if (!text) return '';
  let scrubbed = text;
  scrubbed = scrubbed.replace(/\b(?:\d[ -]*?){13,19}\b/g, '[CARD_REDACTED]');
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
  scrubbed = scrubbed.replace(/\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g, '[SSN_REDACTED]');
  scrubbed = scrubbed.replace(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{4}\b/g, '[PHONE_REDACTED]');
  scrubbed = scrubbed.replace(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, '[IP_REDACTED]');
  scrubbed = scrubbed.replace(/(?:Bearer\s+|api[_-]?key[:=\s]+)[a-zA-Z0-9_\-\.]{16,}/gi, '[TOKEN_REDACTED]');
  scrubbed = scrubbed.replace(/(?:password|passcode|secret|pin)[:=\s]+[^\s,;]+/gi, '[SECRET_REDACTED]');
  return scrubbed;
}

class GmailDetector {
  private composeBox: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private lastDetectedText: string = '';

  constructor() {
    this.initObserver();
    this.listenForMessages();
    this.startPeriodicScan();
    console.log('[DraftPilot] Gmail content script active and monitoring inbox.');
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

  private findComposeBox(): HTMLElement | null {
    const selectors = [
      'div.Am.Al.editable[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
      'div[role="textbox"][g_editable="true"]',
      'div[aria-label*="Message Body"]',
      'div[aria-label*="Reply"]',
      'div[aria-label*="Body"]',
      'div.editable[contenteditable="true"]',
      'div[role="textbox"]',
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

  private extractThreadText(): string {
    let result = '';

    // Extract Subject
    const subjectEl = document.querySelector('h2.hP, h2[data-thread-perm-id], h2[data-legacy-thread-id]');
    if (subjectEl && subjectEl.textContent) {
      result += `Subject: ${subjectEl.textContent.trim()}\n\n`;
    }

    // Extract Senders & Bodies
    const messageBodies = document.querySelectorAll('.a3s.aiL, .a3s, .ii.gt, div[data-message-id]');
    const compose = this.findComposeBox();

    if (messageBodies.length > 0) {
      messageBodies.forEach((body) => {
        if (!compose || !compose.contains(body)) {
          const text = (body as HTMLElement).innerText?.trim();
          if (text && text.length > 5) {
            result += text + '\n\n';
          }
        }
      });
    }

    // Fallback: Check main email container
    if (!result.trim()) {
      const mainContainer = document.querySelector('div[role="main"]');
      if (mainContainer) {
        const text = (mainContainer as HTMLElement).innerText;
        if (text && text.length > 20) {
          result = text.slice(0, 2500);
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
        });
      } else if (message.type === 'INSERT_DRAFT') {
        const success = this.insertDraft(message.draft);
        sendResponse({ success });
      }
      return true;
    });
  }

  private insertDraft(draft: string): boolean {
    let target = this.composeBox || this.findComposeBox();

    if (!target) {
      // Try to click Reply if visible
      const replyBtn = document.querySelector('span[role="button"][data-tooltip*="Reply"], div[role="button"][aria-label*="Reply"]') as HTMLElement;
      if (replyBtn) {
        replyBtn.click();
      }
      target = document.querySelector('div[role="textbox"]') as HTMLElement;
    }

    if (target) {
      target.focus();

      // Modern Gmail text insertion with Selection API & execCommand fallback
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      const html = draft.replace(/\n/g, '<br>');
      let inserted = false;

      try {
        inserted = document.execCommand('insertHTML', false, html);
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
        target.innerHTML = html;
      }

      // Dispatch full input event sequence
      target.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: draft }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: ' ' }));
      return true;
    }
    return false;
  }
}

// Initialize on page load
new GmailDetector();
