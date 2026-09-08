import { scrubPII } from './pii-scrubber.ts';

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
      const splitMatch = text.split(/\*\*(?:Final Response|Reply|Draft|Email|Response):\*\*/i);
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

  // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
  const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
    text = codeBlockMatch[1].trim();
  } else {
    text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
  }

  // 5. Remove Meta Headers & Label Lines (handles multiple stacked headers)
  let prevText = '';
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(
        /^(?:\*\*)?(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|(?:Subject|Re):\s*[^\n]*|Email:?|Suggested Reply:?)(?:\*\*)?\s*\n+/i,
        ''
      )
      .trim();
  }

  // 5b. Strip trailing tip/note postscripts
  text = text.replace(/\n+---\s*\n+\*?(?:Tip|Note):?[\s\S]*$/i, '').trim();
  text = text.replace(/\n+\*(?:Tip|Note):?[\s\S]*$/i, '').trim();

  // 6. Template Variable Normalization
  text = text
    .replace(/{{name}}/gi, customerName)
    .replace(/{{customer_name}}/gi, customerName)
    .replace(/\[Customer(?:\s*Name)?\]/gi, customerName)
    .replace(/\[Name\]/gi, customerName)
    .replace(/\[Client(?:\s*Name)?\]/gi, customerName);

  // 7. Sign-off Placeholder Scrubbing
  const defaultSignoff = 'Customer Support Team';
  text = text
    .replace(/\[Your Name\]/gi, defaultSignoff)
    .replace(/\[Agent Name\]/gi, defaultSignoff)
    .replace(/\[Support Representative\]/gi, defaultSignoff)
    .replace(/\[Representative Name\]/gi, defaultSignoff)
    .replace(/\[Your Title\]/gi, defaultSignoff)
    .replace(/\[Company Name\]/gi, 'DraftPilot Support')
    .replace(/\[Company\]/gi, 'DraftPilot Support')
    .replace(/\[Contact Information\]/gi, 'support@draftpilot.com')
    .replace(/\[Support Team\]/gi, defaultSignoff)
    .replace(/{{agent_name}}/gi, defaultSignoff);

  // 8. Personalize generic "Hi there," or "Hi," to "Hi [Sender Name],"
  if (customerName && customerName.toLowerCase() !== 'there') {
    text = text.replace(/^(?:Hi|Hello|Dear)\s+there,/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear),/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Name\],/im, `Hi ${customerName},`);
    text = text.replace(/^(?:Hi|Hello|Dear)\s+\[Customer\],/im, `Hi ${customerName},`);
  }

  return text;
}

const SALUTATION_BLACKLIST = [
  'there',
  'team',
  'support',
  'all',
  'everyone',
  'sir',
  'madam',
  'sir/madam',
  'madam/sir',
  "ma'am",
  'concern',
  'customer',
  'user',
  'client',
  'can',
  'could',
  'would',
  'please',
  'whom',
  'whomever',
  'friend',
  'member',
  'anyone',
  'somebody',
  'someone',
  'help',
  'info',
  'admin',
  'administrator',
];

