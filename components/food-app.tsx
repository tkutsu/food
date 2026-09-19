"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountryPanel } from "@/components/country-panel";
import { Legend } from "@/components/legend";
import { PriceMap } from "@/components/price-map";
import { SectorBar, type Choice } from "@/components/sector-bar";
import { Toggle } from "@/components/toggle";
import { useCatalog, useDarkMode, useSectors } from "@/hooks/use-food-data";
import { groupSectors } from "@/lib/groups";
import {
  asDaysOfIncome,
  groupAccent,
  buildScale,
  formatIncome,
  formatPrice,
  incomeFor,
  incomeUnitFor,
} from "@/lib/scale";
import type { Series } from "@/lib/types";
import {
  monthsCovered,
  yearAverages,
  yearToShow,
  yearsWithAverages,
} from "@/lib/yearly";

/** Playback pace. A month flickers past; a year is held long enough to read. */
const MONTH_STEP_MS = 90;
const YEAR_STEP_MS = 650;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTH_NAMES[Number(index) - 1]} ${year}`;
}

const MONTH_ABBREVIATIONS = MONTH_NAMES.map((name) => name.slice(0, 3));

/** "Aug", for saying which months a partial year covers. */
function monthName(month: string): string {
  return MONTH_ABBREVIATIONS[Number(month.slice(5, 7)) - 1];
}

/** "Aug 2026". Short enough to sit beside the timeline at any width. */
function shortMonth(month: string): string {
  const [year, index] = month.split("-");
  return `${MONTH_ABBREVIATIONS[Number(index) - 1]} ${year}`;
}

export function FoodApp() {
  const { catalog, error: catalogError } = useCatalog();
  const [dark, toggleDark] = useDarkMode();
  const [groupId, setGroupId] = useState("olive-oil");
  // The dropdown's value: which file, and which series in it.
  const [wantedChoice, setWantedChoice] = useState<string | null>(null);
  const [wantedMonth, setWantedMonth] = useState<string | null>(null);
  // Held as a year rather than an index, for the same reason as the month:
  // switching sector keeps you on the year you were looking at.
  const [wantedYear, setWantedYear] = useState<number | null>(null);
  const [organic, setOrganic] = useState(false);
  const [normalised, setNormalised] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  // A year's average is what most visitors want to compare, and it is steady:
  // no seasonal swing, no country missing because it filed late this month.
  // The monthly timeline is there for anyone who unticks it.
  const [yearly, setYearly] = useState(true);

  // The buttons in the top bar. Meat is three sectors under one of them; the
  // rest are one apiece, and nothing below cares which is which.
  const groups = useMemo(
    () => (catalog ? groupSectors(catalog.sectors) : []),
    [catalog],
  );
  const group = groups.find((entry) => entry.id === groupId) ?? null;
  const groupSectorIds = useMemo(
    () => group?.sectors.map((entry) => entry.id) ?? [],
    [group],
  );
  const { sectors, error: sectorError } = useSectors(groupSectorIds);
  const accent = groupAccent(groupId);

  /** Every series the button offers, across however many files it spans. */
  const choices: Choice[] = useMemo(
    () =>
      (group?.sectors ?? []).flatMap((entry) =>
        (sectors[entry.id]?.products ?? []).map((product) => ({
          key: `${entry.id}:${product.id}`,
          sectorId: entry.id,
          product,
        })),
      ),
    [group, sectors],
  );
  // Held rather than set, so a product that exists under the next button too
  // survives the switch and one that does not falls back to its first.
  const choice =
    choices.find((entry) => entry.key === wantedChoice) ??
    choices.find((entry) => entry.product.id === wantedChoice?.split(":")[1]) ??
    choices[0] ??
    null;
  const sector = choice ? (sectors[choice.sectorId] ?? null) : null;
  const summary = group?.sectors.find((entry) => entry.id === choice?.sectorId);
  const product = choice?.product ?? null;
  const productId = product?.id ?? "";
  const organicAvailable = product?.organic === true;
  const showOrganic = organic && organicAvailable;

  const months = useMemo(
    () => (catalog && sector ? catalog.months.slice(sector.offset) : []),
    [catalog, sector],
  );
  const series: Series = useMemo(() => {
    if (!sector || !productId) return {};
    const set = showOrganic ? sector.organic : sector.conventional;
    return set[productId] ?? {};
  }, [productId, sector, showOrganic]);

  const countryCodes = useMemo(
    () => Object.keys(catalog?.countries ?? {}),
    [catalog],
  );

  /** Turns a country's reported price into what the map is colouring by. */
  const valueAt = useCallback(
    (code: string, index: number): number | null => {
      const reported = series[code]?.[index];
      if (reported === null || reported === undefined) return null;
      if (!normalised) return reported;
      const income = incomeFor(catalog?.income[code], months[index] ?? "");
      return income ? asDaysOfIncome(reported, income) : null;
    },
    [catalog, months, normalised, series],
  );

  /**
   * The month the map opens on: the newest one that still has most of the
   * sector's countries in it. Not simply the newest with anything in it,
   * because sectors trail off rather than stop. Wine's last month holds one
   * country out of four, and opening on a map of one country is worse than
   * opening on a month that is a few behind.
   */
  const opensOn = useMemo(() => {
    const counts = months.map(
      (_, index) =>
        countryCodes.filter((code) => valueAt(code, index) !== null).length,
    );
    const fullest = Math.max(0, ...counts);
    if (fullest === 0) return Math.max(months.length - 1, 0);
    const enough = Math.max(1, Math.ceil(fullest * 0.6));
    for (let index = counts.length - 1; index >= 0; index -= 1) {
      if (counts[index] >= enough) return index;
    }
    return Math.max(months.length - 1, 0);
  }, [countryCodes, months, valueAt]);

  const wantedIndex = wantedMonth ? months.indexOf(wantedMonth) : -1;
  const monthIndex = wantedIndex === -1 ? opensOn : wantedIndex;
  const month = months[monthIndex] ?? "";

  /** The years the yearly timeline steps through, oldest first. */
  const years = useMemo(
    () => yearsWithAverages(series, months),
    [months, series],
  );
  /** Where the yearly timeline opens: the newest year most countries filed. */
  const opensOnYear = useMemo(
    () => yearToShow(series, months),
    [months, series],
  );
  const year =
    wantedYear !== null && years.includes(wantedYear) ? wantedYear : opensOnYear;
  const yearIndex = year === null ? 0 : Math.max(years.indexOf(year), 0);
  const showYear = yearly && year !== null;

  /**
   * The months the year on screen actually spans. For the year in progress
   * that is January to last month, and the panel says so: an average that
   * is missing its autumn should not pass for a whole year.
   */
  const covered = useMemo(
    () => (year === null ? null : monthsCovered(months, year)),
    [months, year],
  );
  const partialYear =
    covered !== null &&
    !(covered.first.endsWith("-01") && covered.last.endsWith("-12"));
  const yearLabel =
    year === null
      ? ""
      : partialYear && covered
        ? `${year} average, ${monthName(covered.first)} to ${monthName(covered.last)}`
        : `${year} average`;

  const averages = useMemo(
    () => (year === null ? {} : yearAverages(series, months, year)),
    [months, series, year],
  );

  const values = useMemo(() => {
    const current: Record<string, number | null> = {};
    for (const code of countryCodes) {
      if (!showYear) {
        current[code] = valueAt(code, monthIndex);
        continue;
      }
      const average = averages[code];
      if (average === undefined) {
        current[code] = null;
      } else if (!normalised) {
        current[code] = average;
      } else {
        // Eurostat's income is itself a yearly figure, so a year's average
        // price meets exactly the income it should be divided by.
        const income = incomeFor(catalog?.income[code], `${year}-12`);
        current[code] = income ? asDaysOfIncome(average, income) : null;
      }
    }
    return current;
  }, [
    averages, catalog, countryCodes, monthIndex, normalised, showYear,
    valueAt, year,
  ]);

  /** Where the panel's marker sits: the month on screen, or the year's last. */
  const markerIndex =
    showYear && covered ? months.indexOf(covered.last) : monthIndex;

  /**
   * The scale describes the month on screen, not the whole run. Twenty-one
   * years of food prices trend far harder than countries differ from each
   * other in any one month: beef spans 430 to 796 euro across the Union in
   * August 2026, a spread of under two to one that holds throughout, while
   * the same series doubles over the period. One scale for the whole timeline
   * therefore spends six of its seven colours on the past and paints the
   * present in a single flat shade.
   *
   * The cost is that a country changing colour during playback means it moved
   * relative to the rest of Europe rather than in absolute terms. The legend
   * carries the month's own range so the shift is never hidden, and the panel
   * draws the country's real series behind its number.
   */
  const scale = useMemo(() => {
    const present: number[] = [];
    for (const code of countryCodes) {
      const value = values[code];
      if (value !== null && value !== undefined) present.push(value);
    }
    return buildScale(present);
  }, [countryCodes, values]);

  /**
   * One unit for the whole series, not for the month on screen, because a
   * legend that flips between minutes and hours mid-playback cannot be read.
   *
   * Chosen from the median rather than the largest value. Milk's dearest
   * reading in twenty-one years just crosses an hour, which under a
   * largest-value rule labelled the entire sector in hours and printed
   * "0.10 hours" for a litre of milk today. The median suits the numbers a
   * visitor actually sees, and the rare outlier simply reads large.
   */
  const incomeUnit = useMemo(() => {
    if (!normalised) return incomeUnitFor(0);
    const all: number[] = [];
    for (let index = 0; index < months.length; index += 1) {
      for (const code of countryCodes) {
        const value = valueAt(code, index);
        if (value !== null) all.push(value);
      }
    }
    if (all.length === 0) return incomeUnitFor(0);
    all.sort((a, b) => a - b);
    return incomeUnitFor(all[Math.floor(all.length / 2)]);
  }, [countryCodes, months.length, normalised, valueAt]);

  const format = useCallback(
    (value: number) =>
      normalised ? formatIncome(value, incomeUnit) : formatPrice(value),
    [incomeUnit, normalised],
  );

  const label = useCallback(
    (code: string, fallbackName: string) => {
      const name = catalog?.countries[code] ?? fallbackName;
      const value = values[code];
      return value === null || value === undefined
        ? `${name} — not reported`
        : `${name} — ${format(value)}`;
    },
    [catalog, format, values],
  );

  // The timeline steps through years when the yearly average is on and
  // through months when it is off; everything below works on whichever.
  const stepCount = showYear ? years.length : months.length;
  const stepIndex = showYear ? yearIndex : monthIndex;

  const goToStep = useCallback(
    (index: number) => {
      if (showYear) setWantedYear(years[index] ?? null);
      else setWantedMonth(months[index] ?? null);
    },
    [months, showYear, years],
  );

  // Playback walks the timeline without the timer depending on every render.
  const indexRef = useRef(stepIndex);
  useEffect(() => {
    indexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    if (!playing || stepCount === 0) return;
    const timer = setInterval(
      () => {
        const next = indexRef.current + 1;
        if (next >= stepCount) {
          setPlaying(false);
          return;
        }
        indexRef.current = next;
        goToStep(next);
      },
      showYear ? YEAR_STEP_MS : MONTH_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [goToStep, playing, showYear, stepCount]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stepIndex >= stepCount - 1) goToStep(0);
    setPlaying(true);
  };

  /**
   * Switching granularity keeps your place, once you have moved off the
   * default: a month in 2019 becomes the 2019 average, and the 2019 average
   * becomes the last month of 2019. Left on the defaults, each mode opens on its own
   * newest well-covered step instead.
   */
  const changeYearly = (value: boolean) => {
    setPlaying(false);
    if (value && wantedMonth) {
      setWantedYear(Number(wantedMonth.slice(0, 4)));
    } else if (!value && wantedYear !== null && year !== null) {
      if (covered) setWantedMonth(covered.last);
    }
    setYearly(value);
  };

  const changeGroup = (id: string) => {
    setPlaying(false);
    setGroupId(id);
  };

  const missing = countryCodes.some((code) => values[code] === null);
  const selectedValue = selected ? values[selected] : null;
  const history = useMemo(
    () =>
      selected
        ? months.map((_, index) => valueAt(selected, index))
        : [],
    [months, selected, valueAt],
  );
  /** The series drawn dashed: whichever of the two is not on the map. */
  const compareHistory = useMemo(() => {
    if (!selected || !sector || !productId || !organicAvailable) return undefined;
    const set = showOrganic ? sector.conventional : sector.organic;
    const other = set[productId]?.[selected];
    if (!other) return undefined;
    return months.map((_, index) => {
      const reported = other[index];
      if (reported === null || reported === undefined) return null;
      if (!normalised) return reported;
      const income = incomeFor(catalog?.income[selected], months[index] ?? "");
      return income ? asDaysOfIncome(reported, income) : null;
    });
  }, [
    catalog, months, normalised, organicAvailable, productId,
    sector, selected, showOrganic,
  ]);

  /**
   * The organic gap for the month on screen. Organic is usually dearer but
   * not always, and a month where it is cheaper is worth seeing rather than
   * hiding, so the wording carries the sign.
   */
  const premium = useMemo(() => {
    if (!selected || !organicAvailable || !sector || !productId) return null;
    const pick = (set: Record<string, Series>) =>
      showYear
        ? yearAverages(set[productId] ?? {}, months, year!)[selected]
        : set[productId]?.[selected]?.[monthIndex];
    const conventionalValue = pick(sector.conventional);
    const organicValue = pick(sector.organic);
    if (!conventionalValue || !organicValue) return null;
    const share = Math.round((organicValue / conventionalValue - 1) * 100);
    if (share === 0) return "the same";
    return share > 0 ? `${share}% more` : `${-share}% less`;
  }, [
    monthIndex, months, organicAvailable, productId, sector, selected,
    showYear, year,
  ]);

  return (
    <main className="relative h-dvh overflow-hidden">
      <PriceMap
        dark={dark}
        groupId={groupId}
        label={label}
        onSelect={setSelected}
        scale={scale}
        selected={selected}
        values={values}
      />

      {catalog && (
        <SectorBar
          accent={accent}
          choiceKey={choice?.key ?? ""}
          choices={choices}
          groupId={groupId}
          groups={groups}
          normalised={normalised}
          onChoice={(key) => setWantedChoice(key)}
          onGroup={changeGroup}
          onNormalised={setNormalised}
          onOrganic={setOrganic}
          organic={showOrganic}
          organicAvailable={organicAvailable}
        />
      )}

      <button
        aria-label={dark ? "Switch to light" : "Switch to dark"}
        className="absolute top-2 right-2 z-[501] flex size-8 items-center justify-center rounded-full border border-ink/20 bg-paper/95 text-ink/70 shadow backdrop-blur-sm transition hover:text-ink sm:top-3 sm:right-3"
        onClick={toggleDark}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
          )}
        </svg>
      </button>

      <Legend
        caption={
          normalised
            ? `of a median income, per ${summary?.unit ?? ""}`
            : `per ${summary?.unit ?? ""}`
        }
        format={format}
        groupId={groupId}
        scale={scale}
        showMissing={missing}
      />

      {/* Timeline, across the bottom */}
      {months.length > 0 && (
        <div className="pointer-events-none absolute inset-x-2 bottom-8 z-[500] flex items-center gap-2 sm:inset-x-auto sm:left-2 sm:w-[min(36rem,70vw)]">
          <Toggle
            accent={accent}
            checked={yearly}
            // "Yearly" alone on a phone: the full label cost the slider
            // beside it all but 44 pixels at 375 wide.
            label={
              <>
                <span className="sm:hidden">Yearly</span>
                <span className="hidden sm:inline">Yearly average</span>
              </>
            }
            onChange={changeYearly}
            tall
            title={
              yearly
                ? "The timeline steps through yearly averages; untick for months"
                : "Tick to step through yearly averages instead of months"
            }
          />
          <button
            aria-label={
              playing ? "Pause" : showYear ? "Play the years" : "Play the months"
            }
            className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full border border-ink/20 bg-paper/95 shadow transition hover:bg-paper"
            style={{ color: accent }}
            onClick={togglePlay}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              {playing ? (
                <path d="M7 5h4v14H7zm6 0h4v14h-4z" />
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>
          <div className="pointer-events-auto flex h-10 min-w-0 flex-1 items-center gap-3 rounded-full border border-ink/20 bg-paper/95 px-4 shadow-lg backdrop-blur-sm">
            <input
              aria-label={showYear ? "Year" : "Month"}
              aria-valuetext={
                showYear ? yearLabel : month ? monthLabel(month) : ""
              }
              className="min-w-0 flex-1"
              style={{ accentColor: accent }}
              max={Math.max(stepCount - 1, 0)}
              min={0}
              onChange={(event) => {
                setPlaying(false);
                goToStep(Number(event.target.value));
              }}
              step={1}
              type="range"
              value={stepIndex}
            />
            {/* Fixed width, so a narrow month like May and a wide one like
                Sep do not move the slider's right edge between frames. The
                gap takes up the difference instead. */}
            <span className="w-[4.5rem] shrink-0 text-right text-xs font-semibold tabular-nums">
              {showYear ? `${year} avg` : month ? shortMonth(month) : "--"}
            </span>
          </div>
        </div>
      )}

      {/* The panel, and the note about what the numbers are */}
      <div className="pointer-events-none absolute right-2 bottom-20 z-[501] flex flex-col items-end gap-2 sm:bottom-24">
        {selected && catalog && summary && (
          <CountryPanel
            // The product is named only when the button offers a choice;
            // "per kg, Milk" under the Milk button says nothing twice.
            caption={`${normalised ? "of a median income, " : ""}per ${summary.unit}${
              product && choices.length > 1 ? `, ${product.label.toLowerCase()}` : ""
            }`}
            detail={product?.detail}
            headline={selectedValue === null ? null : format(selectedValue)}
            history={history}
            monthIndex={markerIndex}
            monthLabel={showYear ? yearLabel : month ? shortMonth(month) : ""}
            accent={accent}
            name={catalog.countries[selected] ?? selected}
            onClose={() => setSelected(null)}
            compareHistory={compareHistory}
            compareLabel={showOrganic ? "conventional" : "organic"}
            organicPremium={premium}
          />
        )}
      </div>

      {(catalogError || sectorError) && (
        <div className="absolute bottom-2 left-1/2 z-[502] flex -translate-x-1/2 items-center gap-3 bg-red-50 px-3 py-1.5 text-xs text-red-900 shadow">
          <span>
            {catalogError
              ? "The price data did not load."
              : `The ${group?.label.toLowerCase() ?? "sector"} prices did not load.`}
          </span>
          <button
            className="border-0 bg-transparent p-0 font-bold text-red-900 underline"
            onClick={() => window.location.reload()}
            type="button"
          >
            Reload
          </button>
        </div>
      )}
    </main>
  );
}
