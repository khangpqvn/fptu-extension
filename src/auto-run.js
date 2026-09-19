/**
 * auto-run.js — Content script that auto-executes actions marked with
 * "auto": true when the current page matches their configured route.
 * Runs at document_idle in the ISOLATED world, then injects each
 * matching action's script.js into the MAIN world via a <script> tag.
 */
(function autoRun() {
  'use strict';

  const url = new URL(location.href);
  if (!['http:', 'https:'].includes(url.protocol)) {
    return;
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  const pathname = normalizePath(url.pathname);

  function normalizePath(value) {
    if (!value || value === '/') return '/';
    const p = value.startsWith('/') ? value : `/${value}`;
    return p.replace(/\/+$/, '') || '/';
  }

  function escapeRegExp(str) {
    return str.replace(/[|\\{}()[\]^$+?.-]/g, '\\$&');
  }

  function matchesDomain(pattern, host) {
    return pattern === '*' || (typeof pattern === 'string' && pattern.toLowerCase().replace(/^www\./, '') === host);
  }

  function matchesEndpoint(pattern, path) {
    if (pattern === '*') return true;
    if (typeof pattern !== 'string') return false;
    const normalized = normalizePath(pattern);
    const expr = escapeRegExp(normalized).replace(/\*/g, '[^/]*');
    return new RegExp(`^${expr}$`).test(path);
  }

  async function loadConfig() {
    const resp = await fetch(chrome.runtime.getURL('config.json'));
    if (!resp.ok) throw new Error(`config.json load failed (${resp.status})`);
    return resp.json();
  }

  async function loadActionMeta(actionId) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(actionId)) return null;
    const metaUrl = chrome.runtime.getURL(`actions/${actionId}/action.json`);
    const resp = await fetch(metaUrl);
    if (!resp.ok) return null;
    const meta = await resp.json();
    if (meta.id !== actionId || !meta.auto) return null;
    return meta;
  }

  function injectScript(actionId) {
    const scriptUrl = chrome.runtime.getURL(`actions/${actionId}/script.js`);
    const el = document.createElement('script');
    el.src = scriptUrl;
    el.dataset.autoAction = actionId;
    el.onload = () => el.remove();
    el.onerror = () => {
      console.error(`[Domain Shortcuts] Failed to inject auto-run script: ${actionId}`);
      el.remove();
    };
    (document.head || document.documentElement).appendChild(el);
  }

  async function run() {
    try {
      const config = await loadConfig();
      const routes = Array.isArray(config?.routes) ? config.routes : [];
      const seen = new Set();
      const actionIds = [];

      for (const route of routes) {
        if (!route || !matchesDomain(route.domain, hostname) || !matchesEndpoint(route.endpoint, pathname)) {
          continue;
        }
        if (!Array.isArray(route.actions)) continue;
        for (const id of route.actions) {
          if (typeof id === 'string' && !seen.has(id)) {
            seen.add(id);
            actionIds.push(id);
          }
        }
      }

      for (const id of actionIds) {
        try {
          const meta = await loadActionMeta(id);
          if (meta) {
            injectScript(id);
          }
        } catch (err) {
          console.error(`[Domain Shortcuts] auto-run error for "${id}":`, err);
        }
      }
    } catch (err) {
      console.error('[Domain Shortcuts] auto-run init error:', err);
    }
  }

  run();
})();
