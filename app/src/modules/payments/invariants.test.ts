import { describe, expect, it } from "vitest";
import {
  assertKeineUeberzahlung,
  assertRechnungZahlungsfaehig,
  deriveRechnungStatus,
  offenerBetrag,
  sumZahlungen,
  validateZahlungInput,
  ZAHLUNG_BEZAHLT_ERROR,
  ZAHLUNG_ENTWURF_ERROR,
  ZAHLUNG_STORNIERT_ERROR,
  ZAHLUNG_UEBERZAHLUNG_ERROR,
} from "./invariants";

describe("validateZahlungInput", () => {
  it("normalisiert de-DE Betrag und Pflichtfelder", () => {
    const v = validateZahlungInput({
      rechnung: "r1",
      datum: "2026-08-12",
      betrag: "50,50",
      zahlungsweg: "ueberweisung",
      notiz: "Anzahlung",
    });
    expect(v.betrag).toBe("50.50");
    expect(v.datum).toBe("2026-08-12");
    expect(v.zahlungsweg).toBe("ueberweisung");
    expect(v.notiz).toBe("Anzahlung");
  });

  it("lehnt Betrag ≤ 0 ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "r1",
        datum: "2026-08-12",
        betrag: "0",
      }),
    ).toThrow(/größer als 0/);
  });

  it("lehnt ungültiges Datum ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "r1",
        datum: "12.08.2026",
        betrag: "10",
      }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it("lehnt fehlende Rechnung ab", () => {
    expect(() =>
      validateZahlungInput({
        rechnung: "",
        datum: "2026-08-12",
        betrag: "10",
      }),
    ).toThrow(/Rechnung/);
  });
});

describe("sumZahlungen / offenerBetrag", () => {
  it("summiert Teilzahlungen", () => {
    expect(
      sumZahlungen([{ betrag: "40.00" }, { betrag: "30.50" }]),
    ).toBe("70.50");
  });

  it("berechnet offenen Rest", () => {
    expect(
      offenerBetrag("119.00", [{ betrag: "50.00" }, { betrag: "19.00" }]),
    ).toBe("50.00");
  });

  it("offener Betrag bei Vollzahlung = 0", () => {
    expect(offenerBetrag("100.00", [{ betrag: "100.00" }])).toBe("0.00");
  });
});

describe("assertKeineUeberzahlung", () => {
  it("erlaubt exakte Restzahlung", () => {
    expect(() =>
      assertKeineUeberzahlung("100.00", [{ betrag: "40.00" }], "60.00"),
    ).not.toThrow();
  });

  it("lehnt Überzahlung ab", () => {
    expect(() =>
      assertKeineUeberzahlung("100.00", [{ betrag: "40.00" }], "60.01"),
    ).toThrow(ZAHLUNG_UEBERZAHLUNG_ERROR);
  });

  it("lehnt erste Zahlung über Brutto ab", () => {
    expect(() =>
      assertKeineUeberzahlung("50.00", [], "50.01"),
    ).toThrow(ZAHLUNG_UEBERZAHLUNG_ERROR);
  });
});

describe("assertRechnungZahlungsfaehig", () => {
  it("erlaubt offen / teilbezahlt / ueberfaellig", () => {
    for (const status of ["offen", "teilbezahlt", "ueberfaellig"] as const) {
      expect(() =>
        assertRechnungZahlungsfaehig({
          status,
          betrag_brutto: "100.00",
        }),
      ).not.toThrow();
    }
  });

  it("lehnt Entwurf ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "entwurf",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_ENTWURF_ERROR);
  });

  it("lehnt bezahlt ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "bezahlt",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_BEZAHLT_ERROR);
  });

  it("lehnt storniert ab", () => {
    expect(() =>
      assertRechnungZahlungsfaehig({
        status: "storniert",
        betrag_brutto: "100.00",
      }),
    ).toThrow(ZAHLUNG_STORNIERT_ERROR);
  });
});

describe("deriveRechnungStatus", () => {
  it("offen ohne Zahlungen und nicht fällig", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-12-31",
        heute: "2026-08-12",
      }),
    ).toBe("offen");
  });

  it("ueberfaellig ohne Zahlungen und Fälligkeit überschritten", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-08-01",
        heute: "2026-08-12",
      }),
    ).toBe("ueberfaellig");
  });

  it("teilbezahlt bei Teilzahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "40.00" }],
        faellig_am: "2026-08-01",
        heute: "2026-08-12",
      }),
    ).toBe("teilbezahlt");
  });

  it("bezahlt bei Vollzahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "teilbezahlt",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "60.00" }, { betrag: "40.00" }],
        heute: "2026-08-12",
      }),
    ).toBe("bezahlt");
  });

  it("bezahlt bei exakter einer Zahlung", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "offen",
        betragBrutto: "119.00",
        zahlungen: [{ betrag: "119.00" }],
      }),
    ).toBe("bezahlt");
  });

  it("lässt entwurf und storniert unverändert", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "entwurf",
        betragBrutto: "100.00",
        zahlungen: [],
      }),
    ).toBe("entwurf");
    expect(
      deriveRechnungStatus({
        currentStatus: "storniert",
        betragBrutto: "100.00",
        zahlungen: [{ betrag: "50.00" }],
      }),
    ).toBe("storniert");
  });

  it("nach Löschen aller Zahlungen zurück auf offen/ueberfaellig", () => {
    expect(
      deriveRechnungStatus({
        currentStatus: "teilbezahlt",
        betragBrutto: "100.00",
        zahlungen: [],
        faellig_am: "2026-12-01",
        heute: "2026-08-12",
      }),
    ).toBe("offen");
  });
});
