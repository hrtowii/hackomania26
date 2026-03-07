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

// ─── Scam Detection ───────────────────────────────────────────────────────────

const SCAM_POPUP_ID = "truthlens-scam-popup";
const BACKEND_URL = "http://localhost:3000";

/** Set to true while we programmatically re-fire a click/submit so the
 *  interceptor ignores it and doesn't trigger a second analysis. */
let scamCheckInProgress = false;

/** Elements the user has explicitly approved — next click passes through once. */
const approvedElements = new WeakSet<HTMLElement>();

/** Elements currently being analysed — re-clicking during the async AI call
 *  passes through immediately rather than spawning a second popup. */
const pendingElements = new WeakSet<HTMLElement>();

/** Track last known mouse position so the popup can anchor to it even on
 *  form submits triggered by keyboard / Enter key. */
let lastMouseX = window.innerWidth / 2;
let lastMouseY = window.innerHeight / 2;

document.addEventListener("mousemove", (e) => {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}, { passive: true });

function removeScamPopup(): void {
  document.getElementById(SCAM_POPUP_ID)?.remove();
}

/**
 * Render a floating warning card anchored near the user's cursor.
 * Returns the "Proceed anyway" button so callers can wire the action to it.
 */
function showScamPopup(
  x: number,
  y: number,
  safetyScore: number,
  summary: string
): HTMLButtonElement {
  removeScamPopup();

  const accentColor =
    safetyScore >= 90 ? "#22c55e" :   // green  — safe
    safetyScore >= 70 ? "#84cc16" :   // lime   — mostly safe
    safetyScore >= 50 ? "#f59e0b" :   // amber  — caution
    safetyScore >= 25 ? "#f97316" :   // orange — suspicious
                        "#ef4444";    // red    — likely scam

  const emoji =
    safetyScore >= 90 ? "✅" :
    safetyScore >= 70 ? "🟡" :
    safetyScore >= 50 ? "⚠️" :
                        "🚨";

  const label =
    safetyScore >= 90 ? "Safe" :
    safetyScore >= 70 ? "Mostly Safe" :
    safetyScore >= 50 ? "Caution" :
    safetyScore >= 25 ? "Suspicious" :
                        "Likely Scam";

  // Conic-gradient safety ring
  const ringDeg = safetyScore * 3.6;

  const popup = document.createElement("div");
  popup.id = SCAM_POPUP_ID;

  popup.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="font-size:20px;">${emoji}</span>
      <div style="flex:1;">
        <div style="font-weight:700;font-size:13px;color:${accentColor};">${label}</div>
        <div style="font-size:11px;color:#aaa;margin-top:1px;">ScamShield SG</div>
      </div>
      <div style="
        width:40px;height:40px;border-radius:50%;flex-shrink:0;
        background:conic-gradient(${accentColor} ${ringDeg}deg,#333 ${ringDeg}deg);
        display:flex;align-items:center;justify-content:center;
      ">
        <div style="
          width:28px;height:28px;border-radius:50%;background:#1a1a2e;
          display:flex;align-items:center;justify-content:center;
          font-size:9px;font-weight:700;color:${accentColor};
        ">${safetyScore}%</div>
      </div>
    </div>
    <div style="font-size:12px;color:#ccc;line-height:1.4;margin-bottom:10px;padding:6px 8px;background:rgba(255,255,255,0.05);border-radius:6px;">
      ${summary}
    </div>
    <div style="display:flex;gap:8px;">
      <button id="scam-proceed-btn" style="
        flex:1;padding:5px 8px;background:#2a2a3e;color:#ccc;
        border:1px solid #555;border-radius:5px;cursor:pointer;
        font-size:11px;font-family:system-ui,sans-serif;
      ">Proceed anyway</button>
      <button id="scam-cancel-btn" style="
        flex:1;padding:5px 8px;background:${accentColor};color:#fff;
        border:none;border-radius:5px;cursor:pointer;
        font-size:11px;font-weight:600;font-family:system-ui,sans-serif;
      ">Cancel</button>
    </div>
  `;

  Object.assign(popup.style, {
    position: "fixed",
    left: `${Math.min(x + 12, window.innerWidth - 275)}px`,
    top: `${Math.max(y - 170, 8)}px`,
    width: "255px",
    zIndex: "2147483647",
    background: "#1a1a2e",
    border: `1px solid ${accentColor}`,
    borderRadius: "10px",
    padding: "12px",
    boxShadow: "0 8px 28px rgba(0,0,0,0.65)",
    fontFamily: "system-ui, sans-serif",
    animation: "scam-fadein 0.15s ease",
  } as Partial<CSSStyleDeclaration>);

  // Inject keyframe once
  if (!document.getElementById("truthlens-scam-style")) {
    const style = document.createElement("style");
    style.id = "truthlens-scam-style";
    style.textContent = `@keyframes scam-fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
  }

  document.body.appendChild(popup);

  document.getElementById("scam-cancel-btn")!.addEventListener("click", removeScamPopup);

  return document.getElementById("scam-proceed-btn") as HTMLButtonElement;
}

