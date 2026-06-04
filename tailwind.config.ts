import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Token names are kept from the fork (forest / plum / lilac /
        // ember / plonkPink) so utility classes across hundreds of
        // components keep compiling. The hex values are remapped to
        // the No Dice black ↔ deep-purple palette; see app/globals.css
        // for CSS-variable equivalents and the design rationale.
        ink: "#0a0a0a",

        // TOP of the gradient stack — deep purple (#330033 anchor).
        forest:        "#330033",
        forestDeep:    "#1F001F",
        forestRaised:  "#401040",
        forestLine:    "#5A145A",

        // MID — purple dropping toward black.
        plum:        "#1A001A",
        plumDeep:    "#0A000A",
        plumRaised:  "#220822",
        plumLine:    "#2B0A2B",

        // BOTTOM — near-black with a faint purple breath.
        lilac:        "#050005",
        lilacDeep:    "#020002",
        lilacRaised:  "#0A020A",
        lilacLine:    "#150515",

        // Ember — aliased to lilac so any leftover .bg-ember etc.
        // flows the same black ↔ purple palette as everything else.
        ember:        "#050005",
        emberDeep:    "#020002",
        emberRaised:  "#0A020A",
        emberLine:    "#150515",

        cream:    "#F2EBD9",
        creamDim: "#C7BFA9",

        // Accent — plonkPink is repointed to the No Dice wordmark
        // red so every existing `bg-plonkPink` / `text-plonkPink`
        // ref becomes a brand-aligned button/CTA against the dark
        // purple bed without renaming the token.
        plonkPink:   "#DA1B33",
        plonkYellow: "#E8C547",
        plonkTeal:   "#1ec8b8",

        // Explicit No Dice tokens — use for new UI to avoid relying
        // on the legacy plonk* aliases.
        nodiceRed:        "#DA1B33",
        nodiceRedDeep:    "#8A0F22",
        nodiceRedDarker:  "#4A0814",
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
