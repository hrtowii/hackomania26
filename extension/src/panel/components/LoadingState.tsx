import { translations } from "../constants";
import type { Language } from "../constants";

export function LoadingState({ lang }: { lang: Language }) {
  const t = translations[lang];
  return (
    <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 60, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      {t.analyzing}
    </div>
  );
}