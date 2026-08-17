/**
 * Persistenz Rechnungen + Angebote über PocketBase (Superuser).
 * Rechnung: Entwurf CRUD; Festschreibung → Nummer + PDF + Journal.
 * Angebot: Entwurf CRUD; Senden → Nummer + PDF (kein Journal).
 */

import {
  allocateAngebotsnummer,
  allocateRechnungsnummer,
  createRecord,
  deleteRecord,
  fetchRecordFile,
  getFirmaById,
  getRecord,
  listRecords,
  pbEq,
  pbLike,
  type Steuermodus,
  updateRecord,
  updateRecordMultipart,
} from "@/lib/pb";
import { getKontakt } from "@/modules/contacts";
import {
  festschreibenBuchung,
  findStornoFuer,
  storniereBuchung,
} from "@/modules/journal/repository";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  ANGEBOT_GESENDET_ERROR,
  ANGEBOT_PDF_IMMUTABLE_ERROR,
  assertAngebotEntwurfEditable,
  assertAngebotEntwurfOhneNummer,
  assertCanChangeAngebotStatus,
  assertCanFestschreiben,
  assertCanPreviewAngebotPdf,
  assertCanPreviewRechnungPdf,
  assertCanServeOriginalAngebotPdf,
  assertCanServeOriginalRechnungPdf,
  assertCanStornierenRechnung,
  assertCanSenden,
  assertCanUebernehmenInRechnung,
  assertAngebotVorschauNurEntwurf,
  assertRechnungVorschauNurEntwurf,
  assertEntwurfEditable,
  assertEntwurfOhneNummer,
  buildJournalInputFromRechnung,
  defaultFaelligAm,
  defaultGueltigBis,
  FESTGESCHRIEBEN_ERROR,
  festschreibungsZeitpunktUtc,
  RECHNUNG_STORNO_ENTWURF_ERROR,
  PDF_IMMUTABLE_ERROR,
  validateAngebotInput,
  validateRechnungInput,
} from "./invariants";
import { loadDokumentLayout } from "./dokument-layout";
import { renderAngebotPdf, renderRechnungPdf } from "./pdf";
import { pdfDateiname } from "./pdf-layout";
import type {
  Angebot,
  AngebotFilter,
  AngebotInput,
  AngebotListResult,
  AngebotMitPositionen,
  Angebotsposition,
  AngebotStatus,
  Rechnung,
  RechnungFilter,
  RechnungInput,
  RechnungListResult,
  RechnungMitPositionen,
  Rechnungsposition,
  RechnungStatus,
  Steuersatz,
} from "./types";

const COL = "rechnungen";
const COL_POS = "rechnungspositionen";

type PbRechnung = {
  id: string;
  firma: string;
  kunde?: string;
  rechnungsdatum: string;
  leistungszeitraum_von?: string;
  leistungszeitraum_bis?: string;
  faellig_am?: string;
  notiz?: string;
  status: string;
  rechnungsnummer?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuermodus: string;
  pdf?: string | string[];
  journal_eintrag?: string;
  festgeschrieben_am?: string;
  created?: string;
  updated?: string;
};

type PbPosition = {
  id: string;
  firma: string;
  rechnung: string;
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit?: string;
  einzelpreis: string;
  steuersatz?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  katalog_position?: string;
};

const VALID_STATUS = new Set([
  "entwurf",
  "offen",
  "teilbezahlt",
  "bezahlt",
  "ueberfaellig",
  "storniert",
]);
const VALID_STEUERSATZ = new Set(["0", "7", "19"]);
const VALID_STEUERMODUS = new Set(["kleinunternehmer", "regelbesteuerung_ist"]);

