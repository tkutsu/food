import type { Series } from "@/lib/types";

/**
 * Calendar years the month list holds in full. A year still in progress is
 * left out: January to August is not a year, and for anything seasonal the
 * missing autumn would pull the average one way.
 */
export function completeYears(months: readonly string[]): number[] {
  const years = new Set<number>();
  for (const month of months) {
    if (month.endsWith("-12")) years.add(Number(month.slice(0, 4)));
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * Each country's average price over one calendar year.
 *
 * A country only gets an average if it reported at least half as many months
 * that year as the best reporting country did. Half of the best rather than
 * half of twelve, because cherries are only on sale for a few months anywhere
 * and a fixed six would leave them off the map entirely, while one stray week
 * of beef should not pass for a year of it.
 */
export function yearAverages(
  series: Series,
  months: readonly string[],
  year: number,
): Record<string, number> {
  const prefix = `${year}-`;
  const indices: number[] = [];
  months.forEach((month, index) => {
    if (month.startsWith(prefix)) indices.push(index);
  });

  const reported: Record<string, number[]> = {};
  let best = 0;
  for (const [country, values] of Object.entries(series)) {
    const present = indices
      .map((index) => values[index])
      .filter((value): value is number => value !== null && value !== undefined);
    if (present.length === 0) continue;
    reported[country] = present;
    best = Math.max(best, present.length);
  }

  const needed = Math.ceil(best / 2);
  const averages: Record<string, number> = {};
  for (const [country, present] of Object.entries(reported)) {
    if (present.length < needed) continue;
    averages[country] =
      present.reduce((sum, value) => sum + value, 0) / present.length;
  }
  return averages;
}

/**
 * The year the yearly view shows: the newest complete one that still holds
 * most of the product's countries, for the same reason the monthly view does
 * not open on a month one country has filed.
 */
export function yearToShow(
  series: Series,
  months: readonly string[],
): number | null {
  const years = completeYears(months);
  if (years.length === 0) return null;
  const counts = years.map(
    (year) => Object.keys(yearAverages(series, months, year)).length,
  );
  const fullest = Math.max(...counts);
  if (fullest === 0) return null;
  const enough = Math.max(1, Math.ceil(fullest * 0.6));
  for (let index = years.length - 1; index >= 0; index -= 1) {
    if (counts[index] >= enough) return years[index];
  }
  return years[years.length - 1];
}
