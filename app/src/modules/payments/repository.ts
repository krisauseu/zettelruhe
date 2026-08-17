/**
 * Persistenz Zahlungen über PocketBase (Superuser).
 * Anlegen/Löschen light; Rechnungsstatus aus Zahlungen ableiten.
 * Anlegen schreibt Zufluss-Journal (ADR-0024); Löschen storniert es.
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
import { getKontakt } from "@/modules/contacts";
import {
  getRechnung,
  listRechnungen,
} from "@/modules/sales/repository";
import type { Rechnung, RechnungStatus } from "@/modules/sales/types";
import {
  ensureZahlungJournal,
  ensureZahlungsjournaleFuerRechnung,
  istVollstaendigBezahlt,
  listAktiveZahlungsjournale,
  storniereZahlungsjournal,
} from "./journal";
import {
  assertKeineUeberzahlung,
  assertRechnungZahlungsfaehig,
  deriveRechnungStatus,
  offenerBetrag,
  sumZahlungen,
  todayBerlin,
  validateZahlungInput,
} from "./invariants";
import type {
  OffenerPosten,
  Zahlung,
  ZahlungFilter,
  ZahlungInput,
  ZahlungListResult,
  Zahlungsweg,
} from "./types";

const COL = "zahlungen";
const COL_RECHNUNG = "rechnungen";

type PbZahlung = {
  id: string;
  firma: string;
  rechnung: string;
  datum: string;
  betrag: string;
  zahlungsweg?: string;
  notiz?: string;
  created?: string;
  updated?: string;
};

const VALID_WEG = new Set(["bar", "ueberweisung", "sonstiges"]);

function mapZahlung(r: PbZahlung): Zahlung {
  const zahlungsweg =
    r.zahlungsweg && VALID_WEG.has(r.zahlungsweg)
      ? (r.zahlungsweg as Zahlungsweg)
      : "";
  return {
    id: r.id,
    firma: r.firma,
    rechnung: r.rechnung,
    datum: r.datum,
    betrag: r.betrag,
    zahlungsweg,
    notiz: r.notiz ?? "",
    created: r.created,
    updated: r.updated,
  };
}

export async function listZahlungenForRechnung(
  firmaId: string,
  rechnungId: string,
): Promise<Zahlung[]> {
  const result = await listRecords<PbZahlung>(COL, {
    page: 1,
    perPage: 200,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("rechnung", rechnungId)}`,
    // PB 0.39: kein system-created-Sort
    sort: "-datum,-id",
  });
  return result.items.map(mapZahlung);
}

export async function listZahlungen(
  firmaId: string,
  filter: ZahlungFilter = {},
  page = 1,
  perPage = 50,
): Promise<ZahlungListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.rechnung) {
    parts.push(pbEq("rechnung", filter.rechnung));
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
    parts.push(`(${pbLike("notiz", q)})`);
  }

  const result = await listRecords<PbZahlung>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    sort: "-datum,-id",
  });

  return {
    items: result.items.map(mapZahlung),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function getZahlung(
  firmaId: string,
  id: string,
): Promise<Zahlung | null> {
  try {
    const r = await getRecord<PbZahlung>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapZahlung(r);
  } catch {
    return null;
  }
}

/**
 * Setzt Rechnungsstatus aus aktuellen Zahlungen (+ Fälligkeit).
 * Nur Status-Feld — PDF/Journal/Nummer bleiben unverändert.
 */
async function syncRechnungStatus(
  firmaId: string,
  rechnung: Rechnung,
  zahlungen: Zahlung[],
  opts?: { heute?: string },
): Promise<RechnungStatus> {
  const next = deriveRechnungStatus({
    currentStatus: rechnung.status,
    betragBrutto: rechnung.betrag_brutto,
    zahlungen,
    faellig_am: rechnung.faellig_am,
    heute: opts?.heute,
  });

  if (next !== rechnung.status) {
    await updateRecord(COL_RECHNUNG, rechnung.id, { status: next });
  }
  return next;
}

/**
 * Zahlung anlegen + Rechnungsstatus ableiten + Zufluss-Journal (ADR-0024).
 */
