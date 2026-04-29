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
        // Warm cream / plum / vermillion registry palette (v0.7 redesign).
        paper: {
          DEFAULT: "#f7f3e5", // warm cream — main background
          2: "#efe9d3",
          3: "#e6dec0",
        },
        // `ink` keys remapped to a deep-plum scale so existing utilities like
        // `text-ink-500`, `border-ink-200` keep working.
        ink: {
          50: "#f7f3e5",
          100: "#efe9d3",
          200: "#e6dec0",
          300: "#C2B9D4", // lavender-grey (now soft-rule)
          400: "#b8a3ae",
          500: "#8e7280",
          600: "#6b4858",
          700: "#492A3A", // primary ink
          800: "#371d2c",
          900: "#26131e",
        },
        stamp: {
          DEFAULT: "#e3662c",
          deep: "#c2491a",
          light: "#e78555",
        },
        // Rule is now ink-plum (heavier official-document rule lines);
        // lavender-grey is the soft-rule.
        rule: {
          DEFAULT: "#492A3A",
          soft: "#C2B9D4",
        },
        periwinkle: {
          DEFAULT: "#8985cf",
          soft: "#acb6f3",
          deep: "#6e6ab5",
        },
        azure: {
          DEFAULT: "#6487e1",
          deep: "#4a6cc9",
        },
        caramel: "#CA986D",
        sand: "#DFC7A5",
        highlight: "#f4bb6e",
        // accent maps to azure so existing `text-accent` utilities behave
        // like links in the new system.
        accent: {
          DEFAULT: "#6487e1",
          hover: "#4a6cc9",
        },
        verified: "#492A3A",     // platform verified = ink
        unverified: "#b8a3ae",
        claimed: "#8985cf",
        good: "#6487e1",         // success = azure
        warn: "#f48d45",         // warn = persimmon orange
        revoked: "#c2491a",      // revoked = stamp-deep
        tier: {
          1: "#492A3A",
          2: "#8985cf",
          3: "#CA986D",
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
