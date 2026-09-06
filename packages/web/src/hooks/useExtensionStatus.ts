'use client';

import { useState, useEffect, useCallback } from 'react';

export type ExtensionStatus = 'checking' | 'installed' | 'not_installed' | 'outdated';

export const CURRENT_EXTENSION_VERSION = '0.1.0';

export interface UseExtensionStatusOptions {
  accountInstalled?: boolean;
}

export interface UseExtensionStatusResult {
  status: ExtensionStatus;
  version: string | null;
  isInstalled: boolean;
  isChecking: boolean;
  isOutdated: boolean;
  recheck: () => void | Promise<void>;
}

/**
 * Compare two semver strings: returns -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export function compareExtensionVersions(v1: string, v2: string): number {
  const parse = (v: string) =>
    v
      .replace(/^v/i, '')
      .split('.')
      .map((p) => parseInt(p, 10) || 0);

  const p1 = parse(v1);
  const p2 = parse(v2);

  const length = Math.max(p1.length, p2.length);
  for (let i = 0; i < length; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }
  return 0;
}

/**
 * Checks synchronous DOM attributes injected by web-handshake.ts content script
 */
export function readExtensionDomStatus(): { installed: boolean; version: string | null } {
  if (typeof document === 'undefined' || !document.documentElement) {
    return { installed: false, version: null };
  }

  const installedAttr = document.documentElement.getAttribute('data-draftpilot-extension-installed');
  const versionAttr = document.documentElement.getAttribute('data-draftpilot-extension-version');

  if (installedAttr === 'true') {
    return {
      installed: true,
      version: versionAttr || CURRENT_EXTENSION_VERSION,
    };
  }

  return { installed: false, version: null };
}

/**
 * Checks localStorage for cached extension pairing
 */
export function readExtensionStorageStatus(): { installed: boolean; version: string | null } {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { installed: false, version: null };
  }
  try {
    const isInstalled = localStorage.getItem('draftpilot_extension_installed') === 'true';
    const version = localStorage.getItem('draftpilot_extension_version') || CURRENT_EXTENSION_VERSION;
    return { installed: isInstalled, version: isInstalled ? version : null };
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * Helper to query /api/extension/heartbeat if in browser and token is available
 */
export async function queryExtensionHeartbeat(): Promise<{ installed: boolean; version: string | null }> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return { installed: false, version: null };
  }

  try {
    let token: string | null = null;
    try {
      token = localStorage.getItem('draftpilot_token');
    } catch {}

    if (!token) {
      try {
        const { supabase } = await import('@/lib/supabase');
        const sessionRes = await supabase.auth.getSession();
        token = sessionRes.data?.session?.access_token || null;
      } catch {}
    }

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch('/api/extension/heartbeat', {
      headers,
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.extension_installed) {
        const detectedVer = data.version || CURRENT_EXTENSION_VERSION;
        try {
          localStorage.setItem('draftpilot_extension_installed', 'true');
          localStorage.setItem('draftpilot_extension_version', detectedVer);
        } catch {}
        return { installed: true, version: detectedVer };
      }
    }
  } catch {
    // Network or parse failure
  }

  return { installed: false, version: null };
}

/**
 * Hook to monitor authentic Chrome extension detection & pairing status
 */
