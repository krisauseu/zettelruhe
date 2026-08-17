/**
 * Persistenz Banking über PocketBase (Superuser).
 * Bankkonto-CRUD, CSV-Import mit Idempotenz, Matching → createZahlung (payments).
 * Gematchte Zahlung über payments.createZahlung (inkl. Zufluss-Journal).
 */

import {
  createRecord,
  deleteRecord,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  updateRecord,
} from "@/lib/pb";
import { money, moneyToString, roundMoney } from "@/lib/money";
import {
  createZahlung,
  listOffenePosten,
  offenerBetrag,
  listZahlungenForRechnung,
} from "@/modules/payments";
import { getRechnung } from "@/modules/sales/repository";
import { parseBankCsv } from "./csv";
import {
  BANK_MATCH_BETRAG_ERROR,
  BANK_MATCH_NICHT_EINGANG_ERROR,
  BANK_MATCH_NICHT_OFFEN_ERROR,
  buildIdempotenzSchluessel,
  MATCH_VORSCHLAG_MIN_SCORE,
  scoreMatch,
  validateBankkontoInput,
} from "./invariants";
import type {
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

const COL_KONTO = "bankkonten";
const COL_LAUF = "bank_import_laeufe";
const COL_BEW = "bank_bewegungen";

type PbBankkonto = {
  id: string;
  firma: string;
  name: string;
  iban?: string;
  bic?: string;
  aktiv?: boolean;
  notiz?: string;
  created?: string;
  updated?: string;
};

type PbImportLauf = {
  id: string;
  firma: string;
  bankkonto: string;
  format: string;
  dateiname?: string;
  importiert_am: string;
  zeilen_gesamt: string;
  zeilen_neu: string;
  zeilen_duplikat: string;
  notiz?: string;
  created?: string;
};

type PbBewegung = {
  id: string;
  firma: string;
  bankkonto: string;
  import_lauf?: string;
  datum: string;
  richtung: string;
  betrag: string;
  verwendungszweck?: string;
  gegenkonto_name?: string;
  gegenkonto_iban?: string;
  referenz?: string;
  status: string;
  idempotenz_schluessel: string;
  rechnung?: string;
  zahlung?: string;
  notiz?: string;
  created?: string;
  updated?: string;
};

const VALID_RICHTUNG = new Set(["eingang", "ausgang"]);
const VALID_STATUS = new Set(["offen", "gematcht", "ignoriert"]);
const VALID_FORMAT = new Set(["csv", "mt940"]);

function mapKonto(r: PbBankkonto): Bankkonto {
  return {
    id: r.id,
    firma: r.firma,
    name: r.name,
    iban: r.iban ?? "",
    bic: r.bic ?? "",
    aktiv: r.aktiv !== false,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function mapLauf(r: PbImportLauf): BankImportLauf {
  const format =
    r.format && VALID_FORMAT.has(r.format)
      ? (r.format as BankImportFormat)
      : "csv";
  return {
    id: r.id,
    firma: r.firma,
    bankkonto: r.bankkonto,
    format,
    dateiname: r.dateiname ?? "",
    importiert_am: r.importiert_am,
    zeilen_gesamt: Number.parseInt(r.zeilen_gesamt, 10) || 0,
    zeilen_neu: Number.parseInt(r.zeilen_neu, 10) || 0,
    zeilen_duplikat: Number.parseInt(r.zeilen_duplikat, 10) || 0,
    notiz: r.notiz ?? "",
    created: r.created,
  };
}

function mapBewegung(r: PbBewegung): BankBewegung {
  const richtung = VALID_RICHTUNG.has(r.richtung)
    ? (r.richtung as BankBewegungRichtung)
    : "eingang";
  const status = VALID_STATUS.has(r.status)
    ? (r.status as BankBewegungStatus)
    : "offen";
  return {
    id: r.id,
    firma: r.firma,
    bankkonto: r.bankkonto,
    import_lauf: r.import_lauf || null,
    datum: r.datum,
    richtung,
    betrag: r.betrag,
    verwendungszweck: r.verwendungszweck ?? "",
    gegenkonto_name: r.gegenkonto_name ?? "",
    gegenkonto_iban: r.gegenkonto_iban ?? "",
    referenz: r.referenz ?? "",
    status,
    idempotenz_schluessel: r.idempotenz_schluessel,
    rechnung: r.rechnung || null,
    zahlung: r.zahlung || null,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

// --- Bankkonto CRUD ---

export async function listBankkonten(
  firmaId: string,
  filter: BankkontoFilter = {},
  page = 1,
  perPage = 50,
): Promise<BankkontoListResult> {
  const parts = [pbEq("firma", firmaId)];
  if (filter.aktiv === true) {
    parts.push("aktiv = true");
  }
  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("name", q)} || ${pbLike("iban", q)} || ${pbLike("notiz", q)})`,
    );
  }

  const result = await listRecords<PbBankkonto>(COL_KONTO, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "name,id",
  });

  return {
    items: result.items.map(mapKonto),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function getBankkonto(
  firmaId: string,
  id: string,
): Promise<Bankkonto | null> {
  try {
    const r = await getRecord<PbBankkonto>(COL_KONTO, id);
    if (r.firma !== firmaId) return null;
    return mapKonto(r);
  } catch {
    return null;
  }
}

export async function createBankkonto(
  firmaId: string,
  input: BankkontoInput,
): Promise<Bankkonto> {
  const v = validateBankkontoInput(input);
  const r = await createRecord<PbBankkonto>(COL_KONTO, {
    firma: firmaId,
    name: v.name,
    iban: v.iban,
    bic: v.bic,
    aktiv: v.aktiv,
    notiz: v.notiz,
  });
  return mapKonto(r);
}

export async function updateBankkonto(
  firmaId: string,
  id: string,
  input: BankkontoInput,
): Promise<Bankkonto> {
  const existing = await getBankkonto(firmaId, id);
  if (!existing) {
    throw new Error("Bankkonto nicht gefunden.");
  }
  const v = validateBankkontoInput(input);
  const r = await updateRecord<PbBankkonto>(COL_KONTO, id, {
    name: v.name,
    iban: v.iban,
    bic: v.bic,
    aktiv: v.aktiv,
    notiz: v.notiz,
  });
  return mapKonto(r);
}

/**
 * Bankkonto löschen light — nur wenn keine Bewegungen existieren.
 */
export async function deleteBankkonto(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getBankkonto(firmaId, id);
  if (!existing) {
    throw new Error("Bankkonto nicht gefunden.");
  }
  const bew = await listRecords<PbBewegung>(COL_BEW, {
    page: 1,
    perPage: 1,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("bankkonto", id)}`,
  });
  if (bew.totalItems > 0) {
    throw new Error(
      "Bankkonto hat bereits Kontoauszugszeilen und kann nicht gelöscht werden. Deaktivieren Sie es stattdessen.",
    );
  }
  await deleteRecord(COL_KONTO, id);
}

// --- Bewegungen ---

export async function getBankBewegung(
  firmaId: string,
  id: string,
): Promise<BankBewegung | null> {
  try {
    const r = await getRecord<PbBewegung>(COL_BEW, id);
    if (r.firma !== firmaId) return null;
    return mapBewegung(r);
  } catch {
    return null;
  }
}

export async function listBankBewegungen(
  firmaId: string,
  filter: BankBewegungFilter = {},
  page = 1,
  perPage = 50,
): Promise<BankBewegungListResult> {
  const parts = [pbEq("firma", firmaId)];
  if (filter.bankkonto) {
    parts.push(pbEq("bankkonto", filter.bankkonto));
  }
  if (filter.status) {
    parts.push(pbEq("status", filter.status));
  }
  if (filter.richtung) {
    parts.push(pbEq("richtung", filter.richtung));
  }
  const von = filter.von?.trim();
  if (von) {
    parts.push(`datum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`datum <= "${bis.replace(/"/g, "")}"`);
  }
  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("verwendungszweck", q)} || ${pbLike("gegenkonto_name", q)} || ${pbLike("referenz", q)} || ${pbLike("gegenkonto_iban", q)})`,
    );
  }

  const result = await listRecords<PbBewegung>(COL_BEW, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "-datum,-id",
  });

  return {
    items: result.items.map(mapBewegung),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

async function findByIdempotenz(
  firmaId: string,
  bankkontoId: string,
  key: string,
): Promise<BankBewegung | null> {
  const result = await listRecords<PbBewegung>(COL_BEW, {
    page: 1,
    perPage: 1,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("bankkonto", bankkontoId)} && ${pbEq("idempotenz_schluessel", key)}`,
  });
  if (result.items.length === 0) return null;
  return mapBewegung(result.items[0]!);
}

