import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        "accent-strong": "var(--color-accent-strong)",
        good: "var(--color-good)",
        warn: "var(--color-warn)",
        bad: "var(--color-bad)",
        protein: "var(--color-protein)",
        carbs: "var(--color-carbs)",
        fat: "var(--color-fat)",
        calories: "var(--color-calories)",
      },
      fontFamily: {
        sans: ["Rubik", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
