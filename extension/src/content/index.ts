/**
 * Content script — injected into every page.
 * Watches for text selections and shows a floating "Analyze with TruthLens"
 * button near the selection anchor. Clicking it sends the selected text to the
 * background service worker, which stores it and opens the side panel.
 */

const BUTTON_ID = "truthlens-analyze-btn";

// ─── Message types (shared with background) ──────────────────────────────────

export interface AnalyzeSelectionMessage {
  type: "ANALYZE_SELECTION";
  text: string;
  sourceUrl: string;
}

// ─── Button helpers ───────────────────────────────────────────────────────────

function removeButton(): void {
  document.getElementById(BUTTON_ID)?.remove();
}

function createButton(x: number, y: number, selectedText: string): void {
  removeButton();

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.textContent = "🔍 Analyze with TruthLens";

  Object.assign(btn.style, {
    position: "fixed",
    left: `${x}px`,
    top: `${y - 40}px`,
    zIndex: "2147483647",
    background: "#1a1a2e",
    color: "#e0e0ff",
    border: "1px solid #7c7cff",
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    transition: "opacity 0.15s ease",
    userSelect: "none",
    whiteSpace: "nowrap",
  } as Partial<CSSStyleDeclaration>);

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#2a2a4e";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#1a1a2e";
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeButton();

    const msg: AnalyzeSelectionMessage = {
      type: "ANALYZE_SELECTION",
      text: selectedText,
      sourceUrl: window.location.href,
    };

    chrome.runtime.sendMessage(msg);
    // Clear the selection so the button doesn't re-appear immediately
    window.getSelection()?.removeAllRanges();
  });

  document.body.appendChild(btn);
}

// ─── Selection listener ───────────────────────────────────────────────────────

function handleSelectionChange(): void {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";

  if (!text || text.length < 10) {
    removeButton();
    return;
  }

  // Position the button at the end of the selection range
  const range = selection!.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  const x = Math.min(rect.right, window.innerWidth - 220); // keep it on-screen
  const y = rect.top;

  createButton(x, y, text);
}

// Debounce to avoid thrashing on rapid selection changes
let debounceTimer: ReturnType<typeof setTimeout>;

document.addEventListener("mouseup", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleSelectionChange, 80);
});

// Hide button if user clicks elsewhere without selecting anything
document.addEventListener("mousedown", (e) => {
  const btn = document.getElementById(BUTTON_ID);
  if (btn && !btn.contains(e.target as Node)) {
    removeButton();
  }
});

// Hide on scroll so the fixed button doesn't drift from the text
document.addEventListener("scroll", removeButton, { passive: true });
