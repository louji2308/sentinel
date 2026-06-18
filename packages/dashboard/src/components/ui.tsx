const styles: Record<string, React.CSSProperties> = {
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 9999,
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
};

const decisionColors: Record<string, { bg: string; text: string }> = {
  PERMIT: { bg: "#f0fdf4", text: "#16a34a" },
  DENY: { bg: "#fef2f2", text: "#dc2626" },
  ESCALATE: { bg: "#fffbeb", text: "#f59e0b" },
};

export function DecisionBadge({ decision, size = "sm" }: { decision: string; size?: "sm" | "lg" }) {
  const colors = decisionColors[decision] || { bg: "#f3f4f6", text: "#6b7280" };
  const fontSize = size === "lg" ? 14 : 12;
  return <span style={{ ...styles.badge, backgroundColor: colors.bg, color: colors.text, fontSize }}>{decision}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const color = status === "active" ? "#16a34a" : status === "revoked" ? "#dc2626" : "#f59e0b";
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: color,
        marginRight: 6,
      }}
    />
  );
}

export function Card({ title, children, style }: { title?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
        padding: 16,
        marginBottom: 16,
        ...style,
      }}
    >
      {title && <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 600, color: "#111827" }}>{title}</h3>}
      {children}
    </div>
  );
}