function mapRechnung(r: PbRechnung): Rechnung {
  const status = VALID_STATUS.has(r.status)
    ? (r.status as RechnungStatus)
    : "entwurf";
  const steuermodus = VALID_STEUERMODUS.has(r.steuermodus)
    ? (r.steuermodus as Steuermodus)
    : "kleinunternehmer";

  let pdf = "";
  if (typeof r.pdf === "string") {
    pdf = r.pdf;
  } else if (Array.isArray(r.pdf) && r.pdf.length > 0) {
    pdf = String(r.pdf[0]);
  }

  return {
    id: r.id,
    firma: r.firma,
    kunde: r.kunde || null,
    rechnungsdatum: r.rechnungsdatum,
    leistungszeitraum_von: r.leistungszeitraum_von ?? "",
    leistungszeitraum_bis: r.leistungszeitraum_bis ?? "",
    faellig_am: r.faellig_am ?? "",
    notiz: r.notiz ?? "",
    status,
    rechnungsnummer: r.rechnungsnummer ?? "",
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuermodus,
    pdf,
    journal_eintrag: r.journal_eintrag || null,
    festgeschrieben_am: r.festgeschrieben_am ?? "",
    created: r.created,
    updated: r.updated,
  };
}

function mapPosition(r: PbPosition): Rechnungsposition {
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";
  return {
    id: r.id,
    firma: r.firma,
    rechnung: r.rechnung,
    sortierung: Number(r.sortierung) || 0,
    bezeichnung: r.bezeichnung,
    menge: r.menge,
    einheit: r.einheit ?? "",
    einzelpreis: r.einzelpreis,
    steuersatz,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    katalog_position: r.katalog_position || null,
  };
}

