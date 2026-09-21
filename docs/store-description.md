# FPTU Tools

Chrome MV3 extension that runs reusable JavaScript shortcuts on the active tab. Routes select buttons by hostname and pathname, and every button keeps its metadata, icon, and executable code in a dedicated action folder.

## Features

- **Domain and endpoint matching**: match the active hostname plus pathname
- **Multiple endpoints per domain**: one domain route holds a list of endpoints, each with its own actions
- **Glob endpoints**: use exact paths such as `/Attendance/ViewAttendance.aspx` or patterns such as `/courses/*`
- **Composable routes**: all matching routes are merged and duplicate action IDs are removed
- **Folder-based actions**: each button owns an `action.json`, a `script.js`, and optional icon or bundled assets
- **Page-context execution**: packaged scripts run in the active page after a button click
- **Auto-run on page load**: actions with `"auto": true` execute automatically when a matching page finishes loading and do not appear as buttons in the popup
- **Local configuration**: no telemetry or remote service is required

## Route configuration

`src/config.json` only maps URL rules to action folder IDs. Each route pairs one domain with a list of endpoints, and each endpoint lists the actions that apply to it:

```json
{
  "routes": [
    {
      "domain": "abc.com",
      "endpoints": [
        {
          "endpoint": "/courses/*",
          "actions": ["highlight-links", "copy-course-name"]
        },
        {
          "endpoint": "/dashboard",
          "actions": ["copy-course-name"]
        }
      ]
    },
    {
      "domain": "*",
      "endpoints": [
        {
          "endpoint": "*",
          "actions": ["log-current-domain"]
        }
      ]
    }
  ]
}
```

Matching rules, implemented in `src/popup.js` and `src/auto-run.js`:

- A leading `www.` is removed before domain comparison.
- `domain: "*"` matches every HTTP or HTTPS hostname.
- Endpoints match `URL.pathname`; query strings and hashes are ignored.
- `endpoint: "*"` matches every pathname.
- `*` inside an endpoint glob matches characters within one pathname segment. For example, `/courses/*` matches `/courses/123` but not `/courses/123/lessons`.
- Trailing slashes are normalized away before matching.
- All matching routes contribute actions in config order. Repeated action IDs are merged, and the popup shows only the first action for a repeated keyboard key.

## Action folder template

Each action lives under `src/actions/<action-id>/`:

```text
src/actions/my-action/
├── action.json
├── script.js
└── icon.svg          # optional
```

`action.json` defines display metadata:

```json
{
  "id": "my-action",
  "key": "1",
  "name": "My action",
  "description": "One line shown under the name in the popup.",
  "icon": "icon.svg"
}
```

- `id` must equal the folder name, and folder IDs use lowercase kebab-case.
- `key` is the single-character hint rendered next to the name.
- `icon` accepts an emoji or text value, or a local image filename ending in `svg`, `png`, `jpg`, `jpeg`, or `webp`.
- `auto: true` runs the action on page load instead of listing it as a popup button. The field is optional and defaults to `false`.
- The `route` field present in some action files is informational only; URL matching comes from `src/config.json`.

`script.js` holds the code injected into the active tab:

```js
document.querySelectorAll('a').forEach((element) => {
  element.style.outline = '2px solid red';
});
```

Working examples: `src/actions/fap-attendance/` for a click-only button and `src/actions/fap-grade-average/` for an auto-run action.

Scripts are trusted local code with access to the active page. Add only JavaScript you understand.

### Bundled assets

An action folder may ship extra files, such as `src/actions/qr-share-link/qrcode.min.js`. Extra files are not injected automatically. Register each one in the `files` array in `src/background.js`, before the action's `script.js`, and confirm `web_accessible_resources` in `src/manifest.json` still covers the path.

## Auto-run actions

Actions with `"auto": true` in their `action.json` execute automatically when a matching page finishes loading, with no popup click required.

### Creating an auto-run action

1. Create a folder under `src/actions/<action-id>/`.
2. Add `action.json` with `"auto": true`:

```json
{
  "id": "my-auto-action",
  "key": "m",
  "name": "My auto action",
  "description": "Automatically compute and modify the current page DOM on load.",
  "icon": "⚙️",
  "auto": true
}
```

3. Add `script.js` with the DOM manipulation logic:

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

4. Register the action ID under the matching endpoint in `src/config.json`:

```json
{
  "domain": "example.com",
  "endpoints": [
    {
      "endpoint": "/dashboard/*",
      "actions": ["my-auto-action"]
    }
  ]
}
```

Auto-run actions never appear in the popup. Actions without the `auto` field behave as before and run only on click.

### How it works

`src/auto-run.js` is a content script declared in `src/manifest.json`. It runs at `document_idle` on every HTTP or HTTPS page, reads `config.json`, and matches the current URL against the configured routes. For each matched action with `"auto": true`, it messages the background service worker, which injects that action's `script.js` with `chrome.scripting.executeScript`. Injected code runs in Chrome's default isolated world: it shares the page DOM but not the page's JavaScript globals. An error in one action does not block the others.

## Permissions

- **activeTab** — grants temporary access to the current tab when the extension popup is opened
- **scripting** — provides `chrome.scripting.executeScript` to inject scripts
- **<all_urls>** (host_permissions) — ensures script injection permissions across configured domains
- **web_accessible_resources** — exposes `config.json` and `actions/*/*` so the popup and the content script can fetch them

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
