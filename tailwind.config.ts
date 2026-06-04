import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sand: {
          50: "#FCFAF6",
          100: "#F7F1E7",
          200: "#EFE4D2",
          300: "#E2D0B5",
        },
        ink: {
          DEFAULT: "#1C1814",
          800: "#2A241E",
          700: "#3A322A",
          500: "#6B6157",
          400: "#8A8178",
          300: "#A89E92",
        },
        clay: {
          DEFAULT: "#C75B2A",
          600: "#B14C22",
          700: "#8F3C1A",
          100: "#F6E2D5",
        },
        leaf: {
          DEFAULT: "#2F6B4F",
          600: "#27593F",
          100: "#DBEAE1",
        },
        ember: {
          DEFAULT: "#B23A2E",
          600: "#9A3027",
          100: "#F4DDD9",
        },
        gold: {
          DEFAULT: "#C9962E",
          100: "#F6EBCF",
        },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "system-ui", "sans-serif"],
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,24,20,0.04), 0 4px 16px rgba(28,24,20,0.04)",
        lift: "0 4px 24px rgba(28,24,20,0.10)",
      },
    },
  },
  plugins: [],
};
export default config;
