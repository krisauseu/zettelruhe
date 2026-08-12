/**
 * Modul: sales — Rechnungen + Angebote + Wiederkehrende Rechnungen
 * BA5: Rechnung Entwurf, Festschreibung → Nummer + PDF + Journal
 * BA6: Angebot Entwurf, Senden → Nummer + PDF (kein Journal); Status light
 * BA10: Wiederkehrende Vorlage → Job erzeugt Rechnungs-Entwurf
 */

export const MODULE_ID = "sales" as const;

export type {
  Angebot,
  AngebotFilter,
  AngebotInput,
  AngebotListResult,
  AngebotMitPositionen,
  AngebotStatus,
  AngebotStatusZiel,
  Angebotsposition,
  AngebotspositionInput,
  Rechnung,
  RechnungFilter,
  RechnungInput,
  RechnungListResult,
  RechnungMitPositionen,
  RechnungStatus,
  Rechnungsposition,
  RechnungspositionInput,
  Steuermodus,
  Steuersatz,
} from "./types";

export type {
  WiederkehrendeRechnung,
  WiederkehrendeRechnungMitPositionen,
  WiederkehrFilter,
  WiederkehrInput,
  WiederkehrListResult,
  WiederkehrPosition,
  WiederkehrPositionInput,
  WiederkehrRhythmus,
} from "./wiederkehrend-types";

export {
  ANGEBOT_GESENDET_ERROR,
  ANGEBOT_PDF_IMMUTABLE_ERROR,
  ANGEBOT_STATUS_TRANSITIONS,
  assertAngebotEntwurfEditable,
  assertAngebotEntwurfOhneNummer,
  assertCanChangeAngebotStatus,
  assertCanFestschreiben,
  assertCanSenden,
  assertCanUebernehmenInRechnung,
  assertEntwurfEditable,
  assertEntwurfOhneNummer,
  buildBuchungstextFromRechnung,
  buildJournalInputFromRechnung,
  calculatePositionBetraege,
  defaultFaelligAm,
  defaultGueltigBis,
  FESTGESCHRIEBEN_ERROR,
  festschreibungsZeitpunktUtc,
  isAngebotEntwurf,
  isAngebotFinalisiert,
  isEntwurf,
  isFestgeschrieben,
  isValidIsoDate,
  KLEINUNTERNEHMER_HINWEIS,
  normalizeMengeInput,
  parseAngebotStatus,
  parseAngebotStatusZiel,
  parseStatus,
  PDF_IMMUTABLE_ERROR,
  sumPositionen,
  todayBerlin,
  validateAngebotInput,
  validateAngebotspositionInput,
  validatePositionInput,
  validateRechnungInput,
} from "./invariants";

export {
  addDaysIso,
  addMonthsIso,
  assertCanErzeugen,
  DEFAULT_ZAHLUNGSZIEL_TAGE,
  faelligAmFromZahlungsziel,
  isVorlageFaellig,
  mapVorlageToRechnungInput,
  MAX_CATCHUP_PRO_VORLAGE,
  nextNaechstesDatum,
  parseRhythmus,
  validateWiederkehrInput,
} from "./wiederkehrend-invariants";

export {
  createAngebot,
  createRechnung,
  deleteAngebot,
  deleteFestgeschriebeneRechnung,
  deleteGesendetesAngebot,
  deleteRechnung,
  festschreibenRechnung,
  getAngebot,
  getAngebotMitPositionen,
  getAngebotPdfResponse,
  getRechnung,
  getRechnungMitPositionen,
  getRechnungPdfResponse,
  listAngebote,
  listRechnungen,
  replaceAngebotPdf,
  replaceRechnungPdf,
  sendenAngebot,
  setAngebotStatus,
  uebernehmenAlsRechnung,
  updateAngebot,
  updateFestgeschriebeneRechnung,
  updateGesendetesAngebot,
  updateRechnung,
} from "./repository";

export {
  createWiederkehrendeRechnung,
  deleteWiederkehrendeRechnung,
  erzeugeFaelligeAusVorlage,
  erzeugeRechnungAusVorlage,
  getWiederkehrendeRechnung,
  getWiederkehrendeRechnungMitPositionen,
  listFaelligeWiederkehrende,
  listWiederkehrendeRechnungen,
  setWiederkehrAktiv,
  updateWiederkehrendeRechnung,
} from "./wiederkehrend-repository";

export {
  createAngebotAction,
  createRechnungAction,
  deleteAngebotAction,
  deleteRechnungAction,
  festschreibenRechnungAction,
  sendenAngebotAction,
  setAngebotStatusAction,
  uebernehmenAlsRechnungAction,
  updateAngebotAction,
  updateRechnungAction,
} from "./actions";

export {
  createWiederkehrAction,
  deleteWiederkehrAction,
  erzeugeFaelligeAction,
  erzeugeJetztAction,
  setWiederkehrAktivAction,
  updateWiederkehrAction,
} from "./wiederkehrend-actions";
