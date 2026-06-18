module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: "hsl(var(--muted))",
        gold: {
          DEFAULT: "hsl(var(--gold))",
          bright: "hsl(var(--gold-bright))",
          deep: "hsl(var(--gold-deep))",
        },
        permit: { DEFAULT: "hsl(var(--permit))" },
        deny: { DEFAULT: "hsl(var(--deny))" },
        escalate: { DEFAULT: "hsl(var(--escalate))" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "var(--radius)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      letterSpacing: {
        ultra: "0.35em",
      },
      boxShadow: {
        "gold-glow": "0 0 80px -10px hsl(var(--gold) / 0.5)",
      },
    },
  },
  plugins: [],
};
