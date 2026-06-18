import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";

const sora = Sora({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sentinel — Autonomous Compliance, Enforced",
  description:
    "Sentinel is the T3N-powered compliance oracle that governs AI agents in real time — every action permitted, denied, or escalated with cryptographic proof.",
  keywords: ["compliance", "AI agents", "governance", "audit", "policy engine", "Sentinel"],
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable} bg-background`}>
      <body className="bg-background text-foreground antialiased vignette">{children}</body>
    </html>
  );
}
