import { useState, useRef } from "react";
import type { AnalysisResult } from "../types";
import type { Language } from "../constants";
import { translations, BACKEND_URL } from "../constants";

export function VideoUploadView({ onResult, lang }: { onResult: (r: AnalysisResult) => void; lang: Language }) {
  const t = translations[lang];
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"idle" | "uploading" | "analysing">("idle");
  const [transcript, setTranscript] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");
    setTranscript("");
    setStage("uploading");

    try {
      const form = new FormData();
      form.append("video", file);
      form.append("preferred_language", lang);

      setStage("analysing");

      const res = await fetch(`${BACKEND_URL}/analyze-video`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
      }

      const data = await res.json();

      // Show transcript if returned
      if (data.transcript && data.transcript !== "[No audio track or transcription unavailable]") {
        setTranscript(data.transcript);
      }

      onResult(data);
    } catch (err) {
      console.error("Video analysis failed:", err);
      let msg = t.videoFailed;
      if (err instanceof Error) {
        if (err.message.includes("Failed to fetch")) msg = "Cannot connect to backend. Is it running on localhost:3000?";
        else if (err.message.includes("ffmpeg")) msg = "ffmpeg not found. Run: winget install ffmpeg";
        else msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  // Format file size nicely
  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  // Video preview thumbnail using object URL
  const previewUrl = file ? URL.createObjectURL(file) : null;

  const stageLabel = stage === "uploading"
    ? "Uploading video…"
    : stage === "analysing"
    ? t.extractingFrames
    : t.analysingVideo;

  return (
    <div>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>
        {t.uploadVideo}
      </label>

      {/* Drop zone */}
      {!file && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f && f.type.startsWith("video/")) setFile(f);
          }}
          style={{
            border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
            borderRadius: 8, padding: "28px 12px", textAlign: "center",
            cursor: "pointer", background: dragging ? "#7c3aed11" : "#13132a",
            transition: "all 0.15s", marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎬</div>
          <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : "#666", margin: 0 }}>
            {dragging ? "Drop to upload" : "Drag & drop or click to select"}
          </p>
          <p style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{t.videoFormats}</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
          />
        </div>
      )}

      {/* File preview */}
      {file && previewUrl && (
        <div style={{
          background: "#13132a", border: "1px solid #3a3a5e",
          borderRadius: 8, overflow: "hidden", marginBottom: 12,
        }}>
          <video
            src={previewUrl}
            controls
            style={{ width: "100%", maxHeight: 160, display: "block", background: "#000" }}
          />
          <div style={{
            padding: "8px 12px", display: "flex",
            justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 12, color: "#c0c0e0", fontWeight: 600 }}>
                {file.name.length > 30 ? file.name.slice(0, 27) + "..." : file.name}
              </div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>
                {formatSize(file.size)}
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              style={{
                background: "#ef444422", border: "1px solid #ef444444",
                color: "#ef4444", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, cursor: "pointer",
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* What we analyse info box */}
      {file && !loading && (
        <div style={{
          background: "#7c3aed11", border: "1px solid #7c3aed33",
          borderRadius: 8, padding: "10px 12px", marginBottom: 12,
          fontSize: 11, color: "#a78bfa", lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🔍 This analysis will check for:</div>
          <div>🎭 Deepfake / AI-generated faces</div>
          <div>🚨 Scam & fraud language patterns</div>
          <div>📋 False claims & misinformation</div>
          <div>🤖 AI-generated speech patterns</div>
        </div>
      )}

      {/* Loading stage indicator */}
      {loading && (
        <div style={{
          background: "#7c3aed14", border: "1px solid #7c3aed44",
          borderRadius: 8, padding: "12px 14px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
              <animateTransform attributeName="transform" type="rotate"
                from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
            </path>
          </svg>
          <div>
            <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600 }}>{stageLabel}</div>
            <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
              This may take 30–60 seconds for longer videos
            </div>
          </div>
        </div>
      )}

      {/* Transcript preview while loading */}
      {transcript && (
        <div style={{
          background: "#1a1a2e", border: "1px solid #3a3a5e",
          borderRadius: 8, padding: 12, marginBottom: 12,
        }}>
          <div style={{ fontSize: 10, color: "#22c55e", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 700 }}>
            ✓ {t.videoTranscript}
          </div>
          <div style={{ fontSize: 12, color: "#c0c0e0", lineHeight: 1.6, maxHeight: 80, overflowY: "auto" }}>
            {transcript}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          fontSize: 11, color: "#ef4444", marginBottom: 8,
          padding: 8, background: "#ef444411",
          borderRadius: 4, border: "1px solid #ef444433",
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Analyse button */}
      <button
        disabled={!file || loading}
        onClick={handleUpload}
        style={{
          width: "100%", padding: "10px 0",
          background: file && !loading ? "#7c3aed" : "#2a2a4e",
          color: file && !loading ? "#fff" : "#555",
          border: "none", borderRadius: 8,
          fontSize: 14, fontWeight: 700,
          cursor: file && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? stageLabel : t.analyzeVideo}
      </button>
    </div>
  );
}
