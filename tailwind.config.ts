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
        serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        ink: {
          50: "#f7f6f3",
          100: "#ecebe6",
          200: "#d9d6cc",
          300: "#b8b3a4",
          400: "#8d8776",
          500: "#5f5a4d",
          600: "#3d3a32",
          700: "#27251f",
          800: "#17150f",
          900: "#0b0a07",
        },
        accent: {
          DEFAULT: "#8a5a2b",
          hover: "#70471f",
        },
        verified: "#2e7d5b",
        unverified: "#8d8776",
        claimed: "#1f5eb8",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
      },
    },
  },
  plugins: [],
};

export default config;
