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
        primary: "#1D9E75",
        "primary-dark": "#178A65",
        "primary-light": "#E8F5EF",
        background: "#F5F4F0",
        foreground: "#1a1a1a",
        "card-border": "rgba(0,0,0,0.08)",
      },
      fontFamily: {
        sans: [
          "Hiragino Sans",
          "Noto Sans JP",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "16px",
        "card-lg": "20px",
      },
    },
  },
  plugins: [],
};
export default config;
