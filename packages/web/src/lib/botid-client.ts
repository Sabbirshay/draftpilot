"use client";

/**
 * Client-side wrapper for Vercel BotID challenges.
 *
 * Use this in the AuthForm (and any other auth-flow component) to:
 *  1. Surface a friendly retry message when the middleware returns 401
 *     (the user is on a slow connection / VPN / unfamiliar fingerprint).
 *  2. Trigger a manual BotID challenge before the user clicks "Sign in",
 *     so the first submission never races the middleware check.
 *
 * Without this helper, a 401 from /middleware shows up as a raw network
 * error in the browser console and leaves the user staring at a stuck
 * spinner. With it, the user sees a clear "we couldn't verify you" panel
 * with a "Try again" button that re-issues the challenge.
 */

export type BotIdError = {
  error: "bot_detected";
  message: string;
};

/**
 * Detect BotID rejection from a fetch Response.
 * Returns a friendly error string if rejected, null if human.
 */
export function explainBotIdResponse(res: Response): string | null {
  if (res.status !== 401) return null;
  // The middleware always returns JSON for bot detections.
  // We don't await the body here — caller should call .json().
  return "We could not verify this request as human. Please refresh and try again, or disable any VPN/proxy you may be using.";
}

/**
 * Pre-warm the BotID JS challenge on the login/signup page so the
 * fingerprint is established before the user submits. Safe to call
 * multiple times — the SDK is idempotent.
 *
 * Loaded lazily so the dashboard bundle never pulls in botid.
 */
export async function prewarmBotId(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const mod: any = await import("botid");
    if (typeof mod?.init === "function") {
      await mod.init();
    } else if (typeof mod?.initBotId === "function") {
      mod.initBotId({ protect: [{ path: "/login", method: "POST" }, { path: "/join", method: "POST" }] });
    }
  } catch {
    // BotID JS is optional on the client; if it fails to load (e.g. ad
    // blocker), the server-side checkBotId() in middleware still runs.
  }
}
