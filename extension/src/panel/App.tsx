import { useEffect, useState } from "react";
import type { PendingAnalysis } from "../background/index";
import { STORAGE_KEY } from "../background/index";
import { BACKEND_URL } from "./constants";
import type { Language } from "./constants";
import type { AnalysisResult, AppState, Mode } from "./types";
import { Header } from "./components/Header";
import { LanguagePicker } from "./components/LanguagePicker";
import { LoadingState } from "./components/LoadingState";
import { ResultState } from "./components/ResultState";
import { ErrorState } from "./components/ErrorState";
import { ModePicker } from "./components/ModePicker";
import { TextInputView } from "./components/TextInputView";
import { AudioFileView } from "./components/AudioFileView";
import { SpeechView } from "./components/SpeechView";
import { ImageUploadView } from "./components/ImageUploadView";
import { cardStyle } from "./constants";
import { btnPrimary, btnSecondary, translations } from "./constants";

export default function App() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [mode, setMode] = useState<Mode>("picker");
  const [language, setLanguage] = useState<Language>("en");
  const [lastInput, setLastInput] = useState<{ text: string; sourceUrl: string } | null>(null);
  const [pendingTranscript, setPendingTranscript] = useState<string>("");
  const t = translations[language];

  useEffect(() => {
    function consume(pending: PendingAnalysis) {
      chrome.storage.session.remove(STORAGE_KEY);
      setMode("text");
      setState({ status: "loaded", pending });
    }

    chrome.storage.session.get(STORAGE_KEY, (items) => {
      const pending = items[STORAGE_KEY] as PendingAnalysis | undefined;
      if (pending?.text) consume(pending);
    });

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (!(STORAGE_KEY in changes)) return;
      const pending = changes[STORAGE_KEY].newValue as PendingAnalysis | undefined;
      if (pending?.text) consume(pending);
    };

    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  async function analyzeText(text: string, sourceUrl = "") {
    setLastInput({ text, sourceUrl });
    setState({ status: "loading" });
    try {
      const res = await fetch(`${BACKEND_URL}/analyze/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source_url: sourceUrl, preferred_language: language }),
      });

      const raw = await res.text();

      if (!res.ok) {
        throw new Error(raw || `HTTP ${res.status}`);
      }

      try {
        const result: AnalysisResult = JSON.parse(raw);
        setState({ status: "success", result });
      } catch {
        throw new Error(`Backend returned non-JSON response:\n\n${raw.slice(0, 300)}`);
      }
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

    function reset() {
    chrome.storage.session.remove(STORAGE_KEY);
    setState({ status: "idle" });
    setMode("picker");
    setPendingTranscript("");
  }

  function handleLanguageChange(lang: Language) {
    setLanguage(lang);
    if (state.status === "success" && lastInput) {
      analyzeText(lastInput.text, lastInput.sourceUrl);
    }
  }

  const showBack = mode !== "picker" && state.status !== "loading" && state.status !== "success";

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0f0f1a" }}>
      <Header lang={language} showBack={showBack} onBack={reset} />
      <LanguagePicker language={language} onChange={handleLanguageChange} />

      {state.status === "loading" && <LoadingState lang={language} transcript={pendingTranscript}/>}
      {state.status === "success" && <ResultState result={state.result} onReset={reset} lang={language} />}
      {state.status === "error" && <ErrorState message={state.message} onRetry={reset} lang={language} />}

      {(state.status === "idle" || state.status === "loaded") && (
        <>
          {mode === "picker" && <ModePicker onPick={setMode} lang={language} />}

          {mode === "text" && (
            <>
              {state.status === "loaded" ? (
                <div>
                  <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 6 }}>{t.selectedText}</label>
                  <div style={{ ...cardStyle, fontSize: 13, lineHeight: 1.5, color: "#c0c0e0", maxHeight: 140, overflowY: "auto", marginBottom: 8 }}>
                    {state.pending.text}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 16, wordBreak: "break-all" }}>
                    {state.pending.sourceUrl}
                  </div>
                  <button onClick={() => analyzeText(state.pending.text, state.pending.sourceUrl)} style={{ ...btnPrimary, marginBottom: 8 }}>
                    {t.analyze}
                  </button>
                  <button onClick={reset} style={btnSecondary}>{t.dismiss}</button>
                </div>
              ) : (
                <TextInputView onSubmit={(text) => analyzeText(text)} lang={language} />
              )}
            </>
          )}

          {mode === "audio" && (
            <AudioFileView onTranscribed={(text) => { setPendingTranscript(text); analyzeText(text, "audio://file");
              }}
              lang={language}
            />
          )}

          {mode === "speech" && (
            <SpeechView onReady={(text) => analyzeText(text, "speech://microphone")} lang={language} />
          )}

          {mode === "image" && (
            <ImageUploadView onResult={(result) => setState({ status: "success", result })} lang={language} />
          )}
        </>
      )}
    </div>
  );
}
