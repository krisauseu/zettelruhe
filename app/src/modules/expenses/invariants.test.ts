import { describe, expect, it } from "vitest";
import {
  assertCanFestschreiben,
  assertEntwurfEditable,
  buildBuchungstextFromBeleg,
  buildJournalInputFromBeleg,
  DATEI_IMMUTABLE_ERROR,
  FESTGESCHRIEBEN_ERROR,
  isEntwurf,
  isFestgeschrieben,
  validateBelegDatei,
  validateBelegInput,
} from "./invariants";
import type { Beleg } from "./types";

function sampleBeleg(over: Partial<Beleg> = {}): Beleg {
  return {
    id: "b1",
    firma: "f1",
    belegdatum: "2026-08-11",
    buchungsdatum: "2026-08-11",
    richtung: "ausgabe",
    lieferant: null,
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuersatz: "19",
    kategorie: "Büro",
    notiz: "Stifte",
    konto: "4930",
    status: "entwurf",
    datei: "",
    belegnummer: "",
    journal_eintrag: null,
    festgeschrieben_am: "",
    ...over,
  };
}

describe("validateBelegInput", () => {
  it("normalisiert Beträge und Default-Buchungsdatum", () => {
    const v = validateBelegInput({
      belegdatum: "2026-08-11",
      richtung: "ausgabe",
      betrag_netto: "100,00",
      steuersatz: "19",
      kategorie: "Büro",
    });
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("19.00");
    expect(v.betrag_brutto).toBe("119.00");
    expect(v.buchungsdatum).toBe("2026-08-11");
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "11.08.2026",
        richtung: "ausgabe",
        betrag_netto: "10",
      }),
    ).toThrow(/Belegdatum/);
  });

  it("lehnt Nullbetrag ab", () => {
    expect(() =>
      validateBelegInput({
        belegdatum: "2026-08-11",
        richtung: "ausgabe",
        betrag_netto: "0",
      }),
    ).toThrow(/größer als 0/i);
  });
});

describe("Entwurf vs. Festschreibung", () => {
  it("erkennt Status", () => {
    expect(isEntwurf(sampleBeleg())).toBe(true);
    expect(isFestgeschrieben(sampleBeleg({ status: "festgeschrieben" }))).toBe(
      true,
    );
  });

  it("blockiert Edit nach Festschreibung", () => {
    expect(() =>
      assertEntwurfEditable(sampleBeleg({ status: "festgeschrieben" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
  });

  it("erlaubt Festschreiben nur für Entwurf ohne Journal", () => {
    expect(() => assertCanFestschreiben(sampleBeleg())).not.toThrow();
    expect(() =>
      assertCanFestschreiben(sampleBeleg({ status: "festgeschrieben" })),
    ).toThrow(/Nur Entwürfe/);
    expect(() =>
      assertCanFestschreiben(sampleBeleg({ journal_eintrag: "j1" })),
    ).toThrow(/verknüpft/);
  });
});

describe("buildJournalInputFromBeleg", () => {
  it("setzt quelle_typ=beleg und Beträge", () => {
    const b = sampleBeleg({ lieferant: "k1" });
    const j = buildJournalInputFromBeleg(b, {
      belegId: "b1",
      belegnummer: "B-0001",
    });
    expect(j.quelle_typ).toBe("beleg");
    expect(j.quelle_id).toBe("b1");
    expect(j.betrag_brutto).toBe("119.00");
    expect(j.kontakt).toBe("k1");
    expect(j.buchungstext).toMatch(/B-0001/);
    expect(j.buchungstext).toMatch(/Büro/);
  });
});

describe("buildBuchungstextFromBeleg", () => {
  it("fällt auf Richtungslabel zurück", () => {
    expect(
      buildBuchungstextFromBeleg({
        kategorie: "",
        notiz: "",
        richtung: "ausgabe",
      }),
    ).toBe("Ausgabenbeleg");
  });
});

describe("validateBelegDatei", () => {
  it("akzeptiert PDF", () => {
    expect(() =>
      validateBelegDatei({ type: "application/pdf", size: 100 }),
    ).not.toThrow();
  });

  it("lehnt zu große Datei ab", () => {
    expect(() =>
      validateBelegDatei({
        type: "application/pdf",
        size: 20 * 1024 * 1024,
      }),
    ).toThrow(/zu groß/i);
  });

  it("lehnt unzulässigen MIME ab", () => {
    expect(() =>
      validateBelegDatei({ type: "application/zip", size: 100 }),
    ).toThrow(/Dateityp/);
  });
});

describe("DATEI_IMMUTABLE_ERROR", () => {
  it("ist gesetzt (ADR-0012)", () => {
    expect(DATEI_IMMUTABLE_ERROR).toMatch(/unveränderbar/i);
  });
});
