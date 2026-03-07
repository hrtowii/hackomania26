import { translations, LANGUAGES } from "../constants";
import type { Language } from "../constants";

interface LanguagePickerProps {
  language: Language;
  onChange: (lang: Language) => void;
}

export function LanguagePicker({ language, onChange }: LanguagePickerProps) {
  const t = translations[language];
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 8 }}>{t.responseLanguage}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {LANGUAGES.map((l) => {
          const active = language === l.value;
          return (
            <button
              key={l.value}
              onClick={() => onChange(l.value)}
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
  );
}
