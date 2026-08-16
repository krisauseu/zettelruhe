import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_WASSERZEICHEN_ENTWURF,
  assertLogoUpload,
  dokumentSchalterWert,
  dokumentTitel,
  footerBankzeile,
  formatIbanAnzeige,
  formatLeistungszeitraum,
  formatPdfDateDe,
  guessImageMime,
  kontrastTextAuf,
  normalizeAkzentfarbe,
  parseDokumentSchalterForm,
  pdfDateiname,
  pdfNummerAnzeige,
  pickDokumentBankkonto,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
  zahlungshinweisRechnung,
} from "./pdf-layout";

describe("pdfNummerAnzeige", () => {
  it("zeigt im Entwurf nie eine Nummer", () => {
    expect(
      pdfNummerAnzeige({ entwurf: true, nummer: "R-0001" }),
    ).toBe(PDF_WASSERZEICHEN_ENTWURF);
    expect(pdfNummerAnzeige({ entwurf: true, nummer: "" })).toBe(
      PDF_WASSERZEICHEN_ENTWURF,
    );
  });

  it("zeigt nach Festschreibung/Senden die Nummer", () => {
    expect(
      pdfNummerAnzeige({ entwurf: false, nummer: "A-0003" }),
    ).toBe("A-0003");
    expect(pdfNummerAnzeige({ entwurf: false, nummer: "" })).toBe("—");
  });
});

describe("pdfDateiname", () => {
  it("benennt Entwurfs-PDFs ohne Kreisnummer", () => {
    expect(pdfDateiname({ art: "angebot", entwurf: true })).toBe(
      "Angebot-Entwurf.pdf",
    );
    expect(
      pdfDateiname({ art: "rechnung", entwurf: true, nummer: "R-0001" }),
    ).toBe("Rechnung-Entwurf.pdf");
  });

  it("benennt Originale nach der Nummer", () => {
    expect(
      pdfDateiname({ art: "rechnung", entwurf: false, nummer: "R-0002" }),
    ).toBe("R-0002.pdf");
  });
});

describe("normalizeAkzentfarbe", () => {
  it("füllt leer mit Default", () => {
    expect(normalizeAkzentfarbe("")).toBe(DEFAULT_DOKUMENT_AKZENTFARBE);
    expect(normalizeAkzentfarbe(null)).toBe(DEFAULT_DOKUMENT_AKZENTFARBE);
  });

  it("normalisiert #RGB und #RRGGBB", () => {
    expect(normalizeAkzentfarbe("#2b6")).toBe("#22BB66");
    expect(normalizeAkzentfarbe("2B6CB0")).toBe("#2B6CB0");
  });

  it("lehnt Ungültiges ab", () => {
    expect(normalizeAkzentfarbe("red")).toBeNull();
    expect(normalizeAkzentfarbe("#12")).toBeNull();
    expect(() => validateDokumentAkzentfarbe("nope")).toThrow(/Akzentfarbe/);
  });
});

describe("validateDokumentTexte", () => {
  it("trimmt und begrenzt", () => {
    expect(validateDokumentTexte({ kopftext: "  Hallo  ", fusstext: "" })).toEqual({
      kopftext: "Hallo",
      fusstext: "",
    });
    expect(() =>
      validateDokumentTexte({ kopftext: "x".repeat(501) }),
    ).toThrow(/Kopftext/);
    expect(() =>
      validateDokumentTexte({ fusstext: "y".repeat(1001) }),
    ).toThrow(/Fußtext/);
  });
});

describe("Logo-Upload", () => {
  it("akzeptiert PNG unter 2 MB", () => {
    expect(() =>
      assertLogoUpload({ size: 1024, type: "image/png" }),
    ).not.toThrow();
  });

  it("lehnt zu große oder fremde Typen ab", () => {
    expect(() =>
      assertLogoUpload({ size: 3 * 1024 * 1024, type: "image/png" }),
    ).toThrow(/2 MB/);
    expect(() =>
      assertLogoUpload({ size: 100, type: "application/pdf" }),
    ).toThrow(/PNG/);
  });

  it("errät MIME aus Dateiname", () => {
    expect(guessImageMime("logo.JPEG")).toBe("image/jpeg");
    expect(guessImageMime("x.webp", "image/webp")).toBe("image/webp");
  });
});

