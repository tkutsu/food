import type { Series } from "@/lib/types";

/**
 * The years the yearly view can show: every year whose December is in the
 * month list, plus the year in progress, averaged over the months it has so
 * far.
 *
 * The year in progress was left out at first, on the grounds that January to
 * August is not a year and a missing autumn skews anything seasonal. That is
 * still true, and the panel says which months a partial year covers, but
 * leaving it out meant the yearly view could never show this year's prices.
 */
export function timelineYears(months: readonly string[]): number[] {
  const years = new Set<number>();
  for (const month of months) {
    if (month.endsWith("-12")) years.add(Number(month.slice(0, 4)));
  }
  const last = months.at(-1);
  if (last) years.add(Number(last.slice(0, 4)));
  return [...years].sort((a, b) => a - b);
}

/** The first and last months a year covers in the list, e.g. Jan and Aug. */
export function monthsCovered(
  months: readonly string[],
  year: number,
): { first: string; last: string } | null {
  const inYear = months.filter((month) => month.startsWith(`${year}-`));
  if (inYear.length === 0) return null;
  return { first: inYear[0], last: inYear[inYear.length - 1] };
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
 * The year the yearly view opens on: the newest one that still holds
 * most of the product's countries, for the same reason the monthly view does
 * not open on a month one country has filed.
 */
export function yearToShow(
  series: Series,
  months: readonly string[],
): number | null {
  const years = timelineYears(months);
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

/**
 * The years the yearly timeline steps through: every year from
 * `timelineYears` in which at least one country has an average. Years before a product's first report
 * are left off the slider rather than shown as empty maps.
 */
export function yearsWithAverages(
  series: Series,
  months: readonly string[],
): number[] {
  return timelineYears(months).filter(
    (year) => Object.keys(yearAverages(series, months, year)).length > 0,
  );
}
