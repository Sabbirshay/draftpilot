import { apiClient } from '../utils/api-client';

class SidePanel {
  private currentThreadText: string = '';
  private currentDraft: string = '';
  private macros: any[] = [];
  private pollInterval: any = null;
  private customerName: string = 'there';

  constructor() {
    this.init();
  }

  async init() {
    this.attachEventListeners();
    await this.checkAuth();
    this.listenForThread();
    this.startActivePolling();
  }

  private async checkAuth() {
    try {
      const data = await apiClient.getMe();
      this.showView('main-view');
      this.loadUserData(data);
      await this.loadMacros();
      this.pollActiveTabForThread();
    } catch {
      this.showView('login-view');
    }
  }

  private showView(viewId: string) {
    document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
    document.getElementById(viewId)?.classList.remove('hidden');
  }

  private async getGmailTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const lastTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (lastTabs[0] && lastTabs[0].url && lastTabs[0].url.includes('mail.google.com')) {
        return lastTabs[0];
      }

      const currTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (currTabs[0] && currTabs[0].url && currTabs[0].url.includes('mail.google.com')) {
        return currTabs[0];
      }

      const allGmail = await chrome.tabs.query({ url: '*://mail.google.com/*' });
      if (allGmail.length > 0) {
        return allGmail[0];
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private attachEventListeners() {
    // Auth Forms
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const pass = (document.getElementById('login-password') as HTMLInputElement).value;
      try {
        await apiClient.login(email, pass);
        await this.checkAuth();
      } catch (err: any) {
        this.showError(err.message);
      }
    });

    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('reg-email') as HTMLInputElement).value;
      const pass = (document.getElementById('reg-password') as HTMLInputElement).value;
      const team = (document.getElementById('reg-team') as HTMLInputElement).value;
      try {
        await apiClient.register(email, pass, team);
        await this.checkAuth();
      } catch (err: any) {
        this.showError(err.message);
      }
    });

    document.getElementById('show-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-form-container')?.classList.add('hidden');
      document.getElementById('register-form-container')?.classList.remove('hidden');
      this.hideError();
    });

    document.getElementById('show-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('register-form-container')?.classList.add('hidden');
      document.getElementById('login-form-container')?.classList.remove('hidden');
      this.hideError();
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await chrome.storage.local.remove(['token', 'user', 'teamId']);
      this.showView('login-view');
    });

    // Scan Email button
    document.getElementById('scan-email-btn')?.addEventListener('click', () => {
      this.pollActiveTabForThread(true);
    });

    // Tabs
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;

        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
        target.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach((p) => p.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');

        if (tabName === 'draft') this.pollActiveTabForThread();
        if (tabName === 'macros') this.loadMacros();
        if (tabName === 'settings') this.loadUserData();
      });
    });

    // Draft Generation
    document.getElementById('generate-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('generate-btn') as HTMLButtonElement;
      btn.disabled = true;
      btn.innerText = '✨ Generating AI Draft...';

      const hint = (document.getElementById('macro-hint') as HTMLInputElement).value;

      if (!this.currentThreadText) {
        await this.pollActiveTabForThread(false);
      }

      try {
        const result = await apiClient.generateDraft(this.currentThreadText, hint);
        this.currentDraft = result.draft;

        const contentDiv = document.getElementById('draft-content');
        if (contentDiv) {
          contentDiv.innerText = this.currentDraft;
        }

        const badgeEl = document.getElementById('draft-macro-badge');
        if (badgeEl) {
          badgeEl.innerText = result.macroUsed ? `Macro: ${result.macroUsed}` : 'AI Generated';
        }

        document.getElementById('draft-result-container')?.classList.remove('hidden');
        await this.loadUsage();
      } catch (err: any) {
        alert(`Draft error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerText = '✨ Generate Contextual AI Draft';
      }
    });

    // Insert into Gmail Reply
    document.getElementById('insert-btn')?.addEventListener('click', async () => {
      if (!this.currentDraft) return;
      await this.insertTextIntoGmailTab(this.currentDraft);
    });

    // Copy to clipboard
    document.getElementById('copy-btn')?.addEventListener('click', async () => {
      if (this.currentDraft) {
        await navigator.clipboard.writeText(this.currentDraft);
        const btn = document.getElementById('copy-btn') as HTMLButtonElement;
        const originalText = btn.innerText;
        btn.innerText = '✓ Copied!';
        setTimeout(() => (btn.innerText = originalText), 2000);
      }
    });

    // Macros Form
    document.getElementById('show-add-macro-btn')?.addEventListener('click', () => {
      document.getElementById('add-macro-form')?.classList.remove('hidden');
      document.getElementById('show-add-macro-btn')?.classList.add('hidden');
    });

    document.getElementById('cancel-macro-btn')?.addEventListener('click', () => {
      document.getElementById('add-macro-form')?.classList.add('hidden');
      document.getElementById('show-add-macro-btn')?.classList.remove('hidden');
    });

    document.getElementById('add-macro-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('macro-name') as HTMLInputElement).value;
      const content = (document.getElementById('macro-content') as HTMLTextAreaElement).value;
      const tagsStr = (document.getElementById('macro-tags') as HTMLInputElement).value;
      const tags = tagsStr.split(',').map((t) => t.trim()).filter((t) => t);

      try {
        await apiClient.createMacro(name, content, tags);
        (e.target as HTMLFormElement).reset();
        document.getElementById('add-macro-form')?.classList.add('hidden');
        document.getElementById('show-add-macro-btn')?.classList.remove('hidden');
        await this.loadMacros();
      } catch (err: any) {
        alert(err.message);
      }
    });

    // Web Dashboard Link
    document.getElementById('billing-btn')?.addEventListener('click', () => {
      window.open('https://draftpilot-web.vercel.app/dashboard', '_blank');
    });

    // Sync editable draft content back to currentDraft
    document.getElementById('draft-content')?.addEventListener('input', () => {
      const contentDiv = document.getElementById('draft-content');
      if (contentDiv) {
        this.currentDraft = contentDiv.innerText;
      }
    });

    // Macro search filtering
    document.getElementById('macro-search')?.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.filterMacros(query);
    });
  }

  private showError(msg: string) {
    const el = document.getElementById('auth-error');
    if (el) {
      el.innerText = msg;
      el.classList.remove('hidden');
    }
  }

  private hideError() {
    document.getElementById('auth-error')?.classList.add('hidden');
  }

  private async loadUserData(userData?: any) {
    try {
      const data = userData || (await apiClient.getMe());
      const emailEl = document.getElementById('user-email');
      if (emailEl) emailEl.innerText = data.email || data.user?.email || '';

      const teamEl = document.getElementById('settings-team');
      if (teamEl) teamEl.innerText = data.team?.name || data.user?.teams?.name || 'Workspace Active';

      const planEl = document.getElementById('settings-plan');
      if (planEl) planEl.innerText = (data.team?.plan || 'free').toUpperCase();

      await this.loadUsage();
    } catch {
      // Ignore
    }
  }

  private async loadUsage() {
    try {
      const usage = await apiClient.getUsage();

      const countEl = document.getElementById('usage-count');
      if (countEl) countEl.innerText = `${usage.draftsUsed || usage.used || 0}/${usage.draftsLimit || usage.limit || 50}`;

      const progressEl = document.getElementById('usage-progress');
      if (progressEl) {
        const used = usage.draftsUsed || usage.used || 0;
        const limit = usage.draftsLimit || usage.limit || 50;
        const pct = Math.min(100, Math.round((used / limit) * 100));
        progressEl.style.width = `${pct}%`;
        progressEl.style.backgroundColor = pct >= 100 ? '#ef4444' : '#7c3aed';
      }
    } catch {
      // Ignore
    }
  }

  private async loadMacros() {
    try {
      this.macros = await apiClient.getMacros();

      // Clear search when reloading
      const searchInput = document.getElementById('macro-search') as HTMLInputElement;
      if (searchInput) searchInput.value = '';

      this.renderMacrosList(this.macros);
    } catch {
      // Ignore
    }
  }

  private renderMacrosList(macrosToRender: any[]) {
    const listEl = document.getElementById('macros-list');
    const emptyEl = document.getElementById('macros-empty');

    if (!listEl || !emptyEl) return;

    if (macrosToRender.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      listEl.innerHTML = macrosToRender
        .map(
          (m) => `
          <div class="card macro-item mt-2" style="padding: 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <strong style="font-size: 12px; color: #f3f4f6;">${m.name}</strong>
              <button class="btn btn-ghost btn-sm text-error delete-macro" data-id="${m.id}" style="color: #f87171; font-size: 11px; padding: 2px 6px; cursor: pointer;">✕</button>
            </div>
            <div style="font-size: 11px; color: #9ca3af; line-height: 1.4; margin-bottom: 8px; max-height: 50px; overflow: hidden; font-family: monospace; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 6px;">${m.content}</div>
            <button class="btn-use-macro" data-id="${m.id}" style="width: 100%; padding: 6px; font-size: 11px; font-weight: 700; border-radius: 8px; background: #7c3aed; color: white; border: none; cursor: pointer; transition: all 0.2s;">
              ⚡ Insert Macro into Gmail Reply
            </button>
          </div>
        `
        )
        .join('');

      // Attach click listeners for "Insert Macro" buttons
      listEl.querySelectorAll('.btn-use-macro').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const target = e.currentTarget as HTMLElement;
          const id = target.dataset.id;
          const macro = this.macros.find((m) => m.id === id);
          if (macro) {
            const formatted = macro.content
              .replace(/{{name}}/g, this.customerName)
              .replace(/{{customer_name}}/g, this.customerName)
              .replace(/\[Customer\]/g, this.customerName);

            target.innerText = '✓ Inserting into Gmail...';
            await this.insertTextIntoGmailTab(formatted);
            target.innerText = '✓ Inserted into Gmail Reply!';
            setTimeout(() => (target.innerText = '⚡ Insert Macro into Gmail Reply'), 2500);
          }
        });
      });

      // Attach delete listeners
      listEl.querySelectorAll('.delete-macro').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const id = (e.target as HTMLElement).dataset.id;
          if (id && confirm('Delete this macro?')) {
            await apiClient.deleteMacro(id);
            this.loadMacros();
          }
        });
      });
    }
  }

  private filterMacros(query: string) {
    if (!query) {
      this.renderMacrosList(this.macros);
      return;
    }

    const filtered = this.macros.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const content = (m.content || '').toLowerCase();
      const tags = (m.tags || []).join(' ').toLowerCase();
      return name.includes(query) || content.includes(query) || tags.includes(query);
    });

    this.renderMacrosList(filtered);
  }

  private handleThreadDetected(text: string) {
    if (!text || text.trim().length === 0) return;

    this.currentThreadText = text;

    // Extract customer first name
    const match = text.match(/(?:from|hi|dear|hello)\s+([A-Z][a-z]+)/i);
    if (match && match[1]) {
      this.customerName = match[1];
    }

    const statusEl = document.getElementById('thread-status');
    if (statusEl) {
      statusEl.innerText = '✓ Email thread detected';
      statusEl.className = 'status-box detected';
      statusEl.style.color = '#34d399';
      statusEl.style.borderColor = 'rgba(52, 211, 153, 0.4)';
      statusEl.style.backgroundColor = 'rgba(52, 211, 153, 0.1)';
    }

    const previewEl = document.getElementById('thread-preview');
    if (previewEl) {
      previewEl.innerText = this.currentThreadText.substring(0, 140) + '...';
      previewEl.classList.remove('hidden');
    }

    const btn = document.getElementById('generate-btn') as HTMLButtonElement;
    if (btn) btn.disabled = false;
  }

  public async pollActiveTabForThread(manual: boolean = false) {
    try {
      const tab = await this.getGmailTab();
      if (!tab?.id) return;

      // 1. Try messaging content script
      chrome.tabs.sendMessage(tab.id, { type: 'GET_THREAD_CONTENT' }, (response) => {
        if (!chrome.runtime.lastError && response && response.text) {
          this.handleThreadDetected(response.text);
          return;
        }

        // 2. Fallback: Direct script execution
        if (chrome.scripting && tab.id) {
          chrome.scripting.executeScript(
            {
              target: { tabId: tab.id },
              func: () => {
                let text = '';
                const subject = document.querySelector('h2.hP, h2[data-thread-perm-id]')?.textContent?.trim();
                if (subject) text += `Subject: ${subject}\n\n`;

                const bodies = document.querySelectorAll('.a3s.aiL, .a3s, .ii.gt, div[data-message-id]');
                bodies.forEach((b) => {
                  const t = (b as HTMLElement).innerText?.trim();
                  if (t && t.length > 10) text += t + '\n\n';
                });

                if (!text.trim()) {
                  const main = document.querySelector('div[role="main"]');
                  if (main) text = (main as HTMLElement).innerText?.slice(0, 1500) || '';
                }
                return text.trim();
              },
            },
            (results) => {
              if (results && results[0] && results[0].result) {
                this.handleThreadDetected(results[0].result as string);
              } else if (manual) {
                const statusEl = document.getElementById('thread-status');
                if (statusEl) statusEl.innerText = 'Ready — Open an email thread';
              }
            }
          );
        }
      });
    } catch {
      // Ignore
    }
  }

  private async insertTextIntoGmailTab(textToInsert: string) {
    const tab = await this.getGmailTab();
    if (!tab?.id) {
      alert('Please keep your Gmail tab open in Chrome.');
      return;
    }

    // 1. Try messaging content script
    chrome.tabs.sendMessage(tab.id, { type: 'INSERT_DRAFT', draft: textToInsert }, (res) => {
      if (!chrome.runtime.lastError && res && res.success) {
        const btn = document.getElementById('insert-btn') as HTMLButtonElement;
        if (btn) {
          const orig = btn.innerText;
          btn.innerText = '✓ Inserted into Gmail!';
          setTimeout(() => (btn.innerText = orig), 2000);
        }
        return;
      }

      // 2. Fallback: Direct scripting insertion into active Gmail editable element
      if (chrome.scripting && tab.id) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            args: [textToInsert],
            func: (rawText) => {
              const selectors = [
                'div[role="textbox"][contenteditable="true"]',
                'div[role="textbox"][g_editable="true"]',
                'div[aria-label*="Message Body"]',
                'div[aria-label*="Reply"]',
                'div.Am.Al.editable',
                'div.editable[contenteditable="true"]',
                'div[role="textbox"]',
              ];

              let target: HTMLElement | null = null;
              for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                for (let i = 0; i < els.length; i++) {
                  const el = els[i] as HTMLElement;
                  if (el.offsetParent !== null) {
                    target = el;
                    break;
                  }
                }
                if (target) break;
              }

              if (target) {
                target.focus();
                const html = rawText.replace(/\n/g, '<br>');
                try {
                  if (!document.execCommand('insertHTML', false, html)) {
                    target.innerHTML = html;
                  }
                } catch {
                  target.innerHTML = html;
                }
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
              return false;
            },
          },
          (results) => {
            const btn = document.getElementById('insert-btn') as HTMLButtonElement;
            if (btn) {
              const orig = btn.innerText;
              if (results && results[0] && results[0].result) {
                btn.innerText = '✓ Inserted into Gmail!';
              } else {
                btn.innerText = '⚠️ Click Reply in Gmail first';
              }
              setTimeout(() => (btn.innerText = orig), 2500);
            }
          }
        );
      }
    });
  }

  private startActivePolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => {
      this.pollActiveTabForThread();
    }, 2000);
  }

  private listenForThread() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'THREAD_DETECTED' && message.text) {
        this.handleThreadDetected(message.text);
      }
    });
  }
}

// Initialize
new SidePanel();
