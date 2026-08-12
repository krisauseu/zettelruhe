/**
 * Mapping ParsedEInvoice → BelegInput (expenses).
 * Steuer-Modus: unter Kleinunternehmerregelung USt light 0 / ausgeblendet.
 * Empfangene E-Rechnung = typisch Ausgabe (Lieferant:in stellt in Rechnung).
 */

import type { BelegInput } from "@/modules/expenses/types";
import type { MapToBelegOptions, ParsedEInvoice } from "./types";

/**
 * Baut BelegInput aus geparstem DTO.
 * Festschreibung erfolgt später über expenses — hier nur Vorbefüllung.
 */
export function mapParsedToBelegInput(
  dto: ParsedEInvoice,
  opts: MapToBelegOptions,
): BelegInput {
  const isKlein = opts.steuermodus === "kleinunternehmer";

  let betrag_netto = dto.betrag_netto;
  let betrag_ust = dto.betrag_ust;
  let betrag_brutto = dto.betrag_brutto;
  let steuersatz = dto.steuersatz ?? "";

  if (isKlein) {
    // Vorsteuer/USt für Belegerfassung light nicht relevant → 0, Brutto als Netto-Basis
    betrag_ust = "0.00";
    steuersatz = "0";
    // Netto = Brutto unter Kleinunternehmer (keine Vorsteuerabzug-Logik in UI)
    if (betrag_brutto) {
      betrag_netto = betrag_brutto;
    }
  }

  const notizParts: string[] = [];
  if (dto.rechnungsnummer) {
    notizParts.push(`E-Rechnung ${dto.rechnungsnummer}`);
  }
  if (dto.lieferant.name && !opts.lieferantId) {
    notizParts.push(`Lieferant:in: ${dto.lieferant.name}`);
  }
  if (dto.lieferant.ust_id) {
    notizParts.push(`USt-IdNr.: ${dto.lieferant.ust_id}`);
  }
  if (dto.notiz) {
    notizParts.push(dto.notiz);
  }

  const kategorie = "E-Rechnung";

  return {
    belegdatum: dto.rechnungsdatum,
    buchungsdatum: dto.rechnungsdatum,
    richtung: "ausgabe",
    lieferant: opts.lieferantId || null,
    betrag_netto,
    betrag_ust,
    betrag_brutto,
    steuersatz: isKlein ? "0" : steuersatz || "",
    kategorie,
    notiz: notizParts.join(" — ").slice(0, 2000),
    konto: "",
  };
}

/**
 * Light Kontakt-Match: exakter Name (case-insensitive) oder USt-Id in Notiz.
 * Kontakte haben in v1 kein eigenes ust_id-Feld — USt-Id nur in notiz suchen.
 */
export function scoreLieferantMatch(
  dto: ParsedEInvoice,
  kontakt: { id: string; name: string; notiz?: string; ist_lieferant?: boolean },
): number {
  let score = 0;
  const nameDto = normalizeName(dto.lieferant.name);
  const nameK = normalizeName(kontakt.name);
  if (!nameDto || !nameK) return 0;

  if (nameDto === nameK) {
    score += 80;
  } else if (nameK.includes(nameDto) || nameDto.includes(nameK)) {
    score += 40;
  }

  const ust = (dto.lieferant.ust_id || "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (ust && kontakt.notiz) {
    const n = kontakt.notiz.replace(/\s/g, "").toUpperCase();
    if (n.includes(ust)) {
      score += 50;
    }
  }

  if (kontakt.ist_lieferant) {
    score += 5;
  }

  return score;
}

function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]/g, "");
}

export const LIEFERANT_MATCH_MIN_SCORE = 40;
