/**
 * Persistenz Belege über PocketBase (Superuser).
 * Entwurf: CRUD + Datei; Festschreibung → Journal (ADR-0004/0006/0012).
 */

import {
  allocateBelegnummer,
  createRecord,
  createRecordMultipart,
  deleteRecord,
  fetchRecordFile,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  updateRecord,
  updateRecordMultipart,
} from "@/lib/pb";
import { festschreibenBuchung } from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  assertCanFestschreiben,
  assertEntwurfEditable,
  buildJournalInputFromBeleg,
  DATEI_IMMUTABLE_ERROR,
  FESTGESCHRIEBEN_ERROR,
  festschreibungsZeitpunktUtc,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";
import type {
  Beleg,
  BelegFilter,
  BelegInput,
  BelegListResult,
  BelegStatus,
  Buchungsrichtung,
  Steuersatz,
} from "./types";

const COL = "belege";

type PbBeleg = {
  id: string;
  firma: string;
  belegdatum: string;
  buchungsdatum?: string;
  richtung: string;
  lieferant?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuersatz?: string;
  kategorie?: string;
  notiz?: string;
  konto?: string;
  status: string;
  datei?: string | string[];
  belegnummer?: string;
  journal_eintrag?: string;
  festgeschrieben_am?: string;
  created?: string;
  updated?: string;
};

const VALID_RICHTUNG = new Set(["einnahme", "ausgabe"]);
const VALID_STATUS = new Set(["entwurf", "festgeschrieben"]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);

function mapBeleg(r: PbBeleg): Beleg {
  const richtung = VALID_RICHTUNG.has(r.richtung)
    ? (r.richtung as Buchungsrichtung)
    : "ausgabe";
  const status = VALID_STATUS.has(r.status)
    ? (r.status as BelegStatus)
    : "entwurf";
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";

  // PB file field: string filename or array
  let datei = "";
  if (typeof r.datei === "string") {
    datei = r.datei;
  } else if (Array.isArray(r.datei) && r.datei.length > 0) {
    datei = String(r.datei[0]);
  }

  return {
    id: r.id,
    firma: r.firma,
    belegdatum: r.belegdatum,
    buchungsdatum: r.buchungsdatum ?? "",
    richtung,
    lieferant: r.lieferant || null,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuersatz,
    kategorie: r.kategorie ?? "",
    notiz: r.notiz ?? "",
    konto: r.konto ?? "",
    status,
    datei,
    belegnummer: r.belegnummer ?? "",
    journal_eintrag: r.journal_eintrag || null,
    festgeschrieben_am: r.festgeschrieben_am ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function toPbBody(
  validated: ReturnType<typeof validateBelegInput>,
  firmaId: string,
  status: BelegStatus = "entwurf",
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    firma: firmaId,
    belegdatum: validated.belegdatum,
    buchungsdatum: validated.buchungsdatum,
    richtung: validated.richtung,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuersatz: validated.steuersatz || null,
    kategorie: validated.kategorie,
    notiz: validated.notiz,
    konto: validated.konto,
    status,
  };
  if (validated.lieferant) {
    body.lieferant = validated.lieferant;
  } else {
    body.lieferant = null;
  }
  return body;
}

export async function createBeleg(
  firmaId: string,
  input: BelegInput,
  opts?: { datei?: File | Blob | null },
): Promise<Beleg> {
  const validated = validateBelegInput(input);
  const body = toPbBody(validated, firmaId, "entwurf");

  if (opts?.datei) {
    validateBelegDatei(opts.datei as File);
    const fields: Record<string, string | Blob> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === null || v === undefined) {
        // PB multipart: leere Relation weglassen
        if (k === "lieferant" || k === "steuersatz") continue;
        fields[k] = "";
      } else {
        fields[k] = String(v);
      }
    }
    const file = opts.datei;
    const filename =
      file instanceof File && file.name ? file.name : "beleg.bin";
    fields.datei = new File([file], filename, {
      type: file.type || "application/octet-stream",
    });
    const r = await createRecordMultipart<PbBeleg>(COL, fields);
    return mapBeleg(r);
  }

  const r = await createRecord<PbBeleg>(COL, body);
  return mapBeleg(r);
}

export async function updateBeleg(
  firmaId: string,
  id: string,
  input: BelegInput,
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  assertEntwurfEditable(existing);

  const validated = validateBelegInput(input);
  const body = toPbBody(validated, firmaId, "entwurf");
  // firma/status nicht umschreiben unnötig
  delete body.firma;
  delete body.status;

  const r = await updateRecord<PbBeleg>(COL, id, body);
  return mapBeleg(r);
}

/**
 * Datei an Entwurf anhängen/ersetzen.
 * Nach Festschreibung blockiert (ADR-0012).
 */
export async function setBelegDatei(
  firmaId: string,
  id: string,
  file: File | Blob,
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!isEntwurfStatus(existing)) {
    throw new Error(DATEI_IMMUTABLE_ERROR);
  }
  validateBelegDatei(file as File);

  const filename =
    file instanceof File && file.name ? file.name : "beleg.bin";
  const blob = new File([file], filename, {
    type: file.type || "application/octet-stream",
  });

  const r = await updateRecordMultipart<PbBeleg>(COL, id, { datei: blob });
  return mapBeleg(r);
}

