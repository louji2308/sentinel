import Link from "next/link";
import { Logo } from "../brand";
import { Reveal } from "./reveal";

function Icon({ path }: { path: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--gold))" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

const features = [
  {
    title: "Policy Engine",
    desc: "Declarative clauses compiled into a deterministic decision graph that runs sub-millisecond at the edge.",
    icon: <Icon path={<><path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>} />,
  },
  {
    title: "Verifiable Identity",
    desc: "Every agent carries a signed credential. Revoke trust instantly and the oracle enforces it everywhere.",
    icon: <Icon path={<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>} />,
  },
  {
    title: "Cryptographic Receipts",
    desc: "Each verdict produces a tamper-evident receipt — hash-chained, exportable, and audit-ready.",
    icon: <Icon path={<><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 14h6M9 17h4" /></>} />,
  },
  {
    title: "Real-time Escalation",
    desc: "Ambiguous actions are routed to humans in the loop without ever blocking the safe path.",
    icon: <Icon path={<><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></>} />,
  },
];

export function Platform() {
  return (
    <section id="platform" className="relative mx-auto max-w-6xl px-4 py-24 md:px-10">
      <Reveal>
        <p className="text-sm tracking-ultra text-gold">THE PLATFORM</p>
        <h2 className="mt-3 max-w-2xl text-balance text-4xl font-light leading-tight md:text-5xl">
          One oracle between your agents and <span className="gold-text font-semibold">every action they take.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <Reveal key={f.title} delay={i * 90}>
            <article className="glass edge-highlight group h-full rounded-3xl p-6 transition-transform duration-300 hover:-translate-y-1.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 transition group-hover:bg-gold/20">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-medium text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.desc}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const steps = [
  { tag: "PERMIT", color: "permit", text: "Action matches policy. Approved instantly with a signed receipt." },
  { tag: "ESCALATE", color: "escalate", text: "Action is ambiguous. Routed to a human reviewer in real time." },
  { tag: "DENY", color: "deny", text: "Action violates a clause. Blocked and logged with full context." },
];

export function Pipeline() {
  return (
    <section id="pipeline" className="relative overflow-hidden py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[40vmin] w-[80vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(var(--gold)/0.16),transparent_70%)] blur-2xl" />
      <div className="mx-auto max-w-6xl px-4 md:px-10">
        <Reveal>
          <p className="text-sm tracking-ultra text-gold">THE PIPELINE</p>
          <h2 className="mt-3 max-w-2xl text-balance text-4xl font-light leading-tight md:text-5xl">
            Three outcomes. <span className="gold-text font-semibold">Zero blind spots.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.tag} delay={i * 110}>
              <div className="glass edge-highlight relative h-full overflow-hidden rounded-3xl p-7">
                <div
                  className="absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
                  style={{ background: `hsl(var(--${s.color}) / 0.35)` }}
                />
                <span
                  className="inline-flex rounded-full px-3 py-1 font-mono text-xs font-semibold tracking-widest"
                  style={{ color: `hsl(var(--${s.color}))`, background: `hsl(var(--${s.color}) / 0.12)`, border: `1px solid hsl(var(--${s.color}) / 0.3)` }}
                >
                  {s.tag}
                </span>
                <p className="mt-5 text-sm leading-relaxed text-muted">{s.text}</p>
                <div className="mt-6 font-mono text-5xl font-light text-foreground/15">0{i + 1}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-10">
      <Reveal>
        <div className="glass-gold edge-highlight relative overflow-hidden rounded-[40px] px-8 py-16 text-center md:py-20">
          <div className="pointer-events-none absolute inset-0 animate-glow bg-[radial-gradient(circle_at_50%_120%,hsl(var(--gold)/0.3),transparent_60%)]" />
          <h2 className="relative mx-auto max-w-3xl text-balance text-4xl font-light leading-tight md:text-6xl">
            Put a <span className="gold-text font-semibold">Sentinel</span> in front of every agent.
          </h2>
          <p className="relative mx-auto mt-5 max-w-xl text-pretty text-muted">
            Deploy the compliance oracle in minutes. Bring your policy — Sentinel does the enforcing.
          </p>
          <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="rounded-full bg-gold px-8 py-3.5 text-sm font-semibold text-background transition hover:brightness-110">
              Open the Dashboard
            </Link>
            <Link href="#platform" className="rounded-full border border-gold/30 px-8 py-3.5 text-sm font-medium text-foreground transition hover:bg-gold/10">
              Explore the platform
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/5 px-4 py-10 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted md:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo size={22} />
          <span className="font-semibold tracking-[0.25em] text-foreground">SENTINEL</span>
        </div>
        <p>Autonomous compliance, enforced. &copy; {new Date().getFullYear()} Sentinel.</p>
        <div className="flex gap-6">
          <Link href="/dashboard" className="transition hover:text-gold-bright">Dashboard</Link>
          <Link href="/audit" className="transition hover:text-gold-bright">Audit</Link>
        </div>
      </div>
    </footer>
  );
}
