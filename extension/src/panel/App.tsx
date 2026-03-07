import { useEffect, useRef, useState } from "react";
import type { PendingAnalysis } from "../background/index";
import { STORAGE_KEY } from "../background/index";

// ─── Types ────────────────────────────────────────────────────────────────────

type Language = "en" | "zh" | "ms" | "ta" | "singlish";
type RiskLevel = "safe" | "caution" | "suspicious";
type Mode = "picker" | "text" | "image" | "speech";

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

const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "#22c55e",
  caution: "#f59e0b",
  suspicious: "#ef4444",
};

const LANGUAGES: { value: Language; label: string; native: string }[] = [
  { value: "en", label: "EN", native: "English" },
  { value: "zh", label: "中文", native: "Chinese" },
  { value: "ms", label: "BM", native: "Melayu" },
  { value: "ta", label: "தமிழ்", native: "Tamil" },
  { value: "singlish", label: "Singlish", native: "Singlish" },
];

// ─── Shared style tokens ──────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#1a1a2e",
  border: "1px solid #3a3a5e",
  borderRadius: 10,
  padding: 14,
};

const dimText: React.CSSProperties = { color: "#888", fontSize: 11 };

// ─── CSS injected once for animations ─────────────────────────────────────────

function injectStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

// ─── Reusable primitives ──────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 70 ? RISK_COLORS.safe : score >= 40 ? RISK_COLORS.caution : RISK_COLORS.suspicious;
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

function Divider() {
  return <div style={{ borderTop: "1px solid #1e1e3e", margin: "14px 0" }} />;
}

// ─── Language pills ───────────────────────────────────────────────────────────

