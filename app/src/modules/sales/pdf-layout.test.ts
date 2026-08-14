import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_WASSERZEICHEN_ENTWURF,
  assertLogoUpload,
  guessImageMime,
  normalizeAkzentfarbe,
  pdfDateiname,
  pdfNummerAnzeige,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
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
