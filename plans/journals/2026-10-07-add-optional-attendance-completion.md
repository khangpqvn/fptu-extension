---
title: Add optional attendance completion
date: 2026-10-07
summary: Added a checked-by-default checkbox controlling automatic attendance completion and confirmation in both attendance modes.
---

# Add optional attendance completion

## Changes

Added `__attendance_auto_complete` in `src/actions/fap-attendance/script.js`. Both attendance modes use the shared guard in `saveAttendance()`: unchecked skips completion and confirmation, checked preserves existing behavior. The checkbox is disabled during processing and restored afterward. Updated `docs/store-description.md`.

## Verification

JavaScript syntax and `git diff --check` passed. Four Node VM checks using a simulated DOM passed: completion enabled and disabled for Roll Number attendance and all-student attendance. Checks cover selected attendance states, completion and confirmation clicks, and restored controls. Reviewed the scoped diff. No live FAP submission was performed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
