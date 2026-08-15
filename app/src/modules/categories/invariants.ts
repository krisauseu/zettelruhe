/**
 * Reine Domain-Invarianten Kategorien (ohne I/O).
 */

export const KATEGORIE_NAME_MAX = 120;

export const KATEGORIE_IN_VERWENDUNG_ERROR =
  "Kategorie wird noch an Belegen oder im Kassenbuch verwendet und kann nicht gelöscht werden. Deaktivieren Sie sie stattdessen.";

export const KATEGORIE_NAME_DOPPELT_ERROR =
  "Eine Kategorie mit diesem Namen existiert bereits.";

/** Trim + Whitespace zusammenziehen. */
export function normalizeKategorieName(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

export function kategorieNameKey(name: string): string {
  return normalizeKategorieName(name).toLocaleLowerCase("de-DE");
}

export type ValidatedKategorieInput = {
  name: string;
  aktiv: boolean;
  notiz: string;
};

export function validateKategorieInput(input: {
  name: string;
  aktiv?: boolean;
  notiz?: string;
}): ValidatedKategorieInput {
  const name = normalizeKategorieName(input.name);
  if (!name) {
    throw new Error("Name der Kategorie ist erforderlich.");
  }
  if (name.length > KATEGORIE_NAME_MAX) {
    throw new Error(`Name ist zu lang (max. ${KATEGORIE_NAME_MAX} Zeichen).`);
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  return {
    name,
    aktiv: input.aktiv !== false,
    notiz,
  };
}

/** Aktive Namen plus aktueller Schnappschuss, falls der nicht mehr in der Liste steht. */
export function kategorieNamenFuerSelect(
  namen: string[],
  aktuell?: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of namen) {
    const t = normalizeKategorieName(n);
    if (!t) continue;
    const key = kategorieNameKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  const cur = normalizeKategorieName(aktuell ?? "");
  if (cur && !seen.has(kategorieNameKey(cur))) {
    out.push(cur);
  }
  out.sort((a, b) => a.localeCompare(b, "de"));
  return out;
}
