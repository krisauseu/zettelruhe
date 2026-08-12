/**
 * Reine Aggregationen über Journal-Zeilen (ohne I/O).
 * Journal = Source of Truth für gebuchte Beträge (ADR-0004).
 * Storno-Gegenbuchungen sind normale Zeilen mit invertierter Richtung —
 * Summen bilden Netto-Effekt korrekt ab, ohne Sonderlogik.
 */

import { money, moneyToString, subMoney, sumMoney } from "@/lib/money";
import type { JournalEintrag, Steuersatz } from "@/modules/journal/types";
import type { Steuermodus } from "@/lib/pb";
import type {
  BwaLight,
  DashboardKennzahlen,
  EurAuswertung,
  EurKategorieId,
  EurKategorieZeile,
  UstSatzZeile,
  UstUebersicht,
  Zeitraum,
} from "./types";

export const JOURNAL_BASIS_HINWEIS =
  "Grundlage ist das festgeschriebene Buchungsjournal (Belege, Rechnungen, Kasse, manuell, Storno). Zahlungen auf Rechnungen erzeugen in v1 kein Journal-Eintrag (Ist-Versteuerung Follow-up) und fließen hier nicht ein.";

const EUR_META: Record<
  EurKategorieId,
  { label: string; richtung: "einnahme" | "ausgabe" }
> = {
  umsatzerloese: { label: "Umsatzerlöse (Rechnungen)", richtung: "einnahme" },
  bareinnahmen: { label: "Bareinnahmen (Kassenbuch)", richtung: "einnahme" },
  sonstige_einnahmen: {
    label: "Sonstige Einnahmen",
    richtung: "einnahme",
  },
  betriebsausgaben: {
    label: "Betriebsausgaben (Belege)",
    richtung: "ausgabe",
  },
  barausgaben: { label: "Barausgaben (Kassenbuch)", richtung: "ausgabe" },
  sonstige_ausgaben: { label: "Sonstige Ausgaben", richtung: "ausgabe" },
};

/** Light-Mapping Journal-Zeile → EÜR-Kategorie */
export function mapEurKategorie(e: JournalEintrag): EurKategorieId {
  if (e.richtung === "einnahme") {
    if (e.quelle_typ === "rechnung") return "umsatzerloese";
    if (e.quelle_typ === "kasse") return "bareinnahmen";
    return "sonstige_einnahmen";
  }
  // ausgabe
  if (e.quelle_typ === "beleg") return "betriebsausgaben";
  if (e.quelle_typ === "kasse") return "barausgaben";
  return "sonstige_ausgaben";
}

function emptyKategorie(id: EurKategorieId): EurKategorieZeile {
  const meta = EUR_META[id];
  return {
    id,
    label: meta.label,
    richtung: meta.richtung,
    summe_brutto: "0.00",
    summe_netto: "0.00",
    summe_ust: "0.00",
    anzahl: 0,
  };
}

type Acc = {
  brutto: ReturnType<typeof money>;
  netto: ReturnType<typeof money>;
  ust: ReturnType<typeof money>;
  anzahl: number;
};

function emptyAcc(): Acc {
  return { brutto: money(0), netto: money(0), ust: money(0), anzahl: 0 };
}

function accAdd(a: Acc, e: JournalEintrag): void {
  a.brutto = a.brutto.plus(money(e.betrag_brutto));
  a.netto = a.netto.plus(money(e.betrag_netto));
  a.ust = a.ust.plus(money(e.betrag_ust));
  a.anzahl += 1;
}

function accToZeile(id: EurKategorieId, a: Acc): EurKategorieZeile {
  const base = emptyKategorie(id);
  return {
    ...base,
    summe_brutto: moneyToString(a.brutto),
    summe_netto: moneyToString(a.netto),
    summe_ust: moneyToString(a.ust),
    anzahl: a.anzahl,
  };
}

/** EÜR light aus Journal-Zeilen (bereits zeitraum-gefiltert) */
export function buildEur(eintraege: JournalEintrag[], zeitraum: Zeitraum): EurAuswertung {
  const ids = Object.keys(EUR_META) as EurKategorieId[];
  const map = new Map<EurKategorieId, Acc>();
  for (const id of ids) map.set(id, emptyAcc());

  for (const e of eintraege) {
    const kat = mapEurKategorie(e);
    accAdd(map.get(kat)!, e);
  }

  const einnahmenIds: EurKategorieId[] = [
    "umsatzerloese",
    "bareinnahmen",
    "sonstige_einnahmen",
  ];
  const ausgabenIds: EurKategorieId[] = [
    "betriebsausgaben",
    "barausgaben",
    "sonstige_ausgaben",
  ];

  const einnahmen = einnahmenIds.map((id) => accToZeile(id, map.get(id)!));
  const ausgaben = ausgabenIds.map((id) => accToZeile(id, map.get(id)!));

  const sumEinB = sumMoney(...einnahmen.map((z) => z.summe_brutto));
  const sumAusB = sumMoney(...ausgaben.map((z) => z.summe_brutto));
  const sumEinN = sumMoney(...einnahmen.map((z) => z.summe_netto));
  const sumAusN = sumMoney(...ausgaben.map((z) => z.summe_netto));

  return {
    zeitraum,
    einnahmen,
    ausgaben,
    summe_einnahmen_brutto: moneyToString(sumEinB),
    summe_ausgaben_brutto: moneyToString(sumAusB),
    ueberschuss_brutto: moneyToString(subMoney(sumEinB, sumAusB)),
    summe_einnahmen_netto: moneyToString(sumEinN),
    summe_ausgaben_netto: moneyToString(sumAusN),
    ueberschuss_netto: moneyToString(subMoney(sumEinN, sumAusN)),
    anzahl_buchungen: eintraege.length,
    hinweis_journal_basis: JOURNAL_BASIS_HINWEIS,
  };
}

