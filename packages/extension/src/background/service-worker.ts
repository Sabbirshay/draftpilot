// Configure side panel to open on action click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
      // Fallback for older Chrome versions
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && chrome.sidePanel) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch {
      // Fallback
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. Verify message is from our own extension
  if (sender.id !== chrome.runtime.id) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  const handleMessage = async () => {
    try {
      if (message.type === 'GET_AUTH_TOKEN') {
        // Restrict sensitive auth token retrieval strictly to extension internal contexts
        if (sender.tab) {
          sendResponse({ success: false, error: 'Access denied: Content scripts cannot read auth tokens' });
          return;
        }
        const data = await chrome.storage.local.get(['token']);
        sendResponse({ token: data.token || null });
      } else if (message.type === 'SET_AUTH_TOKEN') {
        // Restrict sensitive auth token mutation strictly to extension internal contexts
        if (sender.tab) {
          sendResponse({ success: false, error: 'Access denied: Content scripts cannot set auth tokens' });
          return;
        }
        if (typeof message.token === 'string' || message.token === null) {
          await chrome.storage.local.set({ token: message.token });
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Invalid token payload' });
        }
      } else if (message.type === 'THREAD_DETECTED') {
        // Broadcast to side panel if open
        await chrome.runtime.sendMessage(message).catch(() => {
          // Ignore error if side panel is closed
        });
        sendResponse({ success: true });
      } else if (message.type === 'INSERT_DRAFT') {
        if (typeof message.draft !== 'string') {
          sendResponse({ success: false, error: 'Invalid draft payload' });
          return;
        }
        // Relay from sidepanel to active tab's content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.id) {
          await chrome.tabs.sendMessage(tab.id, message);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      } else {
        sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (err: any) {
      sendResponse({ success: false, error: err.message });
    }
  };

  handleMessage();
  return true; // Keep the message channel open for sendResponse
});
