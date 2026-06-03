// GitHub Pages serves this site at https://elliotscottdesign.github.io/plonkgolf-website/
// so when building for Pages we set basePath + assetPrefix to that subpath.
// Local builds (no env var) skip the prefix so links still work in dev.
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const repo = "plonkgolf-website";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    // Custom loader prepends basePath — next/image's default behaviour
    // doesn't apply basePath in static export, which broke image URLs
    // when served from /plonkgolf-website/.
    loader: "custom",
    loaderFile: "./image-loader.js",
  },
  basePath: isGitHubPages ? `/${repo}` : "",
  assetPrefix: isGitHubPages ? `/${repo}/` : undefined,
};

export default nextConfig;
