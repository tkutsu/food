"use client";

import { BIN_COUNT, NO_DATA_FILL, ramp, type Scale } from "@/lib/scale";

interface LegendProps {
  scale: Scale | null;
  /** Which button's hue the ramp is drawn from. */
  groupId: string;
  /** What one end of the ramp says, already formatted. */
  format: (value: number) => string;
  /** What the two numbers are of, e.g. "per kg". */
  caption: string;
  /** Whether any country on screen is showing the no-data fill. */
  showMissing: boolean;
}

/**
 * The ramp with its two ends labelled. The cuts between swatches are the
 * month's own quantiles and move on every timeline step, so per-swatch ticks
 * would flicker; the two ends hold still and leave room for the map.
 */
export function Legend({
  scale,
  groupId,
  format,
  caption,
  showMissing,
}: LegendProps) {
  if (!scale) return null;
  const colors = ramp(groupId);

  return (
    <div className="pointer-events-none absolute bottom-24 left-2 z-[500] rounded bg-paper/70 px-2 py-1.5 backdrop-blur-sm sm:bottom-8 sm:left-auto sm:right-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-ink/60 tabular-nums">
          {format(scale.min)}
        </span>
        <div className="flex">
          {Array.from({ length: BIN_COUNT }, (_, bin) => (
            <span
              className="block h-3 w-4"
              key={bin}
              style={{ backgroundColor: colors[bin] }}
            />
          ))}
        </div>
        <span className="text-[11px] text-ink/60 tabular-nums">
          {format(scale.max)}
        </span>
      </div>
      <p className="m-0 mt-1 flex items-center justify-end gap-1.5 text-[11px] text-ink/55">
        {showMissing && (
          <>
            <span
              aria-hidden="true"
              className="block size-3 rounded-sm border border-dashed"
              style={{
                borderColor: NO_DATA_FILL,
                backgroundColor: NO_DATA_FILL,
                opacity: 0.55,
              }}
            />
            <span>not reported</span>
            <span aria-hidden="true" className="text-ink/25">
              ·
            </span>
          </>
        )}
        <span>{caption}</span>
      </p>
    </div>
  );
}
