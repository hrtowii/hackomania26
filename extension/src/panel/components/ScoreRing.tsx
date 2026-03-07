import { getRiskColorFromScore } from "../utils";

export function ScoreRing({ score }: { score: number }) {
  const color = getRiskColorFromScore(score);
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
