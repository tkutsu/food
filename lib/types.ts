/** A product within a sector: one series the map can be coloured by. */
export interface Product {
  id: string;
  label: string;
  /** Whether an organic price is reported alongside this product. */
  organic?: boolean;
}

/** Country code to one price per month, null where nothing was reported. */
export type Series = Record<string, (number | null)[]>;

/** One sector's file, fetched when its button is pressed. */
export interface SectorData {
  id: string;
  /** Index into the shared month list where every series below starts. */
  offset: number;
  products: Product[];
  /** Product id to its per-country conventional prices. */
  conventional: Record<string, Series>;
  /** Product id to its per-country organic prices, where reported. */
  organic: Record<string, Series>;
}

export interface SectorSummary {
  id: string;
  label: string;
  /** What one unit of the price is, e.g. "kg" or "litre". */
  unit: string;
  /** Whether any product in the sector has an organic counterpart. */
  organic: boolean;
  /** Where the numbers come from, shown in the panel. */
  note: string;
}

export interface Catalog {
  updated: string;
  /** Every month the timeline can show, as "YYYY-MM". */
  months: string[];
  sectors: SectorSummary[];
  /** Country code to its English name. */
  countries: Record<string, string>;
  /** Country code to median equivalised net income by year, in euro. */
  income: Record<string, Record<string, number>>;
}

export type Bounds = [[number, number], [number, number]];
