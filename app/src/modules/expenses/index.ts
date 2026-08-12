/**
 * Modul: expenses — Belege (manuelle Erfassung + Dateien)
 * Bauabschnitt 4: Entwurf, Festschreibung → Buchungsjournal, Datei immutable nach Festschreibung
 */

export const MODULE_ID = "expenses" as const;

export type {
  Beleg,
  BelegFilter,
  BelegInput,
  BelegListResult,
  BelegStatus,
  Buchungsrichtung,
  Steuersatz,
} from "./types";

export {
  assertCanFestschreiben,
  assertEntwurfEditable,
  BELEG_DATEI_MAX_BYTES,
  BELEG_DATEI_MIME,
  buildBuchungstextFromBeleg,
  buildJournalInputFromBeleg,
  DATEI_IMMUTABLE_ERROR,
  FESTGESCHRIEBEN_ERROR,
  festschreibungsZeitpunktUtc,
  isEntwurf,
  isFestgeschrieben,
  isValidIsoDate,
  parseStatus,
  todayBerlin,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";

export {
  clearBelegDatei,
  createBeleg,
  deleteBeleg,
  deleteFestgeschriebenenBeleg,
  festschreibenBeleg,
  getBeleg,
  getBelegDateiResponse,
  listBelege,
  setBelegDatei,
  updateBeleg,
  updateFestgeschriebenenBeleg,
} from "./repository";

export {
  clearBelegDateiAction,
  createBelegAction,
  deleteBelegAction,
  festschreibenBelegAction,
  updateBelegAction,
} from "./actions";
