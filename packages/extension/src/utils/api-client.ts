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

  // 1. Remove XML/HTML style <think> tags (handles both closed <think>...</think> and unclosed truncated <think>...)
  text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();

  // 2. If the response starts with "Here's a thinking process" or numbered reasoning analysis
  if (
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning):?(?:\*\*)?|\d+\.\s*\*\*Analyze User Input)/i.test(
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
      const splitMatch = text.split(/(?:\*\*|#{1,4}\s*)?(?:Final Response|Reply|Draft|Email|Response):?(?:\*\*)?/i);
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
    /^(?:(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is) (?:a |the )?)?(?:thinking process|thought process|reasoning)|\d+\.\s*\*\*Analyze User Input)/i.test(text) ||
    text.startsWith('1.  **Analyze') ||
    text.startsWith('1. **Analyze')
  ) {
    return '';
  }

  // 4. Robust Code Fence & Wrapper Removal (handles preambles and postscripts)
  const fullWrapperMatch = text.match(/^```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```$/i);
  if (fullWrapperMatch) {
    text = fullWrapperMatch[1].trim();
  } else {
    const codeBlockMatch = text.match(/```(?:markdown|text|email)?\s*\n([\s\S]*?)\n```/i);
    if (codeBlockMatch && codeBlockMatch[1].trim().length > 10) {
      const prefix = text.slice(0, codeBlockMatch.index).trim();
      const innerContent = codeBlockMatch[1].trim();
      const prefixHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(prefix);
      const innerHasGreeting = /^(?:> )?(?:Hi\b|Hello\b|Dear\b|Thank you\b|Thanks\b|Good\s+(?:morning|afternoon|evening)\b|Greetings\b)/im.test(innerContent);
      const prefixIsPreamble = /^(?:\*\*|\*|#{1,4}\s*)?(?:Here(?:'s| is)|Draft|Suggested|Email|Response)\b/i.test(prefix);

      if (!prefixHasGreeting && (prefixIsPreamble || innerHasGreeting)) {
        text = innerContent;
      } else {
        text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
      }
    } else {
      text = text.replace(/^```(?:markdown|text|email)?\s*\n?/i, '').replace(/\n?```$/i, '').trim();
    }
  }

  // 5. Remove Meta Headers & Label Lines (handles multiple stacked headers)
  let prevText = '';
  while (prevText !== text) {
    prevText = text;
    text = text
      .replace(
        /^(?:\*\*|\*|#{1,4}\s*)?(?:Here is (?:the|a) (?:draft|reply|response|suggested reply):?|Draft reply:?|Draft:?|Response:?|(?:Subject|Re):\s*[^\n]*|Email:?|Suggested Reply:?|Thinking Process:?|Thought Process:?|Reasoning:?)(?:\*\*)?\s*\n+/i,
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
    text = text.replace(
      /^(?:Hi|Hello|Dear|Hey|Good\s+(?:morning|afternoon|evening)|Greetings)\b(?:[,\t ]+(?:(?:(?:mr|mrs|ms|miss|dr|prof)\.?\s+)?[A-Z\u00C0-\u024F][A-Za-z\u00C0-\u024F]*(?:[-'· \t][A-Z\u00C0-\u024F][A-Za-z\u00C0-\u024F]*)*|\[[^\]]+\]|there|customer|user|client)(?=[\t ]*[,!:]|[\r\n]|$))?[\t ]*[,!:]?/im,
      `Hi ${customerName},`
    );
  } else {
    text = text.replace(/^(?:Hi|Hello|Dear|Hey)\s+\[Name\],/im, 'Hi there,');
    text = text.replace(/^(?:Hi|Hello|Dear|Hey)\s+\[Customer\],/im, 'Hi there,');
  }

  return text;
}

export function synthesizeSmartSupportDraft(
  promptOrThread: string,
  customerName = 'there',
  kbSnippets: string[] = [],
  macroHint = ''
): string {
  const lower = (promptOrThread || '').toLowerCase();
  const name = customerName && customerName.toLowerCase() !== 'there' ? customerName : 'there';

  // Extract Knowledge Base facts (URLs, phone numbers, clean excerpts)
  let kbFact = '';
  if (kbSnippets && kbSnippets.length > 0) {
    const urls = Array.from(new Set(kbSnippets.flatMap((s) => s.match(/https?:\/\/[^\s)]+/g) || [])));
    const phoneMatches = Array.from(
      new Set(
        kbSnippets.flatMap(
          (s) => s.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,9}/g) || []
        )
      )
    ).filter((p) => p.replace(/\D/g, '').length >= 8);

    if (urls.length > 0 && phoneMatches.length > 0) {
      kbFact = `For more details and direct access, please visit ${urls[0]} or contact our team at ${phoneMatches[0]}.`;
    } else if (urls.length > 0) {
      kbFact = `For additional details and self-service resources, you can visit ${urls[0]}.`;
    } else if (phoneMatches.length > 0) {
      kbFact = `If you need immediate assistance, please feel free to reach our team at ${phoneMatches[0]}.`;
    } else {
      const firstSnippet = kbSnippets.find((s) => s && s.trim().length > 10);
      if (firstSnippet) {
        const cleanSnippet = firstSnippet
          .replace(/^(?:###|#|\*\*).*\n*/gm, '')
          .replace(/\n+/g, ' ')
          .trim();
        if (cleanSnippet.length > 15) {
          const excerpt = cleanSnippet.length > 180 ? cleanSnippet.slice(0, 177) + '...' : cleanSnippet;
          kbFact = `As noted in our documentation: ${excerpt}`;
        }
      }
    }
  }

  // Extract custom guidance / macroHint instructions
  let hintParagraph = '';
  const trimmedHint = (macroHint || '').trim();
  if (trimmedHint) {
    const formatted = trimmedHint.endsWith('.') || trimmedHint.endsWith('!') ? trimmedHint : `${trimmedHint}.`;
    hintParagraph = `Please note: ${formatted}`;
  }

  const extras: string[] = [];
  if (kbFact) extras.push(kbFact);
  if (hintParagraph) extras.push(hintParagraph);
  const extraBlock = extras.length > 0 ? `\n\n${extras.join('\n\n')}` : '';

  // 1. Refund & Return intent
  if (lower.includes('refund') || lower.includes('return') || lower.includes('money back')) {
    return `Hi ${name},\n\nThank you for reaching out to us. I completely understand and would be glad to help you with your return and refund request.\n\nI have located your account and initiated the refund process in accordance with our return policy. You should see the credit reflected on your original payment method within 3–5 business days.${extraBlock}\n\nPlease don't hesitate to reach out if you have any questions in the meantime!\n\nBest regards,\nCustomer Support Team`;
  }

  // 2. Order Status & Shipping intent
  if (
    lower.includes('track') ||
    lower.includes('shipping') ||
    lower.includes('where is my order') ||
    lower.includes('where is') ||
    lower.includes('delivery') ||
    lower.includes('delay') ||
    lower.includes('package')
  ) {
    return `Hi ${name},\n\nThanks for checking in on your order status!\n\nYour shipment is on track and moving smoothly with our carrier. You can view real-time tracking milestone updates directly using the link in your original confirmation email.${extraBlock}\n\nIf you encounter any transit delays or need address adjustments, just let me know and I will be happy to assist.\n\nWarm regards,\nCustomer Support Team`;
  }

  // 3. Password / Account Access intent
  if (
    lower.includes('password') ||
    lower.includes('login') ||
    lower.includes('2fa') ||
    lower.includes('account') ||
    lower.includes('locked') ||
    lower.includes('reset') ||
    lower.includes('sign in')
  ) {
    return `Hi ${name},\n\nThank you for contacting support regarding your account access.\n\nI've generated a secure password reset link for you. For your protection, please make sure you are clicking the link from your registered device. If two-factor authentication (2FA) is enabled, have your authenticator app ready.${extraBlock}\n\nLet us know if you need any additional guidance getting back into your account!\n\nBest regards,\nCustomer Support Team`;
  }

  // 4. Billing / Invoice intent
  if (
    lower.includes('invoice') ||
    lower.includes('receipt') ||
    lower.includes('charge') ||
    lower.includes('card') ||
    lower.includes('billing') ||
    lower.includes('subscription') ||
    lower.includes('payment')
  ) {
    return `Hi ${name},\n\nThank you for contacting our billing department.\n\nI've reviewed your account history and confirmed your recent billing statement. You can download an itemized PDF copy of all past invoices anytime directly from your account billing portal.${extraBlock}\n\nIf you'd like to update your payment method or need a custom VAT/tax invoice, feel free to reply and I'll take care of it immediately.\n\nBest regards,\nCustomer Support Team`;
  }

  // 5. Technical Troubleshooting intent
  if (
    lower.includes('error') ||
    lower.includes('bug') ||
    lower.includes('crash') ||
    lower.includes('issue') ||
    lower.includes('not working') ||
    lower.includes('broken') ||
    lower.includes('failed') ||
    lower.includes('troubleshoot') ||
    lower.includes('glitch')
  ) {
    return `Hi ${name},\n\nThank you for reaching out regarding the issue you are experiencing. I apologize for the inconvenience this has caused.\n\nTo help resolve this quickly, could you please try clearing your browser cache or testing in an incognito window? If the issue persists, please reply with any relevant error codes, screenshots, or the exact steps to reproduce the problem so our technical team can investigate immediately.${extraBlock}\n\nWe appreciate your patience and look forward to getting this sorted out for you!\n\nBest regards,\nCustomer Support Team`;
  }

  // 6. Partnership & Collaboration intent
  if (
    lower.includes('partner') ||
    lower.includes('collaboration') ||
    lower.includes('collaborate') ||
    lower.includes('affiliate') ||
    lower.includes('sponsor')
  ) {
    return `Hi ${name},\n\nThank you for reaching out and for your interest in partnering with us! We are always excited to explore new collaboration opportunities.\n\nCould you please share a bit more detail about your organization, your audience, and what kind of partnership structure you have in mind? I'll make sure this gets routed directly to our partnerships team.${extraBlock}\n\nLooking forward to hearing from you,\nCustomer Support Team`;
  }

  // 7. Default General Support Reply
  return `Hi ${name},\n\nThank you for getting in touch with us! I have reviewed your inquiry and would be glad to assist you.\n\nCould you please provide a few more details so I can resolve this as quickly as possible for you?${extraBlock}\n\nLooking forward to hearing back from you,\nCustomer Support Team`;
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
  'greetings',
  'morning',
  'afternoon',
  'evening',
  'folks',
  'colleague',
  'colleagues',
  'i',
  'we',
  'my',
  'our',
  'thank',
  'just',
];

export function extractSenderName(text: string): string {
  if (!text) return 'there';
  const fromMatch = text.match(/(?:from|sender):\s*([^<\n\r]+?)(?:<|\n|$)/i);
  const lineAngleMatch = text.match(/(?:^|\n)([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F0-9\s._-]{1,40}?)\s*<[^>\n\r]+>/i);
  const signMatch = text.match(
    /(?:thanks|regards|cheers|best|sincerely|thank you),?\s*\n+([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)/i
  );
  const greetMatch = text.match(
    /(?:hi|hello|dear|hey|good\s+(?:morning|afternoon|evening|day)|greetings),?[^\S\r\n]+(?:(?:mr|mrs|ms|miss|dr|prof)\.?[^\S\r\n]+)?([A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*(?:\s*[/]\s*[A-Za-z\u00C0-\u024F]+(?:[-'·][A-Za-z\u00C0-\u024F]+)*)?)/i
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
    let serverRecorded = false;
    let draftSource: 'openrouter' | 'macro' | 'template' = 'template';
    let draftNotice: string | undefined = undefined;

    if (token) {
      try {
        const candidateUrls: string[] = [];
        if (this.webUrl) candidateUrls.push(`${this.webUrl}/api/drafts/generate`);
        if (!candidateUrls.includes('https://draftpilot-web.vercel.app/api/drafts/generate')) {
          candidateUrls.push('https://draftpilot-web.vercel.app/api/drafts/generate');
        }
        candidateUrls.push('http://localhost:3000/api/drafts/generate');
        candidateUrls.push('http://localhost:3001/api/drafts/generate');
        candidateUrls.push('http://127.0.0.1:3000/api/drafts/generate');
        candidateUrls.push('http://127.0.0.1:3001/api/drafts/generate');

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
              signal: AbortSignal.timeout(12000),
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
            serverRecorded = Boolean(genData.draftRecorded);
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

    // 5. Client-Side OpenRouter Generation (Direct AI Fallback if server was offline or unreachable)
    if (!serverSuccess && token) {
      try {
        const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_settings?select=*&limit=1`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (settingsRes.ok) {
          const settingsArr = await settingsRes.json();
          const settings = settingsArr && settingsArr[0] ? settingsArr[0] : null;
          const openrouterApiKey = settings?.openrouter_api_key?.trim();

          if (openrouterApiKey) {
            const activeModel = settings?.selected_model || settings?.openrouter_model || 'z-ai/glm-5.3-flash';
            const candidateModels = [activeModel, 'z-ai/glm-5.3-flash', 'google/gemma-4-26b-a4b-it:free', 'meta-llama/llama-3.1-8b-instruct:free'].filter(
              (m, i, arr) => arr.indexOf(m) === i
            );

            let knowledgeContext = '';
            if (matchedMacro?.content) {
              knowledgeContext += `### Recommended Support Macro & Policy:\n${matchedMacro.content}\n\n`;
            }
            if (kbSnippets.length > 0) {
              knowledgeContext += `### Knowledge Base & Documentation Context:\n${kbSnippets.join('\n---\n')}\n\n`;
            }
            let agentGuidanceContext = '';
            if (macroHint?.trim()) {
              agentGuidanceContext = `### Agent Guidance / Custom Instruction:\n${macroHint.trim()}\n\n`;
            }

            const baseSystemPrompt = settings?.system_prompt?.trim() || 'You are DraftPilot, an intelligent customer support assistant.';
            const strictSystemPrompt = `${baseSystemPrompt}\n\nCRITICAL INSTRUCTIONS:\n1. Output ONLY the raw final email reply text ready to send.\n2. Absolutely DO NOT output any thinking process, analysis, reasoning steps, or markdown bullets.\n3. Start directly with "Hi ${customerName}," and end with "Best regards,\\nCustomer Support Team".\n4. Do NOT wrap in markdown code blocks.`;
            const userPrompt = `Customer Message:\n${scrubbed}\n\n${knowledgeContext}${agentGuidanceContext}Write the clean, direct customer email reply now:`;

            for (const modelToTry of candidateModels) {
              try {
                const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${openrouterApiKey}`,
                    'HTTP-Referer': 'https://draftpilot-web.vercel.app',
                    'X-Title': 'DraftPilot',
                  },
                  body: JSON.stringify({
                    model: modelToTry,
                    messages: [
                      { role: 'system', content: strictSystemPrompt },
                      { role: 'user', content: userPrompt },
                    ],
                    max_tokens: Number(settings?.max_tokens) || 1000,
                    temperature: Number(settings?.temperature) || 0.4,
                  }),
                  signal: AbortSignal.timeout(15000),
                });

                if (orRes.ok) {
                  const orData = await orRes.json();
                  const raw = orData?.choices?.[0]?.message?.content;
                  const cleaned = cleanAiDraft(raw || '', customerName);
                  if (cleaned && cleaned.length > 15) {
                    draftText = cleaned;
                    serverSuccess = true;
                    draftSource = 'openrouter';
                    draftNotice = undefined;
                    break;
                  }
                }
              } catch (orErr) {
                console.warn(`Direct OpenRouter model ${modelToTry} attempt note:`, orErr);
              }
            }
          }
        }
      } catch (clientAiErr) {
        console.warn('Client-side OpenRouter fallback note:', clientAiErr);
      }
    }

    // 6. Grounded Macro / Template Synthesizer if both server and direct AI were unavailable
    if (!serverSuccess) {
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
        draftNotice = 'DraftPilot AI generation unavailable. Generated using fallback template.';
        draftText = synthesizeSmartSupportDraft(scrubbed, customerName, kbSnippets, macroHint || '');
      }
    }

    // Ensure draftText is thoroughly sanitized before saving to telemetry or returning to client
    draftText = cleanAiDraft(draftText, customerName);
    if (!draftText && !matchedMacro) {
      draftSource = 'template';
      draftNotice = 'AI response was invalid or contained only reasoning artifacts. Generated using fallback template.';
      draftText = synthesizeSmartSupportDraft(scrubbed, customerName, kbSnippets, macroHint || '');
    }

    // 7. Guarantee draft event is recorded in draft_history and monthly usage table
    if (token && teamId && !serverRecorded) {
      try {
        const userId = await this.getUserId();
        let recordSuccess = false;

        const recordUrls: string[] = [];
        if (this.webUrl) recordUrls.push(`${this.webUrl}/api/drafts/record`);
        if (!recordUrls.includes('https://draftpilot-web.vercel.app/api/drafts/record')) {
          recordUrls.push('https://draftpilot-web.vercel.app/api/drafts/record');
        }
        recordUrls.push('http://localhost:3000/api/drafts/record');
        recordUrls.push('http://localhost:3001/api/drafts/record');
        recordUrls.push('http://127.0.0.1:3000/api/drafts/record');
        recordUrls.push('http://127.0.0.1:3001/api/drafts/record');

        for (const rUrl of recordUrls) {
          try {
            const rRes = await fetch(rUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                teamId,
                userId,
                threadSnippet: scrubbed.slice(0, 200),
                generatedDraft: draftText,
                macroUsedId: matchedMacro?.id || null,
              }),
              signal: AbortSignal.timeout(5000),
            });
            if (rRes.ok) {
              recordSuccess = true;
              break;
            }
          } catch {}
        }

        // Direct Supabase fallback if server record endpoint was unreachable
        if (!recordSuccess && userId) {
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
              user_id: userId,
              thread_snippet: scrubbed.slice(0, 200),
              generated_draft: draftText,
              macro_used_id: matchedMacro?.id || null,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Telemetry logging note:', err);
      }
    }

    // 8. Record heartbeat pairing telemetry on draft generation
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

      // 2. Fetch draft count from server metrics endpoint first
      let count = 0;
      try {
        const metricUrls = [`${this.webUrl}/api/dashboard/metrics`];
        if (!metricUrls.includes('https://draftpilot-web.vercel.app/api/dashboard/metrics')) {
          metricUrls.push('https://draftpilot-web.vercel.app/api/dashboard/metrics');
        }
        metricUrls.push('http://localhost:3000/api/dashboard/metrics');
        metricUrls.push('http://localhost:3001/api/dashboard/metrics');

        for (const mUrl of metricUrls) {
          try {
            const mRes = await fetch(mUrl, {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(3000),
            });
            if (mRes.ok) {
              const mData = await mRes.json();
              if (mData.draftsCount !== undefined && mData.draftsCount !== null) {
                count = mData.draftsCount;
                if (mData.monthlyLimit) limit = mData.monthlyLimit;
                if (mData.teamPlan) plan = mData.teamPlan;
                return { used: count, limit, draftsUsed: count, draftsLimit: limit, plan };
              }
            }
          } catch {}
        }
      } catch {}

      // 3. Fallback: Fetch draft count from draft_history REST API
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/draft_history?team_id=eq.${teamId}&select=id`,
        {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
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
