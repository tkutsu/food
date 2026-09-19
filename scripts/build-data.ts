/**
 * Bakes every price series the site ships with, so the deployment is static.
 *
 * The Agri-food API reports a price per market per week, which is hundreds of
 * thousands of rows per sector across the Union. Averaging that down to one
 * number per country per month happens here, once, rather than in every
 * visitor's browser.
 *
 * Run with: pnpm build:data
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  classifyProduce,
  mean,
  monthKey,
  monthOfDate,
  monthRange,
  parsePrice,
  perKg,
  slug,
  wineColour,
} from "@/lib/prices";
import type {
  Catalog,
  Product,
  SectorData,
  SectorSummary,
  Series,
} from "@/lib/types";

const AGRIFOOD = "https://api.tech.ec.europa.eu/agrifood/api/";
const EUROSTAT =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ilc_di03";
const OUT_DIR = new URL("../public/data/", import.meta.url);

/** Far enough back for the 2008 spike and the 2022 one to both be on it. */
const FIRST_MONTH = "2005-01";

const MEMBER_STATES = [
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK",
];

/**
 * The stage fruit and vegetables are compared at. All four stages are
 * reported but only this one is filled in across most of the Union, and
 * averaging a farm gate price against a retail one would mean nothing.
 */
const PRODUCE_STAGE = "Ex-packaging station price";
/** Sectors keep this many products, the widest covered first. */
const MAX_PRODUCTS = 8;
/** A product is only worth a slot if this many countries report it. */
const MIN_COUNTRIES = 3;

type Raw = Record<string, string | number | null>;
/**
 * One reported price, as the sector quotes it. Readers hand over the number
 * and the unit string that came with it and never do the conversion
 * themselves: `collect` is the single place that scales onto a kilo. An
 * earlier version left it to each reader and the wine one forgot, which put
 * a per-hectolitre figure under a legend reading "per litre".
 */
interface Reading {
  country: string;
  month: string;
  product: string;
  price: number;
  unit: string;
}

/**
 * One product a sector offers, in words a shopper would use. `from` is the
 * name the API reports it under, `detail` says what the number actually is.
 */
interface CuratedProduct {
  from: string;
  label: string;
  detail?: string;
}

/**
 * One endpoint a sector reads. Most sectors have exactly one; meat has three,
 * because the Commission publishes cattle, pigs and sheep under separate
 * endpoints and a shopper does not think of them as separate aisles.
 */
interface Feed {
  /** Path under the API base, given a member state. */
  path: (memberState: string) => string;
  /** Pulls the readings out of one country's response. */
  read: (rows: Raw[], memberState: string) => Reading[];
}

interface Sector extends Omit<SectorSummary, "organic"> {
  /**
   * The products to keep, in the order the dropdown shows them, the first
   * being the default. Left out, the sector keeps its best covered products
   * under the API's own names, which only fruit and vegetables do: their
   * names are already the ones on a market stall.
   */
  products?: readonly CuratedProduct[];
  /** What a product's number is, for products with no detail of their own. */
  detail?: string;
  /** The endpoints to read, in the order their products should appear. */
  feeds: readonly Feed[];
  /** Recognises this sector's product in an organic row's product name. */
  organicProduct?: (organicName: string, sectorName: string) => string | null;
  /** The organic group this sector draws from, where it is not its own id. */
  organicFrom?: string;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Responses already fetched this run, keyed by URL. Fruit and vegetables are
 * two buttons over one endpoint, so without this the largest feed in the
 * project is pulled twice for all 27 member states.
 */
const responseCache = new Map<string, unknown>();

/**
 * The two error envelopes the Agri-food gateway uses. Matching on shape
 * rather than on a bare `status` field matters because Eurostat's JSON-stat
 * carries a `status` block of its own, holding the provisional and estimated
 * flags, and reading that as an error kills the income fetch.
 */
function asErrorBody(payload: unknown): { status: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.error === "string" && body.status !== undefined) {
    return { status: String(body.status) };
  }
  if (body.type === "Status report" && body.code !== undefined) {
    return { status: String(body.code) };
  }
  return null;
}

/** Requests are spaced rather than fired together; the gateway rate limits. */
const REQUEST_GAP_MS = 350;
let nextSlot = 0;

