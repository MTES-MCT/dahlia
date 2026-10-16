import clsx from "clsx";

// Bordered frame shared by the synthèse panels (collapsible or not). Kept out of
// the client components so server components can import it as a plain string.
export const PANEL_FRAME_CLASSNAME = clsx(
  "border",
  "border-solid",
  "border-(--border-default-grey)",
  "bg-(--background-default-grey)",
);
