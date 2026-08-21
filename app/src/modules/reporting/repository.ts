/**
 * Reporting-Repository: reine Reads + Download-Artefakte.
 * Keine Journal-/Beleg-Mutationen (ADR-0006).
 */

import { getFirmaById } from "@/lib/pb";
import type { Steuermodus } from "@/lib/pb";
import { getJournalEintrag, listJournal } from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  listBelege,
  listBelegeByIds,
  getBelegDateiResponse,
} from "@/modules/expenses/repository";
import type { Beleg } from "@/modules/expenses/types";
import { listKassenbuchByIds } from "@/modules/cash/repository";
import { getKontakt } from "@/modules/contacts/repository";
import { getAktuellePruefungenFuerKontakte } from "@/modules/ustid";
import { listOffenePosten } from "@/modules/payments/repository";
import {
  buildDashboard,
  buildEur,
  buildBwaLight,
  buildUstUebersicht,
  sumOffenePosten,
} from "./aggregate";
import { buildPar19Waechter, type Par19Waechter } from "./par19";
import {
  buildAusgabenNachKategorien,
  buildFaelligkeiten,
  buildLetzteBuchungen,
  buildMonatlicheReihe,
  LETZTE_BUCHUNGEN_ANZAHL,
  monatKategorienLabel,
  quartalKategorienLabel,
  sammelnKategorieQuelleIds,
  type AusgabenKategorienBlick,
  type FaelligkeitenBlick,
  type KategorieSchnappschuesse,
  type LetzteBuchung,
  type VerlaufMonat,
} from "./uebersicht";
import {
  buildUstvaDatensatz,
  firmaToUstvaAngaben,
  serializeUstvaXml,
} from "./ustva";
import { buildZmUebersicht, serializeZmCsv } from "./zm";
import { serializeJournalCsv, serializeBelegArchivCsv } from "./export-csv";
import { datevFilename, serializeDatevCsv } from "./export-datev";
import { buildZip, type ZipEntry } from "./zip";
import {
  isDateInZeitraum,
  periodLastNMonths,
  periodMonth,
  periodQuarter,
  periodYear,
  todayBerlin,
  validateZeitraum,
} from "./periods";
import type {
  BelegArchivMeta,
  BwaLight,
  DashboardKennzahlen,
  EurAuswertung,
  UstUebersicht,
  UstvaDatensatz,
  ZmKontaktBlick,
  ZmUebersicht,
  Zeitraum,
} from "./types";

