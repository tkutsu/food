import { describe, expect, it } from "vitest";
import {
  classifyProduce,
  mean,
  monthOfDate,
  monthRange,
  parsePrice,
  perKg,
  slug,
  wineColour,
} from "@/lib/prices";

describe("parsePrice", () => {
  it("reads the dot decimals beef and olive oil report", () => {
    expect(parsePrice("€301.48")).toBe(301.48);
  });

  it("reads the comma decimals cereals report", () => {
    expect(parsePrice("€190,00")).toBe(190);
  });

  it("keeps thousands separators out of the value", () => {
    expect(parsePrice("€1,234.50")).toBe(1234.5);
    expect(parsePrice("€1.234,50")).toBe(1234.5);
  });

  it("passes numbers through, as fertiliser and organic send them", () => {
    expect(parsePrice(360)).toBe(360);
  });

  it("rejects blanks and non-prices", () => {
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice("N.A.")).toBeNull();
    expect(parsePrice("€0.00")).toBeNull();
  });
});

describe("monthOfDate", () => {
  it("takes the month the reported week starts in", () => {
    expect(monthOfDate("31/08/2026")).toBe("2026-08");
  });

  it("ignores anything that is not a reported date", () => {
    expect(monthOfDate("N.A.")).toBeNull();
    expect(monthOfDate(undefined)).toBeNull();
  });
});

describe("monthRange", () => {
  it("runs inclusively across a year boundary", () => {
    expect(monthRange("2023-11", "2024-02")).toEqual([
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
    ]);
  });

  it("gives a single month when both ends match", () => {
    expect(monthRange("2024-05", "2024-05")).toEqual(["2024-05"]);
  });
});

describe("perKg", () => {
  it("scales the tonne sectors down", () => {
    expect(perKg(1900, "TONNES")).toBe(1.9);
    expect(perKg(500, "€/tonne")).toBe(0.5);
  });

  it("scales the hundred-kilo sectors down", () => {
    expect(perKg(301.48, "€/100Kg")).toBeCloseTo(3.0148);
    expect(perKg(189, "national currency/100kg")).toBe(1.89);
  });

  it("puts wine on the litre, since a hectolitre has no weight", () => {
    expect(perKg(61, "Euro / HL.")).toBe(0.61);
  });

  it("refuses a unit it cannot place", () => {
    expect(perKg(10, "head")).toBeNull();
  });
});

describe("classifyProduce", () => {
  it("splits the combined feed into the two buttons", () => {
    expect(classifyProduce("Apples - Golden delicious")).toEqual({
      kind: "fruit",
      produce: "apples",
    });
    expect(classifyProduce('Tomatoes - Trusses=Vine/"Grappes"')).toEqual({
      kind: "vegetable",
      produce: "tomatoes",
    });
  });

  it("handles the en dash bananas are reported with", () => {
    expect(classifyProduce("Bananas – EU – All types and varieties")?.kind).toBe(
      "fruit",
    );
  });

  it("leaves produce it does not know out rather than guessing", () => {
    expect(classifyProduce("Hazelnuts - In shell")).toBeNull();
  });
});

describe("wineColour", () => {
  it("reads each reporting country's own words", () => {
    expect(wineColour("Rouges et Rosés / Vin IGP")).toBe("red");
    expect(wineColour("Bari Vino bianco senza DOP/IGP")).toBe("white");
    expect(wineColour("Vino tinto sin DOP")).toBe("red");
    expect(wineColour("Weisswein")).toBe("white");
  });

  it("gives up on a description with no colour in it", () => {
    expect(wineColour("Altri Vini")).toBeNull();
  });
});

describe("slug", () => {
  it("strips accents and punctuation", () => {
    expect(slug("Rouges et Rosés / Vin AOP")).toBe("rouges-et-roses-vin-aop");
  });

  it("keeps the grade suffixes olive oil depends on", () => {
    expect(slug("Extra virgin olive oil (up to 0.8%)")).toBe(
      "extra-virgin-olive-oil-up-to-0-8",
    );
  });
});

describe("mean", () => {
  it("keeps four significant figures, whatever the magnitude", () => {
    expect(mean([10, 11, 12])).toBe(11);
    expect(mean([1, 2])).toBe(1.5);
    // A kilo of cereals and a kilo of olive oil are two orders apart, and
    // both have to survive the same rounding.
    expect(mean([0.15832, 0.15834])).toBeCloseTo(0.1583, 4);
    expect(mean([12.0932])).toBe(12.09);
  });

  it("gives nothing for a month with no reports", () => {
    expect(mean([])).toBeNull();
  });
});
