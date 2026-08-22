chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // We use async inside the listener but must return true to indicate we'll sendResponse later
  const handleMessage = async () => {
    try {
      if (message.type === 'GET_AUTH_TOKEN') {
        const data = await chrome.storage.local.get(['token']);
        sendResponse({ token: data.token || null });
      } else if (message.type === 'SET_AUTH_TOKEN') {
        await chrome.storage.local.set({ token: message.token });
        sendResponse({ success: true });
      } else if (message.type === 'THREAD_DETECTED') {
        // Broadcast to side panel if open
        await chrome.runtime.sendMessage(message).catch(() => {
          // Ignore error if side panel is closed
        });
        sendResponse({ success: true });
      } else if (message.type === 'INSERT_DRAFT') {
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