describe("Dokument-Schalter", () => {
  it("fehlt oder nicht false = an", () => {
    expect(dokumentSchalterWert(undefined)).toBe(true);
    expect(dokumentSchalterWert(null)).toBe(true);
    expect(dokumentSchalterWert(true)).toBe(true);
    expect(dokumentSchalterWert(false)).toBe(false);
  });

  it("liest Checkbox-Formwerte", () => {
    expect(parseDokumentSchalterForm("1")).toBe(true);
    expect(parseDokumentSchalterForm("on")).toBe(true);
    expect(parseDokumentSchalterForm(null)).toBe(false);
    expect(parseDokumentSchalterForm("")).toBe(false);
  });
});

describe("pickDokumentBankkonto", () => {
  it("nimmt das erste aktive Konto mit IBAN", () => {
    expect(
      pickDokumentBankkonto([
        { name: "Bar", iban: "", aktiv: true },
        {
          name: "Geschäftskonto",
          iban: "DE89 3704 0044 0532 0130 00",
          bic: "cola deff xxx",
          aktiv: true,
        },
        {
          name: "Zweitkonto",
          iban: "DE02120300000000202051",
          aktiv: true,
        },
      ]),
    ).toEqual({
      name: "Geschäftskonto",
      iban: "DE89370400440532013000",
      bic: "COLADEFFXXX",
    });
  });

  it("überspringt inaktive und leere IBANs", () => {
    expect(
      pickDokumentBankkonto([
        {
          name: "Alt",
          iban: "DE89370400440532013000",
          aktiv: false,
        },
        { name: "Leer", iban: "   ", aktiv: true },
      ]),
    ).toBeUndefined();
  });
});

describe("Bankzeile und IBAN-Anzeige", () => {
  it("gruppiert die IBAN und lässt leere Felder weg", () => {
    expect(formatIbanAnzeige("DE89370400440532013000")).toBe(
      "DE89 3704 0044 0532 0130 00",
    );
    expect(
      footerBankzeile({
        name: "Geschäftskonto",
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
      }),
    ).toBe(
      "Bank: Geschäftskonto  ·  IBAN: DE89 3704 0044 0532 0130 00  ·  BIC: COBADEFFXXX",
    );
    expect(footerBankzeile(undefined)).toBe("");
    expect(
      footerBankzeile({ name: "", iban: "DE89370400440532013000", bic: "" }),
    ).toBe("IBAN: DE89 3704 0044 0532 0130 00");
  });
});

describe("dokumentTitel und Daten", () => {
  it("setzt Entwurf ohne Nummer und Original mit Nummer", () => {
    expect(
      dokumentTitel({ art: "rechnung", entwurf: true, nummer: "R-0001" }),
    ).toBe("Rechnung (Entwurf)");
    expect(
      dokumentTitel({ art: "rechnung", entwurf: false, nummer: "R-0001" }),
    ).toBe("Rechnung Nr. R-0001");
    expect(
      dokumentTitel({ art: "angebot", entwurf: false, nummer: "A-0002" }),
    ).toBe("Angebot Nr. A-0002");
  });

  it("formatiert Datum und Leistungszeitraum de-DE", () => {
    expect(formatPdfDateDe("2026-08-16")).toBe("16.08.2026");
    expect(formatLeistungszeitraum("2026-08-16", "2026-08-16")).toBe(
      "16.08.2026",
    );
    expect(formatLeistungszeitraum("2026-08-01", "2026-08-16")).toBe(
      "01.08.2026 – 16.08.2026",
    );
    expect(formatLeistungszeitraum("", "")).toBe("");
  });
});

describe("zahlungshinweisRechnung", () => {
  it("nennt Betrag, Fälligkeit und Bank, im Entwurf ohne Kreisnummer", () => {
    const text = zahlungshinweisRechnung({
      betrag: "3105.90",
      faelligAm: "2026-08-30",
      entwurf: false,
      hatBank: true,
    });
    expect(text).toContain("3.105,90");
    expect(text).toContain("30.08.2026");
    expect(text).toContain("Rechnungsnummer");
    expect(text).toContain("Bankkonto");
    expect(text).not.toContain("späteren");
    expect(
      zahlungshinweisRechnung({
        betrag: "10.00",
        entwurf: true,
        hatBank: false,
      }),
    ).toMatch(/späteren Rechnungsnummer/);
  });
});

describe("kontrastTextAuf", () => {
  it("wählt weiße Schrift auf dunklem Akzent", () => {
    expect(kontrastTextAuf("#0055FF")).toBe("#FFFFFF");
    expect(kontrastTextAuf("#F5F5F5")).toBe("#111111");
  });
});
