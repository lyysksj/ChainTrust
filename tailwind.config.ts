import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: [
          "'Source Serif 4'",
          "Source Serif 4",
          "Times New Roman",
          "Georgia",
          "serif",
        ],
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "'IBM Plex Mono'",
          "IBM Plex Mono",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        // Lavender registry palette per design handoff.
        paper: {
          DEFAULT: "#f5f1f7",
          2: "#ebe4f0",
          3: "#ddd0e6",
        },
        // `ink` keys are remapped so existing `text-ink-500` etc utilities
        // pick up the design tokens automatically. Intentionally lavender-tinted.
        ink: {
          50: "#f5f1f7",
          100: "#ebe4f0",
          200: "#ddd0e6",
          300: "#c8b8d6",
          400: "#a89cb8",
          500: "#7a6e92",
          600: "#4d4063",
          700: "#2a1f3d",
          800: "#1f1530",
          900: "#15101f",
        },
        stamp: {
          DEFAULT: "#dcc9f0",
          deep: "#a285c4",
        },
        rule: {
          DEFAULT: "#c8b8d6",
          soft: "#ddd0e6",
        },
        accent: {
          DEFAULT: "#a285c4",
          hover: "#dcc9f0",
        },
        verified: "#9eb89c",
        unverified: "#a89cb8",
        claimed: "#a285c4",
        good: "#9eb89c",
        warn: "#c4a576",
        revoked: "#8a6f6f",
        tier: {
          1: "#2a1f3d",
          2: "#7a6e92",
          3: "#a89cb8",
        },
      },
      borderRadius: {
        xs: "2px",
        sm: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
