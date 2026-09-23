import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, taught the design system's own scale names.
 *
 * Out of the box it reads `text-caption` or `text-h3` as a text colour — it
 * only recognises Tailwind's default size names — so merging a colour after
 * one silently dropped the font size, and merging a size after a colour
 * dropped the colour. Registering the scale keeps size and colour in their
 * separate groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "hero",
            "display",
            "h1",
            "h2",
            "h3",
            "h4",
            "body-lg",
            "body",
            "caption",
          ],
        },
      ],
      shadow: [{ shadow: ["glow", "floating"] }],
    },
  },
});

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
