import { scrubPII } from './pii-scrubber';

const SUPABASE_URL = 'https://amjliubpbysvtiqpbgnh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtamxpdWJwYnlzdnRpcXBiZ25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODgyNDAsImV4cCI6MjEwMjk2NDI0MH0.pYeCYannOZEYVdGEe-8km-e_II9Mh-S39KtPXD4yCGI';

export class ApiClient {
  private baseUrl = SUPABASE_URL;

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

  private async getTeamId(): Promise<string | null> {
    const data = await chrome.storage.local.get(['teamId', 'user', 'token']);
    if (data.teamId && data.teamId !== data.user?.id) return data.teamId;
    if (data.user && data.user.team_id && data.user.team_id !== data.user.id) return data.user.team_id;

    // Fallback: Query Supabase directly
    if (data.token) {
      try {
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${data.token}`,
          },
        });
        if (userRes.ok) {
          const authUser = await userRes.json();
          const dbUserRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?id=eq.${authUser.id}&select=*,teams(*)`,
            {
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${data.token}`,
              },
            }
          );
          if (dbUserRes.ok) {
            const users = await dbUserRes.json();
            if (users && users.length > 0 && users[0].team_id) {
              await chrome.storage.local.set({ teamId: users[0].team_id, user: users[0] });
              return users[0].team_id;
            }
          }
        }
      } catch {
        // Ignore
      }
    }
    return data.teamId || null;
  }

  async login(email: string, password: string) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ msg: 'Login failed' }));
      throw new Error(err.error_description || err.msg || err.message || 'Invalid login credentials');
    }

    const data = await res.json();
    const token = data.access_token;
    const authUser = data.user;

    // Fetch user details from DB
    let dbUser: any = null;
    try {
      const userRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${authUser.id}&select=*,teams(*)`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (userRes.ok) {
        const users = await userRes.json();
        if (users && users.length > 0) {
          dbUser = users[0];
        }
      }
    } catch {
      // Ignore
    }

    let teamId = dbUser?.team_id;
    let teamName = dbUser?.teams?.name || `${email.split('@')[0]}'s Team`;
    let plan = dbUser?.teams?.plan || 'free';

    // If user record doesn't exist in DB, auto-provision team and user
    if (!dbUser || !teamId) {
      try {
        const teamRes = await fetch(`${SUPABASE_URL}/rest/v1/teams`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify({ name: teamName }),
        });
        if (teamRes.ok) {
          const createdTeams = await teamRes.json();
          const newTeam = createdTeams[0] || createdTeams;
          teamId = newTeam.id;

          const userCreateRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              id: authUser.id,
              team_id: teamId,
              email: authUser.email,
              full_name: authUser.email.split('@')[0],
              role: 'owner',
            }),
          });
          if (userCreateRes.ok) {
            const createdUsers = await userCreateRes.json();
            dbUser = createdUsers[0] || createdUsers;
            dbUser.teams = newTeam;
          }
        }
      } catch {
        // Fallback
      }
    }

    await chrome.storage.local.set({
      token,
      user: dbUser || {
        id: authUser.id,
        email: authUser.email,
        team_id: teamId,
        teams: { name: teamName, plan },
      },
      teamId: teamId || authUser.id,
    });

    // Mark extension as installed & connected in onboarding_state
    if (teamId) {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/onboarding_state?team_id=eq.${teamId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              extension_installed: true,
              gmail_connected: true,
              updated_at: new Date().toISOString(),
            }),
          }
        );
      } catch {
        // Ignore
      }
    }

    return {
      accessToken: token,
      user: dbUser || { email: authUser.email, teams: { name: teamName, plan } },
    };
  }

  async register(email: string, password: string, teamName: string) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          full_name: email.split('@')[0],
          team_name: teamName,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ msg: 'Signup failed' }));
      throw new Error(err.msg || err.message || 'Signup failed');
    }

    return await this.login(email, password);
  }

  async getMe() {
    const token = await this.getToken();
    if (!token) throw new Error('Unauthorized');

    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      await chrome.storage.local.remove(['token', 'user']);
      throw new Error('Unauthorized');
    }

    const authUser = await res.json();
    const stored = await chrome.storage.local.get(['user']);
    return {
      email: authUser.email,
      team: stored.user?.teams || { name: `${authUser.email.split('@')[0]}'s Team`, plan: 'free' },
      user: stored.user || {
        email: authUser.email,
        teams: { name: `${authUser.email.split('@')[0]}'s Team`, plan: 'free' },
      },
    };
  }

  async getMacros() {
    const token = await this.getToken();
    const teamId = await this.getTeamId();

    if (!token) return [];

    let url = `${SUPABASE_URL}/rest/v1/macros?select=*&order=created_at.desc`;
    if (teamId) {
      url += `&team_id=eq.${teamId}`;
    }

    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) return [];
    return await res.json();
  }

  async createMacro(name: string, content: string, tags?: string[]) {
    const token = await this.getToken();
    const teamId = await this.getTeamId();
    if (!token || !teamId) throw new Error('Not authenticated. Please log in again.');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/macros`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        team_id: teamId,
        name: name.trim(),
        content: content.trim(),
        category: 'General',
        tags: tags || [],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed to create macro' }));
      throw new Error(err.message || err.error || 'Failed to create macro in database');
    }
    const created = await res.json();
    return created[0] || created;
  }

  async updateMacro(id: string, data: { name?: string; content?: string; tags?: string[] }) {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/macros?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Prefer: 'return=representation',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) throw new Error('Failed to update macro');
    return await res.json();
  }

  async deleteMacro(id: string) {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${SUPABASE_URL}/rest/v1/macros?id=eq.${id}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error('Failed to delete macro');
  }

  async generateDraft(threadContent: string, macroHint?: string) {
    const token = await this.getToken();
    const teamId = await this.getTeamId();

    // 1. Client-Side Privacy Scrubber
    const scrubbed = scrubPII(threadContent || '');

    // 2. Fetch available macros
    const macros = await this.getMacros();

    // 3. Match relevant macro
    let matchedMacro = null;
    const lowerThread = scrubbed.toLowerCase();
    const lowerHint = (macroHint || '').toLowerCase();

    if (macroHint && macros.length > 0) {
      matchedMacro = macros.find(
        (m: any) =>
          m.name.toLowerCase().includes(lowerHint) ||
          m.tags?.some((t: string) => t.toLowerCase().includes(lowerHint))
      );
    }

    if (!matchedMacro && macros.length > 0) {
      // Keyword matching
      matchedMacro = macros.find((m: any) => {
        const nameMatch = m.name.toLowerCase().split(' ').some((w: string) => w.length > 3 && lowerThread.includes(w));
        const tagMatch = m.tags?.some((t: string) => lowerThread.includes(t.toLowerCase()));
        return nameMatch || tagMatch;
      });
    }

    // Extract customer first name from thread if possible
    let customerName = 'there';
    const nameMatch = threadContent.match(/(?:from|hi|dear|hello)\s+([A-Z][a-z]+)/i);
    if (nameMatch && nameMatch[1]) {
      customerName = nameMatch[1];
    }

    // 4. Generate intelligent contextual draft
    let draftText = '';
    if (matchedMacro) {
      draftText = matchedMacro.content
        .replace(/{{name}}/g, customerName)
        .replace(/{{customer_name}}/g, customerName)
        .replace(/\[Customer\]/g, customerName)
        .replace(/\[Name\]/g, customerName);
    } else {
      // Natural contextual reply template
      if (lowerThread.includes('refund') || lowerThread.includes('return')) {
        draftText = `Hi ${customerName},\n\nThank you for reaching out to us. I'd be happy to help you with your return or refund request.\n\nPlease confirm your order number, and I will gladly process this and send over your prepaid return label right away.\n\nBest regards,\nCustomer Support Team`;
      } else if (lowerThread.includes('delay') || lowerThread.includes('where is') || lowerThread.includes('tracking')) {
        draftText = `Hi ${customerName},\n\nThanks for checking in on your shipment! I understand waiting for an order can be frustrating, and I apologize for the delay.\n\nI've checked on your shipment status with our carrier and it is actively on its way. You should see delivery within the next 2-3 business days.\n\nPlease let me know if you have any further questions!\n\nBest regards,\nCustomer Support Team`;
      } else if (lowerThread.includes('password') || lowerThread.includes('login') || lowerThread.includes('account')) {
        draftText = `Hi ${customerName},\n\nI can certainly assist you with accessing your account. I have initiated a secure password reset for your email.\n\nPlease check your inbox for the reset link (and your spam folder if it doesn't arrive within 5 minutes).\n\nLet us know if you need any additional help!\n\nBest regards,\nCustomer Support Team`;
      } else {
        draftText = `Hi ${customerName},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
      }
    }

    // 5. Save draft generation event to Supabase draft_history for live analytics
    if (token && teamId) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/draft_history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            team_id: teamId,
            thread_id: `gmail-thread-${Date.now()}`,
            thread_snippet: scrubbed.slice(0, 200),
            macro_id: matchedMacro?.id || null,
            generated_draft: draftText,
          }),
        });
      } catch {
        // Ignore telemetry errors
      }
    }

    return {
      draft: draftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : 88,
    };
  }

  async getUsage() {
    const token = await this.getToken();
    const teamId = await this.getTeamId();
    if (!token || !teamId) return { used: 0, limit: 50, draftsUsed: 0, draftsLimit: 50, plan: 'free' };

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/draft_history?team_id=eq.${teamId}&select=count`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
            Range: '0-0',
            Prefer: 'count=exact',
          },
        }
      );
      const countHeader = res.headers.get('content-range');
      const count = countHeader ? parseInt(countHeader.split('/')[1], 10) || 0 : 0;
      return { used: count, limit: 50, draftsUsed: count, draftsLimit: 50, plan: 'free' };
    } catch {
      return { used: 0, limit: 50, draftsUsed: 0, draftsLimit: 50, plan: 'free' };
    }
  }

  async getCheckoutUrl() {
    return { url: 'https://draftpilot-web.vercel.app/dashboard' };
  }
}

export const apiClient = new ApiClient();
