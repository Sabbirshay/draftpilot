import { scrubPII } from '../utils/pii-scrubber';

class GmailDetector {
  private composeBox: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private lastDetectedText: string = '';

  constructor() {
    this.initObserver();
    this.listenForMessages();
    this.startPeriodicScan();
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
    // Initial scan
    setTimeout(() => this.checkForEmailAndCompose(), 500);
    setTimeout(() => this.checkForEmailAndCompose(), 1500);

    // Periodic check every 2 seconds
    setInterval(() => {
      this.checkForEmailAndCompose();
    }, 2000);

    // Also check on click or keyup in Gmail
    document.addEventListener('click', () => {
      setTimeout(() => this.checkForEmailAndCompose(), 300);
    });
  }

  private findComposeBox(): HTMLElement | null {
    const selectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[role="textbox"][g_editable="true"]',
      'div[role="textbox"][aria-label*="Message Body"]',
      'div[role="textbox"][aria-label*="Reply"]',
      'div[role="textbox"][aria-label*="Body"]',
      'div.Am.Al.editable',
      'div.editable[contenteditable="true"]',
      'div[g_editable="true"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel) as HTMLElement;
      if (el && el.offsetParent !== null) {
        return el;
      }
    }
    return null;
  }

  private extractThreadText(): string {
    let result = '';

    // 1. Extract Email Subject
    const subjectEl = document.querySelector('h2.hP, h2[data-thread-perm-id], h2[data-legacy-thread-id]');
    if (subjectEl && subjectEl.textContent) {
      result += `Subject: ${subjectEl.textContent.trim()}\n\n`;
    }

    // 2. Extract Senders and Message Bodies
    const messageBodies = document.querySelectorAll('.a3s.aiL, .a3s, .ii.gt, div[data-message-id]');
    const compose = this.findComposeBox();

    if (messageBodies.length > 0) {
      messageBodies.forEach((body) => {
        if (!compose || !compose.contains(body)) {
          const text = (body as HTMLElement).innerText?.trim();
          if (text && text.length > 10) {
            result += text + '\n\n';
          }
        }
      });
    }

    // 3. Fallback: Check email view main container
    if (!result.trim()) {
      const mainContainer = document.querySelector('div[role="main"]');
      if (mainContainer) {
        const text = (mainContainer as HTMLElement).innerText;
        if (text && text.length > 30) {
          result = text.slice(0, 2000);
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
        // Ignore context errors
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
      // Try to find any visible compose container
      target = document.querySelector('div[role="textbox"]') as HTMLElement;
    }

    if (target) {
      target.focus();
      const htmlContent = draft.replace(/\n/g, '<br>');

      try {
        if (!document.execCommand('insertHTML', false, htmlContent)) {
          target.innerHTML = htmlContent;
        }
      } catch {
        target.innerHTML = htmlContent;
      }

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
}

// Initialize on load
new GmailDetector();
