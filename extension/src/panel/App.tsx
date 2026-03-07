import { useEffect, useRef, useState } from "react";
import type { PendingAnalysis } from "../background/index";
import { STORAGE_KEY } from "../background/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "en" | "zh" | "ms" | "ta" | "singlish";
type RiskLevel = "safe" | "caution" | "suspicious";
type Mode = "picker" | "text" | "audio" | "speech" | "image";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = "http://localhost:3000";
const MAX_IMAGES = 5;

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "#22c55e",
  caution: "#f59e0b",
  suspicious: "#ef4444",
};

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en",       label: "English"  },
  { value: "zh",       label: "中文"     },
  { value: "ms",       label: "Melayu"   },
  { value: "ta",       label: "தமிழ்"   },
  { value: "singlish", label: "Singlish" },
];

// ─── Style helpers ────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e", border: "1px solid #3a3a5e",
  borderRadius: 8, padding: 12,
};
const dimText: React.CSSProperties = { fontSize: 11, color: "#888" };
const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "10px 0",
  background: "#7c3aed", color: "#fff",
  border: "none", borderRadius: 8,
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  width: "100%", padding: "8px 0",
  background: "transparent", color: "#666",
  border: "1px solid #2a2a4e", borderRadius: 8,
  fontSize: 13, cursor: "pointer",
};

function injectStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css;
  document.head.appendChild(el);
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? RISK_COLORS.safe : score >= 40 ? RISK_COLORS.caution : RISK_COLORS.suspicious;
  return (
    <div style={{
      width: 72, height: 72, borderRadius: "50%",
      border: `5px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, fontWeight: 700, color, flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
      borderRadius: 4, padding: "2px 8px",
      fontSize: 11, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, color: "#666", fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ─── Mode Picker ──────────────────────────────────────────────────────────────

function ModePicker({ onPick }: { onPick: (m: Mode) => void }) {
  const modes: { mode: Mode; icon: string; title: string; desc: string }[] = [
    { mode: "text",   icon: "✍️", title: "Paste / Type Text",  desc: "Paste a news snippet, WhatsApp message, or any claim" },
    { mode: "audio",  icon: "🎵", title: "Upload Audio File",  desc: "Upload a .wav, .mp3, or .m4a file to transcribe and analyse" },
    { mode: "speech", icon: "🎙️", title: "Speak to Analyse",   desc: "Record live speech via your microphone" },
    { mode: "image",  icon: "🖼️", title: "Upload Screenshot",  desc: "Check images or forwarded photos for misleading content" },
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 14, textAlign: "center", lineHeight: 1.5 }}>
        How would you like to fact-check today?
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {modes.map(({ mode, icon, title, desc }) => (
          <button
            key={mode}
            onClick={() => onPick(mode)}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              background: "#1a1a2e", border: "1px solid #3a3a5e",
              borderRadius: 10, padding: "13px 14px",
              cursor: "pointer", textAlign: "left", width: "100%",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#7c3aed";
              (e.currentTarget as HTMLElement).style.background = "#1e1a38";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#3a3a5e";
              (e.currentTarget as HTMLElement).style.background = "#1a1a2e";
            }}
          >
            <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0ff", marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: "#555", lineHeight: 1.4 }}>{desc}</div>
            </div>
            <svg style={{ flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="#444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Text Input View ──────────────────────────────────────────────────────────
// Feeds into the existing working POST /analyze/text call.

function TextInputView({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>PASTE OR TYPE TEXT</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a news headline, WhatsApp message, social media post…"
        style={{
          width: "100%", minHeight: 120, boxSizing: "border-box",
          background: "#13132a", border: "1px solid #3a3a5e",
          borderRadius: 8, padding: 10, color: "#c0c0e0",
          fontSize: 13, lineHeight: 1.6, resize: "vertical",
          fontFamily: "inherit", outline: "none",
        }}
      />
      <button
        disabled={!ready}
        onClick={() => onSubmit(text.trim())}
        style={{
          ...btnPrimary, marginTop: 10,
          background: ready ? "#7c3aed" : "#2a2a4e",
          color: ready ? "#fff" : "#555",
          cursor: ready ? "pointer" : "not-allowed",
        }}
      >
        Analyze Text
      </button>
    </div>
  );
}

// ─── Audio File View ──────────────────────────────────────────────────────────
// Uploads audio to POST /transcribe (Whisper backend), then passes the
// returned text to analyzeText() → POST /analyze/text.
// TODO: ensure backend POST /transcribe returns { text: string }

function AudioFileView({ onTranscribed }: { onTranscribed: (text: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { text } = await res.json();
      onTranscribed(text);
    } catch {
      setError("Transcription failed — check that the backend /transcribe endpoint is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>UPLOAD AUDIO FILE</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        style={{
          border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
          borderRadius: 8, padding: "22px 12px", textAlign: "center",
          cursor: "pointer", background: dragging ? "#7c3aed11" : "#13132a",
          transition: "all 0.15s", marginBottom: 12,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke={dragging ? "#a78bfa" : "#555"} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ margin: "0 auto 8px", display: "block" }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : file ? "#a78bfa" : "#666", margin: 0 }}>
          {file ? file.name : dragging ? "Drop to upload" : "Drag & drop or click to select"}
        </p>
        <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>WAV · MP3 · M4A · OGG</p>
        <input ref={inputRef} type="file" accept="audio/*" style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{error}</p>}

      <button
        disabled={!file || loading}
        onClick={handleUpload}
        style={{
          ...btnPrimary,
          background: file && !loading ? "#7c3aed" : "#2a2a4e",
          color: file && !loading ? "#fff" : "#555",
          cursor: file && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Transcribing…" : "Transcribe & Analyse"}
      </button>
    </div>
  );
}

// ─── Speech (STT) View ────────────────────────────────────────────────────────
// Uses browser Web Speech API. Transcript feeds into POST /analyze/text.
// No extra backend needed — works today.

function SpeechView({ onReady }: { onReady: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    injectStyle("tl-mic", `
      @keyframes tlPulse{0%,100%{box-shadow:0 0 0 0 #ef444455}50%{box-shadow:0 0 0 10px #ef444400}}
      .tl-mic-live{animation:tlPulse 1.2s ease-in-out infinite}
    `);
  }, []);

  function toggle() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Speech recognition not supported in this browser."); return; }
    if (recording) { recRef.current?.stop(); setRecording(false); return; }

    setError("");
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-SG";
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      setTranscript(full);
    };
    rec.onerror = () => { setRecording(false); setError("Microphone error — check browser permissions."); };
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <button
          onClick={toggle}
          className={recording ? "tl-mic-live" : undefined}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: recording ? "#ef444414" : "#1e1e3a",
            border: `2px solid ${recording ? "#ef4444" : "#3a3a5e"}`,
            cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={recording ? "#ef4444" : "#888"} strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </button>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: recording ? "#ef4444" : "#c0c0e0" }}>
            {recording ? "● Listening…" : "Tap mic to start"}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555", lineHeight: 1.4 }}>
            Supports English, Mandarin, Malay &amp; Tamil.<br />Tap again to stop.
          </p>
        </div>
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{error}</p>}

      {transcript && (
        <div>
          <label style={{ ...dimText, display: "block", marginBottom: 5 }}>TRANSCRIPT</label>
          <div style={{ ...cardStyle, fontSize: 13, color: "#c0c0e0", lineHeight: 1.6, maxHeight: 110, overflowY: "auto", marginBottom: 10 }}>
            {transcript}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onReady(transcript)} style={{ ...btnPrimary, flex: 1, width: "auto" }}>
              Analyze Speech
            </button>
            <button onClick={() => setTranscript("")} style={{ ...btnSecondary, width: "auto", padding: "10px 14px" }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Image Upload View ────────────────────────────────────────────────────────
// Calls POST /analyze-image and sets result directly.
// TODO: ensure backend POST /analyze-image returns AnalysisResult shape.

interface UploadedImage { file: File; dataUrl: string; }

function ImageUploadView({ onResult }: { onResult: (r: AnalysisResult) => void }) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = images.length >= MAX_IMAGES;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, MAX_IMAGES - images.length).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { file, dataUrl: reader.result as string }]);
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!images.length) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      images.forEach((img) => form.append("images", img.file));
      const res = await fetch(`${BACKEND_URL}/analyze-image`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onResult(await res.json());
    } catch {
      setError("Image analysis failed — check that the backend /analyze-image endpoint is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>UPLOAD SCREENSHOT(S)</label>
      <p style={{ fontSize: 11, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
        Check images or forwarded photos for misleading visuals or fake headlines. Up to {MAX_IMAGES} images.
      </p>

      {!full && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
            borderRadius: 8, padding: "22px 12px", textAlign: "center",
            cursor: "pointer", background: dragging ? "#7c3aed11" : "#13132a",
            transition: "all 0.15s", marginBottom: images.length ? 12 : 0,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "#a78bfa" : "#555"} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ margin: "0 auto 8px", display: "block" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : "#666", margin: 0 }}>
            {dragging ? "Drop to upload" : "Drag & drop or click to select"}
          </p>
          <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>PNG · JPG · WEBP · up to {MAX_IMAGES}</p>
          <input ref={inputRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, marginBottom: 12 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={img.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #3a3a5e" }} />
              <button
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#ef4444", border: "none",
                  color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
          ))}
          {full && <div style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>Max {MAX_IMAGES} reached</div>}
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{error}</p>}

      {images.length > 0 && (
        <button
          disabled={loading}
          onClick={handleSubmit}
          style={{
            ...btnPrimary,
            background: loading ? "#2a2a4e" : "#7c3aed",
            color: loading ? "#555" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Analysing…" : `Analyse ${images.length} image${images.length > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

// ─── Output sub-views (unchanged from working doc6) ───────────────────────────

function LoadingState() {
  return (
    <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 60, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      Analyzing…
    </div>
  );
}

function ResultState({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const riskColor = RISK_COLORS[result.risk_level];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, background: "#1a1a2e", borderRadius: 8, padding: 12 }}>
        <ScoreRing score={result.credibility_score} />
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>CREDIBILITY SCORE</div>
          <Badge label={result.risk_level} color={riskColor} />
        </div>
      </div>

      <Section title="Summary">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>{result.summary}</p>
      </Section>

      <Section title="Recommendation">
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>{result.recommendation}</p>
      </Section>

      {result.key_claims.length > 0 && (
        <Section title="Key Claims">
          <ul style={{ paddingLeft: 16, fontSize: 13, color: "#c0c0e0", lineHeight: 1.7 }}>
            {result.key_claims.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      )}

      {result.bias_detected.length > 0 && (
        <Section title="Bias Detected">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.bias_detected.map((b) => <Badge key={b} label={b} color="#f59e0b" />)}
          </div>
        </Section>
      )}

      {result.cross_references.length > 0 && (
        <Section title="Cross-References">
          {result.cross_references.map((ref, i) => (
            <div key={i} style={{
              marginBottom: 8, fontSize: 12,
              borderLeft: `3px solid ${RISK_COLORS[ref.contradiction_level === "high" ? "suspicious" : ref.contradiction_level === "medium" ? "caution" : "safe"]}`,
              paddingLeft: 8,
            }}>
              <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "#7c7cff", textDecoration: "none" }}>{ref.source}</a>
              <span style={{ color: "#666", marginLeft: 6 }}>({ref.contradiction_level} contradiction)</span>
            </div>
          ))}
        </Section>
      )}

      <button onClick={onReset} style={{ ...btnSecondary, marginTop: 8 }}>
        Analyze another selection
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{message}</p>
      <button onClick={onRetry} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
        Back
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [mode, setMode] = useState<Mode>("picker");
  const [language, setLanguage] = useState<Language>("en");

  // Consume pre-selected text written by background/content script
  useEffect(() => {
    function consume(pending: PendingAnalysis) {
      chrome.storage.session.remove(STORAGE_KEY);
      setMode("text");
      setState({ status: "loaded", pending });
    }

    chrome.storage.session.get(STORAGE_KEY, (items) => {
      const pending = items[STORAGE_KEY] as PendingAnalysis | undefined;
      if (pending?.text) consume(pending);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!(STORAGE_KEY in changes)) return;
      const pending = changes[STORAGE_KEY].newValue as PendingAnalysis | undefined;
      if (pending?.text) consume(pending);
    };

    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  // POST /analyze/text — the existing working endpoint
  async function analyzeText(text: string, sourceUrl = "") {
    setState({ status: "loading" });
    try {
      const res = await fetch(`${BACKEND_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source_url: sourceUrl, preferred_language: language }),
      });

      const raw = await res.text(); // always read as text first

      if (!res.ok) {
        throw new Error(raw || `HTTP ${res.status}`);
      }

      try {
        const result = JSON.parse(raw);
        setState({ status: "success", result });
      } catch {
        // Backend returned 200 but not valid JSON — show raw for debugging
        throw new Error(`Backend returned non-JSON response:\n\n${raw.slice(0, 300)}`);
      }
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  function reset() {
    chrome.storage.session.remove(STORAGE_KEY);
    setState({ status: "idle" });
    setMode("picker");
  }

  const showBack = mode !== "picker" && state.status !== "loading" && state.status !== "success";

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0f0f1a" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        {showBack && (
          <button onClick={reset} title="Back" style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 0, fontSize: 18, lineHeight: 1 }}>
            ←
          </button>
        )}
        <span style={{ fontSize: 22 }}>🔍</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", letterSpacing: "-0.02em" }}>TruthLens</span>
      </div>

      {/* Language picker — hidden on results screen */}
{state.status !== "success" && (
  <div style={{ marginBottom: 16 }}>
    <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 8 }}>RESPONSE LANGUAGE</label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {LANGUAGES.map((l) => {
        const active = language === l.value;
        return (
          <button
            key={l.value}
            onClick={() => setLanguage(l.value)}
            style={{
              padding: "5px 12px", borderRadius: 20,
              border: active ? "1px solid #7c3aed" : "1px solid #3a3a5e",
              background: active ? "#7c3aed22" : "transparent",
              color: active ? "#a78bfa" : "#666",
              fontSize: 12, fontWeight: active ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  </div>
)}

      {/* Loading */}
      {state.status === "loading" && <LoadingState />}

      {/* Results */}
      {state.status === "success" && <ResultState result={state.result} onReset={reset} />}

      {/* Error */}
      {state.status === "error" && <ErrorState message={state.message} onRetry={reset} />}

      {/* Input modes */}
      {(state.status === "idle" || state.status === "loaded") && (
        <>
          {/* Mode picker: manual open with no pre-selection */}
          {mode === "picker" && <ModePicker onPick={setMode} />}

          {/* TEXT: working — POST /analyze/text */}
          {mode === "text" && (
            <>
              {state.status === "loaded" ? (
                // Context-menu pre-selection flow
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>SELECTED TEXT</label>
                  <div style={{ ...cardStyle, fontSize: 13, lineHeight: 1.5, color: "#c0c0e0", maxHeight: 140, overflowY: "auto", marginBottom: 8 }}>
                    {state.pending.text}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 16, wordBreak: "break-all" }}>
                    {state.pending.sourceUrl}
                  </div>
                  <button onClick={() => analyzeText(state.pending.text, state.pending.sourceUrl)} style={{ ...btnPrimary, marginBottom: 8 }}>
                    Analyze
                  </button>
                  <button onClick={reset} style={btnSecondary}>Dismiss</button>
                </div>
              ) : (
                <TextInputView onSubmit={(text) => analyzeText(text)} />
              )}
            </>
          )}

          {/* AUDIO: POST /transcribe → text → POST /analyze/text */}
          {mode === "audio" && (
            <AudioFileView onTranscribed={(text) => analyzeText(text, "audio://file")} />
          )}

          {/* SPEECH: Web Speech API → text → POST /analyze/text */}
          {mode === "speech" && (
            <SpeechView onReady={(text) => analyzeText(text, "speech://microphone")} />
          )}

          {/* IMAGE: POST /analyze-image → result directly */}
          {mode === "image" && (
            <ImageUploadView onResult={(result) => setState({ status: "success", result })} />
          )}
        </>
      )}
    </div>
  );
}