async function listPositionenForRechnung(
  firmaId: string,
  rechnungId: string,
): Promise<Rechnungsposition[]> {
  const result = await listRecords<PbPosition>(COL_POS, {
    page: 1,
    perPage: 200,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("rechnung", rechnungId)}`,
    sort: "sortierung,id",
  });
  return result.items.map(mapPosition);
}

async function replacePositionen(
  firmaId: string,
  rechnungId: string,
  positionen: ReturnType<typeof validateRechnungInput>["positionen"],
): Promise<Rechnungsposition[]> {
  // Bestehende löschen
  const existing = await listPositionenForRechnung(firmaId, rechnungId);
  for (const p of existing) {
    await deleteRecord(COL_POS, p.id);
  }

  const created: Rechnungsposition[] = [];
  for (const p of positionen) {
    const body: Record<string, unknown> = {
      firma: firmaId,
      rechnung: rechnungId,
      // sortierung muss > 0 sein (PB required number: 0 = blank)
      sortierung: p.sortierung > 0 ? p.sortierung : 1,
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      betrag_netto: p.betrag_netto,
      betrag_ust: p.betrag_ust,
      betrag_brutto: p.betrag_brutto,
    };
    // optionale Select/Relation weglassen statt null (PB-freundlicher)
    if (p.steuersatz) {
      body.steuersatz = p.steuersatz;
    }
    if (p.katalog_position) {
      body.katalog_position = p.katalog_position;
    }
    const r = await createRecord<PbPosition>(COL_POS, body);
    created.push(mapPosition(r));
  }
  return created;
}

export async function createRechnung(
  firmaId: string,
  input: RechnungInput,
): Promise<RechnungMitPositionen> {
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const steuermodus = firma.steuermodus;
  const validated = validateRechnungInput(input, steuermodus);

  const faellig_am =
    validated.faellig_am || defaultFaelligAm(validated.rechnungsdatum);

  const body: Record<string, unknown> = {
    firma: firmaId,
    rechnungsdatum: validated.rechnungsdatum,
    leistungszeitraum_von: validated.leistungszeitraum_von || null,
    leistungszeitraum_bis: validated.leistungszeitraum_bis || null,
    faellig_am: faellig_am || null,
    notiz: validated.notiz,
    status: "entwurf",
    rechnungsnummer: "",
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
  };

  const r = await createRecord<PbRechnung>(COL, body);
  const rechnung = mapRechnung(r);
  assertEntwurfOhneNummer(rechnung);

  const positionen = await replacePositionen(
    firmaId,
    rechnung.id,
    validated.positionen,
  );

  return { ...rechnung, positionen };
}

export async function updateRechnung(
  firmaId: string,
  id: string,
  input: RechnungInput,
): Promise<RechnungMitPositionen> {
  const existing = await getRechnung(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertEntwurfEditable(existing);

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  // Snapshot-Steuer-Modus der Firma beim Speichern (Entwurf folgt aktueller Einstellung)
  const steuermodus = firma.steuermodus;
  const validated = validateRechnungInput(input, steuermodus);

  const faellig_am =
    validated.faellig_am || defaultFaelligAm(validated.rechnungsdatum);

  const body: Record<string, unknown> = {
    rechnungsdatum: validated.rechnungsdatum,
    leistungszeitraum_von: validated.leistungszeitraum_von || null,
    leistungszeitraum_bis: validated.leistungszeitraum_bis || null,
    faellig_am: faellig_am || null,
    notiz: validated.notiz,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
  };

  const r = await updateRecord<PbRechnung>(COL, id, body);
  const rechnung = mapRechnung(r);
  const positionen = await replacePositionen(
    firmaId,
    id,
    validated.positionen,
  );

  return { ...rechnung, positionen };
}

export async function deleteRechnung(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getRechnung(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertEntwurfEditable(existing);

  // Positionen (cascadeDelete auf rechnung sollte greifen; explizit sicherheitshalber)
  const positionen = await listPositionenForRechnung(firmaId, id);
  for (const p of positionen) {
    await deleteRecord(COL_POS, p.id);
  }
  await deleteRecord(COL, id);
}

/**
 * Festschreibung: Rechnungsnummer + PDF + Journal + Status offen.
 * Reihenfolge: Nummer → PDF → Journal → Status (analog Belege).
 */
export async function festschreibenRechnung(
  firmaId: string,
  id: string,
  opts?: { now?: Date },
): Promise<{ rechnung: RechnungMitPositionen; journal: JournalEintrag }> {
  const existing = await getRechnungMitPositionen(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertCanFestschreiben(existing, existing.positionen);

  // Nochmal validieren mit gespeichertem Steuer-Modus
  validateRechnungInput(
    {
      kunde: existing.kunde,
      rechnungsdatum: existing.rechnungsdatum,
      leistungszeitraum_von: existing.leistungszeitraum_von,
      leistungszeitraum_bis: existing.leistungszeitraum_bis,
      faellig_am: existing.faellig_am,
      notiz: existing.notiz,
      positionen: existing.positionen.map((p) => ({
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        steuersatz: p.steuersatz,
        katalog_position: p.katalog_position,
      })),
    },
    existing.steuermodus,
  );

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }

  const kunde = existing.kunde
    ? await getKontakt(firmaId, existing.kunde)
    : null;
  if (!kunde) {
    throw new Error("Kund:in nicht gefunden.");
  }

  const now = opts?.now ?? new Date();
  const rechnungsnummer = await allocateRechnungsnummer(firmaId);

  const layout = await loadDokumentLayout(firma);
  const pdfBuffer = await renderRechnungPdf({
    rechnung: { ...existing, rechnungsnummer },
    positionen: existing.positionen,
    firma,
    kunde,
    rechnungsnummer,
    entwurf: false,
    layout,
  });

  const journalInput = buildJournalInputFromRechnung(
    { ...existing, rechnungsnummer },
    {
      rechnungId: existing.id,
      rechnungsnummer,
      kundeName: kunde.name,
      positionen: existing.positionen,
    },
  );

  const journal = await festschreibenBuchung(firmaId, journalInput, { now });

  const festgeschrieben_am = festschreibungsZeitpunktUtc(now);
  const pdfFile = new File(
    [new Uint8Array(pdfBuffer)],
    `${rechnungsnummer}.pdf`,
    { type: "application/pdf" },
  );

  const r = await updateRecordMultipart<PbRechnung>(COL, id, {
    status: "offen",
    rechnungsnummer,
    journal_eintrag: journal.id,
    festgeschrieben_am,
    pdf: pdfFile,
  });

  const rechnung = mapRechnung(r);
  return {
    rechnung: { ...rechnung, positionen: existing.positionen },
    journal,
  };
}

/** Status auf storniert setzen (idempotent, wenn bereits storniert). */
export async function markRechnungStorniert(
  firmaId: string,
  id: string,
): Promise<Rechnung> {
  const existing = await getRechnung(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  if (existing.status === "storniert") {
    return existing;
  }
  if (existing.status === "entwurf") {
    throw new Error(RECHNUNG_STORNO_ENTWURF_ERROR);
  }
  const r = await updateRecord<PbRechnung>(COL, id, { status: "storniert" });
  return mapRechnung(r);
}

/**
 * Rechnung stornieren: Journal-Gegenbuchung (falls noch keine) + Status storniert.
 * Inhalt/PDF bleiben unverändert (GoBD).
 */
export async function storniereRechnung(
  firmaId: string,
  id: string,
  opts?: { buchungsdatum?: string; buchungstext?: string; now?: Date },
): Promise<{ rechnung: Rechnung; journal: JournalEintrag | null }> {
  const existing = await getRechnung(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertCanStornierenRechnung(existing);

  let journal: JournalEintrag | null = null;
  if (existing.journal_eintrag) {
    const already = await findStornoFuer(firmaId, existing.journal_eintrag);
    if (already) {
      journal = already;
    } else {
      journal = await storniereBuchung(firmaId, existing.journal_eintrag, {
        buchungsdatum: opts?.buchungsdatum,
        buchungstext:
          opts?.buchungstext ||
          `Storno Rechnung ${existing.rechnungsnummer || existing.id}`,
        now: opts?.now,
      });
    }
  }

  const { storniereZahlungsjournaleFuerRechnung } = await import(
    "@/modules/payments/journal"
  );
  const { listZahlungenForRechnung } = await import(
    "@/modules/payments/repository"
  );
  const zahlungen = await listZahlungenForRechnung(firmaId, id);
  if (zahlungen.length > 0) {
    await storniereZahlungsjournaleFuerRechnung(firmaId, zahlungen, {
      buchungsdatum: opts?.buchungsdatum,
      buchungstext:
        opts?.buchungstext ||
        `Storno Zahlung zu Rechnung ${existing.rechnungsnummer || existing.id}`,
      now: opts?.now,
    });
  }

  const rechnung = await markRechnungStorniert(firmaId, id);
  return { rechnung, journal };
}

export async function getRechnung(
  firmaId: string,
  id: string,
): Promise<Rechnung | null> {
  try {
    const r = await getRecord<PbRechnung>(COL, id);
    if (r.firma !== firmaId) return null;
    return mapRechnung(r);
  } catch {
    return null;
  }
}

export async function getRechnungMitPositionen(
  firmaId: string,
  id: string,
): Promise<RechnungMitPositionen | null> {
  const rechnung = await getRechnung(firmaId, id);
  if (!rechnung) return null;
  const positionen = await listPositionenForRechnung(firmaId, id);
  return { ...rechnung, positionen };
}

export async function listRechnungen(
  firmaId: string,
  filter: RechnungFilter = {},
  page = 1,
  perPage = 50,
): Promise<RechnungListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.status && VALID_STATUS.has(filter.status)) {
    parts.push(pbEq("status", filter.status));
  }

  if (filter.kunde) {
    parts.push(pbEq("kunde", filter.kunde));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`rechnungsdatum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`rechnungsdatum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("rechnungsnummer", q)} || ${pbLike("notiz", q)})`,
    );
  }

  const result = await listRecords<PbRechnung>(COL, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort
    sort: "-rechnungsdatum,-id",
  });

  return {
    items: result.items.map(mapRechnung),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

/** PDF-Bytes für Download (nur eigene Firma). */
export async function getRechnungPdfResponse(
  firmaId: string,
  id: string,
): Promise<{ response: Response; filename: string; rechnung: Rechnung }> {
  const rechnung = await getRechnung(firmaId, id);
  if (!rechnung) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertCanServeOriginalRechnungPdf(rechnung);
  const response = await fetchRecordFile(COL, id, rechnung.pdf);
  const filename = pdfDateiname({
    art: "rechnung",
    entwurf: false,
    nummer: rechnung.rechnungsnummer,
  });
  return { response, filename, rechnung };
}

/**
 * On-the-fly-Vorschau eines Rechnungs-Entwurfs.
 * Kein Persistieren, kein Nummernkreis, kein Journal.
 */
export async function renderRechnungVorschauPdf(
  firmaId: string,
  id: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const existing = await getRechnungMitPositionen(firmaId, id);
  if (!existing) {
    throw new Error("Rechnung nicht gefunden.");
  }
  assertRechnungVorschauNurEntwurf(existing);
  assertCanPreviewRechnungPdf(existing, existing.positionen);

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const kunde = existing.kunde
    ? await getKontakt(firmaId, existing.kunde)
    : null;
  if (!kunde) {
    throw new Error("Kund:in nicht gefunden.");
  }

  const layout = await loadDokumentLayout(firma);
  const buffer = await renderRechnungPdf({
    rechnung: existing,
    positionen: existing.positionen,
    firma,
    kunde,
    rechnungsnummer: "",
    entwurf: true,
    layout,
  });
  return {
    buffer,
    filename: pdfDateiname({ art: "rechnung", entwurf: true }),
  };
}

/**
 * Bewusst blockierte stille Mutationen auf festgeschriebenen Rechnungen.
 */
export async function updateFestgeschriebeneRechnung(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}

export async function deleteFestgeschriebeneRechnung(): Promise<never> {
  throw new Error(FESTGESCHRIEBEN_ERROR);
}

export async function replaceRechnungPdf(): Promise<never> {
  throw new Error(PDF_IMMUTABLE_ERROR);
}

// ===========================================================================
// Angebote
// ===========================================================================

const COL_A = "angebote";
const COL_APOS = "angebotspositionen";

type PbAngebot = {
  id: string;
  firma: string;
  kunde?: string;
  angebotsdatum: string;
  gueltig_bis?: string;
  notiz?: string;
  status: string;
  angebotsnummer?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  steuermodus: string;
  pdf?: string | string[];
  gesendet_am?: string;
  rechnung?: string;
  created?: string;
  updated?: string;
};

type PbAngebotsposition = {
  id: string;
  firma: string;
  angebot: string;
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit?: string;
  einzelpreis: string;
  steuersatz?: string;
  betrag_netto: string;
  betrag_ust: string;
  betrag_brutto: string;
  katalog_position?: string;
};

const VALID_ANGEBOT_STATUS = new Set([
  "entwurf",
  "gesendet",
  "angenommen",
  "abgelehnt",
  "abgelaufen",
  "abgerechnet",
]);

function mapAngebot(r: PbAngebot): Angebot {
  const status = VALID_ANGEBOT_STATUS.has(r.status)
    ? (r.status as AngebotStatus)
    : "entwurf";
  const steuermodus = VALID_STEUERMODUS.has(r.steuermodus)
    ? (r.steuermodus as Steuermodus)
    : "kleinunternehmer";

  let pdf = "";
  if (typeof r.pdf === "string") {
    pdf = r.pdf;
  } else if (Array.isArray(r.pdf) && r.pdf.length > 0) {
    pdf = String(r.pdf[0]);
  }

  return {
    id: r.id,
    firma: r.firma,
    kunde: r.kunde || null,
    angebotsdatum: r.angebotsdatum,
    gueltig_bis: r.gueltig_bis ?? "",
    notiz: r.notiz ?? "",
    status,
    angebotsnummer: r.angebotsnummer ?? "",
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    steuermodus,
    pdf,
    gesendet_am: r.gesendet_am ?? "",
    rechnung: r.rechnung || null,
    created: r.created,
    updated: r.updated,
  };
}

function mapAngebotsposition(r: PbAngebotsposition): Angebotsposition {
  const steuersatz =
    r.steuersatz && VALID_STEUERSATZ.has(r.steuersatz)
      ? (r.steuersatz as Steuersatz)
      : "";
  return {
    id: r.id,
    firma: r.firma,
    angebot: r.angebot,
    sortierung: Number(r.sortierung) || 0,
    bezeichnung: r.bezeichnung,
    menge: r.menge,
    einheit: r.einheit ?? "",
    einzelpreis: r.einzelpreis,
    steuersatz,
    betrag_netto: r.betrag_netto,
    betrag_ust: r.betrag_ust,
    betrag_brutto: r.betrag_brutto,
    katalog_position: r.katalog_position || null,
  };
}

async function listPositionenForAngebot(
  firmaId: string,
  angebotId: string,
): Promise<Angebotsposition[]> {
  const result = await listRecords<PbAngebotsposition>(COL_APOS, {
    page: 1,
    perPage: 200,
    filter: `${pbEq("firma", firmaId)} && ${pbEq("angebot", angebotId)}`,
    sort: "sortierung,id",
  });
  return result.items.map(mapAngebotsposition);
}

async function replaceAngebotspositionen(
  firmaId: string,
  angebotId: string,
  positionen: ReturnType<typeof validateAngebotInput>["positionen"],
): Promise<Angebotsposition[]> {
  const existing = await listPositionenForAngebot(firmaId, angebotId);
  for (const p of existing) {
    await deleteRecord(COL_APOS, p.id);
  }

  const created: Angebotsposition[] = [];
  for (const p of positionen) {
    const body: Record<string, unknown> = {
      firma: firmaId,
      angebot: angebotId,
      // sortierung muss > 0 sein (PB required number: 0 = blank)
      sortierung: p.sortierung > 0 ? p.sortierung : 1,
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      betrag_netto: p.betrag_netto,
      betrag_ust: p.betrag_ust,
      betrag_brutto: p.betrag_brutto,
    };
    if (p.steuersatz) {
      body.steuersatz = p.steuersatz;
    }
    if (p.katalog_position) {
      body.katalog_position = p.katalog_position;
    }
    const r = await createRecord<PbAngebotsposition>(COL_APOS, body);
    created.push(mapAngebotsposition(r));
  }
  return created;
}

export async function createAngebot(
  firmaId: string,
  input: AngebotInput,
): Promise<AngebotMitPositionen> {
  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const steuermodus = firma.steuermodus;
  const validated = validateAngebotInput(input, steuermodus);

  const gueltig_bis =
    validated.gueltig_bis || defaultGueltigBis(validated.angebotsdatum);

  const body: Record<string, unknown> = {
    firma: firmaId,
    angebotsdatum: validated.angebotsdatum,
    gueltig_bis: gueltig_bis || null,
    notiz: validated.notiz,
    status: "entwurf",
    angebotsnummer: "",
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
  };

  const r = await createRecord<PbAngebot>(COL_A, body);
  const angebot = mapAngebot(r);
  assertAngebotEntwurfOhneNummer(angebot);

  const positionen = await replaceAngebotspositionen(
    firmaId,
    angebot.id,
    validated.positionen,
  );

  return { ...angebot, positionen };
}

export async function updateAngebot(
  firmaId: string,
  id: string,
  input: AngebotInput,
): Promise<AngebotMitPositionen> {
  const existing = await getAngebot(firmaId, id);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertAngebotEntwurfEditable(existing);

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const steuermodus = firma.steuermodus;
  const validated = validateAngebotInput(input, steuermodus);

  const gueltig_bis =
    validated.gueltig_bis || defaultGueltigBis(validated.angebotsdatum);

  const body: Record<string, unknown> = {
    angebotsdatum: validated.angebotsdatum,
    gueltig_bis: gueltig_bis || null,
    notiz: validated.notiz,
    betrag_netto: validated.betrag_netto,
    betrag_ust: validated.betrag_ust,
    betrag_brutto: validated.betrag_brutto,
    steuermodus,
    kunde: validated.kunde || null,
  };

  const r = await updateRecord<PbAngebot>(COL_A, id, body);
  const angebot = mapAngebot(r);
  const positionen = await replaceAngebotspositionen(
    firmaId,
    id,
    validated.positionen,
  );

  return { ...angebot, positionen };
}

export async function deleteAngebot(
  firmaId: string,
  id: string,
): Promise<void> {
  const existing = await getAngebot(firmaId, id);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertAngebotEntwurfEditable(existing);

  const positionen = await listPositionenForAngebot(firmaId, id);
  for (const p of positionen) {
    await deleteRecord(COL_APOS, p.id);
  }
  await deleteRecord(COL_A, id);
}

/**
 * Senden: Angebotsnummer + PDF + Status gesendet.
 * Kein Journal (erst bei Rechnung).
 */
export async function sendenAngebot(
  firmaId: string,
  id: string,
  opts?: { now?: Date },
): Promise<AngebotMitPositionen> {
  const existing = await getAngebotMitPositionen(firmaId, id);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertCanSenden(existing, existing.positionen);

  validateAngebotInput(
    {
      kunde: existing.kunde,
      angebotsdatum: existing.angebotsdatum,
      gueltig_bis: existing.gueltig_bis,
      notiz: existing.notiz,
      positionen: existing.positionen.map((p) => ({
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        steuersatz: p.steuersatz,
        katalog_position: p.katalog_position,
      })),
    },
    existing.steuermodus,
  );

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }

  const kunde = existing.kunde
    ? await getKontakt(firmaId, existing.kunde)
    : null;
  if (!kunde) {
    throw new Error("Kund:in nicht gefunden.");
  }

  const now = opts?.now ?? new Date();
  const angebotsnummer = await allocateAngebotsnummer(firmaId);

  const layout = await loadDokumentLayout(firma);
  const pdfBuffer = await renderAngebotPdf({
    angebot: { ...existing, angebotsnummer },
    positionen: existing.positionen,
    firma,
    kunde,
    angebotsnummer,
    entwurf: false,
    layout,
  });

  const gesendet_am = festschreibungsZeitpunktUtc(now);
  const pdfFile = new File(
    [new Uint8Array(pdfBuffer)],
    `${angebotsnummer}.pdf`,
    { type: "application/pdf" },
  );

  const r = await updateRecordMultipart<PbAngebot>(COL_A, id, {
    status: "gesendet",
    angebotsnummer,
    gesendet_am,
    pdf: pdfFile,
  });

  const angebot = mapAngebot(r);
  return { ...angebot, positionen: existing.positionen };
}

