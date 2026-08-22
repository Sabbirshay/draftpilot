import { scrubPII } from '../utils/pii-scrubber';

class GmailDetector {
  private composeBox: HTMLElement | null = null;
  private observer: MutationObserver | null = null;

  constructor() {
    this.initObserver();
    this.listenForMessages();
  }

  private initObserver() {
    // Observe DOM mutations to detect when a compose/reply box appears
    this.observer = new MutationObserver(() => {
      // Use requestAnimationFrame to batch DOM reads
      requestAnimationFrame(() => this.checkForCompose());
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private checkForCompose() {
    // Look for Gmail's compose area
    const newComposeBox = document.querySelector('div[role="textbox"][g_editable="true"], div[role="textbox"][aria-label*="Message Body"]') as HTMLElement;
    
    if (newComposeBox && newComposeBox !== this.composeBox) {
      this.composeBox = newComposeBox;
      this.handleComposeDetected();
    } else if (!newComposeBox && this.composeBox) {
      this.composeBox = null;
    }
  }

  private handleComposeDetected() {
    // Try to extract thread text
    const threadText = this.extractThreadText();
    if (threadText) {
      const scrubbedText = scrubPII(threadText);
      chrome.runtime.sendMessage({
        type: 'THREAD_DETECTED',
        text: scrubbedText
      }).catch(() => {
        // Ignore if extension context invalidated or background not ready
      });
    }
  }

  private extractThreadText(): string {
    // Find all message bodies in the current view
    const messageBodies = document.querySelectorAll('.a3s.aiL');
    if (!messageBodies.length) return '';

    let text = '';
    messageBodies.forEach(body => {
      // Exclude the current compose box if it's inside
      if (!this.composeBox || !this.composeBox.contains(body)) {
        text += (body as HTMLElement).innerText + '\n\n';
      }
    });
    
    return text.trim();
  }

  private listenForMessages() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'INSERT_DRAFT') {
        this.insertDraft(message.draft);
        sendResponse({ success: true });
      }
      return true;
    });
  }

  private insertDraft(draft: string) {
    if (!this.composeBox) {
      // Try to find it again just in case
      this.composeBox = document.querySelector('div[role="textbox"][g_editable="true"], div[role="textbox"][aria-label*="Message Body"]') as HTMLElement;
    }

    if (this.composeBox) {
      // Replace newlines with <br> for contenteditable
      const htmlContent = draft.replace(/\n/g, '<br>');
      
      // Focus first to ensure it's active
      this.composeBox.focus();
      
      // Use execCommand to preserve undo stack if possible, otherwise innerHTML
      if (!document.execCommand('insertHTML', false, htmlContent)) {
        this.composeBox.innerHTML += htmlContent;
      }

      // Dispatch events to notify Gmail's internal state
      this.composeBox.dispatchEvent(new Event('input', { bubbles: true }));
      this.composeBox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

// Initialize when the script runs
new GmailDetector();
