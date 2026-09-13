"use client";

interface CountryPanelProps {
  name: string;
  /** The value shown on the map, already formatted, or null if unreported. */
  headline: string | null;
  /** What the headline is per, e.g. "per kg" or "of a median income, per kg". */
  caption: string;
  /** Every month of this country's series, for the shape behind the number. */
  history: readonly (number | null)[];
  /** The series drawn dashed behind the main one, where there is one. */
  compareHistory?: readonly (number | null)[];
  /** What that dashed series is, e.g. "organic". */
  compareLabel?: string;
  monthIndex: number;
  monthLabel: string;
  /** The organic gap, already worded, e.g. "27% more". */
  organicPremium: string | null;
  /** The sector's hue, so the line matches the map it came off. */
  accent: string;
  onClose: () => void;
}

const WIDTH = 260;
const HEIGHT = 44;

/** A path through the series, and the x of the month being shown. */
function spark(
  history: readonly (number | null)[],
  low: number,
  high: number,
): string {
  const span = high - low || 1;
  let path = "";
  let open = false;
  history.forEach((value, index) => {
    if (value === null) {
      open = false;
      return;
    }
    const x = (index / Math.max(history.length - 1, 1)) * WIDTH;
    const y = HEIGHT - ((value - low) / span) * HEIGHT;
    path += `${open ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    open = true;
  });
  return path;
}

export function CountryPanel({
  name,
  headline,
  caption,
  history,
  compareHistory,
  compareLabel,
  monthIndex,
  monthLabel,
  organicPremium,
  accent,
  onClose,
}: CountryPanelProps) {
  const all = [...history, ...(compareHistory ?? [])].filter(
    (value): value is number => value !== null,
  );
  const low = all.length > 0 ? Math.min(...all) : 0;
  const high = all.length > 0 ? Math.max(...all) : 1;
  const marker =
    (monthIndex / Math.max(history.length - 1, 1)) * WIDTH;

  return (
    <div className="rise-in pointer-events-auto w-[min(92vw,20rem)] border border-ink/20 bg-paper/97 p-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-sm font-bold">{name}</h2>
          <p className="m-0 text-xs text-ink/55">{monthLabel}</p>
        </div>
        <button
          aria-label="Close"
          className="-mt-1 -mr-1 shrink-0 border-0 bg-transparent p-1 text-ink/50 hover:text-ink"
          onClick={onClose}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <p className="m-0 mt-2 text-2xl font-bold tabular-nums">
        {headline ?? <span className="text-base text-ink/45">Not reported</span>}
      </p>
      <p className="m-0 text-xs text-ink/55">{caption}</p>

      {organicPremium && (
        <p className="m-0 mt-1 text-xs text-ink/70">
          Organic costs {organicPremium}.
        </p>
      )}

      {all.length > 1 && (
        <svg
          aria-hidden="true"
          className="mt-3 w-full"
          height={HEIGHT}
          preserveAspectRatio="none"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
        >
          <line
            stroke="currentColor"
            strokeWidth="1"
            x1={marker}
            x2={marker}
            y1="0"
            y2={HEIGHT}
            className="text-ink/20"
          />
          {compareHistory && (
            <path
              d={spark(compareHistory, low, high)}
              fill="none"
              stroke="currentColor"
              strokeDasharray="3 3"
              strokeWidth="1.5"
              className="text-ink/45"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={spark(history, low, high)}
            fill="none"
            stroke={accent}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {all.length > 1 && (
        <p className="m-0 flex justify-between text-[11px] text-ink/45">
          <span>the whole series</span>
          {compareHistory && compareLabel && (
            <span>dashed: {compareLabel}</span>
          )}
        </p>
      )}
    </div>
  );
}
