import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#002366",       // --royal (旧 #1D9E75 緑 → royal blue に統一)
        "primary-dark": "#001A4D", // --royal-deep
        "primary-light": "#EFF3FC", // --royal-50
        background: "#F5F4F0",
        foreground: "#1a1a1a",
        "card-border": "rgba(0,0,0,0.08)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-noto)",
          "Hiragino Sans",
          "sans-serif",
        ],
        serif: [
          "var(--font-noto-serif)",
          "Noto Serif JP",
          "serif",
        ],
      },
      borderRadius: {
        card: "16px",
        "card-lg": "20px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};
export default config;
