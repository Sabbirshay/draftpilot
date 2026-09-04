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
 * Constant-time comparison between two strings to prevent timing attacks.
 * Uses XOR-accumulation over full length to avoid timing leakage.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (!a || !b) return false;

  const aLen = a.length;
  const bLen = b.length;
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
    const trimmed = candidate?.trim();
    if (trimmed && trimmed.length > 0 && !secrets.includes(trimmed)) {
      secrets.push(trimmed);
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
 * cookies (x-vercel-protection-bypass, _vercel_jwt, etc.), and Authorization Bearer header.
 */
export function isAuthorizedAutomationBypass(
  request: NextRequest,
  configuredSecret?: string | string[] | null
): boolean {
  let secrets: string[];
  if (configuredSecret !== undefined) {
    if (Array.isArray(configuredSecret)) {
      secrets = configuredSecret
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => s.length > 0);
    } else if (typeof configuredSecret === "string") {
      const trimmed = configuredSecret.trim();
      secrets = trimmed.length > 0 ? [trimmed] : [];
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
    for (const secret of secrets) {
      if (timingSafeEqual(candidate, secret)) {
        return true;
      }
    }
    return false;
  };

  // 1. Check candidate bypass headers
  for (const headerName of AUTOMATION_BYPASS_HEADERS) {
    const value = request.headers?.get?.(headerName);
    if (value && typeof value === "string") {
      const candidate = value.trim();
      if (candidate && matchesAnySecret(candidate)) {
        return true;
      }
    }
  }

  // 2. Check candidate bypass cookies
  for (const cookieName of AUTOMATION_BYPASS_COOKIES) {
    let cookieVal = request.cookies?.get?.(cookieName)?.value;
    if (!cookieVal && request.headers) {
      const rawCookie = request.headers?.get?.("cookie");
      if (rawCookie) {
        const match = new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`).exec(rawCookie);
        if (match) {
          try {
            cookieVal = decodeURIComponent(match[1]);
          } catch {
            cookieVal = match[1];
          }
        }
      }
    }
    if (cookieVal && typeof cookieVal === "string") {
      const candidate = cookieVal.trim();
      if (candidate && matchesAnySecret(candidate)) {
        return true;
      }
    }
  }

  // 3. Fallback: check Authorization Bearer token (case-insensitive "Bearer")
  const auth = request.headers?.get?.("authorization") || request.headers?.get?.("Authorization");
  if (auth && typeof auth === "string") {
    const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (match) {
      const bearer = match[1].trim();
      if (bearer && matchesAnySecret(bearer)) {
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
 *    (via `x-vercel-protection-bypass`, `x-agent-bypass-token`, cookies, or
 *    supported bypass headers) bypass the BotID/Kasada challenge, allowing
 *    automated audits without interference.
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
