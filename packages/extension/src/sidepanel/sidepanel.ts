import { apiClient } from '../utils/api-client';

class SidePanel {
  private currentThreadText: string = '';
  private currentDraft: string = '';
  private macros: any[] = [];
  private pollInterval: any = null;

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
      this.loadMacros();
      this.pollActiveTabForThread();
    } catch {
      this.showView('login-view');
    }
  }

  private showView(viewId: string) {
    document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
    document.getElementById(viewId)?.classList.remove('hidden');
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
      btn.innerText = '✨ Drafting AI Reply...';

      const hint = (document.getElementById('macro-hint') as HTMLInputElement).value;

      // If thread not captured yet, attempt instant active tab scan
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
        await this.loadUsage(); // Refresh usage
      } catch (err: any) {
        alert(`Draft error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerText = 'Generate AI Draft';
      }
    });

    // Insert into Gmail
    document.getElementById('insert-btn')?.addEventListener('click', async () => {
      if (!this.currentDraft) return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'INSERT_DRAFT', draft: this.currentDraft }, (res) => {
          const btn = document.getElementById('insert-btn') as HTMLButtonElement;
          const orig = btn.innerText;
          btn.innerText = '✓ Inserted into Gmail!';
          setTimeout(() => (btn.innerText = orig), 2000);
        });
      }
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

    // Macros
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

    // Open Web Dashboard
    document.getElementById('billing-btn')?.addEventListener('click', () => {
      window.open('https://draftpilot-web.vercel.app/dashboard', '_blank');
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
      const listEl = document.getElementById('macros-list');
      const emptyEl = document.getElementById('macros-empty');

      if (!listEl || !emptyEl) return;

      if (this.macros.length === 0) {
        listEl.innerHTML = '';
        emptyEl.classList.remove('hidden');
      } else {
        emptyEl.classList.add('hidden');
        listEl.innerHTML = this.macros
          .map(
            (m) => `
          <div class="card macro-item mt-2" style="padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px;">
            <div class="flex-between" style="display: flex; justify-content: space-between; align-items: flex-start;">
              <strong style="font-size: 12px; color: #f3f4f6;">${m.name}</strong>
              <button class="btn btn-ghost btn-sm text-error delete-macro" data-id="${m.id}" style="color: #f87171; font-size: 11px; padding: 2px 6px; cursor: pointer;">✕</button>
            </div>
            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${m.content}</div>
          </div>
        `
          )
          .join('');

        document.querySelectorAll('.delete-macro').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            const id = (e.target as HTMLElement).dataset.id;
            if (id && confirm('Delete this macro?')) {
              await apiClient.deleteMacro(id);
              this.loadMacros();
            }
          });
        });
      }
    } catch {
      // Ignore
    }
  }

  private handleThreadDetected(text: string) {
    if (!text || text.trim().length === 0) return;

    this.currentThreadText = text;

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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && tab.url && tab.url.includes('mail.google.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_THREAD_CONTENT' }, (response) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded or page loading
            return;
          }
          if (response && response.text) {
            this.handleThreadDetected(response.text);
          } else if (manual) {
            const statusEl = document.getElementById('thread-status');
            if (statusEl) statusEl.innerText = 'Open an email thread to draft';
          }
        });
      }
    } catch {
      // Ignore
    }
  }

  private startActivePolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    // Poll every 2 seconds while panel is open
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
