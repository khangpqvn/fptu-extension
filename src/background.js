chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.actionId !== 'string') {
    return;
  }

  const isAutoRun = msg.type === 'autoRun';
  const isExecute = msg.type === 'executeAction' && typeof msg.tabId === 'number';

  if (!isAutoRun && !isExecute) {
    return;
  }

  const tabId = isAutoRun ? sender?.tab?.id : msg.tabId;
  if (!tabId) {
    return;
  }

  const files = [`actions/${msg.actionId}/script.js`];

  if (msg.actionId === 'qr-share-link') {
    files.unshift('actions/qr-share-link/qrcode.min.js');
  }

  chrome.scripting.executeScript(
    {
      target: { tabId },
      files,
    },
    () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    },
  );

  return true;
});
