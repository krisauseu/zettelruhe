/**
 * Modul: payments — manuelle Zahlungen (inkl. Teilzahlung)
 * Bauabschnitt 8: Zahlung auf offene Rechnung; Status light; kein Bank-Match, kein Journal.
 */

export const MODULE_ID = "payments" as const;

export type {
  OffenerPosten,
  Zahlung,
  ZahlungFilter,
  ZahlungInput,
  ZahlungListResult,
  Zahlungsweg,
} from "./types";

export {
  assertKeineUeberzahlung,
  assertRechnungZahlungsfaehig,
  deriveRechnungStatus,
  isValidIsoDate,
  normalizeBetragInput,
  offenerBetrag,
  parseZahlungsweg,
  sumZahlungen,
  todayBerlin,
  validateZahlungInput,
  ZAHLUNG_BEZAHLT_ERROR,
  ZAHLUNG_ENTWURF_ERROR,
  ZAHLUNG_STORNIERT_ERROR,
  ZAHLUNG_UEBERZAHLUNG_ERROR,
  ZAHLUNGSFAEHIGE_STATUS,
} from "./invariants";

export {
  createZahlung,
  deleteZahlung,
  getZahlung,
  getZahlungsstand,
  listOffenePosten,
  listZahlungen,
  listZahlungenForRechnung,
  refreshRechnungZahlungsstatus,
} from "./repository";

export { createZahlungAction, deleteZahlungAction } from "./actions";