function LanguagePills({ value, onChange }: { value: Language; onChange: (l: Language) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {LANGUAGES.map((l) => {
        const active = value === l.value;
        return (
          <button
            key={l.value}
            title={l.native}
            onClick={() => onChange(l.value)}
            style={{
              padding: "4px 10px", borderRadius: 20,
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
  );
}

// ─── Waveform (TTS playback visualiser) ───────────────────────────────────────

function Waveform({ playing }: { playing: boolean }) {
  useEffect(() => {
    injectStyle("tl-wave", `
      @keyframes tlWave {
        0%, 100% { transform: scaleY(0.25); }
        50%       { transform: scaleY(1); }
      }
      .tl-bar { transform-origin: center; animation: tlWave 0.9s ease-in-out infinite; }
      .tl-bar:nth-child(1) { animation-delay: 0s; }
      .tl-bar:nth-child(2) { animation-delay: 0.1s; }
      .tl-bar:nth-child(3) { animation-delay: 0.2s; }
      .tl-bar:nth-child(4) { animation-delay: 0.3s; }
      .tl-bar:nth-child(5) { animation-delay: 0.4s; }
      .tl-bar:nth-child(6) { animation-delay: 0.3s; }
      .tl-bar:nth-child(7) { animation-delay: 0.2s; }
      .tl-bar:nth-child(8) { animation-delay: 0.1s; }
      .tl-bar:nth-child(9) { animation-delay: 0s; }
    `);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 28, padding: "0 4px" }}>
      {Array.from({ length: 9 }).map((_, i) => (
        <div
          key={i}
          className={playing ? "tl-bar" : undefined}
          style={{
            width: 3,
            height: playing ? "100%" : "25%",
            borderRadius: 2,
            background: playing ? "#a78bfa" : "#3a3a5e",
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

// ─── TTS Player ───────────────────────────────────────────────────────────────
// Shown on the results screen so elderly users can listen to the summary.
//
// TODO (backend): When `language` changes, call POST /tts with:
//   { text: transcript, language }
//   → returns { audio_url: string }
// Then pass that URL as the `audioUrl` prop here.
// Currently `audioUrl` comes from result.audio_url in the analysis response.

function TTSPlayer({
  audioUrl,
  transcript,
  language,
  onLanguageChange,
}: {
  audioUrl?: string;
  transcript: string;
  language: Language;
  onLanguageChange: (l: Language) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const stop = () => setPlaying(false);
    el.addEventListener("ended", stop);
    return () => el.removeEventListener("ended", stop);
  }, []);

  useEffect(() => { setPlaying(false); }, [audioUrl]);

  return (
    <div style={{ ...card, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ ...dimText, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          🔊 Listen (Audio Summary)
        </div>
      </div>

      {/* Language selector for TTS output */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ ...dimText, marginBottom: 6 }}>Choose audio language</div>
        <LanguagePills value={language} onChange={onLanguageChange} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={togglePlay}
          disabled={!audioUrl}
          title={playing ? "Pause" : "Play"}
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: audioUrl ? "#7c3aed" : "#2a2a4e",
            border: "none",
            cursor: audioUrl ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "background 0.15s",
          }}
        >
          {playing ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="#fff">
              <rect x="2" y="2" width="4" height="10" rx="1" />
              <rect x="8" y="2" width="4" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="#fff">
              <polygon points="3,1 13,7 3,13" />
            </svg>
          )}
        </button>

        <Waveform playing={playing} />

        {audioUrl
          ? <audio ref={audioRef} src={audioUrl} style={{ display: "none" }} />
          : <span style={{ fontSize: 11, color: "#444" }}>Select a language above to generate audio</span>
        }
      </div>

      {/* Scrollable transcript */}
      <div style={{
        marginTop: 10, borderTop: "1px solid #2a2a4e", paddingTop: 10,
        fontSize: 12, color: "#c0c0e0", lineHeight: 1.7,
        maxHeight: 90, overflowY: "auto",
      }}>
        <span style={{ ...dimText, marginRight: 6 }}>Transcript:</span>
        {transcript}
      </div>
    </div>
  );
}

// ─── Image upload zone ────────────────────────────────────────────────────────
// Supports up to MAX_IMAGES drag-and-drop or file picker uploads.

const MAX_IMAGES = 5;

interface UploadedImage { file: File; dataUrl: string; }

function ImageUploadZone({
  images,
  onAdd,
  onRemove,
}: {
  images: UploadedImage[];
  onAdd: (img: UploadedImage) => void;
  onRemove: (idx: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    Array.from(files).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => onAdd({ file, dataUrl: reader.result as string });
      reader.readAsDataURL(file);
    });
  }

  const full = images.length >= MAX_IMAGES;

  return (
    <div>
      {!full && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
            borderRadius: 8, padding: "22px 12px", textAlign: "center",
            cursor: "pointer",
            background: dragging ? "#7c3aed11" : "#13132a",
            transition: "all 0.15s",
            marginBottom: images.length ? 12 : 0,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "#a78bfa" : "#555"}
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ margin: "0 auto 8px", display: "block" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : "#666", margin: 0 }}>
            {dragging ? "Drop to upload" : "Drag & drop or click to select"}
          </p>
          <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>
            PNG · JPG · WEBP &nbsp;·&nbsp; up to {MAX_IMAGES} images
          </p>
          <input ref={inputRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={img.dataUrl} alt=""
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #3a3a5e" }} />
              <button
                onClick={() => onRemove(i)}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#ef4444", border: "none",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
          ))}
          {full && (
            <div style={{ fontSize: 10, color: "#555", alignSelf: "center", marginLeft: 4 }}>
              Max {MAX_IMAGES} reached
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STT Panel ────────────────────────────────────────────────────────────────
// Uses browser Web Speech API (Chromium-based browsers only).
// The final transcript is passed to onReady() which feeds into analyzeText().
//
// TODO (backend): If you want server-side STT (e.g. Whisper), send the recorded
// audio blob to POST /transcribe and use the returned text instead.

function SpeechPanel({ onReady }: { onReady: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    injectStyle("tl-mic", `
      @keyframes tlPulse {
        0%, 100% { box-shadow: 0 0 0 0 #ef444455; }
        50%       { box-shadow: 0 0 0 10px #ef444400; }
      }
      .tl-mic-live { animation: tlPulse 1.2s ease-in-out infinite; }
    `);
  }, []);

  function toggle() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition is not supported in this browser."); return; }

    if (recording) {
      recRef.current?.stop();
      setRecording(false);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-SG"; // Singapore English; change per user's preferred language if needed

    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      setTranscript(full);
    };
    rec.onerror = () => setRecording(false);
    rec.onend = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }

  return (
    <div>
      {/* Mic button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={toggle}
          className={recording ? "tl-mic-live" : undefined}
          style={{
            width: 56, height: 56, borderRadius: "50%",
            background: recording ? "#ef444414" : "#1e1e3a",
            border: `2px solid ${recording ? "#ef4444" : "#3a3a5e"}`,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.2s",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={recording ? "#ef4444" : "#888"}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="8" y1="22" x2="16" y2="22" />
          </svg>
        </button>

        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: recording ? "#ef4444" : "#c0c0e0", margin: 0 }}>
            {recording ? "● Listening…" : "Tap mic to start"}
          </p>
          <p style={{ fontSize: 11, color: "#555", margin: "4px 0 0", lineHeight: 1.4 }}>
            Speak a claim or headline.<br />
            Supports English, Mandarin, Malay & Tamil.
          </p>
        </div>
      </div>

      {/* Live transcript */}
      {transcript && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...dimText, marginBottom: 5 }}>TRANSCRIPT</div>
          <div style={{
            ...card,
            fontSize: 13, color: "#c0c0e0",
            lineHeight: 1.6, maxHeight: 110, overflowY: "auto", marginBottom: 10,
          }}>
            {transcript}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => onReady(transcript)}
              style={{
                flex: 1, padding: "10px 0",
                background: "#7c3aed", color: "#fff",
                border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              Analyze speech
            </button>
            <button
              onClick={() => setTranscript("")}
              style={{
                padding: "10px 14px",
                background: "transparent", color: "#666",
                border: "1px solid #2a2a4e", borderRadius: 8,
                fontSize: 13, cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mode picker ──────────────────────────────────────────────────────────────
// Shown when the user opens TruthLens manually (no pre-selected text).

function ModePicker({ onPick }: { onPick: (m: Mode) => void }) {
  const modes: { mode: Mode; icon: string; title: string; desc: string }[] = [
    {
      mode: "text",
      icon: "✍️",
      title: "Paste / Type Text",
      desc: "Analyse a news snippet, WhatsApp message, or any claim",
    },
    {
      mode: "image",
      icon: "🖼️",
      title: "Upload Screenshot",
      desc: "Check images or forwarded photos for misleading content (up to 5)",
    },
    {
      mode: "speech",
      icon: "🎙️",
      title: "Speak to Analyse",
      desc: "Use your microphone — great for elderly users or voice messages",
    },
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
              background: "#1a1a2e",
              border: "1px solid #3a3a5e",
              borderRadius: 10, padding: "13px 14px",
              cursor: "pointer", textAlign: "left",
              transition: "border-color 0.15s, background 0.15s",
              width: "100%",
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
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e0e0ff", marginBottom: 2 }}>
                {title}
              </div>
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

// ─── Manual text input view ───────────────────────────────────────────────────

function TextInputView({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
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
          borderRadius: 8, padding: 10,
          color: "#c0c0e0", fontSize: 13, lineHeight: 1.6,
          resize: "vertical", fontFamily: "inherit", outline: "none",
        }}
      />
      <button
        disabled={!text.trim()}
        onClick={() => onSubmit(text.trim())}
        style={{
          marginTop: 10, width: "100%", padding: "10px 0",
          background: text.trim() ? "#7c3aed" : "#2a2a4e",
          color: text.trim() ? "#fff" : "#555",
          border: "none", borderRadius: 8,
          fontSize: 14, fontWeight: 700,
          cursor: text.trim() ? "pointer" : "not-allowed",
          transition: "background 0.15s",
        }}
      >
        Analyze Text
      </button>
    </div>
  );
}

// ─── Result view ──────────────────────────────────────────────────────────────

function ResultView({
  result,
  language,
  onLanguageChange,
  onReset,
}: {
  result: AnalysisResult;
  language: Language;
  onLanguageChange: (l: Language) => void;
  onReset: () => void;
}) {
  const riskColor = RISK_COLORS[result.risk_level];

  return (
    <div>
      {/*
        TTS Player — always shown so elderly users can listen to the summary
        in their preferred language.

        TODO (backend):
        - result.audio_url should be populated by your /summary endpoint
          OR call a separate POST /tts { text: result.summary, language }
          when the user selects a language and pass the returned URL here.
      */}
      <TTSPlayer
        audioUrl={result.audio_url}
        transcript={result.summary}
        language={language}
        onLanguageChange={onLanguageChange}
      />

      {/* Score card */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, ...card }}>
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
              borderLeft: `3px solid ${RISK_COLORS[
                ref.contradiction_level === "high" ? "suspicious"
                  : ref.contradiction_level === "medium" ? "caution" : "safe"
              ]}`,
              paddingLeft: 8,
            }}>
              <a href={ref.url} target="_blank" rel="noreferrer"
                style={{ color: "#7c7cff", textDecoration: "none" }}>
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
          marginTop: 4, width: "100%", padding: "9px 0",
          background: "transparent", color: "#666",
          border: "1px solid #2a2a4e", borderRadius: 8,
          fontSize: 13, cursor: "pointer",
        }}
      >
        ← Analyze something else
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [appState, setAppState] = useState<AppState>({ status: "idle" });
  const [mode, setMode] = useState<Mode>("picker");
  const [language, setLanguage] = useState<Language>("en");
  const [images, setImages] = useState<UploadedImage[]>([]);

  // ── Listen for text pre-selected via context-menu ─────────────────────────
  // When the user highlights text on a page and clicks "Analyze with TruthLens",
  // the background script writes it to chrome.storage.session.
  // We detect that here and jump straight into text mode.
  useEffect(() => {
    // Helper: consume a pending analysis — load it into state then immediately
    // remove it from storage so it doesn't re-fire on the next panel open.
    function consume(pending: PendingAnalysis) {
      chrome.storage.session.remove(STORAGE_KEY);
      setMode("text");
      setAppState({ status: "loaded", pending });
    }

    // On mount: check if the panel was opened with pre-selected text already
    // sitting in storage (context-menu flow or floating button flow).
    chrome.storage.session.get(STORAGE_KEY, (items) => {
      const pending = items[STORAGE_KEY] as PendingAnalysis | undefined;
      if (pending?.text) consume(pending);
    });

    // While the panel is already open: react to new selections written by the
    // content script or background (e.g. user selects text a second time).
    const listener = (changes: { [k: string]: chrome.storage.StorageChange }) => {
      if (!(STORAGE_KEY in changes)) return;
      const pending = changes[STORAGE_KEY].newValue as PendingAnalysis | undefined;
      // newValue is undefined when WE remove it (consume), ignore that.
      if (pending?.text) consume(pending);
    };

    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  // ── analyzeText ───────────────────────────────────────────────────────────
  // TODO (backend): POST /summary
  //   Body: { text, source_url, preferred_language }
  //   Response: AnalysisResult
  async function analyzeText(text: string, sourceUrl?: string) {
    setAppState({ status: "loading" });
    try {
      const res = await fetch(`${BACKEND_URL}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source_url: sourceUrl ?? "",     // kept for backend context; never rendered in UI
          preferred_language: language,
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const result: AnalysisResult = await res.json();
      setAppState({ status: "success", result });
    } catch (err) {
      setAppState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── analyzeImages ─────────────────────────────────────────────────────────
  // TODO (backend): POST /analyze-image
  //   Body: FormData with fields: images[] (File), preferred_language (string)
  //   Response: AnalysisResult
  async function analyzeImages() {
    if (!images.length) return;
    setAppState({ status: "loading" });
    try {
      const form = new FormData();
      images.forEach((img) => form.append("images", img.file));
      form.append("preferred_language", language);

      const res = await fetch(`${BACKEND_URL}/analyze-image`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const result: AnalysisResult = await res.json();
      setAppState({ status: "success", result });
    } catch (err) {
      setAppState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── reset — full wipe back to mode picker ─────────────────────────────────
  function reset() {
    chrome.storage.session.remove(STORAGE_KEY);
    setAppState({ status: "idle" });
    setMode("picker");
    setImages([]);
  }

  // ── backToPicker — stay in idle, return to mode selection ─────────────────
  function backToPicker() {
    chrome.storage.session.remove(STORAGE_KEY);
    setAppState({ status: "idle" });
    setMode("picker");
    setImages([]);
  }

  const showBackButton =
    mode !== "picker" &&
    appState.status !== "success" &&
    appState.status !== "loading";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0f0f1a", boxSizing: "border-box" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        {showBackButton && (
          <button
            onClick={backToPicker}
            title="Back to menu"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#666", padding: 0, fontSize: 18, lineHeight: 1,
            }}
          >
            ←
          </button>
        )}
        <span style={{ fontSize: 20 }}>🔍</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#a78bfa", letterSpacing: "-0.02em" }}>
          TruthLens
        </span>
        <span style={{ fontSize: 10, color: "#333", marginLeft: "auto", textAlign: "right", lineHeight: 1.4 }}>
          Fact-check<br />anything
        </span>
      </div>

      {/* ── Language selector (hidden on results screen — TTSPlayer has its own) ── */}
      {appState.status !== "success" && (
        <>
          <div style={{ marginBottom: 4 }}>
            <label style={{ ...dimText, display: "block", marginBottom: 6 }}>RESPONSE LANGUAGE</label>
            <LanguagePills value={language} onChange={setLanguage} />
          </div>
          <Divider />
        </>
      )}

      {/* ══════════════════════════════════════════
          LOADING
      ══════════════════════════════════════════ */}
      {appState.status === "loading" && (
        <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 60, fontSize: 13 }}>
          <div style={{ fontSize: 34, marginBottom: 12 }}>⏳</div>
          Analysing…
        </div>
      )}

      {/* ══════════════════════════════════════════
          RESULTS
      ══════════════════════════════════════════ */}
      {appState.status === "success" && (
        <ResultView
          result={appState.result}
          language={language}
          onLanguageChange={setLanguage}
          onReset={reset}
        />
      )}

      {/* ══════════════════════════════════════════
          ERROR
      ══════════════════════════════════════════ */}
      {appState.status === "error" && (
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{appState.message}</p>
          <button
            onClick={backToPicker}
            style={{
              padding: "8px 20px", background: "#7c3aed", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
            }}
          >
            Back
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          INPUT MODES (idle / loaded)
      ══════════════════════════════════════════ */}
      {(appState.status === "idle" || appState.status === "loaded") && (

        <>
          {/* ── PICKER: shown when extension opened manually ── */}
          {mode === "picker" && <ModePicker onPick={setMode} />}

          {/* ── TEXT MODE ── */}
          {mode === "text" && (
            <div>
              {appState.status === "loaded" ? (
                /*
                  Context-menu flow: text was pre-selected from the page.
                  Source URL is intentionally NOT shown — it's noise for the user.
                  It is still passed to the backend for provenance.
                */
                <div>
                  <label style={{ ...dimText, display: "block", marginBottom: 6 }}>SELECTED TEXT</label>
                  <div style={{
                    ...card,
                    fontSize: 13, lineHeight: 1.6, color: "#c0c0e0",
                    maxHeight: 150, overflowY: "auto", marginBottom: 12,
                  }}>
                    {appState.pending.text}
                  </div>
                  <button
                    onClick={() => analyzeText(appState.pending.text, appState.pending.sourceUrl)}
                    style={{
                      width: "100%", padding: "10px 0",
                      background: "#7c3aed", color: "#fff",
                      border: "none", borderRadius: 8,
                      fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 8,
                    }}
                  >
                    Analyze
                  </button>
                  <button
                    onClick={backToPicker}
                    style={{
                      width: "100%", padding: "8px 0",
                      background: "transparent", color: "#666",
                      border: "1px solid #2a2a4e", borderRadius: 8,
                      fontSize: 13, cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                /* Manual paste / type flow */
                <TextInputView onSubmit={(text) => analyzeText(text)} />
              )}
            </div>
          )}

          {/* ── IMAGE MODE ── */}
          {mode === "image" && (
            <div>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
                Upload screenshots or photos to check for misleading visuals,
                manipulated images, or fake headlines.
              </p>
              <ImageUploadZone
                images={images}
                onAdd={(img) => setImages((prev) => [...prev, img])}
                onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
              />
              {images.length > 0 && (
                <button
                  onClick={analyzeImages}
                  style={{
                    marginTop: 14, width: "100%", padding: "10px 0",
                    background: "#7c3aed", color: "#fff",
                    border: "none", borderRadius: 8,
                    fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Analyze {images.length} image{images.length > 1 ? "s" : ""}
                </button>
              )}
            </div>
          )}

          {/* ── SPEECH MODE ── */}
          {mode === "speech" && (
            <div>
              <p style={{ fontSize: 12, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
                Speak a claim, headline, or question aloud.
                The transcript will be analysed for credibility.
              </p>
              {/*
                onReady feeds the transcript into analyzeText.
                The "speech://microphone" source is a sentinel so the
                backend knows this came from voice input.
              */}
              <SpeechPanel
                onReady={(text) => analyzeText(text, "speech://microphone")}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}