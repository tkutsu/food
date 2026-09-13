"use client";

import { SectorIcon } from "@/components/sector-icons";
import { Toggle } from "@/components/toggle";
import { ACCENT_INK } from "@/lib/scale";
import type { Product, SectorSummary } from "@/lib/types";

interface SectorBarProps {
  sectors: readonly SectorSummary[];
  sectorId: string;
  products: readonly Product[];
  productId: string;
  /** The sector's colour, which the active button and tickboxes wear. */
  accent: string;
  organic: boolean;
  organicAvailable: boolean;
  normalised: boolean;
  onSector: (id: string) => void;
  onProduct: (id: string) => void;
  onOrganic: (value: boolean) => void;
  onNormalised: (value: boolean) => void;
}

export function SectorBar({
  sectors,
  sectorId,
  products,
  productId,
  accent,
  organic,
  organicAvailable,
  normalised,
  onSector,
  onProduct,
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
        {sectors.map((sector) => {
          const active = sector.id === sectorId;
          return (
            <button
              aria-selected={active}
              // The active sector wears the hue its own map is drawn in, so
              // the button and the countries say the same thing.
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
                active ? "" : "text-ink/70 hover:bg-ink/8 hover:text-ink"
              }`}
              key={sector.id}
              style={
                active ? { backgroundColor: accent, color: ACCENT_INK } : undefined
              }
              onClick={() => onSector(sector.id)}
              role="tab"
              title={sector.label}
              type="button"
            >
              <SectorIcon className="size-5 shrink-0" sector={sector.id} />
              <span className="hidden sm:inline">{sector.label}</span>
            </button>
          );
        })}
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
        {products.length > 1 && (
          <select
            aria-label="Product"
            className="h-8 max-w-[15rem] truncate rounded-full border border-ink/20 bg-paper/95 px-3 text-xs font-semibold shadow backdrop-blur-sm"
            onChange={(event) => onProduct(event.target.value)}
            value={productId}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.label}
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
