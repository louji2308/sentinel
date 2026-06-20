"use client";
import { MultiSigWidget } from "../../components/MultiSigWidget";
import { EscalationsPanel } from "../../components/EscalationsPanel";
import { Card } from "../../components/ui";

export default function GovernancePage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-10">
        <div className="animate-rise mb-1 text-sm tracking-ultra text-gold">GOVERNANCE</div>
        <h1 className="animate-rise delay-1 mb-8 text-4xl font-light">Operator Controls</h1>

        <div className="animate-fade delay-2 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <EscalationsPanel />
            <MultiSigWidget />
          </div>

          <Card title="Quick Actions">
            <div className="flex flex-wrap gap-3">
              <a
                href="/agents"
                className="rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
              >
                Manage Agents
              </a>
              <a
                href="/audit"
                className="rounded-full border border-white/15 px-5 py-2 text-xs font-medium text-muted transition hover:bg-white/5 hover:text-foreground"
              >
                Audit Log
              </a>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
