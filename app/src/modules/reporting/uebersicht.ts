/**
 * Übersicht unter den KPI-Karten: Verlauf, Fälligkeiten.
 * Reine Aggregation, kein I/O.
 */

import type { JournalEintrag } from "@/modules/journal/types";
import { buildBwaLight } from "./aggregate";
import {
  addDaysYmd,
  daysBetweenYmd,
  isDateInZeitraum,
  monthsInZeitraum,
} from "./periods";
import type { Zeitraum } from "./types";

export type VerlaufMonat = {
  key: string;
  von: string;
  bis: string;
  jahr: number;
  monat: number;
  label_kurz: string;
  label_lang: string;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ueberschuss_brutto: string;
};

export type FaelligkeitLage = "ueberfaellig" | "faellig_bald";

export type FaelligkeitEintrag = {
  rechnungId: string;
  rechnungsnummer: string;
  kundeName: string | null;
  faellig_am: string;
  offen: string;
  status: string;
  /** Ganze Tage; 0 wenn nicht überfällig oder ohne Datum. */
  tage_verzug: number;
  lage: FaelligkeitLage;
};

export type FaelligkeitenBlick = {
  heute: string;
  horizon_tage: number;
  horizon_bis: string;
  ueberfaellig: FaelligkeitEintrag[];
  bald: FaelligkeitEintrag[];
};

export type OffenerPostenBlick = {
  rechnungId: string;
  rechnungsnummer: string;
  kundeName: string | null;
  faellig_am: string;
  offen: string;
  status: string;
};

const MONAT_KURZ = new Intl.DateTimeFormat("de-DE", {
  month: "short",
  timeZone: "UTC",
});
const MONAT_LANG = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monatLabels(
  jahr: number,
  monat: number,
): { kurz: string; lang: string } {
  const d = new Date(Date.UTC(jahr, monat - 1, 1));
  return {
    kurz: MONAT_KURZ.format(d),
    lang: MONAT_LANG.format(d),
  };
}

/**
 * Originale außerhalb des Slices (anderer Monat derselben Ladung).
 */
function originaleFuerSlice(
  alle: JournalEintrag[],
  extra: JournalEintrag[],
): JournalEintrag[] {
  return [...extra, ...alle];
}

export function buildMonatlicheReihe(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  extraOriginale: JournalEintrag[] = [],
): VerlaufMonat[] {
  const monate = monthsInZeitraum(zeitraum);
  const extras = originaleFuerSlice(eintraege, extraOriginale);
  return monate.map((m) => {
    const slice = eintraege.filter((e) =>
      isDateInZeitraum(e.buchungsdatum, { von: m.von, bis: m.bis }),
    );
    const bwa = buildBwaLight(slice, { von: m.von, bis: m.bis }, extras);
    const labels = monatLabels(m.jahr, m.monat);
    return {
      key: m.key,
      von: m.von,
      bis: m.bis,
      jahr: m.jahr,
      monat: m.monat,
      label_kurz: labels.kurz,
      label_lang: labels.lang,
      einnahmen_brutto: bwa.einnahmen_brutto,
      ausgaben_brutto: bwa.ausgaben_brutto,
      ueberschuss_brutto: bwa.ergebnis_brutto,
    };
  });
}

export function buildFaelligkeiten(
  items: OffenerPostenBlick[],
  heute: string,
  horizonTage = 14,
): FaelligkeitenBlick {
  const horizon_bis = addDaysYmd(heute, horizonTage);
  const ueberfaellig: FaelligkeitEintrag[] = [];
  const bald: FaelligkeitEintrag[] = [];

  for (const p of items) {
    const faellig = (p.faellig_am ?? "").trim();
    if (faellig && faellig < heute) {
      ueberfaellig.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: faellig,
        offen: p.offen,
        status: p.status,
        tage_verzug: daysBetweenYmd(faellig, heute),
        lage: "ueberfaellig",
      });
      continue;
    }
    if (faellig && faellig >= heute && faellig <= horizon_bis) {
      bald.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: faellig,
        offen: p.offen,
        status: p.status,
        tage_verzug: 0,
        lage: "faellig_bald",
      });
      continue;
    }
    if (!faellig && p.status === "ueberfaellig") {
      ueberfaellig.push({
        rechnungId: p.rechnungId,
        rechnungsnummer: p.rechnungsnummer,
        kundeName: p.kundeName,
        faellig_am: "",
        offen: p.offen,
        status: p.status,
        tage_verzug: 0,
        lage: "ueberfaellig",
      });
    }
  }

  ueberfaellig.sort((a, b) => {
    if (a.tage_verzug !== b.tage_verzug) return b.tage_verzug - a.tage_verzug;
    if (a.faellig_am !== b.faellig_am) {
      return (a.faellig_am || "0000") < (b.faellig_am || "0000") ? -1 : 1;
    }
    return a.rechnungsnummer.localeCompare(b.rechnungsnummer, "de");
  });
  bald.sort((a, b) => {
    if (a.faellig_am !== b.faellig_am) {
      return a.faellig_am < b.faellig_am ? -1 : 1;
    }
    return a.rechnungsnummer.localeCompare(b.rechnungsnummer, "de");
  });

  return {
    heute,
    horizon_tage: horizonTage,
    horizon_bis,
    ueberfaellig,
    bald,
  };
}