function steuersatzKey(s: JournalEintrag["steuersatz"]): Steuersatz | "ohne" {
  if (s === "0" || s === "7" || s === "19") return s;
  return "ohne";
}

/** USt-Übersicht light — nur bei Regelbesteuerung sinnvoll */
export function buildUstUebersicht(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  steuermodus: Steuermodus,
): UstUebersicht {
  if (steuermodus === "kleinunternehmer") {
    return {
      zeitraum,
      steuermodus,
      verfuegbar: false,
      zeilen: [],
      summe_ust_einnahmen: "0.00",
      summe_vorsteuer: "0.00",
      zahllast: "0.00",
      hinweis:
        "Unter der Kleinunternehmerregelung (§ 19 UStG) entfällt die USt-Übersicht als Arbeitsflow. Es wird keine Umsatzsteuer ausgewiesen oder abgeführt.",
    };
  }

  type UAcc = {
    ust_einnahmen: ReturnType<typeof money>;
    vorsteuer: ReturnType<typeof money>;
    netto_einnahmen: ReturnType<typeof money>;
    netto_ausgaben: ReturnType<typeof money>;
  };
  const bySatz = new Map<Steuersatz | "ohne", UAcc>();

  function get(s: Steuersatz | "ohne"): UAcc {
    let a = bySatz.get(s);
    if (!a) {
      a = {
        ust_einnahmen: money(0),
        vorsteuer: money(0),
        netto_einnahmen: money(0),
        netto_ausgaben: money(0),
      };
      bySatz.set(s, a);
    }
    return a;
  }

  for (const e of eintraege) {
    const k = steuersatzKey(e.steuersatz);
    const a = get(k);
    if (e.richtung === "einnahme") {
      a.ust_einnahmen = a.ust_einnahmen.plus(money(e.betrag_ust));
      a.netto_einnahmen = a.netto_einnahmen.plus(money(e.betrag_netto));
    } else {
      a.vorsteuer = a.vorsteuer.plus(money(e.betrag_ust));
      a.netto_ausgaben = a.netto_ausgaben.plus(money(e.betrag_netto));
    }
  }

  const order: (Steuersatz | "ohne")[] = ["19", "7", "0", "ohne"];
  const zeilen: UstSatzZeile[] = [];
  for (const s of order) {
    const a = bySatz.get(s);
    if (!a) continue;
    if (
      a.ust_einnahmen.isZero() &&
      a.vorsteuer.isZero() &&
      a.netto_einnahmen.isZero() &&
      a.netto_ausgaben.isZero()
    ) {
      continue;
    }
    zeilen.push({
      steuersatz: s,
      ust_einnahmen: moneyToString(a.ust_einnahmen),
      vorsteuer: moneyToString(a.vorsteuer),
      netto_einnahmen: moneyToString(a.netto_einnahmen),
      netto_ausgaben: moneyToString(a.netto_ausgaben),
    });
  }

  const sumUst = sumMoney(...zeilen.map((z) => z.ust_einnahmen));
  const sumVst = sumMoney(...zeilen.map((z) => z.vorsteuer));
  const zahllast = subMoney(sumUst, sumVst);

  return {
    zeitraum,
    steuermodus,
    verfuegbar: true,
    zeilen,
    summe_ust_einnahmen: moneyToString(sumUst),
    summe_vorsteuer: moneyToString(sumVst),
    zahllast: moneyToString(zahllast),
    hinweis:
      "USt-Übersicht light aus dem Buchungsjournal (Buchungsdatum). Vorbereitung für Mein Elster — kein ELSTER-Versand. " +
      JOURNAL_BASIS_HINWEIS +
      " Bei Ist-Versteuerung kann die Zahllast daher von Zahlungseingängen abweichen, solange Zahlungen kein Journal erzeugen.",
  };
}

export function buildBwaLight(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
): BwaLight {
  let ein = money(0);
  let aus = money(0);
  for (const e of eintraege) {
    if (e.richtung === "einnahme") {
      ein = ein.plus(money(e.betrag_brutto));
    } else {
      aus = aus.plus(money(e.betrag_brutto));
    }
  }
  return {
    zeitraum,
    einnahmen_brutto: moneyToString(ein),
    ausgaben_brutto: moneyToString(aus),
    ergebnis_brutto: moneyToString(subMoney(ein, aus)),
  };
}

export function buildDashboard(
  eintraege: JournalEintrag[],
  zeitraum: Zeitraum,
  steuermodus: Steuermodus,
  offenePosten: { summe: string; anzahl: number },
): DashboardKennzahlen {
  const bwa = buildBwaLight(eintraege, zeitraum);
  const ust =
    steuermodus === "regelbesteuerung_ist"
      ? buildUstUebersicht(eintraege, zeitraum, steuermodus)
      : null;

  return {
    zeitraum,
    steuermodus,
    einnahmen_brutto: bwa.einnahmen_brutto,
    ausgaben_brutto: bwa.ausgaben_brutto,
    ueberschuss_brutto: bwa.ergebnis_brutto,
    offene_posten_summe: moneyToString(money(offenePosten.summe)),
    offene_posten_anzahl: offenePosten.anzahl,
    ust_zahllast: ust?.verfuegbar ? ust.zahllast : null,
    anzahl_buchungen: eintraege.length,
  };
}

/** Summe offener Posten (decimal-sicher) */
export function sumOffenePosten(
  items: { offen: string }[],
): { summe: string; anzahl: number } {
  const summe = sumMoney(...items.map((i) => i.offen));
  return { summe: moneyToString(summe), anzahl: items.length };
}
