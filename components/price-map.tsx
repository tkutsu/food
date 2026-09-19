"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSON, Map as LeafletMap, Path, PathOptions } from "leaflet";
import { NO_DATA_FILL, colorFor, type Scale } from "@/lib/scale";
import type { Bounds } from "@/lib/types";

interface PriceMapProps {
  /** Country code to the value being coloured, null where none was reported. */
  values: Record<string, number | null>;
  scale: Scale | null;
  /** Which button's hue the ramp is drawn from. */
  groupId: string;
  dark: boolean;
  selected: string | null;
  /**
   * Renders the hover label. The name comes from the border file, so
   * countries outside the price data are still named rather than coded.
   */
  label: (code: string, name: string) => string;
  onSelect: (code: string | null) => void;
}

/** Wide enough for Portugal and Cyprus at once, which is the whole map. */
const EUROPE: Bounds = [
  [34.5, -10.5],
  [60.5, 33],
];

const BORDER_LIGHT = "#f4f3ee";
const BORDER_DARK = "#101715";

export function PriceMap({
  values,
  scale,
  groupId,
  dark,
  selected,
  label,
  onSelect,
}: PriceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<Map<string, Path>>(new Map());
  const namesRef = useRef<Map<string, string>>(new Map());
  const selectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    const layers = layersRef.current;
    const names = namesRef.current;

    const initialize = async () => {
      const [L, response] = await Promise.all([
        import("leaflet"),
        fetch("data/borders.json"),
      ]);
      if (cancelled || !containerRef.current) return;
      const borders = (await response.json()) as Parameters<
        typeof L.geoJSON
      >[0];
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        minZoom: 3,
        maxZoom: 8,
        zoomControl: true,
        attributionControl: true,
      });
      map.attributionControl.setPrefix(false);
      map.fitBounds(EUROPE);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        // The basemap's licence, and nothing else. Where the prices and the
        // incomes come from is the panel's job and the readme's; repeating it
        // in the corner of the map only crowded the coastline.
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 8,
      }).addTo(map);

      const geo: GeoJSON = L.geoJSON(borders, {
        onEachFeature: (feature, layer) => {
          const code = String(feature.properties?.code ?? "");
          names.set(code, String(feature.properties?.name ?? code));
          layers.set(code, layer as Path);
          layer.on("click", () => selectRef.current(code));
          layer.bindTooltip("", { sticky: true, direction: "top" });
        },
      }).addTo(map);
      // Clicking the sea is how you put the panel away.
      map.on("click", (event) => {
        if (!(event.originalEvent.target instanceof SVGPathElement)) {
          selectRef.current(null);
        }
      });
      void geo;

      mapRef.current = map;
      setReady(true);

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (!cancelled) map.invalidateSize({ animate: false, pan: false });
        });
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    };

    let disconnect: (() => void) | undefined;
    void initialize().then((cleanup) => {
      if (cancelled) {
        cleanup?.();
        return;
      }
      disconnect = cleanup;
    });

    return () => {
      cancelled = true;
      disconnect?.();
      mapRef.current?.remove();
      mapRef.current = null;
      layers.clear();
      names.clear();
    };
  }, []);

  /** Repaints every country. Runs on each timeline step, so it only styles. */
  useEffect(() => {
    if (!ready) return;
    const border = dark ? BORDER_DARK : BORDER_LIGHT;

    for (const [code, layer] of layersRef.current) {
      const value = values[code];
      const reported = value !== null && value !== undefined;
      const isSelected = code === selected;
      // A country with no price is drawn hollow, behind a dashed edge, rather
      // than in a pale fill. The palest step of every ramp is within a few
      // units of a flat wash once both are composited over the basemap, so a
      // fill would let the cheapest country in Europe read as an empty one.
      const style: PathOptions = reported
        ? {
            fillColor: colorFor(value, scale, groupId),
            fillOpacity: 0.92,
            color: isSelected ? (dark ? "#ffffff" : "#14211f") : border,
            weight: isSelected ? 2.5 : 0.8,
            opacity: 1,
            dashArray: undefined,
          }
        : {
            fillColor: NO_DATA_FILL,
            fillOpacity: 0.07,
            color: NO_DATA_FILL,
            weight: isSelected ? 2 : 1,
            opacity: 0.8,
            dashArray: "2 3",
          };
      layer.setStyle(style);
      layer.setTooltipContent(label(code, namesRef.current.get(code) ?? code));
      if (isSelected) layer.bringToFront();
    }
  }, [dark, groupId, label, ready, scale, selected, values]);

  return (
    <div
      aria-label="Map of European food prices"
      className="absolute inset-0 z-0"
      ref={containerRef}
    />
  );
}