/** Alle Journal-Zeilen im Zeitraum (Seitenweise, Solo-Volumen) */
export async function listJournalInZeitraum(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<JournalEintrag[]> {
  const z = validateZeitraum(zeitraum);
  const items: JournalEintrag[] = [];
  let page = 1;
  let totalPages = 1;
  // Hard cap: 50 × 200 = 10_000 Zeilen light
  while (page <= totalPages && page <= 50) {
    const result = await listJournal(
      firmaId,
      { von: z.von, bis: z.bis },
      page,
      200,
    );
    totalPages = result.totalPages;
    items.push(...result.items);
    if (result.items.length === 0) break;
    page += 1;
  }
  // Stabil: aufsteigend für Export
  items.sort((a, b) => {
    if (a.buchungsdatum !== b.buchungsdatum) {
      return a.buchungsdatum < b.buchungsdatum ? -1 : 1;
    }
    return a.laufende_nr - b.laufende_nr;
  });
  return items;
}

/**
 * Originale zu Storno-Zeilen, die außerhalb des Zeitraums liegen.
 * Nur für Kategorie-/Richtungs-Lookup — nicht in die Periodensumme.
 */
export async function resolveStornoOriginale(
  firmaId: string,
  items: JournalEintrag[],
): Promise<JournalEintrag[]> {
  const have = new Set(items.map((e) => e.id));
  const missing = [
    ...new Set(
      items
        .filter((e) => e.storno_von && !have.has(e.storno_von))
        .map((e) => e.storno_von as string),
    ),
  ];
  const extra: JournalEintrag[] = [];
  for (const id of missing) {
    const e = await getJournalEintrag(firmaId, id);
    if (e) extra.push(e);
  }
  return extra;
}

async function journalMitStornoKontext(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ items: JournalEintrag[]; extra: JournalEintrag[] }> {
  const items = await listJournalInZeitraum(firmaId, zeitraum);
  const extra = await resolveStornoOriginale(firmaId, items);
  return { items, extra };
}

async function loadSteuermodus(firmaId: string): Promise<Steuermodus> {
  const firma = await getFirmaById(firmaId);
  return firma?.steuermodus ?? "kleinunternehmer";
}

export async function getEurAuswertung(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<EurAuswertung> {
  const { items, extra } = await journalMitStornoKontext(firmaId, zeitraum);
  return buildEur(items, validateZeitraum(zeitraum), extra);
}

export async function getUstUebersicht(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<UstUebersicht> {
  const steuermodus = await loadSteuermodus(firmaId);
  const { items, extra } = await journalMitStornoKontext(firmaId, zeitraum);
  return buildUstUebersicht(items, validateZeitraum(zeitraum), steuermodus, extra);
}

/**
 * USt-Übersicht + UStVA-Kennzahlen der aktiven Firma (ein Journal-Lauf).
 */
export async function getUstvaSeite(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ ust: UstUebersicht; ustva: UstvaDatensatz }> {
  const z = validateZeitraum(zeitraum);
  const [firma, { items, extra }] = await Promise.all([
    getFirmaById(firmaId),
    journalMitStornoKontext(firmaId, z),
  ]);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";
  const ust = buildUstUebersicht(items, z, steuermodus, extra);
  const ustva = buildUstvaDatensatz(ust, firmaToUstvaAngaben(firma));
  return { ust, ustva };
}

export async function exportUstvaXml(
  firmaId: string,
  zeitraum: Zeitraum,
  opts?: { erstellungsdatum?: string },
): Promise<{ bytes: Uint8Array; filename: string; xml: string }> {
  const { ustva } = await getUstvaSeite(firmaId, zeitraum);
  return serializeUstvaXml(ustva, opts);
}

async function loadKontakteFuerJournal(
  firmaId: string,
  items: JournalEintrag[],
): Promise<Map<string, ZmKontaktBlick>> {
  const ids = [
    ...new Set(items.map((e) => e.kontakt).filter((id): id is string => Boolean(id))),
  ];
  const map = new Map<string, ZmKontaktBlick>();
  const loaded = await Promise.all(ids.map((id) => getKontakt(firmaId, id)));
  const vorhanden = loaded.filter((k): k is NonNullable<typeof k> => Boolean(k));
  const pruefungen = await getAktuellePruefungenFuerKontakte(
    firmaId,
    vorhanden.map((k) => ({ id: k.id, ust_id: k.ust_id })),
  );
  for (const k of vorhanden) {
    const p = pruefungen.get(k.id);
    map.set(k.id, {
      id: k.id,
      name: k.name,
      land: k.land,
      notiz: k.notiz,
      ust_id: k.ust_id,
      letzte_pruefung: p
        ? {
            anfrage_zeitpunkt: p.anfrage_zeitpunkt || p.created || "",
            status: p.status,
            status_meldung: p.status_meldung,
            abgefragte_ust_id: p.abgefragte_ust_id,
          }
        : undefined,
    });
  }
  return map;
}

/**
 * ZM-Übersicht der aktiven Firma (Journal + Kontakt-Land).
 */
export async function getZmUebersicht(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<ZmUebersicht> {
  const z = validateZeitraum(zeitraum);
  const [firma, { items, extra }] = await Promise.all([
    getFirmaById(firmaId),
    journalMitStornoKontext(firmaId, z),
  ]);
  const steuermodus = firma?.steuermodus ?? "kleinunternehmer";
  const kontakte = await loadKontakteFuerJournal(firmaId, items);
  return buildZmUebersicht(items, z, steuermodus, kontakte, extra);
}

export async function exportZmCsv(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ body: string; filename: string }> {
  const zm = await getZmUebersicht(firmaId, zeitraum);
  const { csv, filename } = serializeZmCsv(zm);
  return { body: csv, filename };
}

export async function getBwaLight(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<BwaLight> {
  const { items, extra } = await journalMitStornoKontext(firmaId, zeitraum);
  return buildBwaLight(items, validateZeitraum(zeitraum), extra);
}

export async function getDashboardKennzahlen(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<DashboardKennzahlen> {
  const steuermodus = await loadSteuermodus(firmaId);
  const { items, extra } = await journalMitStornoKontext(firmaId, zeitraum);
  // Offene Posten: gesamter Stand (nicht zeitraumgebunden) — liquiditätsrelevant
  const offene = await listOffenePosten(firmaId, 1, 500);
  const summe = sumOffenePosten(offene.items);
  return buildDashboard(
    items,
    validateZeitraum(zeitraum),
    steuermodus,
    summe,
    extra,
  );
}

export type UebersichtDashboard = {
  kennzahlen: DashboardKennzahlen;
  verlauf: VerlaufMonat[];
  par19: Par19Waechter | null;
  faelligkeiten: FaelligkeitenBlick;
  ausgaben_kategorien_monat: AusgabenKategorienBlick;
  ausgaben_kategorien_quartal: AusgabenKategorienBlick;
  letzte_buchungen: LetzteBuchung[];
};

async function loadKategorieSchnappschuesse(
  firmaId: string,
  ids: { beleg: string[]; kasse: string[] },
): Promise<KategorieSchnappschuesse> {
  const [belege, kasse] = await Promise.all([
    listBelegeByIds(firmaId, ids.beleg),
    listKassenbuchByIds(firmaId, ids.kasse),
  ]);
  return {
    beleg: new Map(belege.map((b) => [b.id, b.kategorie])),
    kasse: new Map(kasse.map((e) => [e.id, e.kategorie])),
  };
}

/**
 * Übersicht `/app`: Monatskennzahlen plus Verlauf, §-19-Wächter, Fälligkeiten,
 * Ausgaben nach Kategorie und letzte Journal-Zeilen.
 * Ein Journal-Lauf über Kalenderjahr ∪ letzte 12 Monate; Schnappschüsse gebündelt.
 */
export async function getUebersichtDashboard(
  firmaId: string,
  refYmd?: string,
): Promise<UebersichtDashboard> {
  const ref = refYmd ?? todayBerlin();
  const monat = periodMonth(ref);
  const quartal = periodQuarter(ref);
  const jahr = periodYear(ref);
  const zwoelf = periodLastNMonths(12, ref);
  const journalVon = jahr.von < zwoelf.von ? jahr.von : zwoelf.von;
  const steuermodus = await loadSteuermodus(firmaId);
  const [{ items, extra }, offene, letzte] = await Promise.all([
    journalMitStornoKontext(firmaId, { von: journalVon, bis: monat.bis }),
    listOffenePosten(firmaId, 1, 500),
    listJournal(firmaId, {}, 1, LETZTE_BUCHUNGEN_ANZAHL),
  ]);
  const originale = [...extra, ...items];
  const monthItems = items.filter((e) =>
    isDateInZeitraum(e.buchungsdatum, monat),
  );
  const yearItems = items.filter((e) => isDateInZeitraum(e.buchungsdatum, jahr));
  const quarterItems = items.filter((e) =>
    isDateInZeitraum(e.buchungsdatum, quartal),
  );
  const schnappschuesse = await loadKategorieSchnappschuesse(
    firmaId,
    sammelnKategorieQuelleIds(quarterItems, extra),
  );
  const summe = sumOffenePosten(offene.items);
  const kennzahlen = buildDashboard(
    monthItems,
    monat,
    steuermodus,
    summe,
    originale,
  );
  const yearBwa = buildBwaLight(yearItems, jahr, originale);
  return {
    kennzahlen,
    verlauf: buildMonatlicheReihe(items, zwoelf, extra),
    par19: buildPar19Waechter({
      steuermodus,
      umsatz_brutto: yearBwa.einnahmen_brutto,
      kalenderjahr: Number.parseInt(ref.slice(0, 4), 10),
      refYmd: ref,
    }),
    faelligkeiten: buildFaelligkeiten(offene.items, ref, 14),
    ausgaben_kategorien_monat: buildAusgabenNachKategorien(
      items,
      monat,
      schnappschuesse,
      extra,
      { label: monatKategorienLabel(monat) },
    ),
    ausgaben_kategorien_quartal: buildAusgabenNachKategorien(
      items,
      quartal,
      schnappschuesse,
      extra,
      { label: quartalKategorienLabel(quartal) },
    ),
    letzte_buchungen: buildLetzteBuchungen(letzte.items),
  };
}

export async function exportJournalCsv(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ body: string; filename: string }> {
  const z = validateZeitraum(zeitraum);
  const items = await listJournalInZeitraum(firmaId, z);
  const body = serializeJournalCsv(items);
  const filename = `buchungsjournal_${z.von}_${z.bis}.csv`;
  return { body, filename };
}

export async function exportDatevCsv(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ body: string; filename: string; anzahl: number }> {
  const z = validateZeitraum(zeitraum);
  const { items, extra } = await journalMitStornoKontext(firmaId, z);
  const { csv, meta } = serializeDatevCsv(items, z, extra);
  return {
    body: csv,
    filename: datevFilename(z),
    anzahl: meta.anzahl_zeilen,
  };
}

/** Festgeschriebene Belege mit Belegdatum im Zeitraum */
export async function listFestgeschriebeneBelegeInZeitraum(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<Beleg[]> {
  const z = validateZeitraum(zeitraum);
  const items: Beleg[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= 50) {
    const result = await listBelege(
      firmaId,
      {
        status: "festgeschrieben",
        von: z.von,
        bis: z.bis,
      },
      page,
      100,
    );
    totalPages = result.totalPages;
    items.push(...result.items);
    if (result.items.length === 0) break;
    page += 1;
  }
  return items;
}

function safeFilename(name: string, fallback: string): string {
  const base = (name || fallback).replace(/[/\\?%*:|"<>]/g, "_").trim();
  return base.slice(0, 120) || fallback;
}

/**
 * Belegarchiv-ZIP: Metadaten-CSV + Dateien festgeschriebener Belege.
 * Solo-Volumen light; Dateien sequentiell laden.
 */
export async function exportBelegArchivZip(
  firmaId: string,
  zeitraum: Zeitraum,
): Promise<{ bytes: Uint8Array; filename: string; anzahl: number }> {
  const z = validateZeitraum(zeitraum);
  const belege = await listFestgeschriebeneBelegeInZeitraum(firmaId, z);
  const meta: BelegArchivMeta[] = [];
  const entries: ZipEntry[] = [];
  const usedNames = new Set<string>();

  for (const b of belege) {
    const dateinamen: string[] = [];
    for (const storedName of b.datei) {
      try {
        const { response, filename } = await getBelegDateiResponse(
          firmaId,
          b.id,
          storedName,
        );
        const buf = new Uint8Array(await response.arrayBuffer());
        let entryName = `dateien/${safeFilename(filename, `${b.belegnummer || b.id}.bin`)}`;
        if (usedNames.has(entryName)) {
          const parts = entryName.split(".");
          const ext = parts.length > 1 ? parts.pop()! : "bin";
          const stem = parts.join(".") || entryName;
          entryName = `${stem}_${b.id.slice(0, 8)}.${ext}`;
        }
        usedNames.add(entryName);
        entries.push({ name: entryName, data: buf });
        dateinamen.push(entryName);
      } catch {
        /* Datei fehlt im Speicher */
      }
    }
    const dateiname = dateinamen.join("; ");

    meta.push({
      beleg_id: b.id,
      belegnummer: b.belegnummer,
      belegdatum: b.belegdatum,
      buchungsdatum: b.buchungsdatum,
      richtung: b.richtung,
      betrag_brutto: b.betrag_brutto,
      betrag_netto: b.betrag_netto,
      betrag_ust: b.betrag_ust,
      steuersatz: b.steuersatz,
      kategorie: b.kategorie,
      konto: b.konto,
      notiz: b.notiz,
      dateiname,
      journal_eintrag: b.journal_eintrag ?? "",
      festgeschrieben_am: b.festgeschrieben_am,
    });
  }

  const csv = serializeBelegArchivCsv(meta);
  entries.unshift({
    name: "belege_metadaten.csv",
    data: new TextEncoder().encode(csv),
  });

  const readme = [
    "Zettelruhe Belegarchiv-Export (light)",
    `Zeitraum (Belegdatum): ${z.von} bis ${z.bis}`,
    `Anzahl Belege: ${belege.length}`,
    "",
    "Inhalt:",
    "- belege_metadaten.csv — Metadaten festgeschriebener Belege",
    "- dateien/ — Originaldateien (sofern vorhanden)",
    "",
    "Nur festgeschriebene Belege. Entwürfe sind nicht enthalten.",
    "GoBD light: keine stillen Änderungen; Korrekturen über Storno (ADR-0004).",
  ].join("\n");
  entries.unshift({
    name: "README.txt",
    data: new TextEncoder().encode(readme),
  });

  const bytes = buildZip(entries);
  const filename = `belegarchiv_${z.von}_${z.bis}.zip`;
  return { bytes, filename, anzahl: belege.length };
}