/**
 * Manueller Statuswechsel light (kein Inhalts-Edit).
 */
export async function setAngebotStatus(
  firmaId: string,
  id: string,
  ziel: AngebotStatus,
): Promise<Angebot> {
  const existing = await getAngebot(firmaId, id);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertCanChangeAngebotStatus(existing, ziel);

  const r = await updateRecord<PbAngebot>(COL_A, id, { status: ziel });
  return mapAngebot(r);
}

/**
 * Angenommenes Angebot → Rechnungs-Entwurf (Positionen kopieren, verknüpfen).
 * Setzt Angebot auf abgerechnet.
 */
export async function uebernehmenAlsRechnung(
  firmaId: string,
  angebotId: string,
): Promise<{ angebot: Angebot; rechnung: RechnungMitPositionen }> {
  const existing = await getAngebotMitPositionen(firmaId, angebotId);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertCanUebernehmenInRechnung(existing);

  const notizParts = [
    existing.angebotsnummer
      ? `Übernommen aus Angebot ${existing.angebotsnummer}`
      : "Übernommen aus Angebot",
    existing.notiz,
  ].filter(Boolean);

  const rechnung = await createRechnung(firmaId, {
    kunde: existing.kunde,
    rechnungsdatum: existing.angebotsdatum,
    notiz: notizParts.join(" — ").slice(0, 2000),
    positionen: existing.positionen.map((p) => ({
      bezeichnung: p.bezeichnung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      steuersatz: p.steuersatz,
      katalog_position: p.katalog_position,
    })),
  });

  const r = await updateRecord<PbAngebot>(COL_A, angebotId, {
    status: "abgerechnet",
    rechnung: rechnung.id,
  });

  return { angebot: mapAngebot(r), rechnung };
}

