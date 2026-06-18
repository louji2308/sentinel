import { LandingNav } from "../components/landing/landing-nav";
import { Hero } from "../components/landing/hero";
import { Platform, Pipeline, CTA, Footer } from "../components/landing/sections";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <LandingNav />
      <Hero />
      <Platform />
      <Pipeline />
      <CTA />
      <Footer />
    </main>
  );
}
