module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        permit: { DEFAULT: "#16a34a", bg: "#f0fdf4" },
        deny: { DEFAULT: "#dc2626", bg: "#fef2f2" },
        escalate: { DEFAULT: "#f59e0b", bg: "#fffbeb" },
      },
    },
  },
  plugins: [],
};