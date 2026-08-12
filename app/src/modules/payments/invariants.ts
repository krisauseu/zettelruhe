/**
 * Reine Domain-Invarianten Zahlungen (ohne I/O).
 * Teilzahlung: Summe der Zahlungen ≤ Rechnungs-Brutto.
 * Status light aus Zahlungen + Fälligkeit ableiten (kein Journal in Abschn. 8).
 */

import {
  money,
  moneyToString,
  roundMoney,
  subMoney,
  sumMoney,
} from "@/lib/money";
import {
  isValidIsoDate,
  normalizeBetragInput,
  todayBerlin,
} from "@/modules/journal/invariants";
import type { Rechnung, RechnungStatus } from "@/modules/sales/types";
import type { Zahlung, ZahlungInput, Zahlungsweg } from "./types";

export { isValidIsoDate, todayBerlin, normalizeBetragInput };

const VALID_ZAHLUNGSWEG = new Set<Zahlungsweg>([
  "bar",
  "ueberweisung",
  "sonstiges",
]);

/** Status, auf die eine Zahlung gebucht werden darf */
export const ZAHLUNGSFAEHIGE_STATUS = new Set<RechnungStatus>([
  "offen",
  "teilbezahlt",
  "ueberfaellig",
]);

export const ZAHLUNG_UEBERZAHLUNG_ERROR =
  "Zahlung würde den Rechnungsbetrag überschreiten (Überzahlung nicht erlaubt).";

export const ZAHLUNG_ENTWURF_ERROR =
  "Zahlungen sind nur auf festgeschriebene Rechnungen möglich.";

export const ZAHLUNG_BEZAHLT_ERROR =
  "Die Rechnung ist bereits vollständig bezahlt.";

export const ZAHLUNG_STORNIERT_ERROR =
  "Auf stornierte Rechnungen können keine Zahlungen erfasst werden.";

export type ValidatedZahlungInput = {
  rechnung: string;
  datum: string;
  betrag: string;
  zahlungsweg: Zahlungsweg | "";
  notiz: string;
};

/** Validiert und normalisiert eine Zahlungseingabe (ohne Rechnungs-Kontext). */
export function validateZahlungInput(input: ZahlungInput): ValidatedZahlungInput {
  const rechnung = (input.rechnung ?? "").trim();
  if (!rechnung) {
    throw new Error("Rechnung ist erforderlich.");
  }

  const datum = (input.datum ?? "").trim();
  if (!isValidIsoDate(datum)) {
    throw new Error("Zahlungsdatum muss YYYY-MM-DD sein.");
  }

  const betrag = normalizeBetragInput(input.betrag ?? "", "Betrag");
  if (money(betrag).lte(0)) {
    throw new Error("Betrag muss größer als 0 sein.");
  }

  let zahlungsweg: Zahlungsweg | "" = "";
  const rawWeg = (input.zahlungsweg ?? "").trim();
  if (rawWeg) {
    if (!VALID_ZAHLUNGSWEG.has(rawWeg as Zahlungsweg)) {
      throw new Error("Ungültiger Zahlungsweg.");
    }
    zahlungsweg = rawWeg as Zahlungsweg;
  }

  const notiz = (input.notiz ?? "").trim();
  if (notiz.length > 2000) {
    throw new Error("Notiz ist zu lang (max. 2000 Zeichen).");
  }

  return { rechnung, datum, betrag, zahlungsweg, notiz };
}

/** Summe der Zahlungsbeträge (Decimal-String, 2 Stellen). */
export function sumZahlungen(
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): string {
  return moneyToString(
    roundMoney(
      zahlungen.reduce((acc, z) => acc.plus(money(z.betrag)), money(0)),
    ),
  );
}

/**
 * Offener Restbetrag = Brutto − Summe Zahlungen (min. 0).
 * Negativ wird nicht zurückgegeben (Überzahlung wird vorher abgelehnt).
 */
export function offenerBetrag(
  betragBrutto: string,
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): string {
  const bezahlt = sumZahlungen(zahlungen);
  const rest = subMoney(betragBrutto, bezahlt);
  if (rest.lte(0)) {
    return "0.00";
  }
  return moneyToString(roundMoney(rest));
}

/**
 * Prüft, ob eine neue Zahlung (oder alle inkl. candidate) den Brutto nicht übersteigt.
 */
export function assertKeineUeberzahlung(
  betragBrutto: string,
  bestehende: Array<Pick<Zahlung, "betrag">>,
  neuerBetrag: string,
): void {
  const summe = moneyToString(
    roundMoney(sumMoney(sumZahlungen(bestehende), neuerBetrag)),
  );
  if (money(summe).gt(money(betragBrutto))) {
    throw new Error(ZAHLUNG_UEBERZAHLUNG_ERROR);
  }
}

/**
 * Rechnung muss zahlungsfähig sein (festgeschrieben, nicht bezahlt/storniert).
 */
export function assertRechnungZahlungsfaehig(
  rechnung: Pick<Rechnung, "status" | "betrag_brutto">,
): void {
  if (rechnung.status === "entwurf") {
    throw new Error(ZAHLUNG_ENTWURF_ERROR);
  }
  if (rechnung.status === "storniert") {
    throw new Error(ZAHLUNG_STORNIERT_ERROR);
  }
  if (rechnung.status === "bezahlt") {
    throw new Error(ZAHLUNG_BEZAHLT_ERROR);
  }
  if (!ZAHLUNGSFAEHIGE_STATUS.has(rechnung.status)) {
    // Fallback für unbekannte/erweiterte Status
    throw new Error(ZAHLUNG_ENTWURF_ERROR);
  }
}

/**
 * Leitet Rechnungsstatus aus Zahlungen + Fälligkeit ab.
 *
 * - bezahlt: offener Betrag = 0
 * - teilbezahlt: 0 < bezahlt < brutto (auch wenn überfällig — Teilzahlung priorisieren)
 * - ueberfaellig: nichts bezahlt und faellig_am < heute
 * - offen: nichts bezahlt und (kein Fälligkeitsdatum oder noch nicht fällig)
 * - storniert/entwurf: unverändert (nicht aus Zahlungen ableiten)
 */
export function deriveRechnungStatus(opts: {
  currentStatus: RechnungStatus;
  betragBrutto: string;
  zahlungen: Array<Pick<Zahlung, "betrag">>;
  faellig_am?: string;
  /** Referenzdatum YYYY-MM-DD (Europe/Berlin), Default: heute */
  heute?: string;
}): RechnungStatus {
  const { currentStatus, betragBrutto, zahlungen } = opts;
  if (currentStatus === "entwurf" || currentStatus === "storniert") {
    return currentStatus;
  }

  const bezahlt = money(sumZahlungen(zahlungen));
  const brutto = money(betragBrutto);
  const offen = brutto.minus(bezahlt);

  if (offen.lte(0) || bezahlt.gte(brutto)) {
    return "bezahlt";
  }

  if (bezahlt.gt(0)) {
    return "teilbezahlt";
  }

  const heute = opts.heute ?? todayBerlin();
  const faellig = (opts.faellig_am ?? "").trim();
  if (faellig && isValidIsoDate(faellig) && faellig < heute) {
    return "ueberfaellig";
  }

  return "offen";
}

export function parseZahlungsweg(raw: string): Zahlungsweg | "" {
  return VALID_ZAHLUNGSWEG.has(raw as Zahlungsweg)
    ? (raw as Zahlungsweg)
    : "";
}
