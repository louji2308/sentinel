"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "../brand";

const links = [
  { label: "Platform", href: "#platform" },
  { label: "How it works", href: "#pipeline" },
  { label: "Trust", href: "#trust" },
  { label: "Dashboard", href: "/dashboard" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="animate-rise delay-1 fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass edge-highlight flex w-full max-w-6xl items-center justify-between rounded-full px-3 py-2 pl-5">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-xs font-medium tracking-widest text-foreground transition hover:bg-gold/15"
            aria-expanded={open}
          >
            <span className="flex flex-col gap-[3px]">
              <span className="h-px w-4 bg-gold" />
              <span className="h-px w-4 bg-gold" />
            </span>
            MENU
          </button>
          <ul className="hidden items-center gap-7 text-sm text-muted md:flex">
            {links.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="transition-colors hover:text-gold-bright">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <Link href="/" className="absolute left-1/2 hidden -translate-x-1/2 md:block" aria-label="Sentinel home">
          <Logo size={26} />
        </Link>

        <Link
          href="/dashboard"
          className="glass-gold rounded-full px-5 py-2.5 text-sm font-semibold text-gold-bright transition hover:brightness-125"
        >
          Get Access
        </Link>
      </nav>

      {open && (
        <div className="glass edge-highlight animate-scale absolute top-20 w-[92%] max-w-sm rounded-3xl p-4 md:hidden">
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3 text-sm text-foreground transition hover:bg-gold/10"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
