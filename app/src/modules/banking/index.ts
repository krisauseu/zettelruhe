/**
 * Modul: banking — Bankkonten, Kontoauszugs-Import (CSV), Matching light
 * Bauabschnitt 11: getrennt vom Kassenbuch; Matching → payments.createZahlung;
 * kein Journal, kein PSD2. MT940: Follow-up (Format-Enum vorbereitet).
 */

export const MODULE_ID = "banking" as const;

export type {
  BankBewegung,
  BankBewegungFilter,
  BankBewegungListResult,
  BankBewegungRichtung,
  BankBewegungStatus,
  BankImportFormat,
  BankImportLauf,
  Bankkonto,
  BankkontoFilter,
  BankkontoInput,
  BankkontoListResult,
  ImportErgebnis,
  MatchVorschlag,
  ParsedBankZeile,
} from "./types";

export {
  BANK_MATCH_BETRAG_ERROR,
  BANK_MATCH_NICHT_EINGANG_ERROR,
  BANK_MATCH_NICHT_OFFEN_ERROR,
  buildIdempotenzSchluessel,
  extractRechnungsnummernCandidates,
  isPlausibleIban,
  isValidRichtung,
  isValidStatus,
  MATCH_VORSCHLAG_MIN_SCORE,
  normalizeIban,
  normalizeRechnungsnummer,
  normalizeTextKey,
  parseBankDatum,
  parseSignedBetrag,
  scoreMatch,
  todayBerlin,
  validateBankkontoInput,
} from "./invariants";

export {
  BANK_CSV_DEFAULT_HEADER,
  BANK_CSV_HEADERS,
  parseBankCsv,
  parseCsvRows,
} from "./csv";

export {
  createBankkonto,
  deleteBankkonto,
  getBankBewegung,
  getBankkonto,
  idempotenzForZeile,
  ignoreBankBewegung,
  importBankCsv,
  listBankBewegungen,
  listBankkonten,
  listMatchVorschlaege,
  matchBewegungToRechnung,
  reopenBankBewegung,
  updateBankkonto,
} from "./repository";

export {
  createBankkontoAction,
  deleteBankkontoAction,
  ignoreBewegungAction,
  importBankCsvAction,
  matchBewegungAction,
  reopenBewegungAction,
  updateBankkontoAction,
} from "./actions";

export { BankkontoForm } from "./bankkonto-form";
