---
name: domain-button-template
status: completed
---

# Domain button template

## Outcome
Provide a Chrome MV3 extension template where `src/config.json` maps domain and endpoint routes to action folders containing `name`, `description`, `icon`, and `script.js`; the popup displays only buttons matching the active tab URL and executes the selected packaged script in that tab's main page context.

## Constraints
- Keep the implementation dependency-free and scoped to the existing extension.
- Preserve local configuration workflow and `activeTab` permission model.
- Handle unsupported tabs, malformed URLs, empty configurations, and execution failures without uncaught popup errors.
- Update user-facing documentation and packaging metadata only where needed.

## Acceptance criteria
- Every action folder contains metadata with the requested fields and a separate packaged `script.js`.
- Route configuration matches normalized hostname plus pathname glob and merges all matching actions without duplicates.
- Clicking a button injects its folder's packaged script into the active tab and closes the popup only after success.
- Manifest/package remain loadable, including nested action folders and no references to missing extension icon files.
- Build succeeds and source JSON/JS syntax validates.

## Files
- `src/config.json`
- `src/actions/*/action.json`
- `src/actions/*/script.js`
- `src/popup.js`
- `src/popup.html`
- `src/popup.css`
- `src/manifest.json`
- `README.md`
- `docs/store-description.md`
- `build.js` (only if packaging validation requires it)
