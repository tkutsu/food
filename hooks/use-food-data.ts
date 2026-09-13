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
 * Loads one sector's series. A file per sector keeps the first paint to the
 * one sector on screen rather than every price the Union publishes.
 */
export function useSector(sectorId: string): {
  sector: SectorData | null;
  loading: boolean;
  error: boolean;
} {
  const [sector, setSector] = useState<SectorData | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadJson<SectorData>(`data/${sectorId}.json`)
      .then((payload) => {
        if (cancelled) return;
        setSector(payload);
        // Coming back to a sector that failed earlier has to clear it, or the
        // banner outlives the failure it was reporting.
        setFailedId((failed) => (failed === sectorId ? null : failed));
      })
      .catch(() => {
        if (!cancelled) setFailedId(sectorId);
      });
    return () => {
      cancelled = true;
    };
  }, [sectorId]);

  // Derived rather than cleared on change, so switching sector never paints
  // the previous sector's prices under the new one's name.
  const current = sector?.id === sectorId ? sector : null;
  const error = failedId === sectorId;
  return { sector: current, loading: !error && !current, error };
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
