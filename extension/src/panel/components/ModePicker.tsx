import { translations } from "../constants";
import type { Language } from "../constants";
import type { Mode } from "../types";

export function ModePicker({ onPick, lang }: { onPick: (m: Mode) => void; lang: Language }) {
  const t = translations[lang];
  const modes: { mode: Mode; icon: string; title: string; desc: string }[] = [
    { mode: "text", icon: "✍️", title: t.modeText, desc: t.modeTextDesc },
    { mode: "audio", icon: "🎵", title: t.modeAudio, desc: t.modeAudioDesc },
    { mode: "speech", icon: "🎙️", title: t.modeSpeech, desc: t.modeSpeechDesc },
    { mode: "image", icon: "🖼️", title: t.modeImage, desc: t.modeImageDesc },
    { mode: "video", icon: "🎬", title: t.modeVideo, desc: t.modeVideoDesc },
  ];

  return (
    <div>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 14, textAlign: "center", lineHeight: 1.5 }}>
        {t.modePickerTitle}
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