export async function getAngebot(
  firmaId: string,
  id: string,
): Promise<Angebot | null> {
  try {
    const r = await getRecord<PbAngebot>(COL_A, id);
    if (r.firma !== firmaId) return null;
    return mapAngebot(r);
  } catch {
    return null;
  }
}

export async function getAngebotMitPositionen(
  firmaId: string,
  id: string,
): Promise<AngebotMitPositionen | null> {
  const angebot = await getAngebot(firmaId, id);
  if (!angebot) return null;
  const positionen = await listPositionenForAngebot(firmaId, id);
  return { ...angebot, positionen };
}

export async function listAngebote(
  firmaId: string,
  filter: AngebotFilter = {},
  page = 1,
  perPage = 50,
): Promise<AngebotListResult> {
  const parts = [pbEq("firma", firmaId)];

  if (filter.status && VALID_ANGEBOT_STATUS.has(filter.status)) {
    parts.push(pbEq("status", filter.status));
  }

  if (filter.kunde) {
    parts.push(pbEq("kunde", filter.kunde));
  }

  const von = filter.von?.trim();
  if (von) {
    parts.push(`angebotsdatum >= "${von.replace(/"/g, "")}"`);
  }
  const bis = filter.bis?.trim();
  if (bis) {
    parts.push(`angebotsdatum <= "${bis.replace(/"/g, "")}"`);
  }

  const q = filter.q?.trim();
  if (q) {
    parts.push(
      `(${pbLike("angebotsnummer", q)} || ${pbLike("notiz", q)})`,
    );
  }

  const result = await listRecords<PbAngebot>(COL_A, {
    page,
    perPage,
    filter: parts.join(" && "),
    // PB 0.39: kein system-created-Sort
    sort: "-angebotsdatum,-id",
  });

  return {
    items: result.items.map(mapAngebot),
    totalItems: result.totalItems,
    page: result.page,
    perPage: result.perPage,
    totalPages: result.totalPages,
  };
}

