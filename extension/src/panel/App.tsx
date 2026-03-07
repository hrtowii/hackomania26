import { useEffect, useState } from "react";
import type { PendingAnalysis } from "../background/index";
import { STORAGE_KEY } from "../background/index";


type Language = "en" | "zh" | "ms" | "ta" | "singlish";

type RiskLevel = "safe" | "caution" | "suspicious";

interface CrossReference {
  source: string;
  contradiction_level: "low" | "medium" | "high";
  url: string;
}

interface AnalysisResult {
  analysis_id: string;
  credibility_score: number;
  risk_level: RiskLevel;
  summary: string;
  bias_detected: string[];
  cross_references: CrossReference[];
  key_claims: string[];
  recommendation: string;
  audio_url?: string;
}

type AppState =
  | { status: "idle" }
  | { status: "loaded"; pending: PendingAnalysis }
  | { status: "loading" }
  | { status: "success"; result: AnalysisResult }
  | { status: "error"; message: string };


const BACKEND_URL = "http://localhost:3000";

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "#22c55e",
  caution: "#f59e0b",
  suspicious: "#ef4444",
};

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ms", label: "Melayu" },
  { value: "ta", label: "தமிழ்" },
  { value: "singlish", label: "Singlish" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 70
      ? RISK_COLORS.safe
      : score >= 40
        ? RISK_COLORS.caution
        : RISK_COLORS.suspicious;

  return (
    <div
      style={{
        width: 72,
        height: 72,
        borderRadius: "50%",
        border: `5px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22,
        fontWeight: 700,
        color,
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        background: `${color}22`,
        color,
        border: `1px solid ${color}55`,
        borderRadius: 4,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [language, setLanguage] = useState<Language>("en");

  // Load pending analysis from storage on mount (and when storage changes)
  useEffect(() => {
    function loadPending() {
      chrome.storage.session.get(STORAGE_KEY, (items) => {
        const pending = items[STORAGE_KEY] as PendingAnalysis | undefined;
        if (pending) {
          setState({ status: "loaded", pending });
        }
      });
    }

    loadPending();

    // Re-trigger when a new selection comes in while the panel is open
    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (STORAGE_KEY in changes) {
        const pending = changes[STORAGE_KEY].newValue as
          | PendingAnalysis
          | undefined;
        if (pending) setState({ status: "loaded", pending });
      }
    };

    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  async function analyze(pending: PendingAnalysis) {
    setState({ status: "loading" });
    try {
      const res = await fetch(`${BACKEND_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pending.text,
          source_url: pending.sourceUrl,
          preferred_language: language,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }

      const result: AnalysisResult = await res.json();
      setState({ status: "success", result });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function reset() {
    chrome.storage.session.remove(STORAGE_KEY);
    setState({ status: "idle" });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0f0f1a" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 22 }}>🔍</span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#a78bfa",
            letterSpacing: "-0.02em",
          }}
        >
          TruthLens
        </span>
      </div>

      {/* Language picker */}
      <div style={{ marginBottom: 16 }}>
        <label
          style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 4 }}
        >
          RESPONSE LANGUAGE
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          style={{
            background: "#1a1a2e",
            color: "#e0e0ff",
            border: "1px solid #3a3a5e",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            width: "100%",
            cursor: "pointer",
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      {/* State-driven body */}
      {state.status === "idle" && (
        <EmptyState />
      )}

      {state.status === "loaded" && (
        <LoadedState
          pending={state.pending}
          onAnalyze={() => analyze(state.pending)}
          onDismiss={reset}
        />
      )}

      {state.status === "loading" && <LoadingState />}

      {state.status === "success" && (
        <ResultState result={state.result} onReset={reset} />
      )}

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={reset} />
      )}
    </div>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ color: "#666", fontSize: 13, textAlign: "center", marginTop: 60 }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>✍️</div>
      <p>Highlight text on any page and click</p>
      <p style={{ color: "#a78bfa", marginTop: 4, fontWeight: 600 }}>
        "Analyze with TruthLens"
      </p>
    </div>
  );
}

function LoadedState({
  pending,
  onAnalyze,
  onDismiss,
}: {
  pending: PendingAnalysis;
  onAnalyze: () => void;
  onDismiss: () => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>
        SELECTED TEXT
      </label>
      <div
        style={{
          background: "#1a1a2e",
          border: "1px solid #3a3a5e",
          borderRadius: 8,
          padding: 12,
          fontSize: 13,
          lineHeight: 1.5,
          color: "#c0c0e0",
          maxHeight: 140,
          overflowY: "auto",
          marginBottom: 8,
        }}
      >
        {pending.text}
      </div>
      <div style={{ fontSize: 11, color: "#555", marginBottom: 16, wordBreak: "break-all" }}>
        {pending.sourceUrl}
      </div>
      <button
        onClick={onAnalyze}
        style={{
          width: "100%",
          padding: "10px 0",
          background: "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        Analyze
      </button>
      <button
        onClick={onDismiss}
        style={{
          width: "100%",
          padding: "8px 0",
          background: "transparent",
          color: "#666",
          border: "1px solid #2a2a4e",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 60, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      Analyzing…
    </div>
  );
}

function ResultState({
  result,
  onReset,
}: {
  result: AnalysisResult;
  onReset: () => void;
}) {
  const riskColor = RISK_COLORS[result.risk_level];

  return (
    <div>
      {/* Score + risk */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          background: "#1a1a2e",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <ScoreRing score={result.credibility_score} />
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
            CREDIBILITY SCORE
          </div>
          <Badge label={result.risk_level} color={riskColor} />
        </div>
      </div>

      {/* Summary */}
      <Section title="Summary">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>
          {result.summary}
        </p>
      </Section>

      {/* Recommendation */}
      <Section title="Recommendation">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>
          {result.recommendation}
        </p>
      </Section>

      {/* Key claims */}
      {result.key_claims.length > 0 && (
        <Section title="Key Claims">
          <ul style={{ paddingLeft: 16, fontSize: 13, color: "#c0c0e0", lineHeight: 1.7 }}>
            {result.key_claims.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* Bias tags */}
      {result.bias_detected.length > 0 && (
        <Section title="Bias Detected">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.bias_detected.map((b) => (
              <Badge key={b} label={b} color="#f59e0b" />
            ))}
          </div>
        </Section>
      )}

      {/* Cross-references */}
      {result.cross_references.length > 0 && (
        <Section title="Cross-References">
          {result.cross_references.map((ref, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                fontSize: 12,
                borderLeft: `3px solid ${RISK_COLORS[
                  ref.contradiction_level === "high"
                    ? "suspicious"
                    : ref.contradiction_level === "medium"
                      ? "caution"
                      : "safe"
                ]
                  }`,
                paddingLeft: 8,
              }}
            >
              <a
                href={ref.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#7c7cff", textDecoration: "none" }}
              >
                {ref.source}
              </a>
              <span style={{ color: "#666", marginLeft: 6 }}>
                ({ref.contradiction_level} contradiction)
              </span>
            </div>
          ))}
        </Section>
      )}

      <button
        onClick={onReset}
        style={{
          marginTop: 8,
          width: "100%",
          padding: "8px 0",
          background: "transparent",
          color: "#666",
          border: "1px solid #2a2a4e",
          borderRadius: 8,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Analyze another selection
      </button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{message}</p>
      <button
        onClick={onRetry}
        style={{
          padding: "8px 20px",
          background: "#7c3aed",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Back
      </button>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          color: "#666",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
