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
        ink: "#000000",

        // Founder direction: ALL backgrounds pure black. Every tonal
        // token (forest / plum / lilac / ember + all variants) is
        // flattened to #000000 so `bg-forest`, `bg-plumRaised` etc.
        // all paint the same black as the body. Borders that rely
        // on these tokens (e.g. `border-forestLine`) become invisible
        // — acceptable trade for the flat look. Bring colour back by
        // restoring the previous hex values; see git history for the
        // deep-purple variant.
        forest:        "#000000",
        forestDeep:    "#000000",
        forestRaised:  "#000000",
        forestLine:    "#000000",

        plum:        "#000000",
        plumDeep:    "#000000",
        plumRaised:  "#000000",
        plumLine:    "#000000",

        lilac:        "#000000",
        lilacDeep:    "#000000",
        lilacRaised:  "#000000",
        lilacLine:    "#000000",

        ember:        "#000000",
        emberDeep:    "#000000",
        emberRaised:  "#000000",
        emberLine:    "#000000",

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
