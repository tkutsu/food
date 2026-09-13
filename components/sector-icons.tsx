/**
 * One glyph per sector button. Stroked rather than filled, so they sit at the
 * same weight as the rest of the furniture, and every button carries its name
 * as well: ten icons in a row is too many to ask anyone to decode.
 */
import type { ReactElement } from "react";

const WHEAT_GRAINS = [6.2, 10, 13.8];

const PATHS: Record<string, ReactElement> = {
  "olive-oil": (
    <>
      <path d="M10 2.8h4v3.4l2.6 3a3 3 0 0 1 .9 2V19a2 2 0 0 1-2 2H8.5a2 2 0 0 1-2-2v-7.8a3 3 0 0 1 .9-2l2.6-3V2.8Z" />
      <path d="M12 11.8c1.4 1.6 2.1 2.8 2.1 3.7a2.1 2.1 0 1 1-4.2 0c0-.9.7-2.1 2.1-3.7Z" />
    </>
  ),
  fruit: (
    <>
      <path d="M12 21c-3.3 0-5.5-3.5-5.5-7.4 0-3.5 2.2-6 4.5-6 .6 0 1 .2 1 .2s.4-.2 1-.2c2.3 0 4.5 2.5 4.5 6C17.5 17.5 15.3 21 12 21Z" />
      <path d="M12 7.8V4.4" />
      <path d="M12.4 5.2c.4-1.5 1.8-2.4 3.3-2.3.1 1.5-1.1 2.9-2.6 3.2" />
    </>
  ),
  vegetables: (
    <>
      <path d="M12 21.3 7.9 10.4a1 1 0 0 1 1.2-1.3 9.8 9.8 0 0 0 5.8 0 1 1 0 0 1 1.2 1.3L12 21.3Z" />
      <path d="M12 9V5.2M12 8.6 9.3 6M12 8.6 14.7 6" />
    </>
  ),
  beef: (
    <>
      <path d="M6.4 7.4C5 6.6 4.2 5 4.5 3.3c1.7-.2 3.3.5 4.2 1.9" />
      <path d="M17.6 7.4c1.4-.8 2.2-2.4 1.9-4.1-1.7-.2-3.3.5-4.2 1.9" />
      <path d="M12 20c-3.7 0-6.4-2.3-6.4-5.3 0-.9.2-1.7.6-2.4-.5-.8-.8-1.8-.8-2.8C5.4 6.6 8.3 4.5 12 4.5s6.6 2.1 6.6 5c0 1-.3 2-.8 2.8.4.7.6 1.5.6 2.4 0 3-2.7 5.3-6.4 5.3Z" />
      <path d="M10.3 15.6h.01M13.7 15.6h.01" />
    </>
  ),
  pigmeat: (
    <>
      <path d="M12 20.2c-4.2 0-7.2-2.8-7.2-6.6 0-1.4.4-2.7 1.2-3.7-.6-1.4-.8-3-.5-4.6 1.6.2 3 .9 3.9 2A9.4 9.4 0 0 1 12 6.7c1 0 1.9.2 2.6.6.9-1.1 2.3-1.8 3.9-2 .3 1.6.1 3.2-.5 4.6.8 1 1.2 2.3 1.2 3.7 0 3.8-3 6.6-7.2 6.6Z" />
      <path d="M12 16.6a2.6 2 0 1 0 0-4 2.6 2 0 0 0 0 4Z" />
      <path d="M11.2 14.6h.01M12.8 14.6h.01" />
    </>
  ),
  lamb: (
    <>
      <path d="M8.4 16.6a3 3 0 0 1-.5-6 3.2 3.2 0 0 1 3-2.7 3.4 3.4 0 0 1 5.7 0 3.2 3.2 0 0 1 3 2.7 3 3 0 0 1-.5 6Z" />
      <path d="M9.6 16.6V20M17.5 16.6V20" />
      <path d="M6.6 10.6a2.4 2.4 0 1 1-1.9 3.9" />
    </>
  ),
  milk: (
    <>
      <path d="M9.4 2.8h5.2v2.9l1.9 2.8a3 3 0 0 1 .5 1.7v9.3a1.5 1.5 0 0 1-1.5 1.5H8.5A1.5 1.5 0 0 1 7 19.5v-9.3a3 3 0 0 1 .5-1.7l1.9-2.8V2.8Z" />
      <path d="M7 13.2h10" />
    </>
  ),
  cereal: (
    <>
      <path d="M12 21.2V8" />
      {WHEAT_GRAINS.map((y) => (
        <path
          d={`M12 ${y + 3.4}c-2 0-3.4-1.5-3.4-3.4 2 0 3.4 1.5 3.4 3.4Z`}
          key={`left-${y}`}
        />
      ))}
      {WHEAT_GRAINS.map((y) => (
        <path
          d={`M12 ${y + 3.4}c2 0 3.4-1.5 3.4-3.4-2 0-3.4 1.5-3.4 3.4Z`}
          key={`right-${y}`}
        />
      ))}
      <path d="M12 8c0-2 1.2-3.4 3-3.6.2 1.9-1 3.3-3 3.6Z" />
    </>
  ),
  wine: (
    <>
      <path d="M7.4 3.3h9.2l-.7 5.5a3.9 3.9 0 0 1-7.8 0L7.4 3.3Z" />
      <path d="M12 12.7v6.5M8.6 19.2h6.8" />
    </>
  ),
};

export function SectorIcon({
  sector,
  className,
}: {
  sector: string;
  className?: string;
}) {
  const paths = PATHS[sector];
  if (!paths) return null;
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 24 24"
    >
      {paths}
    </svg>
  );
}
