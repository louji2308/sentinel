import Link from "next/link";

/** The Sentinel faceted-shield mark. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="drop-shadow-[0_0_8px_hsl(var(--gold)/0.6)]"
    >
      <path
        d="M16 2 L29 8 V17 C29 24 23 29 16 31 C9 29 3 24 3 17 V8 Z"
        stroke="hsl(var(--gold))"
        strokeWidth="1.4"
        fill="hsl(var(--gold) / 0.06)"
      />
      <path d="M16 7 L23 11 L16 16 L9 11 Z" fill="hsl(var(--gold-bright))" />
      <path d="M16 16 L23 11 V18 L16 24 Z" fill="hsl(var(--gold))" />
      <path d="M16 16 L9 11 V18 L16 24 Z" fill="hsl(var(--gold-deep))" />
    </svg>
  );
}

export function Wordmark({ size = 28, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5">
      <Logo size={size} />
      <span className="font-sans text-lg font-semibold tracking-[0.25em] text-foreground transition-colors group-hover:text-gold-bright">
        SENTINEL
      </span>
    </Link>
  );
}
