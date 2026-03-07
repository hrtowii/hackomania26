import { useEffect, useRef, useState } from "react";
import type { PendingAnalysis } from "../background/index";
import { STORAGE_KEY } from "../background/index";

type Language = "en" | "zh" | "ms" | "ta";
/** Matches backend risk_level values */
type RiskLevel = "safe" | "caution" | "suspicious";
/** Granular WhatsApp FactCheck classification */
type WhatsAppClassification = "legitimate" | "misleading" | "scam" | "suspicious" | "unverified";
type Mode = "picker" | "text" | "audio" | "speech" | "image";

interface CrossReference {
  source: string;
  contradiction_level: "low" | "medium" | "high";
  url: string;
}

interface AnalysisResult {
  analysis_id: string;
  credibility_score: number;
  risk_level: RiskLevel;
  /** Granular classification, present on WhatsApp fact-check results */
  classification?: WhatsAppClassification;
  summary: string;
  bias_detected: string[];
  cross_references: CrossReference[];
  key_claims: string[];
  recommendation: string;
  audio_url?: string;
}

type AppState =
  | { status: "idle" }
  | { status: "loaded"; pending: PendingAnalysis }
  | { status: "loading" }
  | { status: "success"; result: AnalysisResult }
  | { status: "error"; message: string };

// constants

const BACKEND_URL = "http://localhost:3000";
const MAX_IMAGES = 5;

/** Maps the backend risk_level values to display colours */
const RISK_COLORS: Record<RiskLevel, string> = {
  "safe": "#22c55e",
  "caution": "#f59e0b",
  "suspicious": "#ef4444",
};

const CLASSIFICATION_COLORS: Record<WhatsAppClassification, string> = {
  "legitimate": "#22c55e",
  "unverified":  "#f59e0b",
  "suspicious":  "#f97316",
  "misleading":  "#ef4444",
  "scam":        "#dc2626",
};

const CLASSIFICATION_ICONS: Record<WhatsAppClassification, string> = {
  "legitimate": "\u2705",
  "unverified": "\u2753",
  "suspicious": "\u26A0\uFE0F",
  "misleading": "\uD83D\uDEA8",
  "scam":       "\uD83D\uDED1",
};

const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ms", label: "Melayu" },
  { value: "ta", label: "தமிழ்" },
];

