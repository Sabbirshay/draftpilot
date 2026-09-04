import { checkBotId } from "botid/server";
import { NextResponse } from "next/server.js";
import type { NextRequest, NextFetchEvent } from "next/server.js";

/**
 * Supported headers for authorized automation bypass.
 * Prioritizes standard Vercel protection bypass and agent bypass token headers
 * before custom and legacy aliases.
 */
export const AUTOMATION_BYPASS_HEADERS = [
  "x-vercel-protection-bypass",
  "x-agent-bypass-token",
  "x-automation-bypass-secret",
  "x-botid-bypass-secret",
  "x-bypass-secret",
  "x-automation-bypass-token",
  "x-bypass-token",
  "x-automation-secret",
  "x-automation-bypass",
  "x-botid-bypass",
] as const;

/**
 * Supported cookies for authorized automation bypass.
 */
export const AUTOMATION_BYPASS_COOKIES = [
  "x-vercel-protection-bypass",
  "x-agent-bypass-token",
  "_vercel_jwt",
  "_vercel_protection_bypass",
  "x-automation-bypass-secret",
  "x-bypass-token",
  "x-bypass-secret",
] as const;

/**
 * Supported query parameters for authorized automation bypass.
 * Enables automation bypass for browsers, test runners, and webhooks
 * per Vercel's official Protection Bypass for Automation specification.
 */
export const AUTOMATION_BYPASS_QUERY_PARAMS = [
  "x-vercel-protection-bypass",
  "x-agent-bypass-token",
  "x-automation-bypass-secret",
  "bypass_token",
  "bypass-secret",
] as const;

/**
 * Strips surrounding single or double quotes and trims whitespace.
 * RFC 6265 allows cookie values to be enclosed in DQUOTE pairs: "cookie-value".
 * HTTP clients/headers may also enclose tokens in quotes.
 */
export function cleanToken(token: string): string {
  if (!token || typeof token !== "string") return "";
  let val = token.trim();
  if (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    val = val.slice(1, -1).trim();
  }
  return val;
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 * Uses XOR-accumulation over full length to avoid timing leakage.
 * Rejects oversized inputs (> 4096 chars) to prevent CPU starvation attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b) return false;

  const aLen = a.length;
  const bLen = b.length;

  // Sanity check against CPU exhaustion with multi-megabyte payloads
  if (aLen > 4096 || bLen > 4096) return false;

  const maxLen = Math.max(aLen, bLen);
  let result = aLen ^ bLen;

  for (let i = 0; i < maxLen; i++) {
    const charA = i < aLen ? a.charCodeAt(i) : 0;
    const charB = i < bLen ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}

/**
 * Resolves all configured automation bypass secrets from environment.
 * Evaluates VERCEL_AUTOMATION_BYPASS_SECRET, AGENT_BYPASS_TOKEN, and backwards-compatible aliases.
 */
export function getConfiguredBypassSecrets(): string[] {
  const candidates = [
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    process.env.AGENT_BYPASS_TOKEN,
    process.env.AUTOMATION_BYPASS_SECRET,
    process.env.BOTID_BYPASS_SECRET,
    process.env.AUTOMATION_BYPASS_TOKEN,
  ];

  const secrets: string[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const cleaned = cleanToken(trimmed);

    for (const sec of [cleaned, trimmed]) {
      if (sec.length > 0 && !secrets.includes(sec)) {
        secrets.push(sec);
      }
    }
  }

  return secrets;
}

/**
 * Resolves the primary configured automation bypass secret from environment.
 */
export function getConfiguredBypassSecret(): string | null {
  const secrets = getConfiguredBypassSecrets();
  return secrets.length > 0 ? secrets[0] : null;
}

/**
 * Verifies if the request carries a valid pre-shared secret token authorizing
 * BotID bypass for automated testing and auditing agents.
 * Supports standard bypass headers (x-vercel-protection-bypass, x-agent-bypass-token, etc.),
 * cookies (x-vercel-protection-bypass, _vercel_jwt, etc.), query parameters,
 * and Authorization Bearer / Token headers.
 */
