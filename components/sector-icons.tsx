/**
 * One glyph per sector button. Stroked rather than filled, so they sit at the
 * same weight as the rest of the furniture, and every button carries its name
 * as well: seven icons in a row is too many to ask anyone to decode.
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
  // A cut on the bone rather than the animal, because one button now covers
  // cattle, pigs and sheep and any one beast would misname the other two.
  meat: (
    <>
      <path d="M4.6 19.4A8 5.4 -45 0 1 16 8A8 5.4 -45 0 1 4.6 19.4Z" />
      <path d="M4.9 14.9a5.4 5.4 0 0 0 4.2 4.2" />
      <path d="M15.9 8.1 17.3 6.7" />
      <path d="M19.4 8.4a2 2 0 1 1-2.8-2.8 2 2 0 1 1 2.8 2.8Z" />
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