// Translations
const translations = {
  en: {
    appName: "TruthLens",
    responseLanguage: "RESPONSE LANGUAGE",
    analyzing: "Analyzing…",
    credibilityScore: "CREDIBILITY SCORE",
    summary: "Summary",
    recommendation: "Recommendation",
    keyClaims: "Key Claims",
    biasDetected: "Bias Detected",
    crossReferences: "Cross-References",
    analyzeAnother: "Analyze another selection",
    back: "Back",
    
    // Mode picker
    modePickerTitle: "How would you like to fact-check today?",
    modeText: "Paste / Type Text",
    modeTextDesc: "Paste a news snippet, WhatsApp message, or any claim",
    modeAudio: "Upload Audio File",
    modeAudioDesc: "Upload a .wav, .mp3, or .m4a file to transcribe and analyse",
    modeSpeech: "Speak to Analyse",
    modeSpeechDesc: "Record live speech via your microphone",
    modeImage: "Upload Screenshot",
    modeImageDesc: "Check images or forwarded photos for misleading content",
    
    // Text input
    pasteOrType: "PASTE OR TYPE TEXT",
    textPlaceholder: "Paste a news headline, WhatsApp message, social media post…",
    analyzeText: "Analyze Text",
    
    // Audio
    uploadAudioFile: "UPLOAD AUDIO FILE",
    dropToUpload: "Drop to upload",
    dragOrClick: "Drag & drop or click to select",
    audioFormats: "WAV · MP3 · M4A · OGG",
    transcribing: "Transcribing…",
    transcribeAndAnalyze: "Transcribe & Analyse",
    transcriptionFailed: "Transcription failed — check that the backend /transcribe endpoint is running.",
    
    // Speech
    listening: "● Listening…",
    tapMicToStart: "Tap mic to start",
    speechSupport: "Supports English, Mandarin, Malay & Tamil.",
    tapAgainToStop: "Tap again to stop.",
    transcript: "TRANSCRIPT",
    analyzeSpeech: "Analyze Speech",
    clear: "Clear",
    speechNotSupported: "Speech recognition not supported in this browser.",
    microphoneError: "Microphone error — check browser permissions.",
    
    // Image
    uploadScreenshots: "UPLOAD SCREENSHOT(S)",
    imageDesc: "Check images or forwarded photos for misleading visuals or fake headlines. Up to",
    imageDescImages: "images.",
    imageFormats: "PNG · JPG · WEBP · up to",
    maxReached: "Max",
    maxReachedEnd: "reached",
    analysingImages: "Analysing…",
    analyzeImages: "Analyse",
    image: "image",
    images: "images",
    imageFailed: "Image analysis failed — check that the backend /analyze-image endpoint is running.",
    
    // States
    selectedText: "SELECTED TEXT",
    analyze: "Analyze",
    dismiss: "Dismiss",
    
    // Contradiction levels
    lowContradiction: "low contradiction",
    mediumContradiction: "medium contradiction",
    highContradiction: "high contradiction",
    
    // Classification
    classificationLabel: "CLASSIFICATION",
    classificationLegitimate: "Legitimate",
    classificationMisleading: "Misleading",
    classificationScam: "Scam",
    classificationSuspicious: "Suspicious",
    classificationUnverified: "Unverified",
    riskSafe: "Safe",
    riskCaution: "Caution",
    riskSuspicious: "Suspicious",
  },
  
  zh: {
    appName: "真相透镜",
    responseLanguage: "回复语言",
    analyzing: "分析中…",
    credibilityScore: "可信度评分",
    summary: "摘要",
    recommendation: "建议",
    keyClaims: "关键声明",
    biasDetected: "检测到的偏见",
    crossReferences: "交叉引用",
    analyzeAnother: "分析另一个选择",
    back: "返回",
    
    modePickerTitle: "您今天想如何进行事实核查？",
    modeText: "粘贴/输入文本",
    modeTextDesc: "粘贴新闻片段、WhatsApp消息或任何声明",
    modeAudio: "上传音频文件",
    modeAudioDesc: "上传.wav、.mp3或.m4a文件进行转录和分析",
    modeSpeech: "语音分析",
    modeSpeechDesc: "通过麦克风录制实时语音",
    modeImage: "上传截图",
    modeImageDesc: "检查图片或转发的照片是否有误导性内容",
    
    pasteOrType: "粘贴或输入文本",
    textPlaceholder: "粘贴新闻标题、WhatsApp消息、社交媒体帖子…",
    analyzeText: "分析文本",
    
    uploadAudioFile: "上传音频文件",
    dropToUpload: "放下以上传",
    dragOrClick: "拖放或点击选择",
    audioFormats: "WAV · MP3 · M4A · OGG",
    transcribing: "转录中…",
    transcribeAndAnalyze: "转录并分析",
    transcriptionFailed: "转录失败 — 请检查后端 /transcribe 端点是否正在运行。",
    
    listening: "● 正在听…",
    tapMicToStart: "点击麦克风开始",
    speechSupport: "支持英语、普通话、马来语和泰米尔语。",
    tapAgainToStop: "再次点击停止。",
    transcript: "转录文本",
    analyzeSpeech: "分析语音",
    clear: "清除",
    speechNotSupported: "此浏览器不支持语音识别。",
    microphoneError: "麦克风错误 — 请检查浏览器权限。",
    
    uploadScreenshots: "上传截图",
    imageDesc: "检查图片或转发的照片是否有误导性视觉效果或虚假标题。最多",
    imageDescImages: "张图片。",
    imageFormats: "PNG · JPG · WEBP · 最多",
    maxReached: "已达到最大值",
    maxReachedEnd: "",
    analysingImages: "分析中…",
    analyzeImages: "分析",
    image: "张图片",
    images: "张图片",
    imageFailed: "图片分析失败 — 请检查后端 /analyze-image 端点是否正在运行。",
    
    selectedText: "选定的文本",
    analyze: "分析",
    dismiss: "关闭",
    
    lowContradiction: "低矛盾",
    mediumContradiction: "中等矛盾",
    highContradiction: "高矛盾",
    
    classificationLabel: "分类",
    classificationLegitimate: "合法",
    classificationMisleading: "误导性",
    classificationScam: "诈骗",
    classificationSuspicious: "可疑",
    classificationUnverified: "未核实",
    riskSafe: "安全",
    riskCaution: "注意",
    riskSuspicious: "可疑",
  },
  
  ms: {
    appName: "TruthLens",
    responseLanguage: "BAHASA RESPONS",
    analyzing: "Menganalisis…",
    credibilityScore: "SKOR KREDIBILITI",
    summary: "Ringkasan",
    recommendation: "Cadangan",
    keyClaims: "Tuntutan Utama",
    biasDetected: "Bias Dikesan",
    crossReferences: "Rujukan Silang",
    analyzeAnother: "Analisis pilihan lain",
    back: "Kembali",
    
    modePickerTitle: "Bagaimana anda ingin menyemak fakta hari ini?",
    modeText: "Tampal / Taip Teks",
    modeTextDesc: "Tampal petikan berita, mesej WhatsApp, atau sebarang tuntutan",
    modeAudio: "Muat Naik Fail Audio",
    modeAudioDesc: "Muat naik fail .wav, .mp3, atau .m4a untuk transkripsi dan analisis",
    modeSpeech: "Bercakap untuk Analisis",
    modeSpeechDesc: "Rakam ucapan langsung melalui mikrofon anda",
    modeImage: "Muat Naik Tangkapan Skrin",
    modeImageDesc: "Semak imej atau foto yang dimajukan untuk kandungan yang mengelirukan",
    
    pasteOrType: "TAMPAL ATAU TAIP TEKS",
    textPlaceholder: "Tampal tajuk berita, mesej WhatsApp, hantaran media sosial…",
    analyzeText: "Analisis Teks",
    
    uploadAudioFile: "MUAT NAIK FAIL AUDIO",
    dropToUpload: "Lepaskan untuk muat naik",
    dragOrClick: "Seret & lepas atau klik untuk pilih",
    audioFormats: "WAV · MP3 · M4A · OGG",
    transcribing: "Menyalin…",
    transcribeAndAnalyze: "Salin & Analisis",
    transcriptionFailed: "Penyalinan gagal — semak sama ada titik akhir backend /transcribe sedang berjalan.",
    
    listening: "● Mendengar…",
    tapMicToStart: "Ketik mikrofon untuk mula",
    speechSupport: "Menyokong Bahasa Inggeris, Mandarin, Melayu & Tamil.",
    tapAgainToStop: "Ketik lagi untuk berhenti.",
    transcript: "TRANSKRIP",
    analyzeSpeech: "Analisis Ucapan",
    clear: "Padam",
    speechNotSupported: "Pengecaman pertuturan tidak disokong dalam pelayar ini.",
    microphoneError: "Ralat mikrofon — semak kebenaran pelayar.",
    
    uploadScreenshots: "MUAT NAIK TANGKAPAN SKRIN",
    imageDesc: "Semak imej atau foto yang dimajukan untuk visual atau tajuk berita palsu yang mengelirukan. Sehingga",
    imageDescImages: "imej.",
    imageFormats: "PNG · JPG · WEBP · sehingga",
    maxReached: "Maksimum",
    maxReachedEnd: "dicapai",
    analysingImages: "Menganalisis…",
    analyzeImages: "Analisis",
    image: "imej",
    images: "imej",
    imageFailed: "Analisis imej gagal — semak sama ada titik akhir backend /analyze-image sedang berjalan.",
    
    selectedText: "TEKS TERPILIH",
    analyze: "Analisis",
    dismiss: "Tutup",
    
    lowContradiction: "percanggahan rendah",
    mediumContradiction: "percanggahan sederhana",
    highContradiction: "percanggahan tinggi",
    
    classificationLabel: "KLASIFIKASI",
    classificationLegitimate: "Sah",
    classificationMisleading: "Mengelirukan",
    classificationScam: "Penipuan",
    classificationSuspicious: "Mencurigakan",
    classificationUnverified: "Tidak Disahkan",
    riskSafe: "Selamat",
    riskCaution: "Berhati-hati",
    riskSuspicious: "Mencurigakan",
  },
  
  ta: {
    appName: "உண்மை லென்ஸ்",
    responseLanguage: "பதில் மொழி",
    analyzing: "பகுப்பாய்வு செய்கிறது…",
    credibilityScore: "நம்பகத்தன்மை மதிப்பெண்",
    summary: "சுருக்கம்",
    recommendation: "பரிந்துரை",
    keyClaims: "முக்கிய கூற்றுகள்",
    biasDetected: "சார்பு கண்டறியப்பட்டது",
    crossReferences: "குறுக்கு குறிப்புகள்",
    analyzeAnother: "மற்றொரு தேர்வை பகுப்பாய்வு செய்க",
    back: "பின்செல்",
    
    modePickerTitle: "இன்று நீங்கள் எவ்வாறு உண்மையை சரிபார்க்க விரும்புகிறீர்கள்?",
    modeText: "ஒட்டவும் / உரை தட்டச்சு செய்யவும்",
    modeTextDesc: "செய்தி துணுக்கு, WhatsApp செய்தி அல்லது ஏதேனும் கூற்றை ஒட்டவும்",
    modeAudio: "ஆடியோ கோப்பை பதிவேற்றவும்",
    modeAudioDesc: ".wav, .mp3, அல்லது .m4a கோப்பை பதிவேற்றி, படியெடுத்து பகுப்பாய்வு செய்யவும்",
    modeSpeech: "பேசி பகுப்பாய்வு செய்க",
    modeSpeechDesc: "உங்கள் மைக்ரோஃபோன் மூலம் நேரலை பேச்சை பதிவு செய்க",
    modeImage: "திரை பிடிப்பை பதிவேற்றவும்",
    modeImageDesc: "தவறாக வழிநடத்தும் உள்ளடக்கத்திற்காக படங்கள் அல்லது அனுப்பப்பட்ட புகைப்படங்களை சரிபார்க்கவும்",
    
    pasteOrType: "ஒட்டவும் அல்லது உரை தட்டச்சு செய்யவும்",
    textPlaceholder: "செய்தி தலைப்பு, WhatsApp செய்தி, சமூக ஊடக இடுகை ஒட்டவும்…",
    analyzeText: "உரையை பகுப்பாய்வு செய்க",
    
    uploadAudioFile: "ஆடியோ கோப்பை பதிவேற்றவும்",
    dropToUpload: "பதிவேற்ற விடவும்",
    dragOrClick: "இழுத்து விடவும் அல்லது தேர்ந்தெடுக்க கிளிக் செய்யவும்",
    audioFormats: "WAV · MP3 · M4A · OGG",
    transcribing: "படியெடுக்கிறது…",
    transcribeAndAnalyze: "படியெடுத்து பகுப்பாய்வு செய்க",
    transcriptionFailed: "படியெடுப்பு தோல்வியடைந்தது — பின்புல /transcribe endpoint இயங்குகிறதா என சரிபார்க்கவும்.",
    
    listening: "● கேட்கிறது…",
    tapMicToStart: "தொடங்க மைக்கை தட்டவும்",
    speechSupport: "ஆங்கிலம், மாண்டரின், மலாய் & தமிழை ஆதரிக்கிறது.",
    tapAgainToStop: "நிறுத்த மீண்டும் தட்டவும்.",
    transcript: "படியெடுப்பு",
    analyzeSpeech: "பேச்சை பகுப்பாய்வு செய்க",
    clear: "அழி",
    speechNotSupported: "இந்த உலாவியில் பேச்சு அங்கீகாரம் ஆதரிக்கப்படவில்லை.",
    microphoneError: "மைக்ரோஃபோன் பிழை — உலாவி அனுமதிகளை சரிபார்க்கவும்.",
    
    uploadScreenshots: "திரை பிடிப்புகளை பதிவேற்றவும்",
    imageDesc: "தவறாக வழிநடத்தும் காட்சிகள் அல்லது போலி தலைப்புகளுக்காக படங்கள் அல்லது அனுப்பப்பட்ட புகைப்படங்களை சரிபார்க்கவும். அதிகபட்சம்",
    imageDescImages: "படங்கள்.",
    imageFormats: "PNG · JPG · WEBP · அதிகபட்சம்",
    maxReached: "அதிகபட்சம்",
    maxReachedEnd: "அடைந்தது",
    analysingImages: "பகுப்பாய்வு செய்கிறது…",
    analyzeImages: "பகுப்பாய்வு செய்க",
    image: "படம்",
    images: "படங்கள்",
    imageFailed: "படம் பகுப்பாய்வு தோல்வியடைந்தது — பின்புல /analyze-image endpoint இயங்குகிறதா என சரிபார்க்கவும்.",
    
    selectedText: "தேர்ந்தெடுக்கப்பட்ட உரை",
    analyze: "பகுப்பாய்வு செய்க",
    dismiss: "நிராகரி",
    
    lowContradiction: "குறைந்த முரண்பாடு",
    mediumContradiction: "நடுத்தர முரண்பாடு",
    highContradiction: "உயர் முரண்பாடு",
    
    classificationLabel: "வகைப்பாடு",
    classificationLegitimate: "சட்டப்பூர்வமானது",
    classificationMisleading: "தவறான தகவல்",
    classificationScam: "மோசடி",
    classificationSuspicious: "சந்தேகமானது",
    classificationUnverified: "உறுதிப்படுத்தப்படாதது",
    riskSafe: "பாதுகாப்பானது",
    riskCaution: "கவனமாக இருக்கவும்",
    riskSuspicious: "சந்தேகமானது",
  },
};

