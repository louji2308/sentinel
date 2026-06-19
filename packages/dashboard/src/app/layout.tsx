import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { LandingNav } from "../components/landing/landing-nav";

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

const deltha = localFont({
  src: "../../public/fonts/Deltha.otf",
  display: "swap",
  variable: "--font-deltha",
});

export const metadata: Metadata = {
  title: "Sentinel — Autonomous Compliance, Enforced",
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M16 2 L29 8 V17 C29 24 23 29 16 31 C9 29 3 24 3 17 V8 Z" fill="%23caa14a" stroke="%23ffcf6b" stroke-width="1.4"/><path d="M16 7 L23 11 L16 16 L9 11 Z" fill="%23ffe7a3"/><path d="M16 16 L23 11 V18 L16 24 Z" fill="%23caa14a"/><path d="M16 16 L9 11 V18 L16 24 Z" fill="%238a6d2b"/></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
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
    <html lang="en" className={`${sora.variable} ${jetbrains.variable} ${deltha.variable} bg-background`}>
      <body className="bg-background text-foreground antialiased vignette">
        <LandingNav />
        <div className="fixed top-0 left-0 right-0 z-40 h-24 pointer-events-none bg-gradient-to-b from-background via-background to-transparent" />
        {children}
      </body>
    </html>
  );
}
