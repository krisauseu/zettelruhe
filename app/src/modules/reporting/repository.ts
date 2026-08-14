/**
 * Reporting-Repository: reine Reads + Download-Artefakte.
 * Keine Journal-/Beleg-Mutationen (ADR-0006).
 */

import { getFirmaById } from "@/lib/pb";
import type { Steuermodus } from "@/lib/pb";
import { getJournalEintrag, listJournal } from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import { listBelege, getBelegDateiResponse } from "@/modules/expenses/repository";
import type { Beleg } from "@/modules/expenses/types";
import { listOffenePosten } from "@/modules/payments/repository";
import {
  buildDashboard,
  buildEur,
  buildBwaLight,
  buildUstUebersicht,
  sumOffenePosten,
} from "./aggregate";
import { serializeJournalCsv, serializeBelegArchivCsv } from "./export-csv";
import { datevFilename, serializeDatevCsv } from "./export-datev";
import { buildZip, type ZipEntry } from "./zip";
import { validateZeitraum } from "./periods";
import type {
  BelegArchivMeta,
  BwaLight,
  DashboardKennzahlen,
  EurAuswertung,
  UstUebersicht,
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
  const items = await listJournalInZeitraum(firmaId, z);
  const { csv, meta } = serializeDatevCsv(items, z);
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
    let dateiname = "";
    if (b.datei) {
      try {
        const { response, filename } = await getBelegDateiResponse(
          firmaId,
          b.id,
        );
        const buf = new Uint8Array(await response.arrayBuffer());
        let entryName = `dateien/${safeFilename(filename, `${b.belegnummer || b.id}.bin`)}`;
        // Kollisionen vermeiden
        if (usedNames.has(entryName)) {
          const parts = entryName.split(".");
          const ext = parts.length > 1 ? parts.pop()! : "bin";
          const stem = parts.join(".") || entryName;
          entryName = `${stem}_${b.id.slice(0, 8)}.${ext}`;
        }
        usedNames.add(entryName);
        entries.push({ name: entryName, data: buf });
        dateiname = entryName;
      } catch {
        dateiname = "";
      }
    }

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
