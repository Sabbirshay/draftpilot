/**
 * Chrome Extension Web Handshake Content Script
 * Establishes authentic two-way communication between DraftPilot Extension and DraftPilot Web Dashboard.
 * Injected on web dashboard origins (localhost and vercel.app).
 */

export const EXTENSION_VERSION = '0.1.0';

// 1. Instant Synchronous DOM Handshake
try {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-draftpilot-extension-installed', 'true');
    document.documentElement.setAttribute('data-draftpilot-extension-version', EXTENSION_VERSION);
    document.documentElement.setAttribute('data-draftpilot-extension-status', 'ready');
  }
} catch {
  // Ignore in sandboxed contexts
}

// 2. Active Window Message Handshake
if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    // Only accept messages originating from the current window
    if (event.source !== window || !event.data) return;

    if (event.data.type === 'DRAFTPILOT_EXTENSION_PING') {
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
    }
  });

  // 3. Proactive Announcement Event
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
