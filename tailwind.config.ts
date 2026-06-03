import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        forest: "#0E2A21",
        forestDeep: "#081A14",
        forestRaised: "#163A2E",
        forestLine: "#2A4D3F",
        plum: "#1F1233",
        plumDeep: "#110820",
        plumRaised: "#2C1846",
        plumLine: "#3F2266",
        lilac: "#5A3F86",
        lilacDeep: "#3E2A5C",
        lilacRaised: "#6B4D9C",
        lilacLine: "#7D5FB0",
        ember: "#2C140E",
        emberDeep: "#190805",
        emberRaised: "#3E1C12",
        emberLine: "#4F2818",
        cream: "#F2EBD9",
        creamDim: "#C7BFA9",
        plonkPink: "#ff3d8a",
        plonkYellow: "#E8C547",
        plonkTeal: "#1ec8b8",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        eyebrow: "0.3em",
      },
    },
  },
  plugins: [],
};

export default config;
