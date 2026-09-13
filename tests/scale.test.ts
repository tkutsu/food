import { describe, expect, it } from "vitest";
import {
  BIN_COUNT,
  asDaysOfIncome,
  binOf,
  buildScale,
  colorFor,
  formatIncome,
  formatPrice,
  incomeFor,
  incomeUnitFor,
  ramp,
  sectorAccent,
} from "@/lib/scale";

/** Roughly the shape of one sector, in euro a kilo: a crowd, and outliers. */
const OLIVE_OIL = [
  ...Array.from({ length: 200 }, (_, index) => 1.7 + index * 0.04),
  ...Array.from({ length: 20 }, (_, index) => 27.44 + index * 0.1),
];
/** Rough perceived brightness, enough to check which end of a ramp is which. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const SECTORS = [
  "olive-oil", "fruit", "vegetables", "beef", "pigmeat",
  "lamb", "milk", "cereal", "wine",
];

describe("buildScale", () => {
  it("cuts where the readings are, not where the range is", () => {
    const scale = buildScale(OLIVE_OIL);
    // Every break sits inside the crowd rather than being dragged out by the
    // handful of readings three times its size.
    expect(scale?.breaks.every((value) => value < 10)).toBe(true);
  });

  it("spreads the crowd across most of the ramp", () => {
    const scale = buildScale(OLIVE_OIL)!;
    const used = new Set(
      OLIVE_OIL.filter((value) => value < 10).map((value) =>
        binOf(value, scale),
      ),
    );
    expect(used.size).toBeGreaterThanOrEqual(BIN_COUNT - 1);
  });

  it("keeps the true ends, which is what the legend prints", () => {
    const scale = buildScale(OLIVE_OIL)!;
    expect(scale.min).toBeCloseTo(1.7);
    expect(scale.max).toBeCloseTo(29.34);
  });

  it("gives no bin that nothing can land in", () => {
    // A series that barely moves would otherwise repeat a quantile and leave
    // a colour no country ever wears.
    const scale = buildScale([5, 5, 5, 5, 5, 5, 5, 5, 9])!;
    expect(new Set(scale.breaks).size).toBe(scale.breaks.length);
    expect(scale.breaks.every((value, index, all) =>
      index === 0 || value > all[index - 1],
    )).toBe(true);
  });

  it("has nothing to say about a series with no readings", () => {
    expect(buildScale([])).toBeNull();
    expect(buildScale([Number.NaN])).toBeNull();
  });
});

describe("binOf", () => {
  it("clamps past either end rather than falling off", () => {
    const scale = buildScale(OLIVE_OIL)!;
    expect(binOf(-5, scale)).toBe(0);
    expect(binOf(99_999, scale)).toBe(scale.breaks.length);
  });
});

describe("ramp", () => {
  it("gives every sector its own hue", () => {
    for (const dark of [false, true]) {
      const mids = SECTORS.map((id) => sectorAccent(id, dark));
      expect(new Set(mids).size).toBe(SECTORS.length);
    }
  });

  it("gives every sector a full ramp in both modes", () => {
    for (const dark of [false, true]) {
      for (const id of SECTORS) {
        expect(ramp(id, dark)).toHaveLength(BIN_COUNT);
        expect(new Set(ramp(id, dark)).size).toBe(BIN_COUNT);
      }
    }
  });

  it("runs faint to strong in both modes, so more money is more colour", () => {
    // Light surface: the low end is the palest step and the high end the
    // darkest. Dark surface: the other way round, and not the light ramp
    // reversed, which would put the washed-out step on the largest price.
    for (const id of SECTORS) {
      const light = ramp(id, false);
      const dark = ramp(id, true);
      expect(luminance(light[0])).toBeGreaterThan(luminance(light[6]));
      expect(luminance(dark[0])).toBeLessThan(luminance(dark[6]));
      expect(dark).not.toEqual([...light].reverse());
    }
  });

  it("falls back rather than colouring nothing for a sector it lacks", () => {
    expect(ramp("fertiliser", false)).toHaveLength(BIN_COUNT);
    expect(ramp("fertiliser", true)).toHaveLength(BIN_COUNT);
  });
});

describe("colorFor", () => {
  it("takes the low end from whichever ramp the mode uses", () => {
    const scale = buildScale(OLIVE_OIL)!;
    expect(colorFor(scale.min, scale, "beef", false)).toBe(ramp("beef", false)[0]);
    expect(colorFor(scale.min, scale, "beef", true)).toBe(ramp("beef", true)[0]);
    expect(ramp("beef", true)[0]).not.toBe(ramp("beef", false)[0]);
  });

  it("marks a country with nothing reported apart from every price", () => {
    const scale = buildScale(OLIVE_OIL)!;
    const missing = colorFor(null, scale, "beef", false);
    for (const id of SECTORS) expect(ramp(id, false)).not.toContain(missing);
    expect(colorFor(undefined, scale, "beef", false)).toBe(missing);
  });
});

describe("incomeFor", () => {
  it("takes the month's own year when it is published", () => {
    expect(incomeFor({ "2023": 10_000, "2024": 10_850 }, "2024-06")).toBe(10_850);
  });

  it("walks back over the holes the series has", () => {
    // Eurostat publishes a year well after it ends, and 2002 is missing for
    // every country, so gaps are not only at the end.
    expect(incomeFor({ "2001": 9_000 }, "2003-01")).toBe(9_000);
  });

  it("gives up rather than carry an income seven years forward", () => {
    expect(incomeFor({ "2015": 9_000 }, "2026-01")).toBeNull();
    expect(incomeFor(undefined, "2026-01")).toBeNull();
  });
});

describe("formatting", () => {
  it("scales the decimals to the size of the number", () => {
    expect(formatPrice(29.34)).toBe("€29.3");
    expect(formatPrice(4.301)).toBe("€4.30");
    // Cereals live here, and two decimals would flatten the whole sector.
    expect(formatPrice(0.1583)).toBe("€0.158");
  });

  it("picks one unit for the whole sector, from its middle", () => {
    expect(incomeUnitFor(2.4)).toBe("days");
    expect(incomeUnitFor(0.287)).toBe("hours");
    expect(incomeUnitFor(0.006)).toBe("minutes");
  });

  it("steps up a unit only with headroom to spare", () => {
    // A sector whose middle is just over an hour spans a quarter of an hour
    // to two, and "0.28 hours" is not a number anyone reads.
    expect(incomeUnitFor(1.1 / 24)).toBe("minutes");
    expect(incomeUnitFor(3 / 24)).toBe("hours");
    expect(incomeUnitFor(1.1)).toBe("hours");
  });

  it("puts a price in that unit", () => {
    expect(asDaysOfIncome(10.85, 10_850)).toBeCloseTo(0.365);
    expect(formatIncome(0.287, "hours")).toBe("6.89 hours");
    expect(formatIncome(0.006, "minutes")).toBe("8.64 min");
    expect(formatIncome(2.4, "days")).toBe("2.40 days");
  });
});