export async function createZahlung(
  firmaId: string,
  input: ZahlungInput,
  opts?: { heute?: string; now?: Date },
): Promise<{ zahlung: Zahlung; status: RechnungStatus; offen: string }> {
  const validated = validateZahlungInput(input);

  const rechnung = await getRechnung(firmaId, validated.rechnung);
  if (!rechnung) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertRechnungZahlungsfaehig(rechnung);

  const bestehende = await listZahlungenForRechnung(firmaId, rechnung.id);
  assertKeineUeberzahlung(
    rechnung.betrag_brutto,
    bestehende,
    validated.betrag,
  );

  const body: Record<string, unknown> = {
    firma: firmaId,
    rechnung: rechnung.id,
    datum: validated.datum,
    betrag: validated.betrag,
    notiz: validated.notiz,
  };
  if (validated.zahlungsweg) {
    body.zahlungsweg = validated.zahlungsweg;
  }

  const r = await createRecord<PbZahlung>(COL, body);
  const zahlung = mapZahlung(r);
  const alle = [...bestehende, zahlung];

  try {
    await ensureZahlungsjournaleFuerRechnung(
      firmaId,
      rechnung.id,
      bestehende,
      rechnung.betrag_brutto,
      { now: opts?.now },
    );
    const bereits = (
      await Promise.all(
        bestehende.map((z) => listAktiveZahlungsjournale(firmaId, z.id)),
      )
    ).flat();
    await ensureZahlungJournal(firmaId, zahlung, {
      bereits,
      vollstaendig: istVollstaendigBezahlt(rechnung.betrag_brutto, alle),
      now: opts?.now,
    });
  } catch (e) {
    await storniereZahlungsjournal(firmaId, zahlung.id).catch(() => undefined);
    await deleteRecord(COL, zahlung.id);
    throw e;
  }

  const status = await syncRechnungStatus(firmaId, rechnung, alle, {
    heute: opts?.heute,
  });
  const offen = offenerBetrag(rechnung.betrag_brutto, alle);

  return { zahlung, status, offen };
}

/**
 * Zahlung löschen light (Korrektur) + Status neu ableiten.
 * Zahlungsjournal wird storniert (nicht still gelöscht).
 */
export async function deleteZahlung(
  firmaId: string,
  id: string,
  opts?: { heute?: string; now?: Date },
): Promise<{ status: RechnungStatus | null; offen: string | null }> {
  const existing = await getZahlung(firmaId, id);
  if (!existing) {
    throw new Error("Zahlung nicht gefunden.");
  }

  const rechnung = await getRechnung(firmaId, existing.rechnung);
  await storniereZahlungsjournal(firmaId, existing.id, {
    buchungstext: rechnung
      ? `Storno Zahlung zu Rechnung ${rechnung.rechnungsnummer || rechnung.id}`
      : undefined,
    now: opts?.now,
  });
  await deleteRecord(COL, id);

  if (!rechnung) {
    return { status: null, offen: null };
  }

  const rest = await listZahlungenForRechnung(firmaId, rechnung.id);
  const status = await syncRechnungStatus(firmaId, rechnung, rest, {
    heute: opts?.heute,
  });
  const offen = offenerBetrag(rechnung.betrag_brutto, rest);
  return { status, offen };
}

/** Aggregat: bezahlt + offen für eine Rechnung. */
export async function getZahlungsstand(
  firmaId: string,
  rechnungId: string,
): Promise<{
  zahlungen: Zahlung[];
  bezahlt: string;
  offen: string;
  brutto: string;
} | null> {
  const rechnung = await getRechnung(firmaId, rechnungId);
  if (!rechnung) return null;
  const zahlungen = await listZahlungenForRechnung(firmaId, rechnungId);
  const bezahlt = sumZahlungen(zahlungen);
  const offen = offenerBetrag(rechnung.betrag_brutto, zahlungen);
  return {
    zahlungen,
    bezahlt,
    offen,
    brutto: rechnung.betrag_brutto,
  };
}

/**
 * Offene Posten light: festgeschriebene Rechnungen mit Restbetrag > 0.
 * Lädt Rechnungen seitenweise und filtert clientseitig (light, kleine Datenmengen).
 */
