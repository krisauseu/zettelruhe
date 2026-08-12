/**
 * Domain-Typen: Auswertungen & Export (Bauabschnitt 13)
 * Lesend aus Buchungsjournal (+ offene Posten); keine Finanz-Writes.
 */

import type { JournalEintrag, Steuersatz } from "@/modules/journal/types";
import type { Steuermodus } from "@/lib/pb";

/** Zeitraum YYYY-MM-DD inklusiv (Europe/Berlin-Kalendertag) */
export type Zeitraum = {
  von: string;
  bis: string;
};

export type ZeitraumPreset = "monat" | "quartal" | "jahr" | "custom";

/** EÜR-Kategorie light (nicht 1:1 Finanzamts-Software) */
export type EurKategorieId =
  | "umsatzerloese"
  | "bareinnahmen"
  | "sonstige_einnahmen"
  | "betriebsausgaben"
  | "barausgaben"
  | "sonstige_ausgaben";

export type EurKategorieZeile = {
  id: EurKategorieId;
  label: string;
  richtung: "einnahme" | "ausgabe";
  /** Summe Brutto (decimal string) */
  summe_brutto: string;
  /** Summe Netto */
  summe_netto: string;
  /** Summe USt */
  summe_ust: string;
  anzahl: number;
};

export type EurAuswertung = {
  zeitraum: Zeitraum;
  einnahmen: EurKategorieZeile[];
  ausgaben: EurKategorieZeile[];
  summe_einnahmen_brutto: string;
  summe_ausgaben_brutto: string;
  /** Einnahmen − Ausgaben (Brutto light) */
  ueberschuss_brutto: string;
  summe_einnahmen_netto: string;
  summe_ausgaben_netto: string;
  ueberschuss_netto: string;
  /** Anzahl Journal-Zeilen im Zeitraum */
  anzahl_buchungen: number;
  /**
   * Hinweis: Auswertung basiert auf festgeschriebenem Journal.
   * Zahlungen erzeugen kein Journal (Ist-Versteuerung Follow-up).
   */
  hinweis_journal_basis: string;
};

/** USt je Steuersatz (nur Regelbesteuerung) */
export type UstSatzZeile = {
  steuersatz: Steuersatz | "ohne";
  /** Umsatzsteuer aus Einnahmen */
  ust_einnahmen: string;
  /** Vorsteuer aus Ausgaben */
  vorsteuer: string;
  netto_einnahmen: string;
  netto_ausgaben: string;
};

export type UstUebersicht = {
  zeitraum: Zeitraum;
  steuermodus: Steuermodus;
  /** false unter Kleinunternehmerregelung — keine Arbeits-Übersicht */
  verfuegbar: boolean;
  zeilen: UstSatzZeile[];
  summe_ust_einnahmen: string;
  summe_vorsteuer: string;
  /** Zahllast light = USt − Vorsteuer (kann negativ = Erstattung) */
  zahllast: string;
  hinweis: string;
};

export type DashboardKennzahlen = {
  zeitraum: Zeitraum;
  steuermodus: Steuermodus;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ueberschuss_brutto: string;
  /** Summe offener Rechnungs-Restbeträge (payments) */
  offene_posten_summe: string;
  offene_posten_anzahl: number;
  /** USt-Hinweis nur Regelbesteuerung */
  ust_zahllast: string | null;
  anzahl_buchungen: number;
};

/** BWA light: Einnahmen/Ausgaben je Zeitraum (gleiche Basis wie EÜR-Summen) */
export type BwaLight = {
  zeitraum: Zeitraum;
  einnahmen_brutto: string;
  ausgaben_brutto: string;
  ergebnis_brutto: string;
};

export type JournalExportRow = JournalEintrag;

export type DatevExportMeta = {
  /** Dokumentiertes Format — kein DATEV-Zertifizierungs-Claim */
  format_id: "zettelruhe-datev-csv-light-v1";
  delimiter: ";";
  encoding_hint: "utf-8-bom";
  zeitraum: Zeitraum;
  anzahl_zeilen: number;
};

export type BelegArchivMeta = {
  beleg_id: string;
  belegnummer: string;
  belegdatum: string;
  buchungsdatum: string;
  richtung: string;
  betrag_brutto: string;
  betrag_netto: string;
  betrag_ust: string;
  steuersatz: string;
  kategorie: string;
  konto: string;
  notiz: string;
  dateiname: string;
  journal_eintrag: string;
  festgeschrieben_am: string;
};
