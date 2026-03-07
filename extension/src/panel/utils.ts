export type RiskLevel = "safe" | "caution" | "suspicious";

export const RISK_COLORS: Record<RiskLevel, string> = {
  safe: "#22c55e",
  caution: "#f59e0b",
  suspicious: "#ef4444",
};

export function deriveRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "safe";
  if (score >= 40) return "caution";
  return "suspicious";
}

export function getRiskColorFromScore(score: number): string {
  return RISK_COLORS[deriveRiskLevel(score)];
}

export function injectStyle(id: string, css: string): void {
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
