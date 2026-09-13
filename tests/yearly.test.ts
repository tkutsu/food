import { describe, expect, it } from "vitest";
import {
  completeYears,
  yearAverages,
  yearToShow,
  yearsWithAverages,
} from "@/lib/yearly";

/** "2024-01" to "2026-08", the shape the catalogue's month list has. */
function monthsFrom(first: [number, number], last: [number, number]): string[] {
  const out: string[] = [];
  let [year, month] = first;
  while (year < last[0] || (year === last[0] && month <= last[1])) {
    out.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

const MONTHS = monthsFrom([2024, 1], [2026, 8]);
const at = (month: string) => MONTHS.indexOf(month);

/** A series with `value` in the given months and nothing elsewhere. */
function filled(entries: [string, number][]): (number | null)[] {
  const values: (number | null)[] = MONTHS.map(() => null);
  for (const [month, value] of entries) values[at(month)] = value;
  return values;
}

describe("completeYears", () => {
  it("leaves out the year still in progress", () => {
    expect(completeYears(MONTHS)).toEqual([2024, 2025]);
  });
});

describe("yearAverages", () => {
  it("averages the months a country reported", () => {
    const series = {
      FR: filled(
        Array.from({ length: 12 }, (_, i) => [
          `2025-${String(i + 1).padStart(2, "0")}`,
          i < 6 ? 4 : 6,
        ]),
      ),
    };
    expect(yearAverages(series, MONTHS, 2025).FR).toBe(5);
  });

  it("keeps a seasonal product that nobody sells all year", () => {
    // Cherries: three months anywhere, which a fixed six-month rule would
    // throw away for every country.
    const series = {
      ES: filled([["2025-05", 3], ["2025-06", 2], ["2025-07", 2.5]]),
      IT: filled([["2025-06", 3.5], ["2025-07", 3]]),
    };
    const averages = yearAverages(series, MONTHS, 2025);
    expect(averages.ES).toBeCloseTo(2.5);
    expect(averages.IT).toBeCloseTo(3.25);
  });

  it("does not let one stray month pass for a year", () => {
    const year = Array.from({ length: 12 }, (_, i): [string, number] => [
      `2025-${String(i + 1).padStart(2, "0")}`,
      5,
    ]);
    const series = { FR: filled(year), MT: filled([["2025-03", 9]]) };
    const averages = yearAverages(series, MONTHS, 2025);
    expect(averages.FR).toBe(5);
    expect(averages.MT).toBeUndefined();
  });
});

describe("yearToShow", () => {
  it("picks the newest complete year, not the one in progress", () => {
    const series = {
      FR: filled([["2025-01", 4], ["2026-01", 5]]),
      DE: filled([["2025-01", 4], ["2026-01", 5]]),
    };
    expect(yearToShow(series, MONTHS)).toBe(2025);
  });

  it("steps back past a year most countries have not filed", () => {
    const series = {
      FR: filled([["2024-01", 4], ["2025-01", 5]]),
      DE: filled([["2024-01", 4]]),
      IT: filled([["2024-01", 4]]),
    };
    expect(yearToShow(series, MONTHS)).toBe(2024);
  });

  it("has nothing to show for an empty series", () => {
    expect(yearToShow({}, MONTHS)).toBeNull();
  });
});

describe("yearsWithAverages", () => {
  it("steps only through complete years that hold a price", () => {
    const series = { FR: filled([["2025-03", 4], ["2026-02", 5]]) };
    // 2024 has no price, 2026 is still in progress.
    expect(yearsWithAverages(series, MONTHS)).toEqual([2025]);
  });
});
