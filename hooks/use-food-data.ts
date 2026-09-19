"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Catalog, SectorData } from "@/lib/types";

/**
 * Fetches one of the generated files, retrying a couple of times. A single
 * dropped request should not leave the map permanently empty, because nothing
 * in the app ever asks for that file again.
 */
async function loadJson<T>(path: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
      }
    }
  }
  throw lastError;
}

/** Loads the catalogue written by scripts/build-data.ts. */
export function useCatalog(): { catalog: Catalog | null; error: boolean } {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadJson<Catalog>("data/index.json")
      .then((payload) => {
        if (cancelled) return;
        setCatalog(payload);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, error };
}

/**
 * Loads the series behind the button on screen. A file per sector keeps the
 * first paint to what is showing rather than every price the Union publishes.
 * Usually that is one file; meat is three under one button, and the dropdown
 * cannot be drawn until all three have said what they hold.
 */
export function useSectors(sectorIds: readonly string[]): {
  sectors: Record<string, SectorData>;
  loading: boolean;
  error: boolean;
} {
  // The ids as one string, so the effect does not refire on an array that is
  // new every render.
  const key = sectorIds.join(",");
  const [loaded, setLoaded] = useState<Record<string, SectorData>>({});
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(
      key.split(",").map((id) => loadJson<SectorData>(`data/${id}.json`)),
    )
      .then((payloads) => {
        if (cancelled) return;
        setLoaded(Object.fromEntries(payloads.map((one) => [one.id, one])));
        // Coming back to a button that failed earlier has to clear it, or the
        // banner outlives the failure it was reporting.
        setFailedKey((failed) => (failed === key ? null : failed));
      })
      .catch(() => {
        if (!cancelled) setFailedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Derived rather than cleared on change, so switching button never paints
  // the previous sector's prices under the new one's name.
  const ready = key !== "" && key.split(",").every((id) => loaded[id]);
  const error = failedKey === key;
  return { sectors: ready ? loaded : {}, loading: !error && !ready, error };
}

/**
 * The theme the inline script in the layout settled on. It lives on the
 * document element rather than in React, because it has to be right before
 * the first paint, so React subscribes to it rather than owning it.
 */
const themeListeners = new Set<() => void>();

function subscribeToTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function isDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

/** The export has no theme to read, and light is the stylesheet's default. */
function isDarkOnServer(): boolean {
  return false;
}

export function useDarkMode(): [boolean, () => void] {
  const dark = useSyncExternalStore(
    subscribeToTheme,
    isDark,
    isDarkOnServer,
  );

  const toggle = () => {
    document.documentElement.dataset.theme = dark ? "light" : "dark";
    try {
      window.localStorage.setItem("food-theme", dark ? "light" : "dark");
    } catch {
      // A browser refusing storage still gets the theme for this visit.
    }
    for (const listener of themeListeners) listener();
  };

  return [dark, toggle];
}
