# Domain Shortcuts

Execute custom JavaScript snippets on any website, scoped per domain. Press the extension icon, see only the shortcuts that match the current site, and run them instantly.

## Features

- **Domain-aware**: automatically detects the current hostname and shows only relevant shortcuts
- **Custom JS per action**: write any JavaScript that runs in the page context
- **Keyboard-driven**: each action maps to a single key for fast execution
- **Easy to extend**: edit `config.json` to add new domains and actions — no code changes needed
- **Privacy-first**: all data stays local; no telemetry, no network requests

## How to add a domain

Open `config.json` and add an entry under `domains`:

```json
"mydomain.com": {
  "label": "My Site",
  "actions": [
    { "key": "1", "name": "Do something", "js": "document.body.style.background = 'blue';" }
  ]
}
```

Use `"*"` under `domains` for actions that apply to every site (defined in `defaultActions`).

## Permissions

- **activeTab** — inject scripts only when you click the extension
- **scripting** — execute JS in the active tab
- **<all_urls>** — required to match all sites for domain detection

## Build

```bash
node build.js
```

Output: `dist/extension.zip` — ready for Chrome Web Store upload.
