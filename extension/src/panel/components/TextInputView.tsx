import { useState } from "react";
import { translations, btnPrimary, dimText } from "../constants";
import type { Language } from "../constants";

export function TextInputView({ onSubmit, lang }: { onSubmit: (text: string) => void; lang: Language }) {
  const t = translations[lang];
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>{t.pasteOrType}</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.textPlaceholder}
        style={{
          width: "100%", minHeight: 120, boxSizing: "border-box",
          background: "#13132a", border: "1px solid #3a3a5e",
          borderRadius: 8, padding: 10, color: "#c0c0e0",
          fontSize: 13, lineHeight: 1.6, resize: "vertical",
          fontFamily: "inherit", outline: "none",
        }}
      />
      <button
        disabled={!ready}
        onClick={() => onSubmit(text.trim())}
        style={{
          ...btnPrimary, marginTop: 10,
          background: ready ? "#7c3aed" : "#2a2a4e",
          color: ready ? "#fff" : "#555",
          cursor: ready ? "pointer" : "not-allowed",
        }}
      >
        {t.analyzeText}
      </button>
    </div>
  );
}