export function isAuthorizedAutomationBypass(
  request: NextRequest,
  configuredSecret?: string | string[] | null
): boolean {
  let secrets: string[];
  if (configuredSecret !== undefined) {
    if (Array.isArray(configuredSecret)) {
      secrets = [];
      for (const s of configuredSecret) {
        if (typeof s === "string") {
          const trimmed = s.trim();
          const cleaned = cleanToken(trimmed);
          for (const item of [cleaned, trimmed]) {
            if (item.length > 0 && !secrets.includes(item)) {
              secrets.push(item);
            }
          }
        }
      }
    } else if (typeof configuredSecret === "string") {
      const trimmed = configuredSecret.trim();
      const cleaned = cleanToken(trimmed);
      secrets = [];
      for (const item of [cleaned, trimmed]) {
        if (item.length > 0 && !secrets.includes(item)) {
          secrets.push(item);
        }
      }
    } else {
      secrets = [];
    }
  } else {
    secrets = getConfiguredBypassSecrets();
  }

  // If no secret is configured on the server, reject all bypass attempts (fail-closed)
  if (secrets.length === 0) {
    return false;
  }

  const matchesAnySecret = (candidate: string): boolean => {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    const cleaned = cleanToken(trimmed);

    let decoded = trimmed;
    try {
      decoded = decodeURIComponent(trimmed);
    } catch {
      // Keep raw
    }
    const cleanedDecoded = cleanToken(decoded);

    for (const secret of secrets) {
      if (timingSafeEqual(trimmed, secret)) {
        return true;
      }
      if (cleaned !== trimmed && timingSafeEqual(cleaned, secret)) {
        return true;
      }
      if (decoded !== trimmed && timingSafeEqual(decoded, secret)) {
        return true;
      }
      if (
        cleanedDecoded !== decoded &&
        cleanedDecoded !== cleaned &&
        timingSafeEqual(cleanedDecoded, secret)
      ) {
        return true;
      }
    }
    return false;
  };

  // 1. Check candidate bypass headers
  for (const headerName of AUTOMATION_BYPASS_HEADERS) {
    let value = request.headers?.get?.(headerName);
    if (!value && request.headers && typeof (request.headers as any)[headerName] === "string") {
      value = (request.headers as any)[headerName];
    }
    if (value && typeof value === "string") {
      if (matchesAnySecret(value)) {
        return true;
      }
    }
  }

  // 2. Check candidate bypass cookies (supports getAll, get, and raw Cookie header)
  for (const cookieName of AUTOMATION_BYPASS_COOKIES) {
    // NextRequest cookies.getAll() if present
    const cookieList = request.cookies?.getAll?.(cookieName);
    if (cookieList && cookieList.length > 0) {
      for (const c of cookieList) {
        if (c?.value && typeof c.value === "string" && matchesAnySecret(c.value)) {
          return true;
        }
      }
    } else {
      const single = request.cookies?.get?.(cookieName)?.value;
      if (single && typeof single === "string" && matchesAnySecret(single)) {
        return true;
      }
    }

    // Fallback: parse raw cookie header directly
    if (request.headers) {
      const rawCookie = request.headers.get("cookie") || request.headers.get("Cookie");
      if (rawCookie) {
        const cookieRegex = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`, "g");
        let m: RegExpExecArray | null;
        while ((m = cookieRegex.exec(rawCookie)) !== null) {
          let val = m[1].trim();
          try {
            val = decodeURIComponent(val);
          } catch {
            // Keep raw if URI decode fails
          }
          if (val && matchesAnySecret(val)) {
            return true;
          }
        }
      }
    }
  }

  // 3. Check candidate bypass query parameters (standard Vercel protection bypass feature)
  let searchParams: URLSearchParams | null = null;
  if (request.nextUrl?.searchParams) {
    searchParams = request.nextUrl.searchParams;
  } else if (request.url) {
    try {
      searchParams = new URL(request.url, "http://localhost").searchParams;
    } catch {
      searchParams = null;
    }
  }

  if (searchParams) {
    for (const paramName of AUTOMATION_BYPASS_QUERY_PARAMS) {
      const values =
        typeof searchParams.getAll === "function"
          ? searchParams.getAll(paramName)
          : [searchParams.get(paramName)];
      for (const value of values) {
        if (value && typeof value === "string") {
          if (matchesAnySecret(value)) {
            return true;
          }
        }
      }
    }
  }

  // 4. Fallback: check Authorization Bearer or Token header (case-insensitive)
  const auth =
    request.headers?.get?.("authorization") ||
    request.headers?.get?.("Authorization");
  if (auth && typeof auth === "string") {
    const match = /^(?:Bearer|Token)\s+(.+)$/i.exec(auth.trim());
    if (match) {
      const token = match[1].trim();
      if (token && matchesAnySecret(token)) {
        return true;
      }
    }
  }

  return false;
}

export interface MiddlewareOptions {
  checkBotIdFn?: () => Promise<{ isBot: boolean; [key: string]: any }>;
  bypassSecret?: string | string[] | null;
}

/**
 * Vercel BotID middleware — scoped to /login and /join ONLY.
 *
 * Why scoped this way:
 *  - Auth pages are the highest-value target for credential stuffing,
 *    signup abuse, and free-tier farming. BotID here is high-signal.
 *  - /dashboard/* is already session-gated by Supabase; an extra bot
 *    challenge there punishes legitimate users (especially on first
 *    sign-in when the browser fingerprint is fresh).
 *  - The public marketing page (/) is intentionally NOT protected —
 *    Vercel Bot Management already does edge-level bot filtering.
 *
 * Automation Bypass Mechanism:
 *  - Trusted testing/audit agents passing the pre-shared secret token
 *    (via `x-vercel-protection-bypass`, `x-agent-bypass-token`, cookies,
 *    query parameters, or supported bypass headers) bypass the BotID/Kasada challenge,
 *    allowing automated audits without interference.
 *  - When bypassed or verified human, `x-is-human: 1` is forwarded
 *    to downstream routes so subsequent actions skip secondary bot heuristics.
 *
 * When BotID flags public traffic as a bot, returns a 401 JSON shape.
 */
export async function middleware(
  request: NextRequest,
  eventOrOptions?: NextFetchEvent | MiddlewareOptions
) {
  const options: MiddlewareOptions | undefined =
    eventOrOptions &&
    typeof eventOrOptions === "object" &&
    ("checkBotIdFn" in eventOrOptions || "bypassSecret" in eventOrOptions)
      ? (eventOrOptions as MiddlewareOptions)
      : undefined;

  // 1. Check for authorized automation bypass
  const bypassAuthorized = isAuthorizedAutomationBypass(
    request,
    options?.bypassSecret
  );

  if (bypassAuthorized) {
    const headers = new Headers(request.headers);
    headers.set("x-is-human", "1");
    headers.set("x-automation-bypassed", "1");
    headers.set("x-botid-bypassed", "1");

    const response = NextResponse.next({ request: { headers } });
    response.headers.set("x-is-human", "1");
    response.headers.set("x-automation-bypassed", "1");
    response.headers.set("x-botid-bypassed", "1");

    // Standard Vercel Automation Bypass: persist cookie if requested
    let searchParams: URLSearchParams | null = null;
    if (request.nextUrl?.searchParams) {
      searchParams = request.nextUrl.searchParams;
    } else if (request.url) {
      try {
        searchParams = new URL(request.url, "http://localhost").searchParams;
      } catch {
        searchParams = null;
      }
    }

    const shouldSetCookie =
      request.headers?.get?.("x-vercel-set-bypass-cookie") === "true" ||
      request.headers?.get?.("x-vercel-set-bypass-cookie") === "1" ||
      searchParams?.get("x-vercel-set-bypass-cookie") === "true" ||
      searchParams?.get("x-vercel-set-bypass-cookie") === "1";

    if (shouldSetCookie) {
      const rawSecret = options?.bypassSecret
        ? (Array.isArray(options.bypassSecret) ? options.bypassSecret[0] : options.bypassSecret)
        : getConfiguredBypassSecret();
      const primarySecret = rawSecret ? cleanToken(rawSecret) : null;
      if (primarySecret) {
        response.cookies.set("x-vercel-protection-bypass", primarySecret, {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 86400 * 30, // 30 days
        });
      }
    }

    return response;
  }

  // 2. Enforce BotID check for general public traffic
  const botResult = options?.checkBotIdFn
    ? await options.checkBotIdFn()
    : await checkBotId();

  if (botResult.isBot) {
    return NextResponse.json(
      {
        error: "bot_detected",
        message:
          "We could not verify this request as human. Please refresh the page, disable VPN/proxy if active, and try again.",
      },
      { status: 401 }
    );
  }

  // Forward the verified-human marker to the origin so server
  // actions (e.g. the Supabase signIn call from /login) can
  // short-circuit additional bot heuristics.
  const headers = new Headers(request.headers);
  headers.set("x-is-human", "1");

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("x-is-human", "1");
  return response;
}

export const config = {
  matcher: ["/login", "/join"],
};
