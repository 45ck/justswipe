export const brandName = "JustSwipe";
export const brandShortName = "JustSwipe";
export const brandThemeColor = "#050A0E";
export const brandBackgroundColor = "#05080C";

export const brandSymbolSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="JustSwipe Decision Hinge symbol">
  <rect width="512" height="512" rx="112" fill="${brandThemeColor}"/>
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C8FF3D"/>
      <stop offset="48%" stop-color="#45E7A3"/>
      <stop offset="100%" stop-color="#00D9FF"/>
    </linearGradient>
  </defs>
  <path d="M180 70A48 48 0 0 1 228 118v96.575a50 50 0 0 0 0 82.85V394a48 48 0 0 1-96 0V118a48 48 0 0 1 48-48Z" fill="#F7F9FB" fill-rule="evenodd" clip-rule="evenodd"/>
  <path d="M332 70a48 48 0 0 1 48 48v276a48 48 0 0 1-96 0v-96.575a50 50 0 0 0 0-82.85V118a48 48 0 0 1 48-48Z" fill="url(#barGrad)" fill-rule="evenodd" clip-rule="evenodd"/>
</svg>`;

export const brandSymbolDataUri = `data:image/svg+xml,${encodeURIComponent(brandSymbolSvg)}`;

export const brandManifestJson = JSON.stringify({
  name: brandName,
  short_name: brandShortName,
  description: "A swipe-first steering loop for Codex handoffs.",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: brandBackgroundColor,
  theme_color: brandThemeColor,
  icons: [
    {
      src: "/favicon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any maskable",
    },
  ],
});
