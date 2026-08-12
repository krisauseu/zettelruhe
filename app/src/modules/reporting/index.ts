/**
 * Modul: reporting — Auswertungen & Export
 * Bauabschnitt 13: EÜR, USt-Übersicht, Dashboard, DATEV/CSV, Belegarchiv-ZIP
 * Read-only + Download-Artefakte; Journal = Source of Truth.
 */

export const MODULE_ID = "reporting" as const;

export type {
  BelegArchivMeta,
  BwaLight,
  DashboardKennzahlen,
  DatevExportMeta,
  EurAuswertung,
  EurKategorieId,
  EurKategorieZeile,
  UstSatzZeile,
  UstUebersicht,
  Zeitraum,
  ZeitraumPreset,
} from "./types";

export {
  dateToBerlinYmd,
  isDateInZeitraum,
  isValidIsoDate,
  lastDayOfMonth,
  parseYmd,
  periodFromPreset,
  periodMonth,
  periodQuarter,
  periodYear,
  quarterOfMonth,
  todayBerlin,
  validateZeitraum,
  zeitraumFromSearchParams,
  ymd,
} from "./periods";

export {
  JOURNAL_BASIS_HINWEIS,
  buildBwaLight,
  buildDashboard,
  buildEur,
  buildUstUebersicht,
  mapEurKategorie,
  sumOffenePosten,
} from "./aggregate";

export {
  BELEG_ARCHIV_CSV_HEADERS,
  JOURNAL_CSV_HEADERS,
  moneyDe,
  serializeBelegArchivCsv,
  serializeJournalCsv,
} from "./export-csv";

export {
  DATEV_FORMAT_ID,
  DATEV_HEADERS,
  datevBelegdatum,
  datevFilename,
  serializeDatevCsv,
} from "./export-datev";

export { buildZip } from "./zip";
export type { ZipEntry } from "./zip";

export {
  exportBelegArchivZip,
  exportDatevCsv,
  exportJournalCsv,
  getBwaLight,
  getDashboardKennzahlen,
  getEurAuswertung,
  getUstUebersicht,
  listFestgeschriebeneBelegeInZeitraum,
  listJournalInZeitraum,
} from "./repository";
