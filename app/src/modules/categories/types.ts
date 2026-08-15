/**
 * Domain-Typen: gemeinsame Kategorien für Belege und Kassenbuch (ADR-0017).
 * Persistiert als Stammdaten; am Beleg/Kassenbuch bleibt `kategorie` Text.
 */

export type Kategorie = {
  id: string;
  firma: string;
  name: string;
  aktiv: boolean;
  notiz: string;
  created?: string;
  updated?: string;
};

export type KategorieInput = {
  name: string;
  aktiv?: boolean;
  notiz?: string;
};

export type KategorieFilter = {
  q?: string;
  nurAktiv?: boolean;
};

export type KategorieListResult = {
  items: Kategorie[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export type KategorieVerwendung = {
  belege: number;
  kasse: number;
};