export async function getAngebotPdfResponse(
  firmaId: string,
  id: string,
): Promise<{ response: Response; filename: string; angebot: Angebot }> {
  const angebot = await getAngebot(firmaId, id);
  if (!angebot) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertCanServeOriginalAngebotPdf(angebot);
  const response = await fetchRecordFile(COL_A, id, angebot.pdf);
  const filename = pdfDateiname({
    art: "angebot",
    entwurf: false,
    nummer: angebot.angebotsnummer,
  });
  return { response, filename, angebot };
}

/**
 * On-the-fly-Vorschau eines Angebots-Entwurfs.
 * Kein Persistieren, kein Nummernkreis.
 */
export async function renderAngebotVorschauPdf(
  firmaId: string,
  id: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const existing = await getAngebotMitPositionen(firmaId, id);
  if (!existing) {
    throw new Error("Angebot nicht gefunden.");
  }
  assertAngebotVorschauNurEntwurf(existing);
  assertCanPreviewAngebotPdf(existing, existing.positionen);

  const firma = await getFirmaById(firmaId);
  if (!firma) {
    throw new Error("Firma nicht gefunden.");
  }
  const kunde = existing.kunde
    ? await getKontakt(firmaId, existing.kunde)
    : null;
  if (!kunde) {
    throw new Error("Kund:in nicht gefunden.");
  }

  const layout = await loadDokumentLayout(firma);
  const buffer = await renderAngebotPdf({
    angebot: existing,
    positionen: existing.positionen,
    firma,
    kunde,
    angebotsnummer: "",
    entwurf: true,
    layout,
  });
  return {
    buffer,
    filename: pdfDateiname({ art: "angebot", entwurf: true }),
  };
}

export async function updateGesendetesAngebot(): Promise<never> {
  throw new Error(ANGEBOT_GESENDET_ERROR);
}

export async function deleteGesendetesAngebot(): Promise<never> {
  throw new Error(ANGEBOT_GESENDET_ERROR);
}

export async function replaceAngebotPdf(): Promise<never> {
  throw new Error(ANGEBOT_PDF_IMMUTABLE_ERROR);
}
