// ===== Settings you can tweak =====
const TOP_N_DEFAULT = 6;          // how many tabs to prioritize
const REORDER_DELAY_MS = 1200;    // debounce so it doesn't reshuffle constantly
const PIN_TOP = false;            // set true to pin top-N (and unpin others)
// ==================================

/**
 * usage: { [windowId]: { [tabId]: scoreNumber } }
 * Simple heuristic: +1 each time a tab is activated, +0.5 when it finishes loading while active.
 */
const usage = {};
const timers = {}; // per-window debouncers

function scheduleReorder(windowId) {
  clearTimeout(timers[windowId]);
  timers[windowId] = setTimeout(() => {
    reorderWindow(windowId).catch(() => {});
  }, REORDER_DELAY_MS);
}

async function getTopNTabs(windowId, n) {
  const tabs = await chrome.tabs.query({ windowId });
  const winUsage = usage[windowId] || {};
  const scored = tabs
    .filter(t => !t.pinned) // ignore pinned when ranking for movement (unless PIN_TOP)
    .map(t => ({ tab: t, score: winUsage[t.id] || 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => x.tab);
  return scored;
}

async function reorderWindow(windowId) {
  const { topN } = await chrome.storage.local.get("topN");
  const N = topN || TOP_N_DEFAULT;

  const allTabs = await chrome.tabs.query({ windowId });
  if (!allTabs.length) return;

  const top = await getTopNTabs(windowId, N);

  if (PIN_TOP) {
    // Pin the top-N and unpin the rest (optional behavior)
    const topSet = new Set(top.map(t => t.id));
    await Promise.allSettled(
      allTabs.map(t => chrome.tabs.update(t.id, { pinned: topSet.has(t.id) }))
    );
    // Optionally move pinned tabs to the far left in the same visual order:
    let i = 0;
    for (const t of top) {
      try { await chrome.tabs.move(t.id, { index: i++ }); } catch {}
    }
    return;
  }

  // Move top-N (unpinned) tabs to indices 0..N-1 in order of score
  let index = 0;
  for (const t of top) {
    try {
      await chrome.tabs.move(t.id, { index });
      index++;
    } catch {
      /* ignore move failures (e.g., chrome:// tabs) */
    }
  }
}

// --- Listeners to track usage ---
chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  usage[windowId] = usage[windowId] || {};
  usage[windowId][tabId] = (usage[windowId][tabId] || 0) + 1;
  scheduleReorder(windowId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    const w = tab.windowId;
    usage[w] = usage[w] || {};
    usage[w][tabId] = (usage[w][tabId] || 0) + 0.5;
    scheduleReorder(w);
  }
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const w = removeInfo.windowId;
  if (usage[w]) delete usage[w][tabId];
});

chrome.tabs.onDetached.addListener((tabId, { oldWindowId }) => {
  if (usage[oldWindowId]) delete usage[oldWindowId][tabId];
});

// Click the toolbar icon to force an immediate sort for the current window
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.windowId == null) return;
  await reorderWindow(tab.windowId);
});
