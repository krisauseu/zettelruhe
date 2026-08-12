/**
 * Domain-Typen: Belege (manuelle Erfassung + Datei)
 * UX-Schicht über dem Buchungsjournal; Festschreibung → Journal (quelle_typ=beleg).
 */

import type { Buchungsrichtung, Steuersatz } from "@/modules/journal/types";

export type BelegStatus = "entwurf" | "festgeschrieben";

export type { Buchungsrichtung, Steuersatz };

/** Persistierter Beleg */
export type Beleg = {
  id: string;
  firma: string;
  /** YYYY-MM-DD */
  belegdatum: string;
  /** YYYY-MM-DD — bei Entwurf optional, bei Festschreibung gesetzt */
  buchungsdatum: string;
  richtung: Buchungsrichtung;
  /** Lieferant:in (Kontakt), optional */
  lieferant: string | null;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz: Steuersatz | "";
  kategorie: string;
  notiz: string;
  konto: string;
  status: BelegStatus;
  /** Dateiname in PB (leer = keine Datei) */
  datei: string;
  /** Erst bei Festschreibung vergeben */
  belegnummer: string;
  /** Verweis auf Journal-Eintrag nach Festschreibung */
  journal_eintrag: string | null;
  /** ISO-8601 UTC */
  festgeschrieben_am: string;
  created?: string;
  updated?: string;
};

/** Eingabe für Entwurf anlegen/aktualisieren */
export type BelegInput = {
  belegdatum: string;
  buchungsdatum?: string;
  richtung: Buchungsrichtung;
  lieferant?: string | null;
  betrag_netto?: string;
  betrag_ust?: string;
  betrag_brutto?: string;
  steuersatz?: Steuersatz | "";
  kategorie?: string;
  notiz?: string;
  konto?: string;
};

export type BelegFilter = {
  q?: string;
  status?: BelegStatus | "";
  richtung?: Buchungsrichtung | "";
  /** YYYY-MM-DD inklusiv (Belegdatum) */
  von?: string;
  bis?: string;
};

export type BelegListResult = {
  items: Beleg[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};
