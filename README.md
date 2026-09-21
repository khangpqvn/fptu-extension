# FPTU Tools

Chrome MV3 extension for configurable utility buttons matched by domain and endpoint.

- Route registry: `src/config.json`
- Action templates: `src/actions/<action-id>/`
- Auto-run actions: set `"auto": true` in `action.json` to execute on page load without appearing in the popup
- Extension icons: `src/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`, and `icon512.png`
- Configuration guide: `docs/store-description.md`

The generated PNG icons are configured in `src/manifest.json`. Use `src/icons/icon512.png` for the Chrome Web Store listing image.

Build the extension with:

```bash
node build.js
```

The packaged extension is written to `dist/domain-shortcuts.zip`.
