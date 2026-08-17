/**
 * Zahlungsjournal (ADR-0024): Zufluss bei Zahlung, append-only.
 * Forderungsbuchung der Rechnung bleibt bei Festschreibung unangetastet.
 */

import { money } from "@/lib/money";
import {
  festschreibenBuchung,
  findStornoFuer,
  listJournalByQuelle,
  storniereBuchung,
} from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import { getRechnungMitPositionen } from "@/modules/sales/repository";
import { buildJournalInputsFromZahlung, sumZahlungen } from "./invariants";
import type { Zahlung } from "./types";

function journalAlsStaffel(e: JournalEintrag) {
  return {
    steuersatz: e.steuersatz,
    betrag_netto: e.betrag_netto,
    betrag_ust: e.betrag_ust,
    betrag_brutto: e.betrag_brutto,
  };
}

export async function listZahlungsjournal(
  firmaId: string,
  zahlungId: string,
): Promise<JournalEintrag[]> {
  return listJournalByQuelle(firmaId, "zahlung", zahlungId);
}

/** Bereits festgeschriebene, nicht stornierte Zahlungszeilen. */
export async function listAktiveZahlungsjournale(
  firmaId: string,
  zahlungId: string,
): Promise<JournalEintrag[]> {
  const items = await listJournalByQuelle(firmaId, "zahlung", zahlungId);
  const aktiv: JournalEintrag[] = [];
  for (const e of items) {
    const storno = await findStornoFuer(firmaId, e.id);
    if (!storno) aktiv.push(e);
  }
  return aktiv;
}

export function istVollstaendigBezahlt(
  betragBrutto: string,
  zahlungen: Array<Pick<Zahlung, "betrag">>,
): boolean {
  return money(sumZahlungen(zahlungen)).gte(money(betragBrutto));
}

/**
 * Schreibt Journal-Zeilen zur Zahlung, falls noch keine existieren (idempotent).
 * `bereits` = aktive Zeilen der anderen Zahlungen derselben Rechnung.
 */
export async function ensureZahlungJournal(
  firmaId: string,
  zahlung: Zahlung,
  opts: {
    bereits?: JournalEintrag[];
    vollstaendig?: boolean;
    now?: Date;
  } = {},
): Promise<JournalEintrag[]> {
  const existing = await listJournalByQuelle(firmaId, "zahlung", zahlung.id);
  if (existing.length > 0) return existing;

  const rechnung = await getRechnungMitPositionen(firmaId, zahlung.rechnung);
  if (!rechnung) {
    throw new Error("Rechnung zur Zahlung nicht gefunden.");
  }

  const inputs = buildJournalInputsFromZahlung({
    zahlung,
    rechnung,
    positionen: rechnung.positionen,
    bereits: (opts.bereits ?? []).map(journalAlsStaffel),
    vollstaendig: opts.vollstaendig ?? false,
  });

  const created: JournalEintrag[] = [];
  for (const input of inputs) {
    created.push(
      await festschreibenBuchung(firmaId, input, { now: opts.now }),
    );
  }
  return created;
}

/** Gegenbuchung zu allen Zahlungsjournal-Zeilen (idempotent je Zeile). */
export async function storniereZahlungsjournal(
  firmaId: string,
  zahlungId: string,
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date },
): Promise<JournalEintrag[]> {
  const items = await listJournalByQuelle(firmaId, "zahlung", zahlungId);
  const stornos: JournalEintrag[] = [];
  for (const e of items) {
    const already = await findStornoFuer(firmaId, e.id);
    if (already) {
      stornos.push(already);
      continue;
    }
    stornos.push(
      await storniereBuchung(firmaId, e.id, {
        buchungsdatum: opts?.buchungsdatum,
        buchungstext: opts?.buchungstext,
        now: opts?.now,
      }),
    );
  }
  return stornos;
}

export async function storniereZahlungsjournaleFuerRechnung(
  firmaId: string,
  zahlungen: Zahlung[],
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date },
): Promise<JournalEintrag[]> {
  const all: JournalEintrag[] = [];
  for (const z of zahlungen) {
    const rows = await storniereZahlungsjournal(firmaId, z.id, opts);
    all.push(...rows);
  }
  return all;
}

async function bereitsAndererZahlungen(
  firmaId: string,
  zahlungen: Zahlung[],
  aktuelleId: string,
): Promise<JournalEintrag[]> {
  const bereits: JournalEintrag[] = [];
  for (const z of zahlungen) {
    if (z.id === aktuelleId) continue;
    bereits.push(...(await listAktiveZahlungsjournale(firmaId, z.id)));
  }
  return bereits;
}

/** Alle Zahlungen einer Rechnung in Datum-/Id-Reihenfolge journalisieren. */
export async function ensureZahlungsjournaleFuerRechnung(
  firmaId: string,
  rechnungId: string,
  zahlungen: Zahlung[],
  betragBrutto: string,
  opts?: { now?: Date },
): Promise<number> {
  const geordnet = [...zahlungen].sort((a, b) => {
    if (a.datum !== b.datum) return a.datum < b.datum ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  let geschrieben = 0;
  const kumuliert: Zahlung[] = [];
  for (const z of geordnet) {
    kumuliert.push(z);
    const existing = await listJournalByQuelle(firmaId, "zahlung", z.id);
    if (existing.length > 0) continue;
    const bereits = await bereitsAndererZahlungen(firmaId, geordnet, z.id);
    const created = await ensureZahlungJournal(firmaId, z, {
      bereits,
      vollstaendig: istVollstaendigBezahlt(betragBrutto, kumuliert),
      now: opts?.now,
    });
    geschrieben += created.length;
  }
  return geschrieben;
}
