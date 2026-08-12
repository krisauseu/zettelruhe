/**
 * Modul: einvoice — E-Rechnung Empfang
 * Bauabschnitt 12: Upload/Archiv Original, Parse → ParsedEInvoice (ADR-0015),
 * Beleg-Entwurf über expenses. Kein Versand, kein Mustang-Sidecar (ADR-0003/0015).
 */

export const MODULE_ID = "einvoice" as const;

export type {
  BelegInput,
  EInvoiceFormat,
  EInvoiceParseStatus,
  ERechnungEmpfang,
  ERechnungEmpfangFilter,
  ERechnungEmpfangListResult,
  ERechnungEmpfangStatus,
  MapToBelegOptions,
  ParsedEInvoice,
  ParsedEInvoiceLine,
  ParsedEInvoiceParty,
  ParseEInvoiceResult,
} from "./types";

export {
  assertCanCreateBeleg,
  assertHasParsedDto,
  BELEG_BEREITS_ERSTELLT_ERROR,
  deserializeParsed,
  empfangsZeitpunktUtc,
  ERECHNUNG_DATEI_MAX_BYTES,
  ERECHNUNG_DATEI_MIME,
  ORIGINAL_IMMUTABLE_ERROR,
  PARSE_FEHLER_BELEG_ERROR,
  parseEmpfangStatus,
  parseFormat,
  parseParseStatus,
  serializeParsed,
  validateERechnungDatei,
} from "./invariants";

export {
  LIEFERANT_MATCH_MIN_SCORE,
  mapParsedToBelegInput,
  scoreLieferantMatch,
} from "./mapping";

export { parseEInvoiceFile, parseEInvoiceXml } from "./parse";
export type { ParseFileInput } from "./parse";

export {
  archiveERechnung,
  createBelegFromERechnungSafe,
  getERechnungDateiResponse,
  getERechnungEmpfang,
  getLinkedBeleg,
  listERechnungEmpfang,
  replaceERechnungOriginal,
  suggestLieferantForEmpfang,
  uploadERechnung,
} from "./repository";

export {
  archiveERechnungAction,
  createBelegFromERechnungAction,
  uploadERechnungAction,
} from "./actions";
