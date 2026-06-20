import Link from "next/link";
import { Logo } from "../brand";

const links = [
  { label: "Home", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Agents", href: "/agents" },
  { label: "Governance", href: "/governance" },
  { label: "Audit Log", href: "/audit" },
];

export function LandingNav() {
  return (
    <header className="animate-rise delay-1 fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav className="glass edge-highlight flex items-center gap-7 rounded-full px-5 py-3 bg-black/20 backdrop-blur-xl">
        <Link href="/" aria-label="Sentinel home">
          <Logo size={22} />
        </Link>
        <div className="flex items-center gap-7">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors hover:text-gold-bright"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
