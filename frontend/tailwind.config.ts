import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        soil: {
          950: "#0A0A0B",
          900: "#0D0D0E",
          800: "#151516",
          700: "#232324",
        },
        bone: {
          100: "#F3EFE6",
          200: "#DCD7CB",
          400: "#8A8A85",
          600: "#63625E",
        },
        brass: {
          400: "#C08A4E",
          500: "#A8743D",
          600: "#8C5F30",
        },
        moss: {
          400: "#7C9473",
          500: "#5F7A57",
        },
        rust: {
          400: "#BE5A45",
        },
      },
      fontFamily: {
        serif: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
    },
  },
  plugins: [],
};
export default config;
