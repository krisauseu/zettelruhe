import { describe, expect, it } from "vitest";
import {
  assertCanFestschreiben,
  assertCanPreviewRechnungPdf,
  assertCanServeOriginalRechnungPdf,
  assertCanStornierenRechnung,
  assertRechnungVorschauNurEntwurf,
  assertEntwurfEditable,
  assertEntwurfOhneNummer,
  buildJournalInputFromRechnung,
  calculatePositionBetraege,
  defaultFaelligAm,
  FESTGESCHRIEBEN_ERROR,
  isEntwurf,
  isFestgeschrieben,
  KLEINUNTERNEHMER_HINWEIS,
  PDF_IMMUTABLE_ERROR,
  PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR,
  PDF_VORSCHAU_NUR_ENTWURF_ERROR,
  RECHNUNG_STORNO_BEREITS_ERROR,
  RECHNUNG_STORNO_ENTWURF_ERROR,
  sumPositionen,
  validateRechnungInput,
} from "./invariants";
import type { Rechnung, Rechnungsposition } from "./types";

function sampleRechnung(over: Partial<Rechnung> = {}): Rechnung {
  return {
    id: "r1",
    firma: "f1",
    kunde: "k1",
    rechnungsdatum: "2026-08-11",
    leistungszeitraum_von: "",
    leistungszeitraum_bis: "",
    faellig_am: "2026-08-25",
    notiz: "",
    status: "entwurf",
    rechnungsnummer: "",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuermodus: "regelbesteuerung_ist",
    pdf: "",
    journal_eintrag: null,
    festgeschrieben_am: "",
    ...over,
  };
}

function samplePos(over: Partial<Rechnungsposition> = {}): Rechnungsposition {
  return {
    id: "p1",
    firma: "f1",
    rechnung: "r1",
    sortierung: 0,
    bezeichnung: "Beratung",
    menge: "2",
    einheit: "h",
    einzelpreis: "50.00",
    steuersatz: "19",
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    katalog_position: null,
    ...over,
  };
}

describe("calculatePositionBetraege", () => {
  it("berechnet Netto/USt/Brutto unter Regelbesteuerung", () => {
    const v = calculatePositionBetraege(
      { menge: "2", einzelpreis: "50,00", steuersatz: "19" },
      "regelbesteuerung_ist",
    );
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("19.00");
    expect(v.betrag_brutto).toBe("119.00");
    expect(v.steuersatz).toBe("19");
  });

  it("setzt USt unter Kleinunternehmerregelung auf 0", () => {
    const v = calculatePositionBetraege(
      { menge: "1", einzelpreis: "100", steuersatz: "19" },
      "kleinunternehmer",
    );
    expect(v.betrag_netto).toBe("100.00");
    expect(v.betrag_ust).toBe("0.00");
    expect(v.betrag_brutto).toBe("100.00");
    expect(v.steuersatz).toBe("");
  });

  it("lehnt Menge ≤ 0 ab", () => {
    expect(() =>
      calculatePositionBetraege(
        { menge: "0", einzelpreis: "10" },
        "kleinunternehmer",
      ),
    ).toThrow(/Menge/);
  });
});

describe("sumPositionen", () => {
  it("summiert Zeilen", () => {
    const s = sumPositionen([
      {
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        betrag_brutto: "119.00",
      },
      {
        betrag_netto: "50.00",
        betrag_ust: "9.50",
        betrag_brutto: "59.50",
      },
    ]);
    expect(s.betrag_netto).toBe("150.00");
    expect(s.betrag_ust).toBe("28.50");
    expect(s.betrag_brutto).toBe("178.50");
  });
});

describe("validateRechnungInput", () => {
  it("validiert Kopf + Positionen und summiert", () => {
    const v = validateRechnungInput(
      {
        kunde: "k1",
        rechnungsdatum: "2026-08-11",
        positionen: [
          {
            bezeichnung: "Arbeit",
            menge: "1",
            einzelpreis: "200,00",
            steuersatz: "19",
          },
        ],
      },
      "regelbesteuerung_ist",
    );
    expect(v.betrag_brutto).toBe("238.00");
    expect(v.positionen).toHaveLength(1);
  });

  it("verwendet 1-basierte sortierung (PB required number: 0 = blank)", () => {
    const v = validateRechnungInput(
      {
        rechnungsdatum: "2026-08-11",
        positionen: [
          { bezeichnung: "A", menge: "1", einzelpreis: "10" },
          { bezeichnung: "B", menge: "1", einzelpreis: "20" },
        ],
      },
      "kleinunternehmer",
    );
    expect(v.positionen.map((p) => p.sortierung)).toEqual([1, 2]);
  });

  it("lehnt Rechnung ohne Position ab", () => {
    expect(() =>
      validateRechnungInput(
        { rechnungsdatum: "2026-08-11", positionen: [] },
        "kleinunternehmer",
      ),
    ).toThrow(/Position/);
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateRechnungInput(
        {
          rechnungsdatum: "11.08.2026",
          positionen: [
            { bezeichnung: "X", menge: "1", einzelpreis: "10" },
          ],
        },
        "kleinunternehmer",
      ),
    ).toThrow(/Rechnungsdatum/);
  });
});

