/**
 * Content script — injected into every page.
 * Watches for text selections and shows a floating "Analyze with TruthLens"
 * button near the selection anchor. Clicking it sends the selected text to the
 * background service worker, which stores it and opens the side panel.
 */

const BUTTON_ID = "truthlens-analyze-btn";
const SCAM_POPUP_ID = "truthlens-scam-popup";
const UI_ATTR = "data-truthlens-ui";
const INIT_KEY = "__truthlensHandlersInitialized";

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

function markTruthLensUi(el: HTMLElement): void {
  el.setAttribute(UI_ATTR, "true");
}

function isTruthLensUiTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(`[${UI_ATTR}]`) ||
    target.closest(`#${BUTTON_ID}`) ||
    target.closest(`#${SCAM_POPUP_ID}`)
  );
}

function createButton(x: number, y: number, selectedText: string): void {
  removeButton();

  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  markTruthLensUi(btn);
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

// ─── Scam Detection ───────────────────────────────────────────────────────────

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
  markTruthLensUi(popup);

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

// ─── Global document handlers ─────────────────────────────────────────────────

function handleDocumentMouseUp(): void {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(handleSelectionChange, 80);
}

function handleDocumentMouseDown(e: MouseEvent): void {
  if (isTruthLensUiTarget(e.target)) return;

  const btn = document.getElementById(BUTTON_ID);
  if (btn && !btn.contains(e.target as Node)) {
    removeButton();
  }

  const popup = document.getElementById(SCAM_POPUP_ID);
  if (popup && !popup.contains(e.target as Node)) {
    removeScamPopup();
  }
}

function handleDocumentMouseMove(e: MouseEvent): void {
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}

async function handleDocumentClick(e: MouseEvent): Promise<void> {
  if (scamCheckInProgress) return;
  if (isTruthLensUiTarget(e.target)) return;

  const target = e.target as HTMLElement;
  const el = target.closest(
    "a, button, input[type=submit], input[type=button], [role=button]"
  ) as HTMLElement | null;
  if (!el) return;

  // On WhatsApp Web, only intercept <a> link clicks inside message containers
  // (identified by the [data-id] attribute that WhatsApp puts on each message row).
  // Buttons / form controls belong to WhatsApp's own UI — leave them alone.
  if (isOnWhatsApp()) {
    const isMessageLink = el.tagName === "A" && Boolean(el.closest("[data-id]"));
    if (!isMessageLink) return;
  }

  if (approvedElements.has(el)) {
    approvedElements.delete(el);
    return;
  }

  if (pendingElements.has(el)) {
    approvedElements.add(el);
    return;
  }

  let targetUrl: string | undefined;
  if (el.tagName === "A") {
    const href = (el as HTMLAnchorElement).href;
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

  const prevOpacity = el.style.opacity;
  el.style.opacity = "0.5";
  pendingElements.add(el);
  const result = await fetchScamAnalysis(targetUrl, buttonText);
  pendingElements.delete(el);
  el.style.opacity = prevOpacity;

  if (approvedElements.has(el)) {
    approvedElements.delete(el);
    scamCheckInProgress = true;
    el.click();
    scamCheckInProgress = false;
    return;
  }

  if (!result || result.safetyScore > 100) {
    scamCheckInProgress = true;
    el.click();
    scamCheckInProgress = false;
    return;
  }

  approvedElements.add(el);
  const proceedBtn = showScamPopup(e.clientX, e.clientY, result.safetyScore, result.summary);
  proceedBtn.addEventListener("click", () => {
    removeScamPopup();
    el.click();
  });
  document.getElementById("scam-cancel-btn")!.addEventListener("click", () => {
    approvedElements.delete(el);
    removeScamPopup();
  }, { once: true });
}

async function handleDocumentSubmit(e: SubmitEvent): Promise<void> {
  if (scamCheckInProgress) return;
  if (isTruthLensUiTarget(e.target)) return;
  // WhatsApp's form submissions are internal app actions — never intercept them
  if (isOnWhatsApp()) return;

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
}

// ─── WhatsApp FactCheck Feature ─────────────────────────────────────────────

const WA_HOSTNAME = "web.whatsapp.com";
const FACTCHECK_BTN_CLASS = "tl-factcheck-btn";

function isOnWhatsApp(): boolean {
  return window.location.hostname === WA_HOSTNAME;
}

function getWhatsAppMessageText(msgEl: Element): string {
  const copyable = msgEl.querySelector(".copyable-text");
  if (copyable?.textContent) return copyable.textContent.trim();
  const selectable = msgEl.querySelector(".selectable-text");
  if (selectable?.textContent) return selectable.textContent.trim();
  return msgEl.textContent?.trim() ?? "";
}

/**
 * Inject the FactCheck button into WhatsApp's action items row — the flex row
 * that holds the 😊 React button. Our button lives there as a peer icon so it
 * appears and disappears together with the rest of the hover actions.
 *
 * DOM path (from actual WhatsApp HTML):
 *   [data-id]
 *     …
 *     div._amj_                           ← reaction container (shown on hover)
 *       div.x1djpfga                      ← flex items row  ← INSERT HERE
 *         div > div[aria-label="React"]   ← emoji react button
 *
 * WhatsApp adds [aria-label="React"] lazily on hover and REMOVES it on unhover.
 * We mirror that lifecycle: inject when React appears, remove when React leaves.
 */

// Maps each React button element → our injected wrapper div, for cleanup
const reactToWrapper = new WeakMap<Element, Element>();

function injectFactCheckBtn(msgEl: Element): void {
  const text = getWhatsAppMessageText(msgEl);
  if (!text || text.length < 10) return;

  const reactBtn = msgEl.querySelector('[aria-label="React"]');
  if (!reactBtn) return;
  if (reactToWrapper.has(reactBtn)) return; // already injected for this instance

  const reactWrapper = reactBtn.parentElement;        // <div> wrapping the React button
  const itemsRow = reactWrapper?.parentElement;        // the flex row of action items
  if (!itemsRow) return;

  // Build a 32 × 32 circle icon that matches WhatsApp's own action button style
  const btn = document.createElement("button");
  btn.className = FACTCHECK_BTN_CLASS;
  markTruthLensUi(btn);
  btn.title = "FactCheck this message";
  btn.innerHTML = `<span style="font-size:16px;line-height:1;pointer-events:none;">🔍</span>`;

  Object.assign(btn.style, {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "0",
    flexShrink: "0",
    transition: "background 0.12s ease",
  } as Partial<CSSStyleDeclaration>);

  btn.addEventListener("mouseenter", () => { btn.style.background = "rgba(0,0,0,0.08)"; });
  btn.addEventListener("mouseleave", () => { btn.style.background = "transparent"; });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    chrome.runtime.sendMessage({
      type: "ANALYZE_SELECTION",
      text,
      sourceUrl: window.location.href,
    } satisfies AnalyzeSelectionMessage);
  });

  // Wrap in a <div> like WhatsApp does for each action item, insert before React
  const itemWrapper = document.createElement("div");
  itemWrapper.appendChild(btn);
  itemsRow.insertBefore(itemWrapper, reactWrapper);

  // Track so we can remove our wrapper when WhatsApp removes the React button
  reactToWrapper.set(reactBtn, itemWrapper);
}

