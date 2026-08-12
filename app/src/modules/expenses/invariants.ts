/**
 * Reine Domain-Invarianten Belege (ohne I/O).
 * Entwurf editierbar; nach Festschreibung immutable (ADR-0004, ADR-0012).
 */

import { money } from "@/lib/money";
import {
  isValidIsoDate,
  normalizeBetraege,
  todayBerlin,
  festschreibungsZeitpunktUtc,
  type NormalizedBetraege,
} from "@/modules/journal/invariants";
import type { JournalBuchungInput } from "@/modules/journal/types";
import type { Beleg, BelegInput, BelegStatus, Buchungsrichtung } from "./types";

export { isValidIsoDate, todayBerlin, festschreibungsZeitpunktUtc };

const VALID_RICHTUNG = new Set<Buchungsrichtung>(["einnahme", "ausgabe"]);
const VALID_STATUS = new Set<BelegStatus>(["entwurf", "festgeschrieben"]);

/** Erlaubte MIME-Typen für Belegdateien */
export const BELEG_DATEI_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/** Max. Dateigröße 15 MiB */
export const BELEG_DATEI_MAX_BYTES = 15 * 1024 * 1024;

export const FESTGESCHRIEBEN_ERROR =
  "Festgeschriebene Belege dürfen nicht still geändert oder gelöscht werden. Korrektur über neuen Beleg bzw. Storno im Buchungsjournal.";

export const DATEI_IMMUTABLE_ERROR =
  "Die Belegdatei ist nach der Festschreibung unveränderbar (ADR-0012).";

export type ValidatedBelegInput = {
  belegdatum: string;
  buchungsdatum: string;
  richtung: Buchungsrichtung;
  lieferant: string | null;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Beleg["steuersatz"];
  kategorie: string;
  notiz: string;
  konto: string;
};

/** Validiert und normalisiert Beleg-Eingabe (Entwurf). */
export function validateBelegInput(input: BelegInput): ValidatedBelegInput {
  const belegdatum = (input.belegdatum ?? "").trim();
  if (!isValidIsoDate(belegdatum)) {
    throw new Error("Belegdatum muss YYYY-MM-DD sein.");
  }

  const buchungsdatumRaw = (input.buchungsdatum ?? "").trim();
  const buchungsdatum = buchungsdatumRaw || belegdatum;
  if (!isValidIsoDate(buchungsdatum)) {
    throw new Error("Buchungsdatum muss YYYY-MM-DD sein.");
  }

  if (!VALID_RICHTUNG.has(input.richtung)) {
    throw new Error("Richtung muss Einnahme oder Ausgabe sein.");
  }

  const betraege: NormalizedBetraege = normalizeBetraege({
    betrag_netto: input.betrag_netto,
    betrag_ust: input.betrag_ust,
    betrag_brutto: input.betrag_brutto,
    steuersatz: input.steuersatz,
  });

  if (money(betraege.betrag_brutto).isZero()) {
    throw new Error("Bruttobetrag muss größer als 0 sein.");
  }

  const kategorie = (input.kategorie ?? "").trim();
  if (kategorie.length > 120) {
    throw new Error("Kategorie ist zu lang (max. 120 Zeichen).");
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  const lieferant = input.lieferant?.trim() || null;

  return {
    belegdatum,
    buchungsdatum,
    richtung: input.richtung,
    lieferant,
    ...betraege,
    kategorie,
    notiz,
    konto: (input.konto ?? "").trim(),
  };
}

export function isEntwurf(beleg: Pick<Beleg, "status">): boolean {
  return beleg.status === "entwurf";
}

export function isFestgeschrieben(beleg: Pick<Beleg, "status">): boolean {
  return beleg.status === "festgeschrieben";
}

export function assertEntwurfEditable(beleg: Pick<Beleg, "status">): void {
  if (!isEntwurf(beleg)) {
    throw new Error(FESTGESCHRIEBEN_ERROR);
  }
}

export function assertCanFestschreiben(beleg: Beleg): void {
  if (beleg.status !== "entwurf") {
    throw new Error("Nur Entwürfe können festgeschrieben werden.");
  }
  if (beleg.journal_eintrag) {
    throw new Error("Beleg ist bereits mit einem Journal-Eintrag verknüpft.");
  }
}

/** Validiert Upload (MIME + Größe). */
export function validateBelegDatei(file: {
  type: string;
  size: number;
  name?: string;
}): void {
  if (!file || file.size <= 0) {
    throw new Error("Datei ist leer.");
  }
  if (file.size > BELEG_DATEI_MAX_BYTES) {
    throw new Error("Datei ist zu groß (max. 15 MB).");
  }
  const mime = (file.type || "").toLowerCase();
  // Manche Browser senden leeren type — Endung prüfen
  if (mime && !BELEG_DATEI_MIME.has(mime)) {
    throw new Error(
      "Ungültiger Dateityp. Erlaubt: PDF, JPEG, PNG, WebP, GIF.",
    );
  }
  if (!mime && file.name) {
    const lower = file.name.toLowerCase();
    const ok =
      lower.endsWith(".pdf") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp") ||
      lower.endsWith(".gif");
    if (!ok) {
      throw new Error(
        "Ungültiger Dateityp. Erlaubt: PDF, JPEG, PNG, WebP, GIF.",
      );
    }
  }
}

/**
 * Buchungstext für Journal aus Beleg-Metadaten.
 */
export function buildBuchungstextFromBeleg(beleg: {
  kategorie: string;
  notiz: string;
  belegnummer?: string;
  richtung: Buchungsrichtung;
}): string {
  const parts: string[] = [];
  if (beleg.belegnummer) {
    parts.push(`Beleg ${beleg.belegnummer}`);
  }
  if (beleg.kategorie) {
    parts.push(beleg.kategorie);
  }
  if (beleg.notiz) {
    parts.push(beleg.notiz);
  }
  if (parts.length === 0) {
    parts.push(beleg.richtung === "einnahme" ? "Einnahmebeleg" : "Ausgabenbeleg");
  }
  return parts.join(" — ").slice(0, 500);
}

/**
 * Journal-Eingabe aus festzuschreibendem Beleg.
 * belegId + belegnummer werden vom Repository gesetzt.
 */
export function buildJournalInputFromBeleg(
  beleg: Beleg,
  opts: { belegId: string; belegnummer: string },
): JournalBuchungInput {
  const text = buildBuchungstextFromBeleg({
    ...beleg,
    belegnummer: opts.belegnummer,
  });

  return {
    buchungsdatum: beleg.buchungsdatum || beleg.belegdatum,
    belegdatum: beleg.belegdatum,
    buchungstext: text,
    richtung: beleg.richtung,
    betrag_netto: beleg.betrag_netto,
    betrag_ust: beleg.betrag_ust,
    betrag_brutto: beleg.betrag_brutto,
    steuersatz: beleg.steuersatz,
    konto: beleg.konto || undefined,
    kontakt: beleg.lieferant,
    quelle_typ: "beleg",
    quelle_id: opts.belegId,
  };
}

export function parseStatus(raw: string): BelegStatus | "" {
  return VALID_STATUS.has(raw as BelegStatus) ? (raw as BelegStatus) : "";
}
