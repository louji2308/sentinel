"use client";

import { useMemo } from "react";

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Particles({ count = 35 }: { count?: number }) {
  const dots = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rand(0, 100),
      size: rand(1.5, 4),
      duration: rand(6, 14),
      delay: rand(0, 10),
      opacity: rand(0.3, 0.8),
      drift: rand(-30, 30),
    }));
  }, [count]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      {dots.map((d) => (
        <div
          key={d.id}
          className="absolute animate-float-up"
          style={{
            left: `${d.left}%`,
            bottom: "-10px",
            width: `${d.size}px`,
            height: `${d.size}px`,
            borderRadius: "50%",
            background: "hsl(var(--gold-bright))",
            boxShadow: "0 0 6px 2px hsl(var(--gold) / 0.5), 0 0 20px 6px hsl(var(--gold) / 0.2)",
            opacity: d.opacity,
            animationDuration: `${d.duration}s`,
            animationDelay: `${d.delay}s`,
            transform: `translateX(${d.drift}px)`,
          }}
        />
      ))}
    </div>
  );
}
