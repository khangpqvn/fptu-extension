---
title: Add assignment status radio selection
date: 2026-10-07
summary: "Added Pass (9), Reject (8), and Draft (5) options to ct-auto-approve, defaulting to Pass."
---

# Add assignment status radio selection

## Changes

Added a status radio group to `src/actions/ct-auto-approve/script.js`. The selected value and label flow through assignment processing, status verification, and logs. The group is disabled when processing starts. Updated `docs/store-description.md`.

## Verification

`node --check src/actions/ct-auto-approve/script.js`, `node test-config-matching.js` (6 passed), and `git diff --check` passed. Reviewed the diff for default selection, radio grouping, status propagation, and existing skip behavior. Live browser and assignment submission were not tested.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
