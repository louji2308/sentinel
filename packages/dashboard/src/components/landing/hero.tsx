"use client";

import Image from "next/image";
import Link from "next/link";
import { Particles } from "../particles";

export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 pb-10 pt-28 md:px-10">
      <Particles />
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

      <div className="relative mx-auto w-full max-w-6xl">
        <div className="pl-[clamp(0.25rem,1vw,1.5rem)]">
          <p className="animate-rise delay-2 mb-3 text-sm font-light tracking-wide text-muted/80 md:text-base">
            <span className="italic">TRUST BUT VERIFY</span>
          </p>

          <h1 className="animate-clip delay-2 select-none text-[clamp(3.8rem,14vw,12rem)] leading-[0.85] tracking-[-0.06em] text-foreground" style={{ fontFamily: 'var(--font-deltha)', fontWeight: 100, WebkitTextStroke: '1.8px hsl(var(--background))', textStroke: '1.8px hsl(var(--background))' }}>
            <span className="gold-text" style={{ filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.25)) drop-shadow(0 0 12px hsl(var(--gold) / 0.12))' }}>SEN</span>
            <span className="opacity-90" style={{ filter: 'drop-shadow(0 0 5px hsl(0 0% 100% / 0.3)) drop-shadow(0 0 16px hsl(0 0% 100% / 0.1))' }}>TINEL</span>
          </h1>
        </div>

        <div className="relative z-30 mt-16">
          <div className="animate-rise delay-6 glass edge-highlight rounded-3xl p-6 md:p-8 md:max-w-md">
            <p className="text-balance text-lg font-light italic leading-relaxed text-muted md:text-2xl">
              &ldquo;Every action an agent takes leaves a cryptographic trace.&rdquo;
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-6 py-3 text-sm font-medium text-gold-bright backdrop-blur transition hover:bg-gold/20"
            >
              Open Dashboard
              <span aria-hidden>&rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
