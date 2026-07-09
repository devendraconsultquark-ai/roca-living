/**
 * Skeleton — the single loading-placeholder primitive.
 *
 * Every page's loading state is built from this atom so the tint, radius and
 * pulse are identical everywhere. Pass sizing / grid-span via `className`
 * (e.g. "h-20", "lg:col-span-8 h-[400px]"); pick a corner with `radius`.
 *
 * The pulse lives on the atom itself, so a <Skeleton> looks right anywhere —
 * the parent container must NOT also carry `animate-pulse`.
 *
 * @param {object} props
 * @param {string} [props.className]  Sizing / layout utilities.
 * @param {"bar"|"card"|"panel"|"pill"} [props.radius="panel"]  Corner radius.
 */
const RADII = {
  bar: "rounded-lg", // thin bars: titles, filter rows
  card: "rounded-xl", // metric cards, small tiles
  panel: "rounded-2xl", // large content panels
  pill: "rounded-full", // avatars / circular
};

export const Skeleton = ({ className = "", radius = "panel" }) => (
  <div
    aria-hidden="true"
    className={`bg-skeleton animate-pulse motion-reduce:animate-none ${
      RADII[radius] ?? RADII.panel
    } ${className}`}
  />
);
