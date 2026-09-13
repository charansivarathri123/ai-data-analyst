import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "var(--surface-canvas)",
          pure: "var(--surface-pure)",
        },
        cardBg: "var(--card-bg)",
        inputBg: "var(--input-bg)",
        dark: {
          DEFAULT: "#050405",
          pill: "#0E0D12",
        },
        primaryText: "var(--text-primary)",
        mutedText: "var(--text-muted)",
        subtleBorder: "var(--border-subtle)",
        accent: {
          lime: "#D3D05B",
          violet: "var(--accent-violet)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
        serif: [
          '"Newsreader"',
          '"Playfair Display"',
          '"Instrument Serif"',
          "Georgia",
          '"Times New Roman"',
          "serif",
        ],
        mono: [
          '"JetBrains Mono"',
          '"Cascadia Code"',
          "Consolas",
          '"Courier New"',
          "monospace",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(14, 13, 18, 0.08)",
        floating: "0 20px 40px -15px rgba(5, 4, 5, 0.08)",
        subtle: "0 1px 3px 0 rgba(0, 0, 0, 0.04)",
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float 6s ease-in-out 3s infinite",
        pulseGlow: "pulseGlow 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
