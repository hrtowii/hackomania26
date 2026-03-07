import { useEffect, useRef, useState } from "react";
import { translations, btnPrimary, btnSecondary, cardStyle, dimText } from "../constants";
import type { Language } from "../constants";
import { injectStyle } from "../utils";

export function SpeechView({ onReady, lang }: { onReady: (text: string) => void; lang: Language }) {
  const t = translations[lang];
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
    if (!SR) { setError(t.speechNotSupported); return; }
    if (recording) { recRef.current?.stop(); setRecording(false); return; }

    setError("");
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-SG";
    rec.onresult = (e: any) => {
      let full = "";
      for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
      setTranscript(full);
    };
    rec.onerror = () => { setRecording(false); setError(t.microphoneError); };
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
            {recording ? t.listening : t.tapMicToStart}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#555", lineHeight: 1.4 }}>
            {t.speechSupport}<br />{t.tapAgainToStop}
          </p>
        </div>
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{error}</p>}

      {transcript && (
        <div>
          <label style={{ ...dimText, display: "block", marginBottom: 5 }}>{t.transcript}</label>
          <div style={{ ...cardStyle, fontSize: 13, color: "#c0c0e0", lineHeight: 1.6, maxHeight: 110, overflowY: "auto", marginBottom: 10 }}>
            {transcript}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onReady(transcript)} style={{ ...btnPrimary, flex: 1, width: "auto" }}>
              {t.analyzeSpeech}
            </button>
            <button onClick={() => setTranscript("")} style={{ ...btnSecondary, width: "auto", padding: "10px 14px" }}>
              {t.clear}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
