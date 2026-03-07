/**
 * Background service worker (Manifest V3).
 *
 * Responsibilities:
 * 1. Create a "Analyse with TruthLens" context menu item on text selection
 * 2. Receive ANALYZE_SELECTION messages from the content script floating button
 * 3. Persist the selected text + source URL to chrome.storage.session
 * 4. Open the TruthLens side panel on the current tab
 */

// ─── Storage key ─────────────────────────────────────────────────────────────

export const STORAGE_KEY = "truthlens_pending_analysis" as const;

export interface PendingAnalysis {
  text: string;
  sourceUrl: string;
  timestamp: number;
}

function enqueuePendingAnalysis(tabId: number, text: string, sourceUrl: string): void {
  const pending: PendingAnalysis = {
    text,
    sourceUrl,
    timestamp: Date.now(),
  };

  chrome.sidePanel.open({ tabId });
  chrome.storage.session.set({ [STORAGE_KEY]: pending });
}

// ─── Side panel + context menu setup ─────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // Allow the side panel to open when the toolbar icon is clicked.
  // NOTE: this only works when default_popup is NOT set in the manifest.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Create the right-click context menu item (only visible when text is selected).
  chrome.contextMenus.create({
    id: "truthlens-analyze",
    title: "Analyse with TruthLens",
    contexts: ["selection"],
  });
});

// ─── Context menu click handler ───────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "truthlens-analyze") return;

  const tabId = tab?.id;
  if (tabId == null) return;

  const text = info.selectionText?.trim() ?? "";
  if (!text) return;

  enqueuePendingAnalysis(tabId, text, tab?.url ?? info.pageUrl ?? "");
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "ANALYZE_SELECTION") {
    const tabId = sender.tab?.id;
    if (tabId == null) return;
    enqueuePendingAnalysis(tabId, msg.text, msg.sourceUrl);
  }
})