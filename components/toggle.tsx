"use client";

import { ACCENT_INK } from "@/lib/scale";

import type { ReactNode } from "react";

/** A tickbox dressed as a pill, wearing the sector's colour when ticked. */
export function Toggle({
  accent,
  checked,
  label,
  onChange,
  title,
  tall = false,
}: {
  accent: string;
  checked: boolean;
  label: ReactNode;
  onChange: (value: boolean) => void;
  title?: string;
  /** Matches the timeline's taller controls rather than the top row's. */
  tall?: boolean;
}) {
  return (
    <label
      className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border text-xs font-semibold shadow backdrop-blur-sm transition ${
        tall ? "pointer-events-auto h-10 px-4" : "h-8 px-3"
      } ${
        checked
          ? "border-transparent"
          : "border-ink/20 bg-paper/95 text-ink/70 hover:text-ink"
      }`}
      style={checked ? { backgroundColor: accent, color: ACCENT_INK } : undefined}
      title={title}
    >
      <input
        checked={checked}
        className="size-3.5"
        onChange={(event) => onChange(event.target.checked)}
        style={{ accentColor: accent }}
        type="checkbox"
      />
      {label}
    </label>
  );
}
