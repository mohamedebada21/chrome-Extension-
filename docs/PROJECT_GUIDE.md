# Top Tabs Organizer project guide

## What to demonstrate

Explain how tab activation events update usage, how debouncing reduces repeated movement, and how browser APIs manipulate tab order. Treat reliable ranking and safe snoozing as unfinished work.

## Code reading order

1. Read the constants at the top of [bg.js](../bg.js).
2. Trace `onActivated` and `onUpdated` into `scheduleReorder`.
3. Inspect `getTopNTabs` and compare its expected score type with the objects written by the listeners.
4. Follow `reorderWindow` into movement, discard, and storage.
5. Compare API calls with permissions in [manifest.json](../manifest.json).

## Manual validation checklist

Run only with disposable tabs in a separate profile.

- Confirm the unpacked extension loads; inspect service-worker errors.
- Open at least eight tabs and record initial order.
- Activate selected tabs repeatedly; check actual ordering against expected scores.
- Repeat with pinned tabs and multiple windows.
- Check toolbar behavior separately from automatic behavior.
- Inspect overflow and snoozed records in local extension storage.
- Check never-activated tabs and the inactivity threshold.
- Restart the worker and record which state survives.
- Confirm that pages with unsaved input are protected before enabling any routine discard workflow.

Record actual results with the browser version and commit. No browser checks were run as part of this documentation update.

## Improvement order

1. Read the numeric `score` field consistently in ranking.
2. Make discard opt-in and protect active, pinned, and unsaved-work tabs.
3. Design input detection and permissions together, with a receiving message handler and clear user consent.
4. Persist the activity state needed across service-worker restarts.
5. Add focused tests for ranking, inactivity boundaries, and worker restoration.
6. Add an options page and actual demonstration screenshots.

A short, accurate prototype is a better interview artifact than a larger list of unverified features.