export async function listOffenePosten(
  firmaId: string,
  page = 1,
  perPage = 50,
): Promise<{
  items: OffenerPosten[];
  totalItems: number;
  page: number;
  perPage: number;
  totalPages: number;
}> {
  // Alle nicht-entwurf / nicht-bezahlt / nicht-storniert
  const statuses: RechnungStatus[] = ["offen", "teilbezahlt", "ueberfaellig"];
  const all: OffenerPosten[] = [];

  for (const status of statuses) {
    let p = 1;
    // Hard cap: max 5 Seiten à 100 pro Status (light)
    while (p <= 5) {
      const result = await listRechnungen(firmaId, { status }, p, 100);
      for (const r of result.items) {
        const zahlungen = await listZahlungenForRechnung(firmaId, r.id);
        const bezahlt = sumZahlungen(zahlungen);
        const offen = offenerBetrag(r.betrag_brutto, zahlungen);
        if (moneyGtZero(offen)) {
          let kundeName: string | null = null;
          if (r.kunde) {
            const k = await getKontakt(firmaId, r.kunde);
            kundeName = k?.name ?? null;
          }
          all.push({
            rechnungId: r.id,
            rechnungsnummer: r.rechnungsnummer,
            rechnungsdatum: r.rechnungsdatum,
            faellig_am: r.faellig_am,
            kundeId: r.kunde,
            kundeName,
            status: r.status,
            betrag_brutto: r.betrag_brutto,
            bezahlt,
            offen,
          });
        }
      }
      if (p >= result.totalPages) break;
      p += 1;
    }
  }

  // Sort: Fälligkeit, dann Datum
  all.sort((a, b) => {
    const fa = a.faellig_am || "9999-99-99";
    const fb = b.faellig_am || "9999-99-99";
    if (fa !== fb) return fa < fb ? -1 : 1;
    if (a.rechnungsdatum !== b.rechnungsdatum) {
      return a.rechnungsdatum < b.rechnungsdatum ? 1 : -1;
    }
    return a.rechnungsnummer.localeCompare(b.rechnungsnummer);
  });

  const totalItems = all.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * perPage;
  const items = all.slice(start, start + perPage);

  return {
    items,
    totalItems,
    page: safePage,
    perPage,
    totalPages,
  };
}

const nachzugDone = new Set<string>();

/**
 * Bestehende Zahlungen ohne Journal nachziehen (idempotent).
 * Einmal je Prozess und Firma — weitere Aufrufe sind no-op.
 */
export async function nachziehenZahlungsjournale(
  firmaId: string,
  opts?: { now?: Date; force?: boolean },
): Promise<number> {
  if (!firmaId) return 0;
  if (!opts?.force && nachzugDone.has(firmaId)) return 0;

  let geschrieben = 0;
  let page = 1;
  const byRechnung = new Map<string, Zahlung[]>();

  while (page <= 50) {
    const result = await listZahlungen(firmaId, {}, page, 200);
    for (const z of result.items) {
      const list = byRechnung.get(z.rechnung) ?? [];
      list.push(z);
      byRechnung.set(z.rechnung, list);
    }
    if (page >= result.totalPages || result.items.length === 0) break;
    page += 1;
  }

  for (const [rechnungId, zahlungen] of byRechnung) {
    const rechnung = await getRechnung(firmaId, rechnungId);
    if (!rechnung) continue;
    geschrieben += await ensureZahlungsjournaleFuerRechnung(
      firmaId,
      rechnungId,
      zahlungen,
      rechnung.betrag_brutto,
      { now: opts?.now },
    );
  }

  nachzugDone.add(firmaId);
  return geschrieben;
}

/** Nachzug für die aktive Firma; Fehler dürfen die App nicht blockieren. */
export async function nachziehenZahlungsjournaleEinmal(
  firmaId: string,
): Promise<void> {
  try {
    await nachziehenZahlungsjournale(firmaId);
  } catch (e) {
    console.error("Zahlungsjournal-Nachzug fehlgeschlagen:", e);
  }
}

function moneyGtZero(s: string): boolean {
  // Avoid importing money cycle issues — simple check
  const n = Number.parseFloat(s);
  return Number.isFinite(n) && n > 0;
}

/**
 * Optional: Überfälligkeit für offene Rechnungen ohne Zahlungen nachziehen
 * (z. B. beim Anzeigen). Idempotent.
 */
export async function refreshRechnungZahlungsstatus(
  firmaId: string,
  rechnungId: string,
  opts?: { heute?: string },
): Promise<RechnungStatus | null> {
  const rechnung = await getRechnung(firmaId, rechnungId);
  if (!rechnung) return null;
  if (
    rechnung.status === "entwurf" ||
    rechnung.status === "storniert" ||
    rechnung.status === "bezahlt"
  ) {
    return rechnung.status;
  }
  const zahlungen = await listZahlungenForRechnung(firmaId, rechnungId);
  return syncRechnungStatus(firmaId, rechnung, zahlungen, {
    heute: opts?.heute ?? todayBerlin(),
  });
}
