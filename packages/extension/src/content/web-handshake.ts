/**
 * Chrome Extension Web Handshake Content Script
 * Establishes authentic two-way communication between DraftPilot Extension and DraftPilot Web Dashboard.
 * Injected on web dashboard origins (localhost and vercel.app).
 */

export const EXTENSION_VERSION = '0.1.0';

/**
 * Sets extension status attributes on <html> element.
 * Hydration-proof: can be invoked multiple times across page lifecycle.
 */
export function applyDomAttributes(): void {
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-draftpilot-extension-installed', 'true');
      document.documentElement.setAttribute('data-draftpilot-extension-version', EXTENSION_VERSION);
      document.documentElement.setAttribute('data-draftpilot-extension-status', 'ready');
    }
  } catch {
    // Ignore in sandboxed contexts
  }
}

/**
 * Syncs authenticated session credentials from web dashboard to extension storage.
 */
export function syncWebAuthToExtension(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const token = localStorage.getItem('draftpilot_token');
    const userStr = localStorage.getItem('draftpilot_user');
    let user: any = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        // Ignore parse error
      }
    }
    const teamId = user?.team_id || (user as any)?.teams?.id || null;
    const webUrl = window.location.origin.replace(/\/$/, '');

    if (token && chrome?.runtime?.sendMessage) {
      chrome.runtime
        .sendMessage({
          type: 'SET_AUTH_TOKEN',
          token,
          user,
          teamId,
          webUrl,
        })
        .catch(() => {});
    }
  } catch {
    // Ignore in sandboxed or testing contexts
  }
}

// 1. Instant Synchronous DOM Handshake at document_start
applyDomAttributes();
syncWebAuthToExtension();

// 2. Re-apply on DOMContentLoaded to guarantee attributes persist across Next.js / React hydration
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      applyDomAttributes();
      syncWebAuthToExtension();
    });
  } else {
    applyDomAttributes();
    syncWebAuthToExtension();
  }
}

// 3. Active Window Message Handshake
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only accept messages originating from the current window
    if (event.source !== window || !event.data) return;

    if (event.data.type === 'DRAFTPILOT_EXTENSION_PING') {
      // Re-apply DOM attributes upon receiving PING
      applyDomAttributes();
      syncWebAuthToExtension();
      window.postMessage(
        {
          source: 'draftpilot-extension',
          type: 'DRAFTPILOT_EXTENSION_PONG',
          version: EXTENSION_VERSION,
          ready: true,
          status: 'ready',
          timestamp: Date.now(),
        },
        '*'
      );
    } else if (event.data.type === 'DRAFTPILOT_AUTH_CHANGED') {
      syncWebAuthToExtension();
    }
  });

  // Re-sync on localStorage changes (e.g. login / logout in web app)
  window.addEventListener('storage', (event) => {
    if (event.key === 'draftpilot_token' || event.key === 'draftpilot_user') {
      syncWebAuthToExtension();
    }
  });

  // 4. Proactive Announcement Event
  window.postMessage(
    {
      source: 'draftpilot-extension',
      type: 'DRAFTPILOT_EXTENSION_READY',
      version: EXTENSION_VERSION,
      ready: true,
      status: 'ready',
    },
    '*'
  );

  try {
    window.dispatchEvent(
      new CustomEvent('draftpilot-extension-detected', {
        detail: { version: EXTENSION_VERSION, status: 'ready' },
      })
    );
  } catch {
    // Ignore in older environments
  }
}