interface ScamResult {
  safetyScore: number;
  summary: string;
}

async function fetchScamAnalysis(
  targetUrl: string | undefined,
  buttonText: string | undefined
): Promise<ScamResult | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/scam-detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_url: targetUrl,
        page_url: window.location.href,
        button_text: buttonText,
        page_title: document.title,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { safety_score: number; summary: string };
    return { safetyScore: data.safety_score, summary: data.summary };
  } catch {
    return null; // silently fail — don't block the user
  }
}

// ─── Click interceptor (capture phase — runs before page handlers) ────────────

document.addEventListener(
  "click",
  async (e: MouseEvent) => {
    if (scamCheckInProgress) return;

    const target = e.target as HTMLElement;
    // Ignore clicks that originate inside our own popup
    if (target.closest(`#${SCAM_POPUP_ID}`)) return;

    const el = target.closest(
      "a, button, input[type=submit], input[type=button], [role=button]"
    ) as HTMLElement | null;
    if (!el) return;

    // User already approved this element — let it through and clear the approval
    if (approvedElements.has(el)) {
      approvedElements.delete(el);
      return;
    }

    // Analysis already in-flight for this element — treat re-click as proceed
    if (pendingElements.has(el)) {
      approvedElements.add(el); // mark so the natural click passes through
      return;
    }

    // Determine destination
    let targetUrl: string | undefined;
    if (el.tagName === "A") {
      const href = (el as HTMLAnchorElement).href;
      // Skip pure hash anchors on the same page
      if (href && !href.startsWith(window.location.origin + "#")) {
        targetUrl = href;
      }
    } else {
      const form = el.closest("form") as HTMLFormElement | null;
      if (form?.action) targetUrl = form.action;
    }

    e.preventDefault();
    e.stopImmediatePropagation();

    const buttonText =
      (el.textContent?.trim().slice(0, 120)) ||
      ((el as HTMLInputElement).value?.slice(0, 120));

    // Dim element to signal processing
    const prevOpacity = el.style.opacity;
    el.style.opacity = "0.5";
    pendingElements.add(el);
    const result = await fetchScamAnalysis(targetUrl, buttonText);
    pendingElements.delete(el);
    el.style.opacity = prevOpacity;

    // If the user already re-clicked during analysis, just proceed
    if (approvedElements.has(el)) {
      approvedElements.delete(el);
      scamCheckInProgress = true;
      el.click();
      scamCheckInProgress = false;
      return;
    }

    if (!result || result.safetyScore > 100) {
      // Safe or analysis unavailable — proceed transparently
      scamCheckInProgress = true;
      el.click();
      scamCheckInProgress = false;
      return;
    }

    // Risky — show warning popup
    // Pre-approve the element so that clicking it again (step 4) passes through
    approvedElements.add(el);
    const proceedBtn = showScamPopup(e.clientX, e.clientY, result.safetyScore, result.summary);
    proceedBtn.addEventListener("click", () => {
      removeScamPopup();
      el.click(); // approvedElements already has el, so it passes through
    });
    document.getElementById("scam-cancel-btn")!.addEventListener("click", () => {
      approvedElements.delete(el); // revoke approval on cancel
      removeScamPopup();
    }, { once: true });
  },
  true // capture phase
);

// ─── Form submit interceptor ──────────────────────────────────────────────────

document.addEventListener(
  "submit",
  async (e: SubmitEvent) => {
    if (scamCheckInProgress) return;

    const form = e.target as HTMLFormElement;
    e.preventDefault();
    e.stopImmediatePropagation();

    const targetUrl = form.action || window.location.href;
    const submitLabel = (e.submitter as HTMLElement | null)?.textContent?.trim().slice(0, 120);

    form.style.opacity = "0.5";
    const result = await fetchScamAnalysis(targetUrl, submitLabel ?? "Submit");
    form.style.opacity = "";

    if (!result || result.safetyScore > 100) {
      scamCheckInProgress = true;
      form.submit();
      scamCheckInProgress = false;
      return;
    }

    const proceedBtn = showScamPopup(lastMouseX, lastMouseY, result.safetyScore, result.summary);
    proceedBtn.addEventListener("click", () => {
      removeScamPopup();
      scamCheckInProgress = true;
      form.submit();
      scamCheckInProgress = false;
    });
  },
  true // capture phase
);

// Dismiss popup when clicking outside of it
document.addEventListener("mousedown", (e) => {
  const popup = document.getElementById(SCAM_POPUP_ID);
  if (popup && !popup.contains(e.target as Node)) {
    removeScamPopup();
  }
});
