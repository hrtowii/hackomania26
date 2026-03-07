/**
 * Background service worker (Manifest V3).
 *
 * Responsibilities:
 * 1. Create a "Analyse with TruthLens" context menu item on text selection
 * 2. Receive ANALYZE_SELECTION messages from the content script floating button
 * 3. Persist the selected text + source URL to chrome.storage.session
 * 4. Open the TruthLens side panel on the current tab
 */

import type { AnalyzeSelectionMessage } from "../content/index";

// ─── Storage key ─────────────────────────────────────────────────────────────

export const STORAGE_KEY = "truthlens_pending_analysis" as const;

export interface PendingAnalysis {
  text: string;
  sourceUrl: string;
  timestamp: number;
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

  const pending: PendingAnalysis = {
    text,
    sourceUrl: tab?.url ?? info.pageUrl ?? "",
    timestamp: Date.now(),
  };

  // Open the side panel first — we are directly inside a user-gesture handler,
  // so Chrome will allow this call. Store afterwards.
  chrome.sidePanel.open({ tabId });
  chrome.storage.session.set({ [STORAGE_KEY]: pending });
});

// ─── Message handler (floating button in content script) ──────────────────────

chrome.runtime.onMessage.addListener(
  (message: AnalyzeSelectionMessage, sender, _sendResponse) => {
    if (message.type !== "ANALYZE_SELECTION") return;

    const tabId = sender.tab?.id;
    if (tabId == null) return;

    const pending: PendingAnalysis = {
      text: message.text,
      sourceUrl: message.sourceUrl,
      timestamp: Date.now(),
    };

    // Open the side panel immediately while still in the message-handler
    // synchronous frame, then persist the data.
    chrome.sidePanel.open({ tabId });
    chrome.storage.session.set({ [STORAGE_KEY]: pending });
  }
);
