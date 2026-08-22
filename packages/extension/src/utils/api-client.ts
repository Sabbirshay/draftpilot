export class ApiClient {
  private baseUrl = 'http://localhost:3001';

  constructor() {
    this.initBaseUrl();
  }

  private async initBaseUrl() {
    const data = await chrome.storage.local.get(['apiUrl']);
    if (data.apiUrl) {
      this.baseUrl = data.apiUrl;
    }
  }

  private async getToken(): Promise<string | null> {
    const data = await chrome.storage.local.get(['token']);
    return data.token || null;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const token = await this.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      await chrome.storage.local.remove(['token']);
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMsg = 'API request failed';
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || errorMsg;
      } catch (e) {
        // ignore
      }
      throw new Error(errorMsg);
    }

    if (response.status !== 204) {
      return response.json();
    }
  }

  async login(email: string, password: string) {
    const data = await this.fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    await chrome.storage.local.set({ token: data.accessToken });
    return data;
  }

  async register(email: string, password: string, teamName: string) {
    const data = await this.fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, teamName })
    });
    await chrome.storage.local.set({ token: data.accessToken });
    return data;
  }

  async getMe() {
    return this.fetchApi('/auth/me');
  }

  async getMacros() {
    return this.fetchApi('/macros');
  }

  async createMacro(name: string, content: string, tags?: string[]) {
    return this.fetchApi('/macros', {
      method: 'POST',
      body: JSON.stringify({ name, content, tags: tags || [] })
    });
  }

  async updateMacro(id: string, data: { name?: string; content?: string; tags?: string[] }) {
    return this.fetchApi(`/macros/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async deleteMacro(id: string) {
    return this.fetchApi(`/macros/${id}`, { method: 'DELETE' });
  }

  async generateDraft(threadContent: string, macroHint?: string) {
    return this.fetchApi('/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({ threadContent, macroHint })
    });
  }

  async getUsage() {
    return this.fetchApi('/billing/usage');
  }

  async getCheckoutUrl() {
    return this.fetchApi('/billing/checkout', { method: 'POST' });
  }
}

export const apiClient = new ApiClient();