describe("Entwurf vs. Festschreibung", () => {
  it("erkennt Status (alle nicht-entwurf = festgeschrieben)", () => {
    expect(isEntwurf(sampleRechnung())).toBe(true);
    expect(isFestgeschrieben(sampleRechnung({ status: "offen" }))).toBe(true);
    expect(
      isFestgeschrieben(sampleRechnung({ status: "teilbezahlt" })),
    ).toBe(true);
    expect(isFestgeschrieben(sampleRechnung({ status: "bezahlt" }))).toBe(
      true,
    );
    expect(
      isFestgeschrieben(sampleRechnung({ status: "ueberfaellig" })),
    ).toBe(true);
  });

  it("blockiert Edit nach Festschreibung", () => {
    expect(() =>
      assertEntwurfEditable(sampleRechnung({ status: "offen" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
    expect(() =>
      assertEntwurfEditable(sampleRechnung({ status: "bezahlt" })),
    ).toThrow(FESTGESCHRIEBEN_ERROR);
  });

  it("Entwurf ohne Rechnungsnummer", () => {
    expect(() =>
      assertEntwurfOhneNummer(sampleRechnung({ rechnungsnummer: "" })),
    ).not.toThrow();
    expect(() =>
      assertEntwurfOhneNummer(
        sampleRechnung({ status: "entwurf", rechnungsnummer: "R-0001" }),
      ),
    ).toThrow(/keine Rechnungsnummer/);
  });

  it("erlaubt Festschreiben nur für Entwurf mit Kund:in und Positionen", () => {
    expect(() =>
      assertCanFestschreiben(sampleRechnung(), [samplePos()]),
    ).not.toThrow();

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ status: "offen" }), [
        samplePos(),
      ]),
    ).toThrow(/Nur Entwürfe/);

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ kunde: null }), [samplePos()]),
    ).toThrow(/Kund:in/);

    expect(() =>
      assertCanFestschreiben(sampleRechnung({ rechnungsnummer: "R-1" }), [
        samplePos(),
      ]),
    ).toThrow(/Rechnungsnummer/);

    expect(() => assertCanFestschreiben(sampleRechnung(), [])).toThrow(
      /Position/,
    );
  });
});

describe("assertCanStornierenRechnung", () => {
  it("erlaubt festgeschriebene Status", () => {
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "offen" })),
    ).not.toThrow();
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "bezahlt" })),
    ).not.toThrow();
  });

  it("lehnt Entwurf und bereits Storniertes ab", () => {
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "entwurf" })),
    ).toThrow(RECHNUNG_STORNO_ENTWURF_ERROR);
    expect(() =>
      assertCanStornierenRechnung(sampleRechnung({ status: "storniert" })),
    ).toThrow(RECHNUNG_STORNO_BEREITS_ERROR);
  });
});

describe("buildJournalInputFromRechnung", () => {
  it("setzt quelle_typ=rechnung und Richtung Einnahme", () => {
    const j = buildJournalInputFromRechnung(sampleRechnung(), {
      rechnungId: "r1",
      rechnungsnummer: "R-0001",
      kundeName: "Muster GmbH",
    });
    expect(j.quelle_typ).toBe("rechnung");
    expect(j.quelle_id).toBe("r1");
    expect(j.richtung).toBe("einnahme");
    expect(j.betrag_brutto).toBe("119.00");
    expect(j.buchungstext).toMatch(/R-0001/);
    expect(j.buchungstext).toMatch(/Muster/);
  });
});

describe("defaultFaelligAm", () => {
  it("addiert 14 Tage", () => {
    expect(defaultFaelligAm("2026-08-11")).toBe("2026-08-25");
  });
});

describe("PDF / §-19-Hinweis", () => {
  it("ADR-0012 Immutability-Hinweis", () => {
    expect(PDF_IMMUTABLE_ERROR).toMatch(/unveränderbar/i);
  });

  it("§-19-Hinweis für Kleinunternehmerregelung", () => {
    expect(KLEINUNTERNEHMER_HINWEIS).toMatch(/§ 19/);
  });
});

describe("Rechnungs-PDF Vorschau vs. Original", () => {
  it("erlaubt Vorschau nur für sendefähigen Entwurf", () => {
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung(), [samplePos()]),
    ).not.toThrow();
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung({ kunde: null }), [
        samplePos(),
      ]),
    ).toThrow(/Kund:in/);
    expect(() =>
      assertCanPreviewRechnungPdf(sampleRechnung({ status: "offen" }), [
        samplePos(),
      ]),
    ).toThrow(/Nur Entwürfe/);
  });

  it("serviert Original nicht am Entwurf", () => {
    expect(() =>
      assertCanServeOriginalRechnungPdf(sampleRechnung()),
    ).toThrow(PDF_ORIGINAL_NUR_NACH_FESTSCHREIBUNG_ERROR);
    expect(() =>
      assertCanServeOriginalRechnungPdf(
        sampleRechnung({ status: "offen", pdf: "R-0001.pdf" }),
      ),
    ).not.toThrow();
  });

  it("blockiert Vorschau nach Festschreibung", () => {
    expect(() =>
      assertRechnungVorschauNurEntwurf(sampleRechnung({ status: "offen" })),
    ).toThrow(PDF_VORSCHAU_NUR_ENTWURF_ERROR);
  });
});