// css style helper

const cardStyle: React.CSSProperties = {
  background: "#1a1a2e", border: "1px solid #3a3a5e",
  borderRadius: 8, padding: 12,
};
const dimText: React.CSSProperties = { fontSize: 11, color: "#888" };
const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "10px 0",
  background: "#7c3aed", color: "#fff",
  border: "none", borderRadius: 8,
  fontSize: 14, fontWeight: 700, cursor: "pointer",
};
const btnSecondary: React.CSSProperties = {
  width: "100%", padding: "8px 0",
  background: "transparent", color: "#666",
  border: "1px solid #2a2a4e", borderRadius: 8,
  fontSize: 13, cursor: "pointer",
};

function injectStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css;
  document.head.appendChild(el);
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? RISK_COLORS["safe"] : score >= 40 ? RISK_COLORS["caution"] : RISK_COLORS["suspicious"];
  return (
    <div style={{
      width: 72, height: 72, borderRadius: "50%",
      border: `5px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, fontWeight: 700, color, flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
      borderRadius: 4, padding: "2px 8px",
      fontSize: 11, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.05em",
    }}>
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, color: "#666", fontWeight: 700,
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// mode pickers

function ModePicker({ onPick, lang }: { onPick: (m: Mode) => void; lang: Language }) {
  const t = translations[lang];
  const modes: { mode: Mode; icon: string; title: string; desc: string }[] = [
    { mode: "text", icon: "✍️", title: t.modeText, desc: t.modeTextDesc },
    { mode: "audio", icon: "🎵", title: t.modeAudio, desc: t.modeAudioDesc },
    { mode: "speech", icon: "🎙️", title: t.modeSpeech, desc: t.modeSpeechDesc },
    { mode: "image", icon: "🖼️", title: t.modeImage, desc: t.modeImageDesc },
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

function TextInputView({ onSubmit, lang }: { onSubmit: (text: string) => void; lang: Language }) {
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

function AudioFileView({ onTranscribed, lang }: { onTranscribed: (text: string) => void; lang: Language }) {
  const t = translations[lang];
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      form.append("audio", file);
      const res = await fetch(`${BACKEND_URL}/transcribe`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { text } = await res.json();
      onTranscribed(text);
    } catch {
      setError(t.transcriptionFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>{t.uploadAudioFile}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) setFile(f);
        }}
        style={{
          border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
          borderRadius: 8, padding: "22px 12px", textAlign: "center",
          cursor: "pointer", background: dragging ? "#7c3aed11" : "#13132a",
          transition: "all 0.15s", marginBottom: 12,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke={dragging ? "#a78bfa" : "#555"} strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ margin: "0 auto 8px", display: "block" }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : file ? "#a78bfa" : "#666", margin: 0 }}>
          {file ? file.name : dragging ? t.dropToUpload : t.dragOrClick}
        </p>
        <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{t.audioFormats}</p>
        <input ref={inputRef} type="file" accept="audio/*" style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{error}</p>}

      <button
        disabled={!file || loading}
        onClick={handleUpload}
        style={{
          ...btnPrimary,
          background: file && !loading ? "#7c3aed" : "#2a2a4e",
          color: file && !loading ? "#fff" : "#555",
          cursor: file && !loading ? "pointer" : "not-allowed",
        }}
      >
        {loading ? t.transcribing : t.transcribeAndAnalyze}
      </button>
    </div>
  );
}

function SpeechView({ onReady, lang }: { onReady: (text: string) => void; lang: Language }) {
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

interface UploadedImage { file: File; dataUrl: string; }

function ImageUploadView({ onResult, lang }: { onResult: (r: AnalysisResult) => void; lang: Language }) {
  const t = translations[lang];
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = images.length >= MAX_IMAGES;

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).slice(0, MAX_IMAGES - images.length).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => setImages((prev) => [...prev, { file, dataUrl: reader.result as string }]);
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit() {
    if (!images.length) return;
    setLoading(true); setError("");
    try {
      const form = new FormData();
      images.forEach((img) => form.append("images", img.file));
      const res = await fetch(`${BACKEND_URL}/analyze-image`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onResult(await res.json());
    } catch {
      setError(t.imageFailed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <label style={{ ...dimText, display: "block", marginBottom: 6 }}>{t.uploadScreenshots}</label>
      <p style={{ fontSize: 11, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
        {t.imageDesc} {MAX_IMAGES} {t.imageDescImages}
      </p>

      {!full && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          style={{
            border: `2px dashed ${dragging ? "#7c3aed" : "#3a3a5e"}`,
            borderRadius: 8, padding: "22px 12px", textAlign: "center",
            cursor: "pointer", background: dragging ? "#7c3aed11" : "#13132a",
            transition: "all 0.15s", marginBottom: images.length ? 12 : 0,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={dragging ? "#a78bfa" : "#555"} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ margin: "0 auto 8px", display: "block" }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p style={{ fontSize: 12, color: dragging ? "#a78bfa" : "#666", margin: 0 }}>
            {dragging ? t.dropToUpload : t.dragOrClick}
          </p>
          <p style={{ fontSize: 10, color: "#444", marginTop: 3 }}>{t.imageFormats} {MAX_IMAGES}</p>
          <input ref={inputRef} type="file" accept="image/*" multiple
            style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, marginBottom: 12 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={img.dataUrl} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #3a3a5e" }} />
              <button
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#ef4444", border: "none",
                  color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >✕</button>
            </div>
          ))}
          {full && <div style={{ fontSize: 10, color: "#555", alignSelf: "center" }}>{t.maxReached} {MAX_IMAGES} {t.maxReachedEnd}</div>}
        </div>
      )}

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 8 }}>{error}</p>}

      {images.length > 0 && (
        <button
          disabled={loading}
          onClick={handleSubmit}
          style={{
            ...btnPrimary,
            background: loading ? "#2a2a4e" : "#7c3aed",
            color: loading ? "#555" : "#fff",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? t.analysingImages : `${t.analyzeImages} ${images.length} ${images.length > 1 ? t.images : t.image}`}
        </button>
      )}
    </div>
  );
}

function LoadingState({ lang }: { lang: Language }) {
  const t = translations[lang];
  return (
    <div style={{ color: "#a78bfa", textAlign: "center", marginTop: 60, fontSize: 13 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      {t.analyzing}
    </div>
  );
}

function ResultState({ result, onReset, lang }: { result: AnalysisResult; onReset: () => void; lang: Language }) {
  const t = translations[lang];
  const riskColor = RISK_COLORS[result.risk_level] ?? "#f59e0b";

  const riskLabel: Record<RiskLevel, string> = {
    safe: t.riskSafe,
    caution: t.riskCaution,
    suspicious: t.riskSuspicious,
  };

  const classificationLabel: Record<WhatsAppClassification, string> = {
    legitimate: t.classificationLegitimate,
    misleading: t.classificationMisleading,
    scam: t.classificationScam,
    suspicious: t.classificationSuspicious,
    unverified: t.classificationUnverified,
  };
  
  const getContradictionText = (level: "low" | "medium" | "high") => {
    if (level === "low") return t.lowContradiction;
    if (level === "medium") return t.mediumContradiction;
    return t.highContradiction;
  };
  
  return (
    <div>
      {/* Classification badge — shown when the result includes a WhatsApp classification */}
      {result.classification && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 12, padding: "10px 14px",
          background: `${CLASSIFICATION_COLORS[result.classification]}18`,
          border: `1px solid ${CLASSIFICATION_COLORS[result.classification]}55`,
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>
            {CLASSIFICATION_ICONS[result.classification]}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#888", letterSpacing: "0.05em", marginBottom: 2 }}>
              {t.classificationLabel}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: CLASSIFICATION_COLORS[result.classification],
            }}>
              {classificationLabel[result.classification]}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, background: "#1a1a2e", borderRadius: 8, padding: 12 }}>
        <ScoreRing score={result.credibility_score} />
        <div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{t.credibilityScore}</div>
          <Badge label={riskLabel[result.risk_level] ?? result.risk_level} color={riskColor} />
        </div>
      </div>

      <Section title={t.summary}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>{result.summary}</p>
      </Section>

      <Section title={t.recommendation}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c0c0e0" }}>{result.recommendation}</p>
      </Section>

      {result.key_claims.length > 0 && (
        <Section title={t.keyClaims}>
          <ul style={{ paddingLeft: 16, fontSize: 13, color: "#c0c0e0", lineHeight: 1.7 }}>
            {result.key_claims.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </Section>
      )}

      {result.bias_detected.length > 0 && (
        <Section title={t.biasDetected}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {result.bias_detected.map((b) => <Badge key={b} label={b} color="#f59e0b" />)}
          </div>
        </Section>
      )}

      {result.cross_references.length > 0 && (
        <Section title={t.crossReferences}>
          {result.cross_references.map((ref, i) => (
            <div key={i} style={{
              marginBottom: 8, fontSize: 12,
              borderLeft: `3px solid ${ref.contradiction_level === "high" ? "#ef4444" : ref.contradiction_level === "medium" ? "#f59e0b" : "#22c55e"}`,
              paddingLeft: 8,
            }}>
              <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "#7c7cff", textDecoration: "none" }}>{ref.source}</a>
              <span style={{ color: "#666", marginLeft: 6 }}>({getContradictionText(ref.contradiction_level)})</span>
            </div>
          ))}
        </Section>
      )}

      <button onClick={onReset} style={{ ...btnSecondary, marginTop: 8 }}>
        {t.analyzeAnother}
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry, lang }: { message: string; onRetry: () => void; lang: Language }) {
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

export default function App() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const [mode, setMode] = useState<Mode>("picker");
  const [language, setLanguage] = useState<Language>("en");
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
        const result = JSON.parse(raw);
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
  }

  const showBack = mode !== "picker" && state.status !== "loading" && state.status !== "success";

  return (
    <div style={{ padding: 16, minHeight: "100vh", background: "#0f0f1a" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        {showBack && (
          <button onClick={reset} title={t.back} style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 0, fontSize: 18, lineHeight: 1 }}>
            ←
          </button>
        )}
        <span style={{ fontSize: 22 }}>🔍</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#a78bfa", letterSpacing: "-0.02em" }}>{t.appName}</span>
      </div>

      {/* Language picker */}
      {state.status !== "success" && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#888", display: "block", marginBottom: 8 }}>{t.responseLanguage}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LANGUAGES.map((l) => {
              const active = language === l.value;
              return (
                <button
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
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
      )}

      {/* Loading */}
      {state.status === "loading" && <LoadingState lang={language} />}

      {/* Results */}
      {state.status === "success" && <ResultState result={state.result} onReset={reset} lang={language} />}

      {/* Error */}
      {state.status === "error" && <ErrorState message={state.message} onRetry={reset} lang={language} />}

      {/* Input modes */}
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
            <AudioFileView onTranscribed={(text) => analyzeText(text, "audio://file")} lang={language} />
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