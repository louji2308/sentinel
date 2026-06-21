"""Generate SENTINEL demo voiceover (~3 min, WayneNeural)."""
import asyncio
import edge_tts

TEXT = """In 2026, AI agents book flights, process payroll, and move money autonomously. They authenticate with API keys. An API key answers who. It does not answer should. SENTINEL is the answer to should.

SENTINEL is a compliance oracle between an agent's intent and its execution. Every action is evaluated against Cedar policy inside a Terminal 3 TEE. The verdict is a cryptographically signed receipt. Deterministic and independently verifiable.

We have four agents: Travel, HR Payroll, Rogue, and Expense.

All four run simultaneously. Five hundred dollars permitted in under two milliseconds. Cedar, not a model. Nine thousand triggers an escalation in the dashboard. Fifteen thousand is denied.

Watch what happens. The agent autonomously renegotiates: fifty percent, twenty five percent, at thirty seven fifty it gets a permit. No LLM. No human. A deterministic feedback loop.

Payroll and HR permitted. External payments denied by domain rules. The rogue agent stopped at the credential gate.

This is Cedar. An AWS authorization language. Every receipt names the exact policy clause that fired. Reproducible forever.

You see mode local. Here is why. WASM execution failed on the T3N testnet across eleven configurations. We filed it as Bug One of five reports. The circuit breaker switched to a local Cedar engine in under a second. Same API. Same receipts. It retries every sixty seconds. Zero code changes needed.

We did not hide the bug. We engineered around it and kept building.

Seven contract functions. Seventeen endpoints. Four agents. Cedar for every decision. No LLM near a compliance decision.

That is SENTINEL."""


async def main() -> None:
    output = "sentinel-demo-voiceover.mp3"
    communicate = edge_tts.Communicate(TEXT, voice="en-SG-WayneNeural", rate="+0%")
    await communicate.save(output)
    print(f"Saved to {output}")


if __name__ == "__main__":
    asyncio.run(main())
