import { translations } from "../constants";
import type { Language } from "../constants";

export function LoadingState({ lang, transcript }: { lang: Language; transcript?: string }) {
  const t = translations[lang];
  return (
    <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 40, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <div>{t.analyzing}</div>

      {transcript && (
        <div style={{
          marginTop: 20, padding: 12,
          background: "#1a1a2e", border: "1px solid #3a3a5e",
          borderRadius: 8, textAlign: "left",
        }}>
          <div style={{
            fontSize: 10, color: "#666", marginBottom: 6,
            textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700,
          }}>
            Transcript
          </div>
          <div style={{ fontSize: 12, color: "#c0c0e0", lineHeight: 1.6 }}>
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
}
