// ===== Settings you can tweak =====
const TOP_N_DEFAULT = 6;          // how many tabs to prioritize
const REORDER_DELAY_MS = 1200;    ///wait 1.2s after activity to avoid jittery reorders.
const PIN_TOP = false;            // the top N get pinned to the left (true/false)
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 min before snoozing
const KEEP_MODIFIED_AWAKE = false;
// ==================================

/**
 * usage: { [windowId]: { [tabId]: scoreNumber } }
 * Simple heuristic: +1 each time a tab is activated, +0.5 when it finishes loading while active.
 */
const usage = {}; // per-window tab usage scores
const timers = {}; // per-window debouncers
const modifiedTabs = {}; // per-window "dirty" check for inputs



// Schedule a reorder of tabs in the given window after a short delay.

function scheduleReorder(windowId) {// schedule a reorder for the given windowId
  clearTimeout(timers[windowId]);// cancel any existing timer
  // set a new timer
  timers[windowId] = setTimeout(() => {
    reorderWindow(windowId).catch(() => {});// ignore errors
  }, REORDER_DELAY_MS);
}


// Get the top N tabs by usage score in the given window.

async function getTopNTabs(windowId, n) {
  const tabs = await chrome.tabs.query({ windowId });// all tabs in the window
  const winUsage = usage[windowId] || {};// usage scores for this window
  // Score tabs, sort by score descending, take top N
  const scored = tabs
    .filter(t => !t.pinned)                             // ignore pinned when ranking for movement (unless PIN_TOP)
    .map(t => ({ tab: t, score: winUsage[t.id] || 0 })) // pair each tab with its score
    .sort((a, b) => b.score - a.score)                  // sort descending by score
    .slice(0, n)                                        // take top N
    .map(x => x.tab);                                   // extract tabs from pairs
  return scored;                                        // return top N tabs
}
// Reorder tabs in the given window so that the top N by usage score are at the front.

//Reads a user-saved topN (if set), falling back to 6.
///Gets all tabs; early exit if none.
//Computes the current top-N.
async function reorderWindow(windowId) {
  const { topN } = await chrome.storage.local.get("topN");// get user setting
  const N = topN || TOP_N_DEFAULT;// default if not set
  const allTabs = await chrome.tabs.query({ windowId });// all tabs in the window
  if (!allTabs.length) return; // nothing to do if no tabs

  // Get the top-N tabs by usage score
    const top = await getTopNTabs(windowId, N);
  
  
  
  async function saveSnoozableTabs(windowId, allTabs, topTabs) {
  const topSet = new Set(topTabs.map(t => t.id));

  // Filter out the active ones
  const snoozable = allTabs
    .filter(t => !topSet.has(t.id))
    .map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      windowId,
      discarded: t.discarded || false
    }));
  const existing = (await chrome.storage.local.get("snoozableTabs")).snoozableTabs || {};

  existing[windowId] = {
    updated: Date.now(),
    tabs: snoozable
  };

  await chrome.storage.local.set({ snoozableTabs: existing });

  console.log(`Saved ${snoozable.length} snoozable tabs for window ${windowId}`);
}

 // Pinning mode: top-N are pinned; everyone else unpinned. If PIN_TOP is true, pin the top-N tabs and unpin the rest
  if (PIN_TOP) {
    // Pin the top-N and unpin the rest (optional behavior)
    const topSet = new Set(top.map(t => t.id));// IDs of top N tabs

    
    // Update pin state of all tabs in parallel
    //Promise.allSettled guards against special tabs that can’t be updated.

    await Promise.allSettled(
      allTabs.map(t => chrome.tabs.update(t.id, { pinned: topSet.has(t.id) }))
    );// ignore individual failures

    //  move pinned tabs to the far left in the same visual order:
    let i = 0; // target index for pinned tabs
    // Move each top tab to the next index
    for (const t of top) {
        
      try { await chrome.tabs.move(t.id, { index: i++ }); } catch {} // ignore move failures (e.g., chrome:// tabs)// increment target index
      
    }
    return;// done if pinning
  }

  // Move top-N (unpinned) tabs to indices 0..N-1 in order of score
  let index = 0;// next target index
  // Move each top tab to the next index
  for (const t of top) {
    try {
      await chrome.tabs.move(t.id, { index });// move tab to target index
      index++;// increment target index
    } catch {
      /* ignore move failures (e.g., chrome:// tabs) */
    }
  }

  // --- Snooze inactive tabs beyond top-N ---
const now = Date.now();
usage[windowId] = usage[windowId] || {};
const topSet = new Set(top.map(t => t.id));

for (const t of allTabs) {
  if (topSet.has(t.id)) continue; // skip top N
  if (modifiedTabs[t.id] || KEEP_MODIFIED_AWAKE === true) continue;
  const lastActive = usage[windowId][t.id]?.lastUsed || 0;
  if (now - lastActive > INACTIVITY_LIMIT_MS) {
    try {
      await chrome.tabs.discard(t.id);
      console.log(`Snoozed tab: ${t.title}`);
    } catch (e) {
      console.warn(`Could not snooze tab ${t.title}:`, e);
    }
  }
}
await saveSnoozableTabs(windowId, allTabs, top);
}

// --- Listeners to track usage ---


//Every time you switch to a tab, that tab’s score +1.
//Then we schedule a (debounced) reorder for that window.

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  usage[windowId] = usage[windowId] || {};// ensure window entry
  const data = usage[windowId][tabId] || { score: 0, lastUsed: Date.now() };
  data.score += 1;// increment score
  data.lastUsed = Date.now();
  usage[windowId][tabId] = data;
  scheduleReorder(windowId);// schedule reorder
});

// When the active tab finishes loading, give it a smaller bump (+0.5).
//Then schedule a reorder.


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // only care about completed loads of the active tab
  if (changeInfo.status === "complete" && tab.active) {
    const w = tab.windowId;// window ID
    usage[w] = usage[w] || {};// ensure window entry
    const data = usage[w][tabId] || { score: 0, lastUsed: Date.now() };
    data.score += 0.5;// increment score
    data.lastUsed = Date.now();
    usage[w][tabId] = data;
    scheduleReorder(w);// schedule reorder

    // Detect user modification
     try {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (id) => {
          document.addEventListener(
            "input",
            () => {
              chrome.runtime.sendMessage({ type: "tabModified", tabId: id });
            },
            { once: true }
          );
        },
        args: [tabId],
      });
    } catch (e) {
      console.warn("Could not inject input listener:", e);
    }
  }
});


// When a window is removed, clean up its usage data // Clean up score table when a tab closes.
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const w = removeInfo.windowId;
  if (usage[w]) delete usage[w][tabId];
});

// When a tab is moved to a new window, clean up its usage data in the old window 
chrome.tabs.onDetached.addListener((tabId, { oldWindowId }) => {
  if (usage[oldWindowId]) delete usage[oldWindowId][tabId];
});

// Clicking the toolbar button forces an immediate sort for the current window
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.windowId == null) return;
  await reorderWindow(tab.windowId);
});

// work on sleeping the outer six tabs to kill their memory usage
// check for if user inout has updated the tabs