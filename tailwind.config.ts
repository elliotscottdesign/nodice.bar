import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Token names are kept from the Plonk Golf fork (forest / plum /
        // lilac / ember / plonkPink) so utility classes across hundreds
        // of components keep compiling. The hex values are remapped to
        // the No Dice red→black palette; see app/globals.css for the
        // CSS-variable equivalents and the design rationale.
        ink: "#0a0a0a",

        // TOP of the gradient stack — vivid deep crimson.
        forest:        "#5A0A16",
        forestDeep:    "#2B0610",
        forestRaised:  "#6E0E1C",
        forestLine:    "#821224",

        // MID — red dropping toward black.
        plum:        "#240610",
        plumDeep:    "#120308",
        plumRaised:  "#320A18",
        plumLine:    "#441220",

        // BOTTOM — near-black with a faint red tint.
        lilac:        "#050204",
        lilacDeep:    "#020001",
        lilacRaised:  "#0F0408",
        lilacLine:    "#1C0610",

        // Ember (Borough-themed pages) — aliased to lilac so it flows
        // on the same red→black palette as everything else.
        ember:        "#050204",
        emberDeep:    "#020001",
        emberRaised:  "#0F0408",
        emberLine:    "#1C0610",

        cream:    "#F2EBD9",
        creamDim: "#C7BFA9",

        // Accent — Plonk's pink is repointed to the No Dice wordmark
        // red so every existing `bg-plonkPink` / `text-plonkPink` ref
        // becomes a brand-aligned accent without renaming the token.
        plonkPink:   "#DA1B33",
        plonkYellow: "#E8C547",
        plonkTeal:   "#1ec8b8",

        // New brand tokens — use these for genuinely No Dice-only UI
        // (CTAs, focus rings, headline accents) without overloading
        // the legacy Plonk names.
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
