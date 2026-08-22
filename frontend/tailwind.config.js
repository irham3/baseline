/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        page: "rgb(var(--bg-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        raised: "rgb(var(--raised-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-soft": "rgb(var(--ink-soft-rgb) / <alpha-value>)",
        "ink-faint": "rgb(var(--ink-faint-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        "line-subtle": "rgb(var(--line-subtle-rgb, 233 239 231) / <alpha-value>)",
        green: {
          DEFAULT: "rgb(var(--green-rgb) / <alpha-value>)",
          strong: "rgb(var(--green-strong-rgb) / <alpha-value>)",
          soft: "rgb(var(--green-soft-rgb) / <alpha-value>)",
        },
        amber: {
          DEFAULT: "rgb(var(--amber-rgb) / <alpha-value>)",
          soft: "rgb(var(--amber-soft-rgb) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger-rgb) / <alpha-value>)",
          soft: "rgb(var(--danger-soft-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["'Onest'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,29,26,0.04), 0 8px 24px -12px rgba(26,29,26,0.12)",
        lift: "0 2px 4px rgba(26,29,26,0.05), 0 18px 40px -18px rgba(26,29,26,0.22)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
