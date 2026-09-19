import type { SectorSummary } from "@/lib/types";

/**
 * Buttons in the top bar. Nearly every button is one sector, but the
 * Commission publishes cattle, pigs and sheep as three separate feeds and a
 * shopper walks past one counter, so those three sit under one name with the
 * animal in the dropdown.
 *
 * This is presentation and nothing more. The three keep their own files, their
 * own months and their own products; only the button and the colour are
 * shared, and the map still draws one series from one sector at a time.
 */
const GROUPS: readonly { id: string; label: string; sectors: readonly string[] }[] =
  [{ id: "meat", label: "Meat", sectors: ["beef", "pigmeat", "lamb"] }];

export interface SectorGroup {
  id: string;
  label: string;
  /** The sectors behind the button, in the order the dropdown lists them. */
  sectors: SectorSummary[];
}

/**
 * The catalogue's sectors as buttons. A grouped one takes the place of the
 * first of its members, so the bar keeps the catalogue's order otherwise.
 */
export function groupSectors(
  sectors: readonly SectorSummary[],
): SectorGroup[] {
  const groups: SectorGroup[] = [];
  const placed = new Set<string>();

  for (const sector of sectors) {
    const definition = GROUPS.find((group) =>
      group.sectors.includes(sector.id),
    );
    if (!definition) {
      groups.push({ id: sector.id, label: sector.label, sectors: [sector] });
      continue;
    }
    if (placed.has(definition.id)) continue;
    placed.add(definition.id);
    // Built from the definition rather than the catalogue, so the dropdown
    // reads beef, veal, pork, lamb whatever order the sectors arrived in.
    const members = definition.sectors
      .map((id) => sectors.find((entry) => entry.id === id))
      .filter((entry): entry is SectorSummary => entry !== undefined);
    if (members.length > 0) {
      groups.push({ id: definition.id, label: definition.label, sectors: members });
    }
  }

  return groups;
}
