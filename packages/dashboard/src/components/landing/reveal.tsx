"use client";

import { useEffect, useRef, useState } from "react";

/** Fades + lifts children into view the first time they enter the viewport. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: "opacity 0.8s cubic-bezier(0.22,1,0.36,1), transform 0.8s cubic-bezier(0.22,1,0.36,1), filter 0.8s ease",
        transitionDelay: `${delay}ms`,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(34px)",
        filter: shown ? "blur(0)" : "blur(8px)",
      }}
    >
      {children}
    </div>
  );
}