/**
 * CSV-Import: speichert neue Bewegungen; Duplikate (Idempotenz) werden übersprungen.
 */
export async function importBankCsv(
  firmaId: string,
  bankkontoId: string,
  csvText: string,
  opts?: { dateiname?: string; now?: Date },
): Promise<ImportErgebnis & { parseFehler: Array<{ zeile: number; meldung: string }> }> {
  const konto = await getBankkonto(firmaId, bankkontoId);
  if (!konto) {
    throw new Error("Bankkonto nicht gefunden.");
  }
  if (!konto.aktiv) {
    throw new Error("Bankkonto ist deaktiviert.");
  }

  const parsed = parseBankCsv(csvText);
  if (parsed.zeilen.length === 0 && parsed.fehler.length > 0) {
    throw new Error(
      parsed.fehler[0]?.meldung ?? "CSV konnte nicht gelesen werden.",
    );
  }

  const now = opts?.now ?? new Date();
  const importiert_am = now.toISOString();

  // Import-Lauf zuerst anlegen (Zähler werden am Ende aktualisiert)
  const laufRaw = await createRecord<PbImportLauf>(COL_LAUF, {
    firma: firmaId,
    bankkonto: bankkontoId,
    format: "csv",
    dateiname: (opts?.dateiname ?? "").slice(0, 255),
    importiert_am,
    zeilen_gesamt: "0",
    zeilen_neu: "0",
    zeilen_duplikat: "0",
    notiz: "",
  });

  let neu = 0;
  let duplikat = 0;

  for (const zeile of parsed.zeilen) {
    const key = buildIdempotenzSchluessel(bankkontoId, zeile);
    const existing = await findByIdempotenz(firmaId, bankkontoId, key);
    if (existing) {
      duplikat += 1;
      continue;
    }
    await createRecord<PbBewegung>(COL_BEW, {
      firma: firmaId,
      bankkonto: bankkontoId,
      import_lauf: laufRaw.id,
      datum: zeile.datum,
      richtung: zeile.richtung,
      betrag: zeile.betrag,
      verwendungszweck: zeile.verwendungszweck.slice(0, 2000),
      gegenkonto_name: zeile.gegenkonto_name.slice(0, 200),
      gegenkonto_iban: zeile.gegenkonto_iban.slice(0, 34),
      referenz: zeile.referenz.slice(0, 200),
      status: "offen",
      idempotenz_schluessel: key,
      notiz: "",
    });
    neu += 1;
  }

  const gesamt = parsed.zeilen.length;
  const laufUpdated = await updateRecord<PbImportLauf>(COL_LAUF, laufRaw.id, {
    zeilen_gesamt: String(gesamt),
    zeilen_neu: String(neu),
    zeilen_duplikat: String(duplikat),
  });

  return {
    lauf: mapLauf(laufUpdated),
    neu,
    duplikat,
    gesamt,
    parseFehler: parsed.fehler,
  };
}

