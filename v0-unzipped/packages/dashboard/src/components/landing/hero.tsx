"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

const CrystalScene = dynamic(() => import("../crystal-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-40 w-40 animate-glow rounded-full bg-gold/30 blur-3xl" />
    </div>
  ),
});

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-10 pt-28 md:px-10">
      {/* Atmospheric backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <Image
          src="/assets/ember-atmosphere.png"
          alt=""
          fill
          priority
          className="animate-fade object-cover opacity-50"
        />
        <div className="absolute left-1/2 top-1/2 h-[60vmin] w-[60vmin] -translate-x-1/2 -translate-y-1/2 animate-glow rounded-full bg-[radial-gradient(circle,hsl(var(--gold)/0.35),transparent_65%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background))_92%)]" />
      </div>

      {/* Headline + crystal stack */}
      <div className="relative mx-auto w-full max-w-6xl">
        <p className="animate-rise delay-2 mb-2 pl-1 text-sm font-light tracking-ultra text-muted md:text-base">
          EVERY AGENT ACTION
        </p>

        <div className="relative flex items-center justify-center">
          {/* The 3D crystal sits centered, overlapping the word */}
          <div className="pointer-events-none absolute left-1/2 top-[44%] z-20 h-[clamp(260px,30vw,400px)] w-[clamp(260px,30vw,400px)] -translate-x-1/2 -translate-y-1/2 animate-scale delay-3">
            <CrystalScene />
          </div>

          <h1 className="animate-clip delay-2 relative select-none text-center font-sans text-[clamp(4.5rem,17vw,15rem)] font-extralight leading-[0.85] tracking-tight text-foreground">
            <span className="gold-text font-semibold">GOV</span>
            <span className="opacity-90">RNED</span>
          </h1>
        </div>

        {/* Floating bottom row: stat card · copy · trusted-by */}
        <div className="relative z-30 mt-12 grid gap-5 md:grid-cols-12 md:items-end">
          {/* Stat card */}
          <div className="animate-rise delay-5 glass edge-highlight flex items-center gap-4 rounded-3xl p-3 md:col-span-4">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
              <Image src="/assets/gold-vault.png" alt="Secured policy vault" fill className="object-cover" />
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold text-gold-bright">4.2B+</div>
              <div className="text-[11px] font-medium tracking-widest text-foreground">ACTIONS GOVERNED</div>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                Real-time verdicts on billions of autonomous agent actions, each with a signed receipt.
              </p>
            </div>
          </div>

          {/* Copy + CTA */}
          <div className="animate-rise delay-6 md:col-span-5 md:col-start-8">
            <p className="text-pretty text-sm leading-relaxed text-muted">
              Sentinel is the compliance oracle for autonomous AI. Every action an agent attempts is
              evaluated against your policy in milliseconds — then permitted, denied, or escalated
              with cryptographic, audit-ready proof.
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-6 py-3 text-sm font-medium text-gold-bright backdrop-blur transition hover:bg-gold/20"
            >
              Learn More
              <span aria-hidden className="transition-transform group-hover:translate-x-1">&rarr;</span>
            </Link>
          </div>
        </div>

        <div id="trust" className="animate-fade delay-7 mt-10 flex justify-center text-center md:justify-end md:text-right">
          <p className="font-light tracking-[0.2em] text-muted">
            TRUSTED BY <span className="font-semibold text-foreground">2,000+</span> ENTERPRISES
          </p>
        </div>
      </div>
    </section>
  );
}
