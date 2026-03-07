export function Badge({ label, color }: { label: string; color: string }) {
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