// --- Matching ---

/**
 * Vorschläge offener Rechnungen für eine Auszugszeile (Eingang).
 * Kein Silent-Match — UI muss bestätigen.
 */
export async function listMatchVorschlaege(
  firmaId: string,
  bewegungId: string,
  opts?: { minScore?: number; limit?: number },
): Promise<MatchVorschlag[]> {
  const bew = await getBankBewegung(firmaId, bewegungId);
  if (!bew) {
    throw new Error("Auszugszeile nicht gefunden.");
  }
  if (bew.richtung !== "eingang") {
    return [];
  }
  if (bew.status !== "offen") {
    return [];
  }

  const minScore = opts?.minScore ?? MATCH_VORSCHLAG_MIN_SCORE;
  const limit = opts?.limit ?? 10;

  // Offene Posten (payments) — light, seitenweise geladen
  const posten = await listOffenePosten(firmaId, 1, 100);
  const vorschlaege: MatchVorschlag[] = [];

  for (const p of posten.items) {
    const { score, gruende } = scoreMatch({
      bewegungBetrag: bew.betrag,
      bewegungDatum: bew.datum,
      verwendungszweck: bew.verwendungszweck,
      referenz: bew.referenz,
      rechnungsnummer: p.rechnungsnummer,
      offen: p.offen,
      brutto: p.betrag_brutto,
      rechnungsdatum: p.rechnungsdatum,
    });
    if (score < minScore) continue;
    // Betrag darf offenen Rest nicht übersteigen (Überzahlung)
    if (money(bew.betrag).gt(money(p.offen))) continue;

    vorschlaege.push({
      rechnungId: p.rechnungId,
      rechnungsnummer: p.rechnungsnummer,
      rechnungsdatum: p.rechnungsdatum,
      kundeName: p.kundeName,
      betrag_brutto: p.betrag_brutto,
      offen: p.offen,
      status: p.status,
      score,
      gruende,
    });
  }

  vorschlaege.sort((a, b) => b.score - a.score || a.rechnungsnummer.localeCompare(b.rechnungsnummer));
  return vorschlaege.slice(0, limit);
}