export function useExtensionStatus(options?: UseExtensionStatusOptions): UseExtensionStatusResult {
  const [status, setStatus] = useState<ExtensionStatus>(() => {
    if (options?.accountInstalled) return 'installed';
    const dom = readExtensionDomStatus();
    if (dom.installed && dom.version) {
      return compareExtensionVersions(dom.version, CURRENT_EXTENSION_VERSION) < 0 ? 'outdated' : 'installed';
    }
    const storage = readExtensionStorageStatus();
    if (storage.installed && storage.version) {
      return compareExtensionVersions(storage.version, CURRENT_EXTENSION_VERSION) < 0 ? 'outdated' : 'installed';
    }
    return 'checking';
  });

  const [version, setVersion] = useState<string | null>(() => {
    if (options?.accountInstalled) return CURRENT_EXTENSION_VERSION;
    const dom = readExtensionDomStatus();
    if (dom.installed && dom.version) return dom.version;
    const storage = readExtensionStorageStatus();
    if (storage.installed && storage.version) return storage.version;
    return null;
  });

  // Keep state reactive to dynamic prop updates
  useEffect(() => {
    if (options?.accountInstalled) {
      setStatus((prev) => (prev === 'outdated' ? 'outdated' : 'installed'));
      setVersion((prev) => prev || CURRENT_EXTENSION_VERSION);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', CURRENT_EXTENSION_VERSION);
      } catch {}
    }
  }, [options?.accountInstalled]);

  const performCheck = useCallback(() => {
    setStatus('checking');

    // 1. Check synchronous DOM attributes first
    const domStatus = readExtensionDomStatus();
    if (domStatus.installed && domStatus.version) {
      setVersion(domStatus.version);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', domStatus.version);
      } catch {}
      if (compareExtensionVersions(domStatus.version, CURRENT_EXTENSION_VERSION) < 0) {
        setStatus('outdated');
      } else {
        setStatus('installed');
      }
      return;
    }

    // 2. Check account-level pairing fallback
    if (options?.accountInstalled) {
      setVersion(CURRENT_EXTENSION_VERSION);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', CURRENT_EXTENSION_VERSION);
      } catch {}
      setStatus('installed');
      return;
    }

    // 3. Check localStorage cached pairing
    const storageStatus = readExtensionStorageStatus();
    if (storageStatus.installed && storageStatus.version) {
      setVersion(storageStatus.version);
      if (compareExtensionVersions(storageStatus.version, CURRENT_EXTENSION_VERSION) < 0) {
        setStatus('outdated');
      } else {
        setStatus('installed');
      }
      return;
    }

    // 4. Active Window Message Handshake & Heartbeat Query
    if (typeof window === 'undefined') {
      setStatus('not_installed');
      return;
    }

    let resolved = false;

    const handleDetected = (detectedVer?: string | null) => {
      resolved = true;
      const ver = detectedVer || CURRENT_EXTENSION_VERSION;
      setVersion(ver);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', ver);
      } catch {}

      if (compareExtensionVersions(ver, CURRENT_EXTENSION_VERSION) < 0) {
        setStatus('outdated');
      } else {
        setStatus('installed');
      }
      cleanup();
    };

    const messageHandler = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;

      const data = event.data;
      if (
        (data.type === 'DRAFTPILOT_EXTENSION_PONG' || data.type === 'DRAFTPILOT_EXTENSION_READY') &&
        data.source === 'draftpilot-extension'
      ) {
        handleDetected(data.version);
      }
    };

    const customEventHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      handleDetected(customEvent.detail?.version);
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('draftpilot-extension-detected', customEventHandler);
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener('draftpilot-extension-detected', customEventHandler);

    // Send active ping to window
    try {
      window.postMessage(
        {
          source: 'draftpilot-web',
          type: 'DRAFTPILOT_EXTENSION_PING',
          timestamp: Date.now(),
        },
        '*'
      );
    } catch {
      // Ignore in restricted environments
    }

    // Asynchronously query heartbeat endpoint
    queryExtensionHeartbeat()
      .then((heartbeat) => {
        if (!resolved && heartbeat.installed && heartbeat.version) {
          handleDetected(heartbeat.version);
        }
      })
      .catch(() => {});

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        // Double check DOM in case content script injected during timeout
        const recheckDom = readExtensionDomStatus();
        if (recheckDom.installed && recheckDom.version) {
          handleDetected(recheckDom.version);
          return;
        }

        // Double check account pairing
        if (options?.accountInstalled) {
          handleDetected(CURRENT_EXTENSION_VERSION);
          return;
        }

        // Double check localStorage
        const recheckStorage = readExtensionStorageStatus();
        if (recheckStorage.installed && recheckStorage.version) {
          handleDetected(recheckStorage.version);
          return;
        }

        setStatus('not_installed');
        cleanup();
      }
    }, 450);

    return cleanup;
  }, [options?.accountInstalled]);

  const recheck = useCallback(async () => {
    setStatus('checking');

    // 1. Broadcast ping immediately
    if (typeof window !== 'undefined') {
      try {
        window.postMessage(
          {
            source: 'draftpilot-web',
            type: 'DRAFTPILOT_EXTENSION_PING',
            timestamp: Date.now(),
          },
          '*'
        );
      } catch {}
    }

    // 2. Re-read synchronous DOM attributes
    const dom = readExtensionDomStatus();
    if (dom.installed && dom.version) {
      setVersion(dom.version);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', dom.version);
      } catch {}
      setStatus(compareExtensionVersions(dom.version, CURRENT_EXTENSION_VERSION) < 0 ? 'outdated' : 'installed');
      return;
    }

    // 3. Check account-level pairing status
    if (options?.accountInstalled) {
      setVersion(CURRENT_EXTENSION_VERSION);
      try {
        localStorage.setItem('draftpilot_extension_installed', 'true');
        localStorage.setItem('draftpilot_extension_version', CURRENT_EXTENSION_VERSION);
      } catch {}
      setStatus('installed');
      return;
    }

    // 4. Check localStorage
    const storage = readExtensionStorageStatus();
    if (storage.installed && storage.version) {
      setVersion(storage.version);
      setStatus(compareExtensionVersions(storage.version, CURRENT_EXTENSION_VERSION) < 0 ? 'outdated' : 'installed');
      return;
    }

    // 5. Query /api/extension/heartbeat
    const heartbeat = await queryExtensionHeartbeat().catch(() => ({ installed: false, version: null }));
    if (heartbeat.installed && heartbeat.version) {
      setVersion(heartbeat.version);
      setStatus(compareExtensionVersions(heartbeat.version, CURRENT_EXTENSION_VERSION) < 0 ? 'outdated' : 'installed');
      return;
    }

    // 6. Run active handshake listener check
    performCheck();
  }, [options?.accountInstalled, performCheck]);

  useEffect(() => {
    const cleanup = performCheck();
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [performCheck]);

  return {
    status,
    version,
    isInstalled: status === 'installed',
    isChecking: status === 'checking',
    isOutdated: status === 'outdated',
    recheck,
  };
}

export default useExtensionStatus;
