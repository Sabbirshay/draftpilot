import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
 * When BotID flags the request, we return a 401 with a stable JSON
 * shape so the AuthForm component can show a friendly retry UI
 * instead of the raw "Failed to verify your browser" Kasada page.
 */
export async function middleware(request: NextRequest) {
  const botResult = await checkBotId();

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

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/login", "/join"],
};
