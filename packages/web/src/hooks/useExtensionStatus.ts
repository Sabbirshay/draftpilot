'use client';

import { useState, useEffect, useCallback } from 'react';

export type ExtensionStatus = 'checking' | 'installed' | 'not_installed' | 'outdated';

export const CURRENT_EXTENSION_VERSION = '0.1.0';

export interface UseExtensionStatusResult {
  status: ExtensionStatus;
  version: string | null;
  isInstalled: boolean;
  isChecking: boolean;
  isOutdated: boolean;
  recheck: () => void;
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
 * Hook to monitor authentic Chrome extension detection & pairing status
 */
export function useExtensionStatus(): UseExtensionStatusResult {
  const [status, setStatus] = useState<ExtensionStatus>('checking');
  const [version, setVersion] = useState<string | null>(null);

  const performCheck = useCallback(() => {
    setStatus('checking');

    // 1. Check synchronous DOM attributes first
    const domStatus = readExtensionDomStatus();
    if (domStatus.installed && domStatus.version) {
      setVersion(domStatus.version);
      if (compareExtensionVersions(domStatus.version, CURRENT_EXTENSION_VERSION) < 0) {
        setStatus('outdated');
      } else {
        setStatus('installed');
      }
      return;
    }

    // 2. Active Window Message Handshake
    if (typeof window === 'undefined') {
      setStatus('not_installed');
      return;
    }

    let resolved = false;

    const messageHandler = (event: MessageEvent) => {
      if (event.source !== window || !event.data) return;

      const data = event.data;
      if (
        (data.type === 'DRAFTPILOT_EXTENSION_PONG' || data.type === 'DRAFTPILOT_EXTENSION_READY') &&
        data.source === 'draftpilot-extension'
      ) {
        resolved = true;
        const detectedVersion = data.version || CURRENT_EXTENSION_VERSION;
        setVersion(detectedVersion);

        if (compareExtensionVersions(detectedVersion, CURRENT_EXTENSION_VERSION) < 0) {
          setStatus('outdated');
        } else {
          setStatus('installed');
        }

        cleanup();
      }
    };

    const customEventHandler = (event: Event) => {
      const customEvent = event as CustomEvent;
      resolved = true;
      const detectedVersion = customEvent.detail?.version || CURRENT_EXTENSION_VERSION;
      setVersion(detectedVersion);

      if (compareExtensionVersions(detectedVersion, CURRENT_EXTENSION_VERSION) < 0) {
        setStatus('outdated');
      } else {
        setStatus('installed');
      }

      cleanup();
    };

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        // Double check DOM in case content script injected during timeout
        const recheckDom = readExtensionDomStatus();
        if (recheckDom.installed && recheckDom.version) {
          setVersion(recheckDom.version);
          if (compareExtensionVersions(recheckDom.version, CURRENT_EXTENSION_VERSION) < 0) {
            setStatus('outdated');
          } else {
            setStatus('installed');
          }
        } else {
          setStatus('not_installed');
        }
        cleanup();
      }
    }, 450);

    const cleanup = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('draftpilot-extension-detected', customEventHandler);
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener('draftpilot-extension-detected', customEventHandler);

    // Send active ping
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

    return cleanup;
  }, []);

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
    recheck: performCheck,
  };
}

export default useExtensionStatus;
