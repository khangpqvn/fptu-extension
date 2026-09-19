chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || msg.type !== 'autoRun' || typeof msg.actionId !== 'string') {
    return;
  }

  const tabId = sender?.tab?.id;
  if (!tabId) {
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId },
      world: 'MAIN',
      files: [`actions/${msg.actionId}/script.js`],
    },
    () => {
      if (chrome.runtime.lastError) {
        console.error(
          `[Domain Shortcuts] auto-run injection failed for "${msg.actionId}":`,
          chrome.runtime.lastError.message,
        );
      }
    },
  );
});
