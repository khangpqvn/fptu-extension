/**
 * Example auto-run script: compute and modify the current page DOM on load.
 *
 * Replace this template with your own logic. The script runs in the MAIN
 * world so it has full access to the page's DOM and JavaScript globals.
 */
(function autoDomModifier() {
  'use strict';
  console.log("Ong ban Tat");
  // --- Example: count and log all headings ---
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log(`[auto-dom-modifier] Found ${headings.length} heading(s) on ${location.hostname}`);

  // --- Example: add a subtle top banner ---
  const banner = document.createElement('div');
  banner.textContent = `Domain Shortcuts active — ${headings.length} heading(s) detected`;
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    padding: '4px 12px',
    background: '#1e1e2e',
    color: '#cdd6f4',
    fontSize: '12px',
    zIndex: '2147483647',
    textAlign: 'center',
    opacity: '0.9',
    pointerEvents: 'none',
  });
  document.body.appendChild(banner);

  // Auto-remove the banner after 3 seconds
  setTimeout(() => banner.remove(), 3000);
})();
