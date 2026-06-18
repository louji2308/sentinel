import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Sentinel — Compliance Oracle",
  description: "T3N-powered compliance enforcement dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f9fafb", fontFamily: "system-ui, sans-serif", color: "#111827" }}>
        <nav style={{ background: "#111827", color: "#fff", padding: "0 24px", display: "flex", alignItems: "center", height: 56 }}>
          <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: 18, fontWeight: 700 }}>
            ⚖️ Sentinel
          </Link>
          <div style={{ marginLeft: 32, display: "flex", gap: 20 }}>
            <Link href="/" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>Dashboard</Link>
            <Link href="/agents" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>Agents</Link>
            <Link href="/audit" style={{ color: "#9ca3af", textDecoration: "none", fontSize: 14 }}>Audit Log</Link>
          </div>
        </nav>
        <main style={{ maxWidth: 1200, margin: "24px auto", padding: "0 24px" }}>{children}</main>
      </body>
    </html>
  );
}