import { useRef, useState } from "react";
import { translations, btnPrimary, BACKEND_URL } from "../constants";
import type { Language } from "../constants";

export function AudioFileView({ onTranscribed, lang }: { onTranscribed: (text: string) => void; lang: Language }) {
  const t = translations[lang];
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
      const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", headers: { "X-Language": lang }, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { text } = await res.json();
      onTranscribed(text);
    } catch {
      setError(t.transcriptionFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>{t.uploadAudioFile}</label>
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
          {file ? file.name : dragging ? t.dropToUpload : t.dragOrClick}
        </p>
        <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{t.audioFormats}</p>
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
        {loading ? t.transcribing : t.transcribeAndAnalyze}
      </button>

      {loading && (
        <p style={{ fontSize: 10, color: "#888", marginTop: 8, textAlign: "center" }}>
          First upload may take 2-5 minutes while model downloads...
        </p>
      )}
    </div>
  );
}
