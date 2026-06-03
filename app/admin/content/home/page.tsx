import AdminPageHeader from "@/components/admin/AdminPageHeader";
import ContentEditor from "@/components/admin/ContentEditor";

export const metadata = { title: "Home page content — Plonk Admin" };

// Default copy on the public homepage, passed through to the editor so
// each field shows its current value as placeholder/preview text even
// before anyone's saved an override.
const FALLBACKS: Record<string, string> = {
  "home.hero.image": "/borough/course/Course_1.jpg",
  "home.hero.eyebrow": "Hackney · Borough Market",
  "home.hero.headline_1": "Crazy Golf Creations",
  "home.hero.headline_2": "Across the Capital",
  "home.hero.subcopy":
    "Two original courses. Two iconic London arches. One unforgettable round — with cocktails, food and games to match.",
  "home.venues.hackney":
    "Polynesian putt paradise, 7ft American pool, retro arcade, tacos and rum punch.",
  "home.venues.borough":
    "London under the arches — 9 holes of street-art murals, cocktails and full kitchen.",
};

export default function HomeContentPage() {
  return (
    <>
      <AdminPageHeader
        title="Home page"
        description="Edit the copy and hero image visible on plonkgolf.co.uk."
        action={
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-cream/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-cream/85 hover:bg-cream/5"
          >
            View page ↗
          </a>
        }
      />
      <ContentEditor page="home" fallbacks={FALLBACKS} previewPath="/" />
    </>
  );
}
