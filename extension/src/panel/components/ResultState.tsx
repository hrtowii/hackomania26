import { translations, CLASSIFICATION_COLORS, CLASSIFICATION_ICONS, btnSecondary } from "../constants";
import type { Language, WhatsAppClassification } from "../constants";
import { deriveRiskLevel, RISK_COLORS, type RiskLevel } from "../utils";
import type { AnalysisResult } from "../types";
import { ScoreRing } from "./ScoreRing";
import { Badge } from "./Badge";
import { Section } from "./Section";

export function ResultState({ result, onReset, lang }: { result: AnalysisResult; onReset: () => void; lang: Language }) {
  const t = translations[lang];
  const riskLevel = deriveRiskLevel(result.credibility_score);
  const riskColor = RISK_COLORS[riskLevel] ?? "#f59e0b";

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
      {/* Classification badge */}
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
          <Badge label={riskLabel[riskLevel]} color={riskColor} />
        </div>
      </div>

      {result.ai_detection && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 10, color: "#666", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6,
          }}>
            AI / DEEPFAKE DETECTION
          </div>
          <div style={{
            background: result.ai_detection.verdict === "real"
              ? "#22c55e18"
              : result.ai_detection.verdict === "inconclusive"
                ? "#f59e0b18"
                : "#ef444418",
            border: `1px solid ${result.ai_detection.verdict === "real"
                ? "#22c55e44"
                : result.ai_detection.verdict === "inconclusive"
                  ? "#f59e0b44"
                  : "#ef444444"
              }`,
            borderRadius: 10, padding: "12px 14px",
          }}>
            {/* Verdict row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 24 }}>
                {result.ai_detection.verdict === "real" ? "✅"
                  : result.ai_detection.verdict === "ai-generated" ? "🤖"
                    : result.ai_detection.verdict === "deepfake" ? "🎭"
                      : "❓"}
              </span>
              <div>
                <div style={{
                  fontSize: 15, fontWeight: 700,
                  color: result.ai_detection.verdict === "real"
                    ? "#22c55e"
                    : result.ai_detection.verdict === "inconclusive"
                      ? "#f59e0b"
                      : "#ef4444",
                }}>
                  {result.ai_detection.verdict === "real" ? "Appears Real"
                    : result.ai_detection.verdict === "ai-generated" ? "AI Generated"
                      : result.ai_detection.verdict === "deepfake" ? "Deepfake Detected"
                        : "Inconclusive"}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {result.ai_detection.confidence}% confidence
                </div>
              </div>
              {/* Confidence bar */}
              <div style={{ flex: 1, height: 6, background: "#2a2a4e", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${result.ai_detection.confidence}%`,
                  background: result.ai_detection.verdict === "real"
                    ? "#22c55e"
                    : result.ai_detection.verdict === "inconclusive"
                      ? "#f59e0b"
                      : "#ef4444",
                  borderRadius: 3,
                  transition: "width 0.5s ease",
                }} />
              </div>
            </div>

            {/* Signals list */}
            {result.ai_detection.signals.length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 5 }}>SIGNALS DETECTED</div>
                {result.ai_detection.signals.map((signal, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: "#c0c0e0", lineHeight: 1.6,
                    paddingLeft: 10, borderLeft: "2px solid #3a3a5e",
                    marginBottom: 4,
                  }}>
                    {signal}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
              {ref.url?.startsWith("http") ? (
                <a href={ref.url} target="_blank" rel="noreferrer" style={{ color: "#7c7cff", textDecoration: "none" }}>{ref.source}</a>
              ) : (
                <span style={{ color: "#7c7cff" }}>{ref.source}</span>
              )}
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