let waObserver: MutationObserver | null = null;

function setupWhatsAppObserver(): void {
  if (waObserver) return;

  if (!document.getElementById("tl-wa-style")) {
    const s = document.createElement("style");
    s.id = "tl-wa-style";
    s.textContent = `.${FACTCHECK_BTN_CLASS}:active { transform: scale(0.88); }`;
    document.head.appendChild(s);
  }

  const scan = () => document.querySelectorAll("[data-id]").forEach(injectFactCheckBtn);

  waObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // ── Nodes added ──────────────────────────────────────────────────────
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // New message row
        if (node.hasAttribute("data-id")) injectFactCheckBtn(node);
        node.querySelectorAll("[data-id]").forEach(injectFactCheckBtn);

        // React button rendered lazily → inject into its row
        const added: Element[] = [];
        if (node.matches('[aria-label="React"]')) added.push(node);
        node.querySelectorAll('[aria-label="React"]').forEach((b) => added.push(b));
        for (const rb of added) {
          const row = rb.closest("[data-id]");
          if (row) injectFactCheckBtn(row);
        }
      }

      // ── Nodes removed ─────────────────────────────────────────────────────
      // WhatsApp removes [aria-label="React"] on unhover — remove our button too
      for (const node of mutation.removedNodes) {
        if (!(node instanceof Element)) continue;

        const removed: Element[] = [];
        if (node.matches('[aria-label="React"]')) removed.push(node);
        node.querySelectorAll('[aria-label="React"]').forEach((b) => removed.push(b));
        for (const rb of removed) {
          const wrapper = reactToWrapper.get(rb);
          wrapper?.remove();
          reactToWrapper.delete(rb);
        }
      }
    }
  });

  waObserver.observe(document.body, { childList: true, subtree: true });
  setTimeout(scan, 800);
  window.addEventListener("hashchange", () => setTimeout(scan, 400), { passive: true });
}

// ─── Global document handlers ─────────────────────────────────────────────────

function setupGlobalDocumentHandlers(): void {
  document.addEventListener("mouseup", handleDocumentMouseUp);
  document.addEventListener("mousedown", handleDocumentMouseDown);
  document.addEventListener("scroll", removeButton, { passive: true });
  document.addEventListener("mousemove", handleDocumentMouseMove, { passive: true });
  document.addEventListener("click", handleDocumentClick, true);
  document.addEventListener("submit", handleDocumentSubmit, true);
}

if (!(globalThis as Record<string, unknown>)[INIT_KEY]) {
  (globalThis as Record<string, unknown>)[INIT_KEY] = true;
  setupGlobalDocumentHandlers();
  if (isOnWhatsApp()) setupWhatsAppObserver();
}
