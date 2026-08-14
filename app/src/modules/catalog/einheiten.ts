/** Standard-Einheiten für Katalog und Positionen (Funktionstest M1). */
export const KATALOG_EINHEITEN = [
  "Stück",
  "Stunde",
  "Artikel",
  "Karton",
  "Pauschal",
] as const;

export type KatalogEinheit = (typeof KATALOG_EINHEITEN)[number];

export function einheitOptionen(aktuell?: string): string[] {
  const current = (aktuell ?? "").trim();
  if (current && !KATALOG_EINHEITEN.includes(current as KatalogEinheit)) {
    return [...KATALOG_EINHEITEN, current];
  }
  return [...KATALOG_EINHEITEN];
}