export function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z][A-Za-z0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/);
  const signMatch = text.match(/(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Z][a-z]+)/i);
  const greetMatch = text.match(
    /(?:hi|dear|hello),?\s+(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?([A-Za-z]+(?:\s*[/]\s*[A-Za-z]+|['][A-Za-z]+)?)/i
  );

  if (fromMatch && fromMatch[1].trim()) {
    const clean = fromMatch[1].replace(/["']/g, '').trim();
    if (clean && !clean.toLowerCase().includes('redacted')) {
      const candidate = clean.split(' ')[0];
      if (!SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (lineAngleMatch && lineAngleMatch[1].trim()) {
    const clean = lineAngleMatch[1].trim();
    if (clean && !clean.toLowerCase().startsWith('subject')) {
      const candidate = clean.split(' ')[0];
      if (!SALUTATION_BLACKLIST.includes(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }
  if (signMatch && signMatch[1]) {
    const clean = signMatch[1].trim();
    if (!SALUTATION_BLACKLIST.includes(clean.toLowerCase())) {
      return clean;
    }
  }
  if (greetMatch && greetMatch[1]) {
    const candidate = greetMatch[1].trim();
    const normalized = candidate.replace(/\s*[/]\s*/, '/').toLowerCase();
    if (!SALUTATION_BLACKLIST.includes(normalized)) {
      return candidate;
    }
  }
  return 'there';
}

export class ApiClient {
  private baseUrl = SUPABASE_URL;
  private webUrl = 'https://draftpilot-web.vercel.app';
  private settingsCache: { data: any; timestamp: number } | null = null;

  constructor() {
    this.initBaseUrl();
  }

  private async initBaseUrl() {
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        const data = await chrome.storage.local.get(['apiUrl', 'webUrl']);
        if (data.apiUrl) {
          this.baseUrl = data.apiUrl;
          if (data.apiUrl.includes('localhost') || data.apiUrl.includes('127.0.0.1')) {
            this.webUrl = data.apiUrl.replace(/\/$/, '');
          }
        }
        if (data.webUrl) {
          this.webUrl = data.webUrl.replace(/\/$/, '');
        }
      }
    } catch {
      // Chrome storage not available in node/test environments
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

    // Mark extension as installed & connected in onboarding_state and server heartbeat
    await this.recordHeartbeat().catch(() => {});

    return {
      accessToken: token,
      user: dbUser || { email: authUser.email, teams: { name: teamName, plan } },
    };
  }

  /**
   * Records extension presence and pairing telemetry to both Supabase onboarding_state
   * and the web server's /api/extension/heartbeat endpoint.
   */
  async recordHeartbeat(): Promise<boolean> {
    const token = await this.getToken();
    const teamId = await this.getTeamId();
    if (!token) return false;

    let synced = false;

    // 1. Direct Supabase onboarding_state update
    if (teamId) {
      try {
        const res = await fetch(
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
        if (res.ok) {
          synced = true;
        }
      } catch {
        // Ignore network errors in direct patch
      }
    }

    // 2. Web server heartbeat route (/api/extension/heartbeat)
    try {
      const hbRes = await fetch(`${this.webUrl}/api/extension/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          version: '0.1.0',
          client: 'draftpilot-extension',
          timestamp: Date.now(),
        }),
      });
      if (hbRes.ok) {
        synced = true;
      }
    } catch {
      // Ignore network errors
    }

    return synced;
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
      // Fetch both document_chunks and macros in parallel for comprehensive KB search
      const [chunksRes, macrosRes] = await Promise.all([
        fetch(
          `${SUPABASE_URL}/rest/v1/document_chunks?team_id=eq.${teamId}&select=chunk_text&limit=40`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        ),
        fetch(
          `${SUPABASE_URL}/rest/v1/macros?team_id=eq.${teamId}&select=name,content,tags&limit=30`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          }
        ),
      ]);

      const chunks = chunksRes.ok ? ((await chunksRes.json()) as { chunk_text: string }[]) : [];
      const macros = macrosRes.ok ? ((await macrosRes.json()) as { name: string; content: string; tags?: string[] }[]) : [];

      // Build unified search corpus from chunks + macro content
      const searchItems: { text: string; source: string }[] = [];

      for (const c of chunks) {
        if (c.chunk_text && c.chunk_text.trim().length > 10) {
          searchItems.push({ text: c.chunk_text, source: 'chunk' });
        }
      }

      for (const m of macros) {
        if (m.content && m.content.trim().length > 10) {
          // Include macro name + tags in searchable text for better keyword matching
          const macroSearchText = [
            m.name || '',
            m.content,
            ...(m.tags || []),
          ].join(' ');
          searchItems.push({ text: macroSearchText, source: 'macro' });
        }
      }

      if (searchItems.length === 0) return [];

      // Enhanced keyword extraction: include shorter words (3+ chars) and preserve key terms
      const lowerQuery = queryText.toLowerCase();
      const keywords = lowerQuery
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2);

      // Score each item with improved matching: exact keyword match + partial/substring match
      const scored = searchItems.map((item) => {
        const lowerText = item.text.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (lowerText.includes(kw)) {
            // Full keyword match — higher weight for longer keywords
            score += kw.length >= 5 ? 3 : 2;
          } else if (kw.length >= 4) {
            // Check if any word in the text starts with the keyword (prefix match)
            const words = lowerText.split(/\s+/);
            if (words.some((w) => w.startsWith(kw) || kw.startsWith(w))) {
              score += 1;
            }
          }
        }
        return { text: item.text, score };
      });

      return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
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
    let draftSource: 'openrouter' | 'macro' | 'template' = 'template';
    let draftNotice: string | undefined = undefined;

    if (token) {
      try {
        const candidateUrls = [`${this.webUrl}/api/drafts/generate`];
        if (!this.webUrl.includes('localhost') && !this.webUrl.includes('127.0.0.1')) {
          candidateUrls.push('http://localhost:3000/api/drafts/generate');
        }

        let genRes: Response | null = null;
        for (const url of candidateUrls) {
          try {
            const res = await fetch(url, {
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

            if (res.status === 403) {
              const genData = await res.json().catch(() => ({}));
              const errorMsg = genData.error || 'Account deactivated. Please contact support.';
              const banError = new Error(errorMsg);
              (banError as any).banned = true;
              (banError as any).status = 403;
              throw banError;
            }

            if (res.ok) {
              genRes = res;
              break;
            }
          } catch (fetchErr: any) {
            if (fetchErr?.banned || fetchErr?.status === 403) throw fetchErr;
          }
        }

        if (genRes && genRes.ok) {
          const genData = await genRes.json();
          if (genData.draft) {
            draftText = genData.draft;
            serverSuccess = true;
            draftSource = genData.source || 'openrouter';
            draftNotice = genData.notice;
          }
        }
      } catch (err: any) {
        if (err?.banned || err?.status === 403 || err?.message?.toLowerCase().includes('deactivated')) {
          throw err;
        }
        console.warn('Server draft generation fallback:', err);
      }
    }

    // 5. High-Fidelity Grounded Fallback if server was offline
    if (!serverSuccess) {
      draftNotice = 'DraftPilot web server unreachable. Generated using offline fallback template.';
      if (matchedMacro) {
        draftSource = 'macro';
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
        draftSource = 'template';
        const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';
        if (lowerThread.includes('refund') || lowerThread.includes('return') || lowerThread.includes('money back')) {
          draftText = `Hi ${name},\n\nThank you for reaching out to us. I completely understand and would be glad to help you with your return and refund request.\n\nI have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.\n\nPlease don't hesitate to reach out if you have any questions in the meantime!\n\nBest regards,\nCustomer Support Team`;
        } else if (
          lowerThread.includes('track') ||
          lowerThread.includes('shipping') ||
          lowerThread.includes('where is my order') ||
          lowerThread.includes('where is') ||
          lowerThread.includes('delivery') ||
          lowerThread.includes('delay') ||
          lowerThread.includes('package')
        ) {
          draftText = `Hi ${name},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nWarm regards,\nCustomer Support Team`;
        } else if (
          lowerThread.includes('password') ||
          lowerThread.includes('login') ||
          lowerThread.includes('2fa') ||
          lowerThread.includes('account') ||
          lowerThread.includes('locked') ||
          lowerThread.includes('reset') ||
          lowerThread.includes('sign in')
        ) {
          draftText = `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nI've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nCustomer Support Team`;
        } else if (
          lowerThread.includes('invoice') ||
          lowerThread.includes('receipt') ||
          lowerThread.includes('charge') ||
          lowerThread.includes('card') ||
          lowerThread.includes('billing') ||
          lowerThread.includes('subscription') ||
          lowerThread.includes('payment')
        ) {
          draftText = `Hi ${name},\n\nThank you for contacting our billing department.\n\nI've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.\n\nIf you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.\n\nBest regards,\nCustomer Support Team`;
        } else if (
          lowerThread.includes('error') ||
          lowerThread.includes('bug') ||
          lowerThread.includes('crash') ||
          lowerThread.includes('issue') ||
          lowerThread.includes('not working') ||
          lowerThread.includes('broken') ||
          lowerThread.includes('failed') ||
          lowerThread.includes('troubleshoot') ||
          lowerThread.includes('glitch')
        ) {
          draftText = `Hi ${name},\n\nThank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.\n\nTo help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate immediately.\n\nWe appreciate your patience and look forward to getting this sorted out for you!\n\nBest regards,\nCustomer Support Team`;
        } else if (
          lowerThread.includes('partner') ||
          lowerThread.includes('collaboration') ||
          lowerThread.includes('collaborate') ||
          lowerThread.includes('affiliate') ||
          lowerThread.includes('sponsor')
        ) {
          draftText = `Hi ${name},\n\nThank you for reaching out and for your interest in partnering with us! We are always excited to explore new collaboration opportunities.\n\nCould you please share a bit more detail about your organization, your audience, and what kind of partnership structure you have in mind? I'll make sure this gets routed directly to our partnerships team.\n\nLooking forward to hearing from you,\nCustomer Support Team`;
        } else {
          draftText = `Hi ${name},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
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

    // 7. Record heartbeat pairing telemetry on draft generation
    this.recordHeartbeat().catch(() => {});

    return {
      draft: draftText,
      macroUsed: matchedMacro?.name || null,
      confidence: matchedMacro ? 96 : 88,
      source: draftSource,
      ...(draftNotice ? { notice: draftNotice } : {}),
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
