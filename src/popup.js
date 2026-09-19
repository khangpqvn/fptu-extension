const domainDisplay = document.getElementById('domain-display');
const shortcutList = document.getElementById('shortcut-list');
const noActions = document.getElementById('no-actions');
const status = document.getElementById('status');

function normalizeHostname(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return normalized.replace(/\/+$/, '') || '/';
}

function getActiveTabUrl(tab) {
  if (!tab?.id || !tab.url) {
    throw new Error('The active tab has no accessible URL.');
  }

  const url = new URL(tab.url);
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    throw new Error('This page does not support shortcuts.');
  }

  return url;
}

function escapeRegularExpression(value) {
  return value.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
}

function matchesEndpoint(pattern, pathname) {
  if (pattern === '*') {
    return true;
  }
  if (typeof pattern !== 'string') {
    return false;
  }

  const normalizedPattern = normalizePathname(pattern);
  const expression = escapeRegularExpression(normalizedPattern).replace(/\*/g, '[^/]*');
  return new RegExp(`^${expression}$`).test(normalizePathname(pathname));
}

function matchesDomain(pattern, hostname) {
  return pattern === '*' || (
    typeof pattern === 'string'
    && normalizeHostname(pattern) === hostname
  );
}

function getActionIds(config, hostname, pathname) {
  const actionIds = [];
  const seenActionIds = new Set();
  const routes = Array.isArray(config?.routes) ? config.routes : [];

  routes.forEach((route) => {
    if (!route || !matchesDomain(route.domain, hostname) || !matchesEndpoint(route.endpoint, pathname)) {
      return;
    }

    if (!Array.isArray(route.actions)) {
      return;
    }

    route.actions.forEach((actionId) => {
      if (typeof actionId !== 'string' || seenActionIds.has(actionId)) {
        return;
      }
      seenActionIds.add(actionId);
      actionIds.push(actionId);
    });
  });

  return actionIds;
}

function getActionPath(actionId, fileName) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(actionId)) {
    throw new Error(`Invalid action folder: ${actionId}`);
  }
  const isActionFile = fileName === 'action.json' || fileName === 'script.js';
  const isIconFile = /^[a-z0-9][a-z0-9._-]*\.(?:svg|png|jpe?g|webp)$/i.test(fileName);
  if (!isActionFile && !isIconFile) {
    throw new Error(`Invalid action asset: ${fileName}`);
  }

  return `actions/${actionId}/${fileName}`;
}

async function loadAction(actionId) {
  const metadataPath = getActionPath(actionId, 'action.json');
  const response = await fetch(chrome.runtime.getURL(metadataPath));

  if (!response.ok) {
    throw new Error(`Could not load ${metadataPath} (${response.status}).`);
  }

  const metadata = await response.json();
  if (metadata.id !== actionId) {
    throw new Error(`${metadataPath} must use id "${actionId}".`);
  }
  if (typeof metadata.key !== 'string' || typeof metadata.name !== 'string'
    || typeof metadata.description !== 'string' || typeof metadata.icon !== 'string') {
    throw new Error(`${metadataPath} is missing required button metadata.`);
  }
  if (/\.(?:svg|png|jpe?g|webp)$/i.test(metadata.icon)) {
    getActionPath(actionId, metadata.icon);
  }

  const scriptPath = getActionPath(actionId, 'script.js');
  const scriptResponse = await fetch(chrome.runtime.getURL(scriptPath));
  if (!scriptResponse.ok) {
    throw new Error(`Could not load ${scriptPath} (${scriptResponse.status}).`);
  }
  const code = await scriptResponse.text();

  return {
    ...metadata,
    folder: actionId,
    scriptPath,
    code,
  };
}

function createActionIcon(action) {
  if (typeof action.icon !== 'string' || !action.icon) {
    return null;
  }

  const wrapper = document.createElement('span');
  wrapper.className = 'shortcut-icon';
  wrapper.setAttribute('aria-hidden', 'true');

  if (/\.(?:svg|png|jpe?g|webp)$/i.test(action.icon)) {
    const image = document.createElement('img');
    image.src = chrome.runtime.getURL(getActionPath(action.folder, action.icon));
    image.alt = '';
    wrapper.appendChild(image);
  } else {
    wrapper.textContent = action.icon;
  }

  return wrapper;
}

function createActionButton(action, tabId) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'shortcut';

  const copy = document.createElement('span');
  copy.className = 'shortcut-copy';

  const name = document.createElement('strong');
  name.className = 'shortcut-name';
  name.textContent = typeof action.name === 'string' ? action.name : 'Unnamed shortcut';

  const key = document.createElement('kbd');
  key.className = 'shortcut-key';
  key.textContent = typeof action.key === 'string' ? action.key : '';

  const description = document.createElement('span');
  description.className = 'shortcut-description';
  description.textContent = typeof action.description === 'string' ? action.description : '';

  copy.append(name, description);
  const icon = createActionIcon(action);
  button.append(...[icon, copy, key].filter(Boolean));

  button.addEventListener('click', async () => {
    document.querySelectorAll('.shortcut').forEach((item) => {
      item.disabled = true;
    });
    status.textContent = 'Running…';

    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: [action.scriptPath],
      });
      window.close();
    } catch (error) {
      document.querySelectorAll('.shortcut').forEach((item) => {
        item.disabled = false;
      });
      console.error('Execution failed:', error);
      status.textContent = `Could not run shortcut: ${error.message}`;
    }
  });

  return button;
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = getActiveTabUrl(tab);
    const hostname = normalizeHostname(url.hostname);
    const pathname = normalizePathname(url.pathname);
    domainDisplay.textContent = `${hostname}${pathname}`;

    const response = await fetch(chrome.runtime.getURL('config.json'));
    if (!response.ok) {
      throw new Error(`Could not load config.json (${response.status}).`);
    }

    const config = await response.json();
    const actionIds = getActionIds(config, hostname, pathname);
    const results = await Promise.allSettled(actionIds.map(loadAction));
    const loadedActions = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => result.value);
    const failedActions = results.filter((result) => result.status === 'rejected');
    const seenKeys = new Set();
    const actions = loadedActions.filter((action) => {
      if (typeof action.key !== 'string' || seenKeys.has(action.key)) {
        return false;
      }
      seenKeys.add(action.key);
      return true;
    });

    if (failedActions.length) {
      status.textContent = `${failedActions.length} action template(s) could not be loaded.`;
    }

    actions.forEach((action) => {
      shortcutList.appendChild(createActionButton(action, tab.id));
    });

    noActions.hidden = actions.length > 0;
  } catch (error) {
    domainDisplay.textContent = 'Unavailable page';
    noActions.hidden = true;
    status.textContent = error.message;
  }
}

init();
