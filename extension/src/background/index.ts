/**
 * Background service worker (Manifest V3).
 *
 * Responsibilities:
 * 1. Receive ANALYZE_SELECTION messages from the content script
 * 2. Persist the selected text + source URL to chrome.storage.session
 * 3. Open the TruthLens side panel on the current tab
 */

import type { AnalyzeSelectionMessage } from "../content/index";

// ─── Storage key ─────────────────────────────────────────────────────────────

export const STORAGE_KEY = "truthlens_pending_analysis" as const;

export interface PendingAnalysis {
  text: string;
  sourceUrl: string;
  timestamp: number;
}

// ─── Side panel setup ─────────────────────────────────────────────────────────
// Allow the side panel to be opened programmatically on any tab.

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// ─── Message handler ──────────────────────────────────────────────────────────

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

    // Store the selection so the side panel can read it on mount
    chrome.storage.session.set({ [STORAGE_KEY]: pending }, () => {
      // Open the side panel on the tab that sent the message
      chrome.sidePanel.open({ tabId });
    });
  }
);