async function takeSlot(): Promise<void> {
  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + REQUEST_GAP_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

/**
 * The gateway in front of the API rate limits, and under load returns a
 * 303001 "address endpoint" body often enough that a single attempt loses
 * whole countries. Both are worth waiting out rather than dropping a country.
 */
async function fetchJson(url: string, attempts = 6): Promise<unknown> {
  const cached = responseCache.get(url);
  if (cached !== undefined) return cached;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await takeSlot();
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(240_000),
      });
      if (response.status === 429) {
        // Back the whole build off, not just this request: every worker is
        // queueing against the same limit.
        nextSlot = Date.now() + 5_000 * attempt;
        throw new Error("HTTP 429");
      }
      // A country that reports nothing for a sector answers 404, which is an
      // answer rather than a failure.
      if (response.status === 404) return remember(url, []);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (Array.isArray(payload)) return remember(url, payload);
      const error = asErrorBody(payload);
      if (error) {
        // A "no results" body is an answer, not a failure: plenty of
        // countries simply do not report a given sector.
        if (error.status === "404") return remember(url, []);
        throw new Error(JSON.stringify(payload).slice(0, 160));
      }
      return remember(url, payload);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1_200 * attempt));
      }
    }
  }
  throw lastError;
}

function remember<T>(url: string, payload: T): T {
  responseCache.set(url, payload);
  return payload;
}

