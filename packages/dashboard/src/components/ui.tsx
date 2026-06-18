const decisionStyles: Record<string, string> = {
  PERMIT: "text-permit bg-permit/10 border-permit/30",
  DENY: "text-deny bg-deny/10 border-deny/30",
  ESCALATE: "text-escalate bg-escalate/10 border-escalate/30",
};

export function DecisionBadge({ decision, size = "sm" }: { decision: string; size?: "sm" | "lg" }) {
  const cls = decisionStyles[decision] || "text-muted bg-white/5 border-white/10";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono font-semibold uppercase tracking-widest ${cls} ${
        size === "lg" ? "text-sm" : "text-[11px]"
      }`}
    >
      {decision}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-permit shadow-[0_0_8px_hsl(var(--permit))]"
      : status === "revoked"
      ? "bg-deny shadow-[0_0_8px_hsl(var(--deny))]"
      : "bg-escalate shadow-[0_0_8px_hsl(var(--escalate))]";
  return <span className={`mr-2 inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`glass edge-highlight rounded-3xl p-6 ${className}`}>
      {title && (
        <h3 className="mb-4 text-sm font-medium uppercase tracking-widest text-gold">{title}</h3>
      )}
      {children}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-muted">
            {head.map((h) => (
              <th key={h} className="px-3 pb-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  mono,
  muted,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
}) {
  return (
    <td
      className={`px-3 py-3 ${mono ? "font-mono text-xs text-foreground/80" : ""} ${
        muted ? "text-xs text-muted" : ""
      }`}
    >
      {children}
    </td>
  );
}
