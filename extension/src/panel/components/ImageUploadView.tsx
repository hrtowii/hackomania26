import { useRef, useState } from "react";
import { translations, btnPrimary, dimText, BACKEND_URL, MAX_IMAGES } from "../constants";
import type { Language } from "../constants";
import type { AnalysisResult, UploadedImage } from "../types";

export function ImageUploadView({ onResult, lang }: { onResult: (r: AnalysisResult) => void; lang: Language }) {
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
      let imagesb64: any = [];
      for (let image of images) {
        image.file.arrayBuffer().then((res) => {
        })
      }
      // const res = await fetch(`${BACKEND_URL}/image`, { method: "POST", body: [] });
      // if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // onResult(await res.json());
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
          {loading ? t.analysingImages : ${t.analyzeImages} ${images.length} ${images.length > 1 ? t.images : t.image}}
        </button>
      )}
    </div>
  );
}