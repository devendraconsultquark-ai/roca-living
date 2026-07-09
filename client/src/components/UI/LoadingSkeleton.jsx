import { Skeleton } from "./Skeleton";

/**
 * Shared list-shaped loading screen, composed from the <Skeleton> atom so its
 * tint / radius / pulse match every page's loading state. Used as the app's
 * route-level Suspense fallback.
 * @param {object} props
 * @param {number} props.lines - Number of rows to display (default: 4)
 * @param {string} props.className - Custom outer classes
 */
export const LoadingSkeleton = ({ lines = 4, className = "" }) => {
  const rows = Array.from({ length: Math.max(1, lines - 1) });

  return (
    <div className={`space-y-4 py-4 w-full ${className}`}>
      {/* Header bar placeholder */}
      <Skeleton radius="bar" className="h-10 w-full" />
      {/* List item row placeholders */}
      {rows.map((_, idx) => (
        <Skeleton key={idx} radius="bar" className="h-16 w-full" />
      ))}
    </div>
  );
};
