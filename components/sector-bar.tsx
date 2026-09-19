"use client";

import { SectorIcon } from "@/components/sector-icons";
import { Toggle } from "@/components/toggle";
import { ACCENT_INK } from "@/lib/scale";
import type { SectorGroup } from "@/lib/groups";
import type { Product } from "@/lib/types";

/**
 * One line in the dropdown. A button usually offers the products of one
 * sector, but meat offers three sectors' worth, so each line has to carry
 * which file it came from.
 */
export interface Choice {
  /** Unique across the button, as `sector:product`. */
  key: string;
  sectorId: string;
  product: Product;
}

interface SectorBarProps {
  groups: readonly SectorGroup[];
  groupId: string;
  choices: readonly Choice[];
  choiceKey: string;
  /** The button's colour, which it and the tickboxes wear. */
  accent: string;
  organic: boolean;
  organicAvailable: boolean;
  normalised: boolean;
  onGroup: (id: string) => void;
  onChoice: (key: string) => void;
  onOrganic: (value: boolean) => void;
  onNormalised: (value: boolean) => void;
}

export function SectorBar({
  groups,
  groupId,
  choices,
  choiceKey,
  accent,
  organic,
  organicAvailable,
  normalised,
  onGroup,
  onChoice,
  onOrganic,
  onNormalised,
}: SectorBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-col items-center gap-2 p-2 sm:p-3">
      <div
        aria-label="Sector"
        className="pointer-events-auto flex flex-wrap justify-center gap-0.5 rounded-full border border-ink/15 bg-paper/95 p-1 shadow-lg backdrop-blur-sm"
        role="tablist"
      >
        {groups.map((group) => {
          const active = group.id === groupId;
          return (
            <button
              aria-selected={active}
              // The active button wears the hue its own map is drawn in, so
              // the button and the countries say the same thing.
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                active ? "" : "text-ink/70 hover:bg-ink/8 hover:text-ink"
              }`}
              key={group.id}
              style={
                active ? { backgroundColor: accent, color: ACCENT_INK } : undefined
              }
              onClick={() => onGroup(group.id)}
              role="tab"
              title={group.label}
              type="button"
            >
              <SectorIcon className="size-5 shrink-0" sector={group.id} />
              <span className="hidden sm:inline">{group.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
        {choices.length > 1 && (
          <select
            aria-label="Product"
            className="h-8 max-w-[15rem] truncate rounded-full border border-ink/20 bg-paper/95 px-3 text-xs font-semibold shadow backdrop-blur-sm"
            onChange={(event) => onChoice(event.target.value)}
            value={choiceKey}
          >
            {choices.map((choice) => (
              <option key={choice.key} value={choice.key}>
                {choice.product.label}
              </option>
            ))}
          </select>
        )}

        {organicAvailable && (
          <Toggle
            accent={accent}
            checked={organic}
            label="Organic"
            onChange={onOrganic}
          />
        )}
        <Toggle
          accent={accent}
          checked={normalised}
          label="Against income"
          onChange={onNormalised}
          title="Show the price as a share of a median income rather than euro"
        />
      </div>
    </div>
  );
}
