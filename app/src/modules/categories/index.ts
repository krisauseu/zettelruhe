/**
 * Modul: categories — gemeinsame Kategorien für Belege und Kassenbuch
 */

export const MODULE_ID = "categories" as const;

export type {
  Kategorie,
  KategorieFilter,
  KategorieInput,
  KategorieListResult,
  KategorieVerwendung,
} from "./types";

export {
  KATEGORIE_IN_VERWENDUNG_ERROR,
  KATEGORIE_NAME_DOPPELT_ERROR,
  KATEGORIE_NAME_MAX,
  kategorieNameKey,
  kategorieNamenFuerSelect,
  normalizeKategorieName,
  validateKategorieInput,
} from "./invariants";

export {
  countKategorieVerwendung,
  createKategorie,
  deleteKategorie,
  getKategorie,
  listAllKategorien,
  listKategorien,
  updateKategorie,
} from "./repository";

export {
  createKategorieAction,
  deleteKategorieAction,
  updateKategorieAction,
} from "./actions";
