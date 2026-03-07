import { translations } from "../constants";
import type { Language } from "../constants";

export function ErrorState({ message, onRetry, lang }: { message: string; onRetry: () => void; lang: Language }) {
  const t = translations[lang];
  return (
    <div style={{ textAlign: "center", marginTop: 40 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
      <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{message}</p>
      <button onClick={onRetry} style={{ padding: "8px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
        {t.back}
      </button>
    </div>
  );
}
