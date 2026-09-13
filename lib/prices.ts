/**
 * Turning what the Agri-food API reports into something comparable across
 * countries and sectors. Kept apart from the fetching so it can be tested.
 */

/**
 * Prices arrive as display strings with a currency symbol, and the decimal
 * separator follows whoever reported them: "€301.48" from beef, "€190,00"
 * from cereals. Everything is euro, whatever the unit field claims.
 */
export function parsePrice(raw: string | number | null): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  const digits = raw.replace(/[^\d.,-]/g, "");
  if (!digits) return null;
  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  // Whichever separator comes last is the decimal one; the other groups
  // thousands. A lone separator with three digits after it is a group.
  let normalized: string;
  if (lastComma === -1 && lastDot === -1) {
    normalized = digits;
  } else if (lastComma > lastDot) {
    normalized = `${digits.slice(0, lastComma).replace(/[.,]/g, "")}.${digits.slice(lastComma + 1)}`;
  } else {
    normalized = `${digits.slice(0, lastDot).replace(/[.,]/g, "")}.${digits.slice(lastDot + 1)}`;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** "31/08/2026" to "2026-08". The API dates a week by the day it starts. */
export function monthOfDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  return match ? `${match[3]}-${match[2]}` : null;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Every month from `first` up to and including `last`, as "YYYY-MM". */
export function monthRange(first: string, last: string): string[] {
  const [firstYear, firstMonth] = first.split("-").map(Number);
  const [lastYear, lastMonth] = last.split("-").map(Number);
  const months: string[] = [];
  let year = firstYear;
  let month = firstMonth;
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(monthKey(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * Scales a price onto one kilo, whatever weight the sector quotes. The unit
 * strings are inconsistent across sectors ("TONNES", "€/tonne", "100KG",
 * and a "national currency" prefix that is euro anyway).
 *
 * Wine is quoted per hectolitre, a volume with no honest conversion to a
 * weight, so it is scaled to the litre and carries its own unit through to
 * the legend.
 */
export function perKg(price: number, unit: string): number | null {
  const normalized = unit.toLowerCase();
  if (/\bton|tonne/.test(normalized)) return price / 1000;
  if (/100\s*kg/.test(normalized)) return price / 100;
  if (/\bhl\b|hectolitre/.test(normalized)) return price / 100;
  if (/\bkg\b/.test(normalized)) return price;
  return null;
}

export function slug(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

const FRUIT = new Set([
  "apples", "apricots", "avocados", "bananas", "cherries", "clementines",
  "figs", "grapefruits", "kiwis", "lemons", "mandarins", "melons",
  "nectarines", "oranges", "peaches", "pears", "plums", "satsumas",
  "strawberries", "table grapes", "watermelons",
]);

const VEGETABLE = new Set([
  "artichokes", "asparagus", "aubergines", "beans", "broccoli", "cabbages",
  "carrots", "cauliflowers", "celeriac", "chicory", "courgettes", "cucumbers",
  "garlic", "leeks", "lettuces", "mushrooms", "onions", "peas", "peppers",
  "potatoes", "spinach", "sweet peppers", "tomatoes", "white cabbages",
  "witloof",
]);

/**
 * Splits the combined fruit-and-vegetable feed into the two buttons. Varieties
 * read "Apples - Gala", or "Bananas – EU – All types and varieties" for the
 * one product reported with an origin, so the produce is whatever comes first.
 */
export function classifyProduce(
  variety: string,
): { kind: "fruit" | "vegetable"; produce: string } | null {
  const produce = variety.split(/\s+[–-]\s+/)[0].trim().toLowerCase();
  if (FRUIT.has(produce)) return { kind: "fruit", produce };
  if (VEGETABLE.has(produce)) return { kind: "vegetable", produce };
  return null;
}

/**
 * Wine is described in the reporting country's own words and only four of
 * them report, so colour is the one thing that compares across all of them.
 */
export function wineColour(description: string): "red" | "white" | null {
  const text = description.toLowerCase();
  if (/\brouges?\b|\brosso\b|\brossi\b|\brosé|rosado|rosato|\btinto\b|\bred\b/.test(text)) {
    return "red";
  }
  if (/\bblancs?\b|\bbianco\b|\bbianchi\b|\bblanco\b|\bwei[sß]|\bwhite\b/.test(text)) {
    return "white";
  }
  return null;
}

/**
 * Mean of the reported prices, or null when a month had none. Kept to four
 * significant figures rather than a fixed number of decimals: a kilo of
 * cereals and a kilo of olive oil are two orders of magnitude apart, and
 * rounding both to the same place would flatten one of them.
 */
export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toPrecision(4));
}
