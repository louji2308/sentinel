"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./brand";

const links = [
  { label: "Overview", href: "/dashboard" },
  { label: "Agents", href: "/agents" },
  { label: "Audit Log", href: "/audit" },
];

export function AppHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 px-4 pt-4">
      <nav className="glass edge-highlight mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-3">
        <Wordmark size={24} />
        <div className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-gold/15 text-gold-bright"
                    : "text-muted hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
