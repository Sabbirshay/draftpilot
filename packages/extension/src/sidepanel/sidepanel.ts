import { apiClient } from '../utils/api-client';

class SidePanel {
  private currentThreadText: string = '';
  private currentDraft: string = '';
  private macros: any[] = [];

  constructor() {
    this.init();
  }

  async init() {
    this.attachEventListeners();
    await this.checkAuth();
    this.listenForThread();
  }

  private async checkAuth() {
    try {
      await apiClient.getMe();
      this.showView('main-view');
      this.loadUserData();
    } catch (e) {
      this.showView('login-view');
    }
  }

  private showView(viewId: string) {
    document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
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
      await chrome.storage.local.remove(['token']);
      this.showView('login-view');
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const tabName = target.dataset.tab;
        
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        target.classList.add('active');
        
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
        document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');

        if (tabName === 'macros') this.loadMacros();
        if (tabName === 'settings') this.loadUserData();
      });
    });

    // Draft Generation
    document.getElementById('generate-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('generate-btn') as HTMLButtonElement;
      btn.disabled = true;
      btn.innerText = 'Generating...';

      const hint = (document.getElementById('macro-hint') as HTMLInputElement).value;
      
      try {
        const result = await apiClient.generateDraft(this.currentThreadText, hint);
        this.currentDraft = result.draft;
        
        const contentDiv = document.getElementById('draft-content');
        if (contentDiv) {
          contentDiv.innerText = this.currentDraft;
        }
        
        document.getElementById('draft-result-container')?.classList.remove('hidden');
        await this.loadUsage(); // Refresh usage
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      } finally {
        btn.disabled = false;
        btn.innerText = 'Generate Draft';
      }
    });

    document.getElementById('insert-btn')?.addEventListener('click', async () => {
      if (this.currentDraft) {
        chrome.runtime.sendMessage({
          type: 'INSERT_DRAFT',
          draft: this.currentDraft
        });
      }
    });

    document.getElementById('copy-btn')?.addEventListener('click', async () => {
      if (this.currentDraft) {
        await navigator.clipboard.writeText(this.currentDraft);
        const btn = document.getElementById('copy-btn') as HTMLButtonElement;
        const originalText = btn.innerText;
        btn.innerText = 'Copied!';
        setTimeout(() => btn.innerText = originalText, 2000);
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
      const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);

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

    // Settings
    document.getElementById('billing-btn')?.addEventListener('click', async () => {
      try {
        const { url } = await apiClient.getCheckoutUrl();
        window.open(url, '_blank');
      } catch (err: any) {
        alert(err.message);
      }
    });

    document.getElementById('save-api-url')?.addEventListener('click', async () => {
      const url = (document.getElementById('api-url') as HTMLInputElement).value;
      if (url) {
        await chrome.storage.local.set({ apiUrl: url });
        alert('API URL saved. Please reload extension.');
      }
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

  private async loadUserData() {
    try {
      const user = await apiClient.getMe();
      const emailEl = document.getElementById('user-email');
      if (emailEl) emailEl.innerText = user.email;

      const teamEl = document.getElementById('settings-team');
      if (teamEl) teamEl.innerText = user.team?.name || 'No Team';

      await this.loadUsage();
    } catch (e) {
      // Ignore
    }
  }

  private async loadUsage() {
    try {
      const usage = await apiClient.getUsage();
      
      const countEl = document.getElementById('usage-count');
      if (countEl) countEl.innerText = `${usage.draftsUsed}/${usage.draftsLimit}`;

      const progressEl = document.getElementById('usage-progress');
      if (progressEl) {
        const pct = Math.min(100, (usage.draftsUsed / usage.draftsLimit) * 100);
        progressEl.style.width = `${pct}%`;
        progressEl.style.backgroundColor = pct >= 100 ? 'var(--error)' : 'var(--accent)';
      }

      const planEl = document.getElementById('settings-plan');
      if (planEl) planEl.innerText = usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1);

      const billingBtn = document.getElementById('billing-btn');
      if (billingBtn) {
        billingBtn.innerText = usage.plan === 'free' ? 'Upgrade to Team' : 'Manage Billing';
      }
    } catch (e) {
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
        listEl.innerHTML = this.macros.map(m => `
          <div class="card macro-item mt-2">
            <div class="flex-between">
              <strong>${m.name}</strong>
              <button class="btn btn-ghost btn-sm text-error delete-macro" data-id="${m.id}">Del</button>
            </div>
            <div class="text-sm text-muted mt-1 text-truncate">${m.content.substring(0, 50)}...</div>
          </div>
        `).join('');

        document.querySelectorAll('.delete-macro').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = (e.target as HTMLElement).dataset.id;
            if (id && confirm('Delete this macro?')) {
              await apiClient.deleteMacro(id);
              this.loadMacros();
            }
          });
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  private listenForThread() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'THREAD_DETECTED') {
        this.currentThreadText = message.text;
        
        const statusEl = document.getElementById('thread-status');
        if (statusEl) {
          statusEl.innerText = 'Reply detected ✓';
          statusEl.className = 'status-box detected';
        }

        const previewEl = document.getElementById('thread-preview');
        if (previewEl) {
          previewEl.innerText = this.currentThreadText.substring(0, 150) + '...';
          previewEl.classList.remove('hidden');
        }

        const btn = document.getElementById('generate-btn') as HTMLButtonElement;
        if (btn) btn.disabled = false;
      }
    });
  }
}

// Initialize
new SidePanel();
