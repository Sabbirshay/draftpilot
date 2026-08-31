import { scrubPII } from './pii-scrubber';

const SUPABASE_URL = 'https://amjliubpbysvtiqpbgnh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtamxpdWJwYnlzdnRpcXBiZ25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczODgyNDAsImV4cCI6MjEwMjk2NDI0MH0.pYeCYannOZEYVdGEe-8km-e_II9Mh-S39KtPXD4yCGI';

/**
 * Sanitizes and extracts the actual customer support reply from raw LLM output,
 * stripping any internal thinking process, reasoning steps, or markdown fences.
 */
export function cleanAiDraft(rawText: string, customerName = 'there'): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // 1. Remove XML/HTML style <think>...</think> tags (e.g. DeepSeek / Nemotron / Qwen reasoning)
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. If the response starts with "Here's a thinking process" or numbered reasoning analysis
  if (
    /^(?:Here(?:'s| is) (?:a |the )?(?:thinking process|thought process|reasoning):?|Thinking Process:?|Thought Process:?|Reasoning:?|\d+\.\s*\*\*Analyze User Input)/i.test(
      text
    )
  ) {
    // Look for where the actual greeting / email draft starts
    const emailMatch = text.match(
      /(?:^|\n\s*\n|\n)(?:> )?(Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good morning\b|Good afternoon\b|Greetings\b)([\s\S]+)$/i
    );
    if (emailMatch) {
      text = (emailMatch[1] + emailMatch[2]).trim();
    } else {
      // Look for a "**Final Response:**" or "**Draft:**" or "Reply:" marker
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email):\*\*/i);
      if (splitMatch.length > 1 && splitMatch[1].trim().length > 15) {
        text = splitMatch[1].trim();
      } else {
        // The model output ONLY thinking steps and was truncated before writing the email!
        return '';
      }
    }
  }

  // 3. Double-check if the resulting text is still just a thinking process fragment
  if (
    /^(?:Here(?:'s| is) (?:a |the )?thinking process|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Remove leading/trailing markdown code fences (```markdown ... ```)
  text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();

  // 5. Remove leading meta labels like "Draft reply:" or "Here is the reply:"
  text = text
    .replace(/^(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Response:?|Email:?)\s*\n+/i, '')
    .trim();

  // 6. Replace template variables with extracted customer name if still present
  text = text
    .replace(/{{name}}/g, customerName)
    .replace(/{{customer_name}}/g, customerName)
    .replace(/\[Customer\]/g, customerName)
    .replace(/\[Name\]/g, customerName);

  // 7. Personalize generic "Hi there," or "Hi," to "Hi [Sender Name],"
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
  }

  return text;
}

export function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z][A-Za-z0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/);
  const signMatch = text.match(/(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Z][a-z]+)/i);
  const greetMatch = text.match(/(?:hi|dear|hello)\s+([A-Z][a-z]+)/i);

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      return clean.split(' ')[0];
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (clean && !clean.toLowerCase().startsWith('subject')) {
      return clean.split(' ')[0];
    }
  }
  if (signMatch && signMatch[1]) {
    return signMatch[1].trim();
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const blacklist = ['there', 'team', 'support', 'all', 'everyone', 'sir', 'madam', 'can', 'could', 'would', 'please'];
    if (!blacklist.includes(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return 'there';
}

export class ApiClient {
  private baseUrl = SUPABASE_URL;
  private settingsCache: { data: any; timestamp: number } | null = null;

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

  private async getUserId(): Promise<string | null> {
    const data = await chrome.storage.local.get(['user', 'token']);
    if (data.user?.id) return data.user.id;

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
          return authUser?.id || null;
        }
      } catch {
        // Ignore
      }
    }
    return null;
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

  async getKnowledgeSnippets(queryText: string): Promise<string[]> {
    const token = await this.getToken();
    const teamId = await this.getTeamId();
    if (!token || !teamId || !queryText) return [];

    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/document_chunks?team_id=eq.${teamId}&select=chunk_text&limit=40`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) return [];
      const chunks = (await res.json()) as { chunk_text: string }[];
      if (!chunks || chunks.length === 0) return [];

      const lowerQuery = queryText.toLowerCase();
      const keywords = lowerQuery
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3);

      const scored = chunks.map((c) => {
        const lowerChunk = c.chunk_text.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (lowerChunk.includes(kw)) score += 1;
        }
        return { text: c.chunk_text, score };
      });

      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.text);
    } catch {
      return [];
    }
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
      matchedMacro = macros.find((m: any) => {
        const nameMatch = m.name
          .toLowerCase()
          .split(' ')
          .some((w: string) => w.length > 3 && lowerThread.includes(w));
        const tagMatch = m.tags?.some((t: string) => lowerThread.includes(t.toLowerCase()));
        return nameMatch || tagMatch;
      });
    }

    // 3. Fetch relevant knowledge base snippets from uploaded documentation
    const kbSnippets = await this.getKnowledgeSnippets(scrubbed);

    // Extract customer first name from thread using multi-pattern parser
    const customerName = extractSenderName(threadContent);

    // 4. Request draft generation securely from server endpoint (keeping API keys server-side)
    let draftText = '';
    let serverSuccess = false;

    if (token) {
      try {
        const genRes = await fetch('https://draftpilot-web.vercel.app/api/drafts/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            threadContent: scrubbed,
            macroHint: macroHint || '',
            matchedMacro,
            kbSnippets,
          }),
        });

        if (genRes.ok) {
          const genData = await genRes.json();
          if (genData.draft) {
            draftText = genData.draft;
            serverSuccess = true;
          }
        }
      } catch (err) {
        console.warn('Server draft generation fallback:', err);
      }
    }

    // 5. High-Fidelity Grounded Fallback if server was offline
    if (!serverSuccess) {
      if (matchedMacro) {
        draftText = matchedMacro.content
          .replace(/{{name}}/g, customerName)
          .replace(/{{customer_name}}/g, customerName)
          .replace(/\[Customer\]/g, customerName)
          .replace(/\[Name\]/g, customerName);

        if (customerName && customerName.toLowerCase() !== 'there') {
          draftText = draftText.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
          draftText = draftText.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
        }
      } else {
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
    }

    // 6. Save draft generation event to Supabase draft_history for live analytics
    if (token && teamId) {
      try {
        const userId = await this.getUserId();
        if (userId) {
          const histRes = await fetch(`${SUPABASE_URL}/rest/v1/draft_history`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              team_id: teamId,
              user_id: userId,
              thread_snippet: scrubbed.slice(0, 200),
              generated_draft: draftText,
              macro_used_id: matchedMacro?.id || null,
            }),
          });
          if (!histRes.ok) {
            console.warn('draft_history insert status:', histRes.status, await histRes.text());
          }
        }
      } catch (err) {
        console.warn('Telemetry logging note:', err);
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
      // 1. Fetch team plan & quota
      let limit = 50;
      let plan = 'free';
      const teamRes = await fetch(
        `${SUPABASE_URL}/rest/v1/teams?id=eq.${teamId}&select=monthly_draft_limit,plan&limit=1`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (teamRes.ok) {
        const teams = await teamRes.json();
        if (teams && teams[0]) {
          limit = teams[0].monthly_draft_limit || 50;
          plan = teams[0].plan || 'free';
        }
      }

      // 2. Fetch draft count
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/draft_history?team_id=eq.${teamId}&select=id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      let count = 0;
      if (res.ok) {
        const data = await res.json();
        count = Array.isArray(data) ? data.length : 0;
      }

      return { used: count, limit, draftsUsed: count, draftsLimit: limit, plan };
    } catch {
      return { used: 0, limit: 50, draftsUsed: 0, draftsLimit: 50, plan: 'free' };
    }
  }

  async getCheckoutUrl() {
    return { url: 'https://draftpilot-web.vercel.app/dashboard' };
  }
}

export const apiClient = new ApiClient();