/** Runs `worker` over `items`, `limit` of them in flight, in order. */
async function pool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      for (;;) {
        const index = next;
        next += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

// ---------------------------------------------------------------------------
// Readers: one per shape the API returns
// ---------------------------------------------------------------------------

/** The common shape: a weekly row with a begin date, a price and a unit. */
function weekly(productField: string) {
  return (rows: Raw[], memberState: string): Reading[] => {
    const readings: Reading[] = [];
    for (const row of rows) {
      const month = monthOfDate(row.beginDate as string);
      const product = row[productField];
      const price = parsePrice(row.price as string);
      if (!month || month < FIRST_MONTH || !product || price === null) continue;
      readings.push({
        country: memberState,
        month,
        product: String(product),
        price,
        unit: String(row.unit ?? ""),
      });
    }
    return readings;
  };
}

const SECTORS: Sector[] = [
  {
    id: "olive-oil",
    label: "Olive oil",
    unit: "kg",
    // Lampante is lamp oil, unfit to eat until refined, and refined olive oil
    // is an ingredient blended into the bottles rather than one of them.
    products: [
      { from: "Extra virgin olive oil (up to 0.8%)", label: "Extra virgin" },
      { from: "Virgin olive oil (up to 2%)", label: "Virgin" },
    ],
    detail: "Sold in bulk, at the mill or market",
    note: "Weekly prices at every reporting market, averaged to a national month. Eight countries press enough oil to report.",
    feeds: [
      {
        path: (ms) => `oliveOil/prices?memberStateCodes=${ms}`,
        read: weekly("product"),
      },
    ],
  },
  {
    id: "fruit",
    label: "Fruit",
    unit: "kg",
    detail: "Wholesale, as it leaves the packing station",
    note: `Weekly ${PRODUCE_STAGE.toLowerCase()}s, the one stage of the supply chain most of the Union reports.`,
    feeds: [
      {
        path: (ms) =>
          `fruitAndVegetable/pricesSupplyChain?memberStateCodes=${ms}`,
        read: produce("fruit"),
      },
    ],
    organicProduct: matchOrganicProduce,
    organicFrom: "produce",
  },
  {
    id: "vegetables",
    label: "Vegetables",
    unit: "kg",
    detail: "Wholesale, as it leaves the packing station",
    note: `Weekly ${PRODUCE_STAGE.toLowerCase()}s, the one stage of the supply chain most of the Union reports.`,
    feeds: [
      {
        path: (ms) =>
          `fruitAndVegetable/pricesSupplyChain?memberStateCodes=${ms}`,
        read: produce("vegetable"),
      },
    ],
    organicProduct: matchOrganicProduce,
    organicFrom: "produce",
  },
  {
    id: "meat",
    label: "Meat",
    unit: "kg",
    // Cattle, pigs and sheep are three endpoints at the Commission and one
    // aisle at the butcher, so they are one button with the animal in the
    // dropdown. Beef leads because it is the most widely reported and the
    // only one with an organic price beside it.
    //
    // The API splits cattle into eight carcass categories by the animal's
    // age and sex. Nobody buys a young bull or a steer; they buy beef or
    // veal, and heifers stand for beef: prime meat, reported everywhere.
    // S, E and R are grades on the EU's lean-meat scale for pig carcasses,
    // and class E is the one the Commission quotes as its reference pig
    // price. Both lamb carcasses stay, because Greece and much of the
    // Mediterranean report only the light one and dropping it would take
    // them off the map.
    products: [
      {
        from: "Heifers",
        label: "Beef",
        detail: "Heifer carcasses, the prime grade, at the slaughterhouse",
      },
      {
        from: "Calves slaughtered <8M",
        label: "Veal",
        detail: "Calves under eight months, at the slaughterhouse",
      },
      {
        from: "E",
        label: "Pork",
        detail: "Class E carcasses, the reference grade, at the slaughterhouse",
      },
      {
        from: "Heavy Lamb",
        label: "Lamb",
        detail: "Heavier carcasses, at the slaughterhouse",
      },
      {
        from: "Light Lamb",
        label: "Young lamb",
        detail: "Light carcasses, as sold around the Mediterranean",
      },
    ],
    note: "Weekly carcass prices from the cattle, pig and sheep feeds, averaged to a national month.",
    feeds: [
      {
        path: (ms) => `beef/prices?memberStateCodes=${ms}`,
        read: weekly("category"),
      },
      {
        path: (ms) => `pigmeat/prices?memberStateCodes=${ms}`,
        read: weekly("pigClass"),
      },
      {
        path: (ms) => `sheepAndGoat/prices?memberStateCodes=${ms}`,
        read: weekly("category"),
      },
    ],
    organicProduct: (organicName) => organicName,
  },
  {
    id: "milk",
    label: "Milk",
    unit: "kg",
    // The feed also lists organic raw milk as a product of its own, which
    // would sit in the dropdown beside the organic tickbox saying the same
    // thing. The tickbox covers the same 22 countries.
    products: [
      {
        from: "Raw milk",
        label: "Milk",
        detail: "Paid to the farmer, before it is processed",
      },
    ],
    note: "The monthly price a dairy pays a farmer for raw milk, before it becomes anything else.",
    feeds: [
      {
        path: (ms) => `rawMilk/prices?memberStateCodes=${ms}`,
        read: readRawMilk,
      },
    ],
    organicProduct: () => "Raw milk",
  },
  {
    id: "cereal",
    label: "Wheat",
    unit: "kg",
    // Feed barley, feed maize, feed wheat and feed oats go to animals, and
    // malting barley goes to brewers. What reaches a kitchen is wheat, for
    // bread and for pasta. "Cereals" also reads as breakfast to a shopper.
    products: [
      {
        from: "Breadmaking common wheat",
        label: "Bread wheat",
        detail: "Grain for flour, wholesale",
      },
      {
        from: "Durum wheat",
        label: "Durum wheat",
        detail: "Grain for pasta, wholesale",
      },
    ],
    note: "Weekly prices at the named markets of each country, across every stage from the farm gate to the port, averaged to a national month.",
    feeds: [
      {
        path: (ms) => `cereal/prices?memberStateCodes=${ms}`,
        read: weekly("productName"),
      },
    ],
    organicProduct: matchOrganicCereal,
  },
  {
    id: "wine",
    label: "Wine",
    unit: "litre",
    // White first: all four reporting countries price it, while red and
    // rosé is missing one, and the default should fill the most map.
    products: [
      { from: "White", label: "White" },
      { from: "Red and rosé", label: "Red and rosé" },
    ],
    detail: "In bulk, every quality tier together",
    note: "Only Germany, Spain, France and Italy report wine, each in its own words, so the prices are gathered by colour.",
    feeds: [
      {
        path: (ms) => `wine/prices?memberStateCodes=${ms}`,
        read: readWine,
      },
    ],
  },
];

/** Raw milk is reported monthly already, with the year and month as fields. */
function readRawMilk(rows: Raw[], memberState: string): Reading[] {
  const readings: Reading[] = [];
  for (const row of rows) {
    const year = Number(row.year);
    const monthNumber = Number(row.month);
    const price = parsePrice(row.price as string);
    if (!year || !monthNumber || price === null) continue;
    const month = monthKey(year, monthNumber);
    if (month < FIRST_MONTH) continue;
    readings.push({
      country: memberState,
      month,
      product: String(row.product ?? "Raw milk"),
      price,
      unit: String(row.unit ?? ""),
    });
  }
  return readings;
}

/** Each wine country names its wines its own way, so they gather by colour. */
function readWine(rows: Raw[], memberState: string): Reading[] {
  const readings: Reading[] = [];
  for (const row of rows) {
    const month = monthOfDate(row.beginDate as string);
    const colour = wineColour(String(row.description ?? ""));
    const raw = parsePrice(row.price as string);
    if (!month || month < FIRST_MONTH || !colour || raw === null) continue;
    readings.push({
      country: memberState,
      month,
      product: colour === "red" ? "Red and rosé" : "White",
      price: raw,
      unit: String(row.unit ?? ""),
    });
  }
  return readings;
}

/** Reads the shared fruit-and-vegetable feed as one side of it. */
function produce(kind: "fruit" | "vegetable") {
  return (rows: Raw[], memberState: string): Reading[] => {
    const readings: Reading[] = [];
    for (const row of rows) {
      if (row.periodType !== "Week") continue;
      if (row.productStage !== PRODUCE_STAGE) continue;
      const month = monthOfDate(row.beginDate as string);
      const classified = classifyProduce(String(row.variety ?? ""));
      const price = parsePrice(row.price as string);
      if (!month || month < FIRST_MONTH || !classified || price === null) continue;
      if (classified.kind !== kind) continue;
      // Gathered to the produce, not the variety: a Gala and a Golden are
      // both an apple, and no two countries report the same varieties.
      readings.push({
        country: memberState,
        month,
        product: produceLabel(classified.produce),
        price,
        unit: String(row.unit ?? ""),
      });
    }
    return readings;
  };
}

/** The few produce names the API writes differently from a shopping list. */
const PRODUCE_NAMES: Record<string, string> = {
  "table grapes": "Grapes",
  cauliflowers: "Cauliflower",
  lettuces: "Lettuce",
};

function produceLabel(produce: string): string {
  return PRODUCE_NAMES[produce] ?? titleCase(produce);
}

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Organic-Apples - Gala" is an apple; so is "Apples - Golden delicious". */
function matchOrganicProduce(organicName: string): string | null {
  const stripped = organicName.replace(/^organic[\s-]*/i, "");
  const classified = classifyProduce(stripped);
  return classified ? produceLabel(classified.produce) : null;
}

/** The organic feed names a grain loosely; the sector names it precisely. */
function matchOrganicCereal(
  organicName: string,
  sectorName: string,
): string | null {
  const organic = organicName.toLowerCase();
  const target = sectorName.toLowerCase();
  const grains = ["common wheat", "durum wheat", "barley", "maize", "rye", "oats"];
  for (const grain of grains) {
    if (organic.includes(grain) && target.includes(grain)) return sectorName;
  }
  return null;
}

/** Which organic sector label feeds which of ours. */
const ORGANIC_SECTORS: Record<string, string> = {
  "Fruit and vegetables": "produce",
  "Beef and veal": "meat",
  "Milk and milk products": "milk",
  Cereals: "cereal",
};

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** product -> country -> month -> every price reported that month. */
type Bucket = Map<string, Map<string, Map<string, number[]>>>;

function collect(readings: readonly Reading[], bucket: Bucket): void {
  for (const { country, month, product, price: reported, unit } of readings) {
    // The one place a reported price becomes a price per kilo. A unit nobody
    // has seen before drops the row rather than passing a tonne figure
    // through onto a per-kilo scale.
    const price = perKg(reported, unit);
    if (price === null) continue;
    let byCountry = bucket.get(product);
    if (!byCountry) bucket.set(product, (byCountry = new Map()));
    let byMonth = byCountry.get(country);
    if (!byMonth) byCountry.set(country, (byMonth = new Map()));
    const prices = byMonth.get(month);
    if (prices) prices.push(price);
    else byMonth.set(month, [price]);
  }
}

/** The products worth a slot in the selector, widest coverage first. */
/**
 * A sector's curated products that the run actually found, in their declared
 * order. A curated name the API no longer reports is said out loud: that is
 * an upstream rename, and silently shipping a sector with no default product
 * is how a button goes blank without anyone noticing.
 */
function pickCurated(sector: Sector, bucket: Bucket): string[] {
  const picked: string[] = [];
  for (const { from } of sector.products ?? []) {
    const countries = bucket.get(from)?.size ?? 0;
    if (countries >= MIN_COUNTRIES) {
      picked.push(from);
    } else {
      console.warn(
        `  ${sector.id}: "${from}" reported by ${countries} countries, left out`,
      );
    }
  }
  return picked;
}

function rankProducts(bucket: Bucket): string[] {
  return [...bucket.entries()]
    .map(([product, byCountry]) => {
      let months = 0;
      for (const byMonth of byCountry.values()) months += byMonth.size;
      return { product, countries: byCountry.size, months };
    })
    .filter((entry) => entry.countries >= MIN_COUNTRIES)
    .sort(
      (a, b) => b.countries - a.countries || b.months - a.months ||
        a.product.localeCompare(b.product),
    )
    .slice(0, MAX_PRODUCTS)
    .map((entry) => entry.product);
}

/** Averages each month's reports into one number per country. */
function serialise(
  bucket: Bucket,
  products: readonly string[],
  months: readonly string[],
): Record<string, Series> {
  const out: Record<string, Series> = {};
  for (const product of products) {
    const byCountry = bucket.get(product);
    if (!byCountry) continue;
    const series: Series = {};
    for (const [country, byMonth] of byCountry) {
      const values = months.map((month) => mean(byMonth.get(month) ?? []));
      // A country that reported nothing inside the window is not a country
      // with no prices, it is a country with no row. Leave it off the map.
      if (values.every((value) => value === null)) continue;
      series[country] = values;
    }
    if (Object.keys(series).length > 0) out[slug(product)] = series;
  }
  return out;
}

/**
 * Which product, if any, this run reports in noticeably fewer countries than
 * the committed file. Compared product by product rather than as a sector
 * total, and only over the products both have: dropping feed grain from
 * cereals shrinks the sector's reach on purpose, and that must not read as
 * a rate-limited run.
 */
function lostCoverage(fresh: SectorData, existing: SectorData): string | null {
  for (const [id, series] of Object.entries(fresh.conventional)) {
    const before = existing.conventional[id];
    if (!before) continue;
    const now = Object.keys(series).length;
    const then = Object.keys(before).length;
    if (now < then * 0.9) return `${id} in ${now} countries, was ${then}`;
  }
  return null;
}

/**
 * The sector file already in the repo, if there is one. Committed data is the
 * fallback: a build that cannot reach the API for a sector should leave last
 * week's prices in place rather than publish a thinner map.
 */
async function readExisting(name: string): Promise<SectorData | null> {
  try {
    return JSON.parse(
      await readFile(new URL(name, OUT_DIR), "utf8"),
    ) as SectorData;
  } catch {
    return null;
  }
}

/** Trims the leading months no sector product ever filled in. */
function firstFilled(
  conventional: Record<string, Series>,
  monthCount: number,
): number {
  let earliest = monthCount;
  for (const series of Object.values(conventional)) {
    for (const values of Object.values(series)) {
      const index = values.findIndex((value) => value !== null);
      if (index !== -1 && index < earliest) earliest = index;
    }
  }
  return earliest === monthCount ? 0 : earliest;
}

function trim(
  sets: Record<string, Series>,
  offset: number,
): Record<string, Series> {
  if (offset === 0) return sets;
  const out: Record<string, Series> = {};
  for (const [product, series] of Object.entries(sets)) {
    out[product] = Object.fromEntries(
      Object.entries(series).map(([country, values]) => [
        country,
        values.slice(offset),
      ]),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Median income, for the normalised view
// ---------------------------------------------------------------------------

/**
 * Median equivalised net income per year, in euro, from Eurostat's
 * income-and-living-conditions survey. The one figure that says what a price
 * costs the people living with it rather than what it says on the invoice.
 */
async function fetchIncome(): Promise<Record<string, Record<string, number>>> {
  const url = `${EUROSTAT}?${new URLSearchParams({
    format: "JSON",
    lang: "en",
    freq: "A",
    age: "TOTAL",
    sex: "T",
    statinfo: "MED_EI",
    unit: "EUR",
  })}`;
  const payload = (await fetchJson(url)) as {
    id: string[];
    size: number[];
    dimension: Record<string, { category: { index: Record<string, number> } }>;
    value: Record<string, number>;
  };

  const geoAxis = payload.id.indexOf("geo");
  const timeAxis = payload.id.indexOf("time");
  // JSON-stat flattens every dimension into one index; these undo that.
  const strides = payload.size.map((_, axis) =>
    payload.size.slice(axis + 1).reduce((product, size) => product * size, 1),
  );
  const geos = payload.dimension.geo.category.index;
  const times = payload.dimension.time.category.index;

  const income: Record<string, Record<string, number>> = {};
  for (const [code, geoIndex] of Object.entries(geos)) {
    if (!MEMBER_STATES.includes(code)) continue;
    for (const [year, timeIndex] of Object.entries(times)) {
      const value =
        payload.value[
          String(geoIndex * strides[geoAxis] + timeIndex * strides[timeAxis])
        ];
      if (typeof value !== "number") continue;
      (income[code] ??= {})[year] = value;
    }
  }
  return income;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function lastFullMonth(): string {
  const now = new Date();
  const month = now.getUTCMonth(); // 0-based, so this is already last month
  return month === 0
    ? monthKey(now.getUTCFullYear() - 1, 12)
    : monthKey(now.getUTCFullYear(), month);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // `pnpm build:data wine` refetches one sector and leaves the rest of the
  // committed data alone. The gateway rate limits hard enough that pulling
  // all nine to fix one is worth avoiding.
  const only = new Set(process.argv.slice(2));
  const requested = SECTORS.filter(
    (sector) => only.size === 0 || only.has(sector.id),
  );
  if (only.size > 0) {
    const unknown = [...only].filter(
      (id) => !SECTORS.some((sector) => sector.id === id),
    );
    if (unknown.length > 0) {
      throw new Error(
        `no such sector: ${unknown.join(", ")}. ` +
          `Known: ${SECTORS.map((sector) => sector.id).join(", ")}`,
      );
    }
    console.log(`only ${requested.map((s) => s.id).join(", ")}`);
  }
  const months = monthRange(FIRST_MONTH, lastFullMonth());
  const countries: Record<string, string> = {};

  // One organic call per country serves every sector that has an organic
  // counterpart, so it is fetched once up front. Skipped entirely when no
  // requested sector has an organic counterpart.
  const needsOrganic = requested.some((sector) => sector.organicProduct);
  if (needsOrganic) console.log("organic...");
  const organicRows = !needsOrganic
    ? []
    : (
    await pool(MEMBER_STATES, 3, async (memberState) => {
      const rows = (await fetchJson(
        `${AGRIFOOD}organic/prices?memberStateCodes=${memberState}`,
      )) as Raw[];
      return rows.map(
        (row): Raw => ({ ...row, memberStateCode: memberState }),
      );
    })
  ).flat();
  if (needsOrganic) console.log(`  ${organicRows.length} rows`);

  const summaries: SectorSummary[] = [];

  for (const sector of SECTORS) {
    // A sector left out of the run keeps its committed file and contributes
    // its summary from it, so index.json stays complete either way.
    if (!requested.includes(sector)) {
      const existing = await readExisting(`${sector.id}.json`);
      if (existing) {
        summaries.push({
          id: sector.id,
          label: sector.label,
          unit: sector.unit,
          note: sector.note,
          organic: Object.keys(existing.organic).length > 0,
        });
      }
      continue;
    }

    const responses = await pool(MEMBER_STATES, 3, async (memberState) => {
      const readings: Reading[] = [];
      // One feed failing takes its animal off the map for that country and
      // leaves the rest of the sector standing, which is what the sector
      // would have shown before the feeds were gathered under one button.
      for (const feed of sector.feeds) {
        try {
          const rows = (await fetchJson(
            AGRIFOOD + feed.path(memberState),
          )) as Raw[];
          for (const row of rows) {
            const name = row.memberStateName;
            if (typeof name === "string" && name) countries[memberState] = name;
          }
          readings.push(...feed.read(rows, memberState));
        } catch (error) {
          console.warn(`  ${sector.id}/${memberState}: ${String(error)}`);
        }
      }
      return readings;
    });

    const bucket: Bucket = new Map();
    for (const readings of responses) collect(readings, bucket);
    const products = sector.products
      ? pickCurated(sector, bucket)
      : rankProducts(bucket);
    const conventional = serialise(bucket, products, months);

    // Organic prices, matched onto the products the sector already has.
    const organicBucket: Bucket = new Map();
    if (sector.organicProduct) {
      for (const row of organicRows) {
        const group = ORGANIC_SECTORS[String(row.sector ?? "")];
        if (group !== (sector.organicFrom ?? sector.id)) continue;
        const price = parsePrice(row.organicPrice as number);
        const year = Number(row.year);
        const monthNumber = Number(row.monthNumber);
        if (price === null || !year || !monthNumber) continue;
        const month = monthKey(year, monthNumber);
        if (month < FIRST_MONTH) continue;
        const organicName = String(row.organicProduct ?? "");
        const matched = products.find(
          (product) => sector.organicProduct!(organicName, product) === product,
        );
        if (!matched) continue;
        collect(
          [
            {
              country: String(row.memberStateCode),
              month,
              product: matched,
              price,
              unit: String(row.organicUnit ?? "100kg"),
            },
          ],
          organicBucket,
        );
      }
    }
    const organic = serialise(organicBucket, products, months);
    // An organic tickbox that paints one country is not a comparison. The
    // same threshold as a product: at least a few countries or nothing.
    for (const [id, series] of Object.entries(organic)) {
      if (Object.keys(series).length < MIN_COUNTRIES) delete organic[id];
    }

    const offset = firstFilled(conventional, months.length);
    const withOrganic = new Set(Object.keys(organic));
    const catalogue: Product[] = products
      .filter((product) => conventional[slug(product)])
      .map((product) => {
        const curated = sector.products?.find(({ from }) => from === product);
        const detail = curated?.detail ?? sector.detail;
        return {
          id: slug(product),
          label: curated?.label ?? product,
          ...(detail ? { detail } : {}),
          ...(withOrganic.has(slug(product)) ? { organic: true } : {}),
        };
      });

    const data: SectorData = {
      id: sector.id,
      offset,
      products: catalogue,
      conventional: trim(conventional, offset),
      organic: trim(organic, offset),
    };

    // The gateway rate limits, and a country dropped after six attempts is a
    // country missing from the map. Losing one out of twenty-seven to a bad
    // afternoon is noise; losing a tenth of them is a worse map than the one
    // already committed, so that one stays.
    const existing = await readExisting(`${sector.id}.json`);
    const thinner = existing ? lostCoverage(data, existing) : null;
    if (existing && thinner) {
      console.warn(`${sector.id.padEnd(11)} kept the committed file: ${thinner}`);
      summaries.push({
        id: sector.id,
        label: sector.label,
        unit: sector.unit,
        note: sector.note,
        organic: Object.keys(existing.organic).length > 0,
      });
      continue;
    }

    await writeFile(
      new URL(`${sector.id}.json`, OUT_DIR),
      JSON.stringify(data),
    );

    summaries.push({
      id: sector.id,
      label: sector.label,
      unit: sector.unit,
      note: sector.note,
      organic: withOrganic.size > 0,
    });

    const reporting = new Set(
      Object.values(conventional).flatMap((series) => Object.keys(series)),
    );
    console.log(
      `${sector.id.padEnd(11)} ${String(catalogue.length).padStart(2)} products` +
        ` · ${String(reporting.size).padStart(2)} countries` +
        ` · from ${months[offset]}` +
        (withOrganic.size > 0 ? ` · organic on ${withOrganic.size}` : ""),
    );
  }

  // Every sector is read; the cached feeds are the largest thing in memory.
  responseCache.clear();

  const income = await fetchIncome();
  const borders = JSON.parse(
    await readFile(new URL("borders.json", OUT_DIR), "utf8"),
  ) as { features: { properties: { code: string; name: string } }[] };
  for (const feature of borders.features) {
    countries[feature.properties.code] ??= feature.properties.name;
  }

  const catalog: Catalog = {
    updated: new Date().toISOString(),
    months,
    sectors: summaries,
    countries: Object.fromEntries(
      MEMBER_STATES.map((code) => [code, countries[code] ?? code]),
    ),
    income,
  };
  await writeFile(new URL("index.json", OUT_DIR), JSON.stringify(catalog));
  console.log(
    `\nindex.json: ${months.length} months, ${Object.keys(income).length} countries with income`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
