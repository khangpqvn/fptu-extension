(async () => {
  // Get the active tab URL to detect domain (popup runs in extension context)
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tabs[0]?.url || '';
  const hostname = new URL(tabUrl).hostname.replace(/^www\./, '');

  document.getElementById('domain-display').textContent = hostname;

  const res = await fetch(chrome.runtime.getURL('config.json'));
  const config = await res.json();

  // Prefer domain-specific actions; fall back to defaultActions
  const domainConfig = config.domains[hostname] || { label: 'Default', actions: [] };
  const fallbackConfig = { label: 'Default', actions: config.defaultActions || [] };
  const actions = domainConfig.actions || fallbackConfig.actions;
  const container = document.getElementById('shortcut-list');
  const noActions = document.getElementById('no-actions');

  if (!actions.length) {
    noActions.hidden = false;
    return;
  }

  actions.forEach(({ key, name, js }) => {
    const btn = document.createElement('button');
    btn.innerHTML = `${name} <kbd>${key}</kbd>`;
    btn.addEventListener('click', async () => {
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (code) => { try { eval(code); } catch (e) { console.error(e); } },
        args: [js],
      });
      window.close();
    });
    container.appendChild(btn);
  });
})();