/** Datei vom Entwurf entfernen. */
export async function clearBelegDatei(
  firmaId: string,
  id: string,
): Promise<Beleg> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!isEntwurfStatus(existing)) {
    throw new Error(DATEI_IMMUTABLE_ERROR);
  }
  // PB: leerer String löscht File-Feld
  const r = await updateRecordMultipart<PbBeleg>(COL, id, { datei: "" });
  return mapBeleg(r);
}

function isEntwurfStatus(b: Beleg): boolean {
  return b.status === "entwurf";
}

export async function deleteBeleg(firmaId: string, id: string): Promise<void> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  assertEntwurfEditable(existing);
  await deleteRecord(COL, id);
}

/**
 * Festschreibung: Belegnummer + Journal-Eintrag + Status atomar im Domain-Service.
 * Reihenfolge: Nummernkreis → Journal → Beleg-Status (Journal append-only).
 */
export async function festschreibenBeleg(
  firmaId: string,
  id: string,
  opts?: { now?: Date },
): Promise<{ beleg: Beleg; journal: JournalEintrag }> {
  const existing = await getBeleg(firmaId, id);
  if (!existing) {
    throw new Error("Beleg nicht gefunden.");
  }
  assertCanFestschreiben(existing);

  // Nochmal validieren (Beträge/Daten konsistent)
  validateBelegInput({
    belegdatum: existing.belegdatum,
    buchungsdatum: existing.buchungsdatum || existing.belegdatum,
    richtung: existing.richtung,
    lieferant: existing.lieferant,
    betrag_netto: existing.betrag_netto,
    betrag_ust: existing.betrag_ust,
    betrag_brutto: existing.betrag_brutto,
    steuersatz: existing.steuersatz,
    kategorie: existing.kategorie,
    notiz: existing.notiz,
    konto: existing.konto,
  });

  const now = opts?.now ?? new Date();
  const belegnummer = await allocateBelegnummer(firmaId);

  const journalInput = buildJournalInputFromBeleg(
    { ...existing, belegnummer },
    { belegId: existing.id, belegnummer },
  );

  const journal = await festschreibenBuchung(firmaId, journalInput, { now });

  const festgeschrieben_am = festschreibungsZeitpunktUtc(now);
  const r = await updateRecord<PbBeleg>(COL, id, {
    status: "festgeschrieben",
    belegnummer,
    journal_eintrag: journal.id,
    festgeschrieben_am,
    buchungsdatum: existing.buchungsdatum || existing.belegdatum,
  });

  return { beleg: mapBeleg(r), journal };
}

export async function getBeleg(
  firmaId: string,
  id: string,
): Promise<Beleg | null> {
  try {
    const r = await getRecord<PbBeleg>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapBeleg(r);
  } catch {
    return null;
  }
}

export async function listBelege(
  firmaId: string,
  filter: BelegFilter = {},
  page = 1,
  perPage = 50,
): Promise<BelegListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.status === "entwurf" || filter.status === "festgeschrieben") {
    parts.push(pbEq("status", filter.status));
  }

  if (filter.richtung === "einnahme" || filter.richtung === "ausgabe") {
    parts.push(pbEq("richtung", filter.richtung));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`belegdatum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`belegdatum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("kategorie", q)} || ${pbLike("notiz", q)} || ${pbLike("belegnummer", q)} || ${pbLike("konto", q)})`,
    );
  }

  const result = await listRecords<PbBeleg>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort (Feld nicht in Collection) — id als Tiebreaker
    sort: "-belegdatum,-id",
  });

  return {
    items: result.items.map(mapBeleg),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/** Kategorie-Schnappschüsse zu bekannten IDs (eine Filterwelle je 50, Solo-Volumen). */
export async function listBelegeByIds(
  firmaId: string,
  ids: string[],
): Promise<Beleg[]> {
  const unique = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (unique.length === 0) return [];
  const out: Beleg[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const result = await listRecords<PbBeleg>(COL, {
      page: 1,
      perPage: 50,
      filter: `${pbEq("firma", firmaId)} && (${chunk.map((id) => pbEq("id", id)).join(" || ")})`,
    });
    out.push(...result.items.map(mapBeleg));
  }
  return out;
}

/** Datei-Bytes für Download (nur eigene Firma). */
export async function getBelegDateiResponse(
  firmaId: string,
  id: string,
): Promise<{ response: Response; filename: string; beleg: Beleg }> {
  const beleg = await getBeleg(firmaId, id);
  if (!beleg) {
    throw new Error("Beleg nicht gefunden.");
  }
  if (!beleg.datei) {
    throw new Error("Keine Datei am Beleg.");
  }
  const response = await fetchRecordFile(COL, id, beleg.datei);
  return { response, filename: beleg.datei, beleg };
}

/**
 * Bewusst blockierte stille Mutationen auf festgeschriebenen Belegen.
 */
export async function updateFestgeschriebenenBeleg(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}

export async function deleteFestgeschriebenenBeleg(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}
