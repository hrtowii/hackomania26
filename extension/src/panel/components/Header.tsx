import { translations } from "../constants";
import type { Language } from "../constants";

interface HeaderProps {
  lang: Language;
  showBack: boolean;
  onBack: () => void;
}

export function Header({ lang, showBack, onBack }: HeaderProps) {
  const t = translations[lang];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      {showBack && (
        <button
          onClick={onBack}
          title={t.back}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 0, fontSize: 18, lineHeight: 1 }}
        >
          ←
        </button>
      )}
      <span style={{ fontSize: 22 }}>🔍</span>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", letterSpacing: "-0.02em" }}>{t.appName}</span>
    </div>
  );
}