/**
 * Manuelle/1-Klick-Zuordnung: Auszugszeile → Rechnung → createZahlung (payments).
 * Kein Journal; PDF/Inhalt der Rechnung unverändert.
 */
export async function matchBewegungToRechnung(
  firmaId: string,
  bewegungId: string,
  rechnungId: string,
  opts?: {
    /** Optional anderer Zahlungsbetrag (Default: Auszugsbetrag, max. offen) */
    betrag?: string;
    notiz?: string;
  },
): Promise<{ bewegung: BankBewegung; zahlungId: string }> {
  const bew = await getBankBewegung(firmaId, bewegungId);
  if (!bew) {
    throw new Error("Auszugszeile nicht gefunden.");
  }
  if (bew.status !== "offen") {
    throw new Error(BANK_MATCH_NICHT_OFFEN_ERROR);
  }
  if (bew.richtung !== "eingang") {
    throw new Error(BANK_MATCH_NICHT_EINGANG_ERROR);
  }

  const rechnung = await getRechnung(firmaId, rechnungId);
  if (!rechnung) {
    throw new Error("Rechnung nicht gefunden.");
  }

  const bestehende = await listZahlungenForRechnung(firmaId, rechnungId);
  const offen = offenerBetrag(rechnung.betrag_brutto, bestehende);
  const zahlungsBetrag = opts?.betrag
    ? moneyToString(roundMoney(opts.betrag))
    : bew.betrag;

  if (money(zahlungsBetrag).gt(money(offen))) {
    throw new Error(BANK_MATCH_BETRAG_ERROR);
  }

  const notizParts = [
    opts?.notiz?.trim(),
    bew.verwendungszweck
      ? `Kontoauszug: ${bew.verwendungszweck.slice(0, 200)}`
      : "",
    `Bank-Match ${bew.datum}`,
  ].filter(Boolean);

  const { zahlung } = await createZahlung(firmaId, {
    rechnung: rechnungId,
    datum: bew.datum,
    betrag: zahlungsBetrag,
    zahlungsweg: "ueberweisung",
    notiz: notizParts.join(" · ").slice(0, 2000),
  });

  const updated = await updateRecord<PbBewegung>(COL_BEW, bewegungId, {
    status: "gematcht",
    rechnung: rechnungId,
    zahlung: zahlung.id,
  });

  return { bewegung: mapBewegung(updated), zahlungId: zahlung.id };
}

/** Auszugszeile ignorieren (kein Match, keine Zahlung). */
export async function ignoreBankBewegung(
  firmaId: string,
  bewegungId: string,
): Promise<BankBewegung> {
  const bew = await getBankBewegung(firmaId, bewegungId);
  if (!bew) {
    throw new Error("Auszugszeile nicht gefunden.");
  }
  if (bew.status === "gematcht") {
    throw new Error(
      "Gematchte Auszugszeilen können nicht ignoriert werden (Zahlung zuerst korrigieren).",
    );
  }
  if (bew.status === "ignoriert") {
    return bew;
  }
  const updated = await updateRecord<PbBewegung>(COL_BEW, bewegungId, {
    status: "ignoriert",
  });
  return mapBewegung(updated);
}

/** Ignorieren zurücknehmen → wieder offen. */
export async function reopenBankBewegung(
  firmaId: string,
  bewegungId: string,
): Promise<BankBewegung> {
  const bew = await getBankBewegung(firmaId, bewegungId);
  if (!bew) {
    throw new Error("Auszugszeile nicht gefunden.");
  }
  if (bew.status !== "ignoriert") {
    throw new Error("Nur ignorierte Zeilen können wieder geöffnet werden.");
  }
  const updated = await updateRecord<PbBewegung>(COL_BEW, bewegungId, {
    status: "offen",
  });
  return mapBewegung(updated);
}

/** Für Tests: Idempotenz-Schlüssel einer geparsten Zeile. */
export function idempotenzForZeile(
  bankkontoId: string,
  zeile: ParsedBankZeile,
): string {
  return buildIdempotenzSchluessel(bankkontoId, zeile);
}
