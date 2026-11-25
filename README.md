# Top Tabs Organizer — Chrome Extension

A small Chrome Manifest V3 prototype for prioritizing frequently used tabs. It tracks tab activity, attempts to move the top six toward the left, and records overflow/snoozed tab information locally.

**Status:** experimental prototype. Known implementation issues remain; use a separate browser profile with disposable tabs for evaluation.

## Why this project

A focused browser-automation example using Chrome tab events, a background service worker, local extension storage, and debounced operations.

## Install for development

```sh
git clone https://github.com/mohamedebada21/chrome-Extension-.git
cd chrome-Extension-
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this repository.
4. Open disposable tabs, switch between them, and use the toolbar action to request organization.

The current code can automatically reorder and discard tabs. Do not evaluate it with unsaved work.

## Repository map

| File | Responsibility |
| --- | --- |
| [manifest.json](manifest.json) | Extension metadata, permissions, and background worker |
| [bg.js](bg.js) | Usage tracking, ranking, tab movement, and local storage |
| [Project guide](docs/PROJECT_GUIDE.md) | Manual checks, limitations, and improvement order |

## Current behavior and limitations

- The default target is six tabs; source constants control timing and pinning.
- The script reads a stored `topN` value, but no settings interface is included.
- Usage records contain objects while the ranking function treats them as numeric scores. Ranking needs correction.
- Input-change detection calls `chrome.scripting`, which is not included in the manifest permissions, and there is no receiving message handler.
- Activity state is held in memory and may be lost when the service worker restarts.
- The inactivity/discard behavior needs review, especially for never-observed tabs.
- There is no automated test suite or verified browser compatibility matrix.

These limitations are part of the project backlog, not completed features. The [project guide](docs/PROJECT_GUIDE.md) gives a practical validation checklist.

## Privacy

The source stores overflow and snoozed tab metadata, including URLs and titles, in Chrome local extension storage. No remote service integration appears in the two implementation files reviewed. Local storage can still contain sensitive browsing information; use a clean test profile.

## References

[Chrome extension development](https://developer.chrome.com/docs/extensions/get-started), [Tabs API](https://developer.chrome.com/docs/extensions/reference/api/tabs), and [service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
