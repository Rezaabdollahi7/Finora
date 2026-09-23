import localFont from "next/font/local";

/**
 * Dana, the brand typeface (docs/DESIGN_SYSTEM.md §0.4).
 *
 * Self-hosted through next/font, which fingerprints the files, preloads the
 * weights the first paint needs and generates a size-matched fallback, so
 * the swap from system-ui to Dana does not shift the layout.
 *
 * Only the weights the type scale uses are shipped: UltraLight and Light for
 * the large figures, Regular to DemiBold for text, Bold and above for the
 * rare emphasis.
 */
export const dana = localFont({
  src: [
    { path: "./fonts/dana/Dana-UltraLight.woff", weight: "200", style: "normal" },
    { path: "./fonts/dana/Dana-Light.woff", weight: "300", style: "normal" },
    { path: "./fonts/dana/Dana-Regular.woff", weight: "400", style: "normal" },
    { path: "./fonts/dana/Dana-Medium.woff", weight: "500", style: "normal" },
    { path: "./fonts/dana/Dana-DemiBold.woff", weight: "600", style: "normal" },
    { path: "./fonts/dana/Dana-Bold.woff", weight: "700", style: "normal" },
    { path: "./fonts/dana/Dana-ExtraBold.woff", weight: "800", style: "normal" },
    { path: "./fonts/dana/Dana-Black.woff", weight: "900", style: "normal" },
  ],
  variable: "--font-dana",
  display: "swap",
  fallback: ["system-ui", "Tahoma", "sans-serif"],
});
