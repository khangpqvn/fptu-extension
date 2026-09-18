# Domain button template implementation report

## Outcome
Implemented the requested Chrome extension template for domain-specific utility buttons. Button definitions now include `name`, `description`, `icon`, and `js`; the popup filters by the active tab hostname and executes the selected JavaScript in that tab.

## Changes
- Updated `src/config.json` with the requested button schema and exact-domain/wildcard examples.
- Reworked `src/popup.js` for safe DOM rendering, URL validation, config loading errors, duplicate-key filtering, and execution feedback.
- Updated popup markup and styling to show icons, names, descriptions, empty states, and errors.
- Removed missing manifest icon references and kept the narrower `activeTab`/`scripting` permission model.
- Updated `docs/store-description.md` with configuration and build instructions.

## Verification
- `node --check build.js`
- `node --check src/popup.js`
- Node validation for manifest/config schema
- CSS brace-balance validation
- `node build.js` produced `dist/domain-shortcuts.zip` with 5 source files
- `git diff HEAD --check` passed; only line-ending normalization warnings were emitted

## Limitations
JavaScript is intentionally user-provided action-folder code and runs with page access when the button is clicked. Only load trusted action folders. This implementation matches pathname globs by single path segment and ignores query strings and hashes.

## Follow-up implementation
The route registry now lives in `src/config.json`, action metadata and code live under `src/actions/<action-id>/`, and packaged action scripts are injected with `chrome.scripting.executeScript({ files })`. Matching routes merge action IDs and duplicate keyboard keys are filtered.
