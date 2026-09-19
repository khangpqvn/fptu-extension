# Domain Shortcuts

Run reusable JavaScript shortcuts on the active browser tab. Routes select buttons by both hostname and endpoint, while every button keeps its metadata, icon, and executable code in a dedicated folder.

## Features

- **Domain and endpoint matching**: match the active hostname plus pathname
- **Glob endpoints**: use exact paths such as `/courses` or patterns such as `/courses/*`
- **Composable routes**: all matching routes are merged and duplicate actions are removed
- **Folder-based actions**: each button owns an `action.json`, `script.js`, and optional icon asset
- **Page-context execution**: packaged scripts execute in the active page after a button click
- **Auto-run on page load**: actions with `"auto": true` execute automatically when a matching page finishes loading and do not appear as buttons in the popup
- **Local configuration**: no telemetry or remote service is required

## Route configuration

`src/config.json` only maps URL rules to action folder IDs:

```json
{
  "routes": [
    {
      "domain": "abc.com",
      "endpoint": "/courses/*",
      "actions": ["highlight-links", "copy-course-name"]
    },
    {
      "domain": "*",
      "endpoint": "*",
      "actions": ["log-current-domain"]
    }
  ]
}
```

Matching rules:

- A leading `www.` is removed before domain comparison.
- `domain: "*"` matches every HTTP or HTTPS hostname.
- Endpoints match `URL.pathname`; query strings and hashes are ignored.
- `endpoint: "*"` matches every pathname.
- `*` inside an endpoint glob matches characters within one pathname segment. For example, `/courses/*` matches `/courses/123` but not `/courses/123/lessons`.
- Trailing slashes are normalized away before matching.
- All matching routes contribute actions in config order. Repeated action IDs and repeated keyboard keys are shown once.

## Action folder template

Each action lives under `src/actions/<action-id>/`:

```text
src/actions/highlight-links/
├── action.json
├── script.js
└── icon.svg          # optional
```

`action.json` defines display metadata:

```json
{
  "id": "highlight-links",
  "key": "1",
  "name": "Highlight links",
  "description": "Draw an outline around every link.",
  "icon": "icon.svg"
}
```

`icon` can be an emoji/text value or a local image filename such as `icon.svg`. `script.js` contains the code injected into the active tab:

```js
document.querySelectorAll('a').forEach((element) => {
  element.style.outline = '2px solid red';
});
```

The action ID, folder name, and `action.json` `id` must match. Action folder IDs use lowercase kebab-case.

Scripts are trusted local code with access to the active page. Add only JavaScript you understand.

## Auto-run action template

Actions with `"auto": true` in their `action.json` execute automatically when a matching page finishes loading — no popup click required. The script runs in the page's MAIN world with full DOM and JavaScript access.

### Creating an auto-run action

1. Create a folder under `src/actions/<action-id>/`.
2. Add `action.json` with `"auto": true`:

```json
{
  "id": "auto-dom-modifier",
  "key": "m",
  "name": "Auto DOM modifier",
  "description": "Automatically compute and modify the current page DOM on load.",
  "icon": "⚙️",
  "auto": true
}
```

3. Add `script.js` with your DOM manipulation logic:

```js
(function () {
  'use strict';
  // Your computation and DOM modifications here
  const headings = document.querySelectorAll('h1, h2, h3');
  headings.forEach((h) => {
    h.style.borderBottom = '2px solid #f5c2e7';
  });
})();
```

4. Add the action ID to a route in `src/config.json`:

```json
{
  "domain": "example.com",
  "endpoint": "/dashboard/*",
  "actions": ["auto-dom-modifier"]
}
```

The `auto` field is optional and defaults to `false`. Actions without it behave as before — they appear as popup buttons and run only on click. Auto-run actions do not appear in the popup; they execute silently when the page loads.

### How it works

A content script (`auto-run.js`) loads at `document_idle` on every HTTP/HTTPS page. It reads `config.json`, matches the current URL against configured routes, and for each matched action with `"auto": true`, injects its `script.js` into the page via a `<script>` tag. Errors in one action do not block others.

## Permissions

- **activeTab** — grants temporary access to the current tab when the extension popup is opened
- **scripting** — provides `chrome.scripting.executeScript` to inject scripts
- **<all_urls>** (host_permissions) — ensures script injection permissions across configured domains

## Extension icons

The extension includes generated PNG icons in `src/icons/`:

- `icon16.png` — compact toolbar size
- `icon32.png` — high-density toolbar size
- `icon48.png` — extension management page
- `icon128.png` — Chrome Web Store extension icon
- `icon512.png` — Chrome Web Store listing image

The first four sizes are configured in `src/manifest.json`. The `icon512.png` file is included as the larger store asset.

Regenerate all icon sizes after changing the master SVG:

```bash
node scripts/generate-icons.js
```

## Build

```bash
node build.js
```

Output: `dist/domain-shortcuts.zip`.
