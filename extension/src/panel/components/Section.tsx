import type React from "react";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
