import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertCanCreateBeleg,
  deserializeParsed,
  PARSE_FEHLER_BELEG_ERROR,
  serializeParsed,
  validateERechnungDatei,
} from "./invariants";
import {
  LIEFERANT_MATCH_MIN_SCORE,
  mapParsedToBelegInput,
  scoreLieferantMatch,
} from "./mapping";
import { parseEInvoiceFile, parseEInvoiceXml } from "./parse";
import {
  extractXmlFromPdf,
  mapTaxPercentToSteuersatz,
  normalizeEInvoiceAmount,
  normalizeEInvoiceDate,
  stripXmlNamespaces,
} from "./parse-utils";
import type { ParsedEInvoice } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ublXml = readFileSync(
  join(__dirname, "fixtures/xrechnung-minimal.xml"),
  "utf8",
);
const ciiXml = readFileSync(
  join(__dirname, "fixtures/zugferd-cii-minimal.xml"),
  "utf8",
);

describe("parse-utils", () => {
  it("stript Namespace-Präfixe", () => {
    const stripped = stripXmlNamespaces("<cbc:ID>A1</cbc:ID>");
    expect(stripped).toContain("<ID>A1</ID>");
  });

  it("normalisiert Datum YYYYMMDD und ISO", () => {
    expect(normalizeEInvoiceDate("20260805")).toBe("2026-08-05");
    expect(normalizeEInvoiceDate("2026-08-01")).toBe("2026-08-01");
    expect(normalizeEInvoiceDate("2026-08-01T12:00:00")).toBe("2026-08-01");
  });

  it("normalisiert Beträge Punkt/Komma", () => {
    expect(normalizeEInvoiceAmount("119.00")).toBe("119.00");
    expect(normalizeEInvoiceAmount("1.234,56")).toBe("1234.56");
    expect(normalizeEInvoiceAmount("19,5")).toBe("19.50");
  });

  it("mappt Steuersätze", () => {
    expect(mapTaxPercentToSteuersatz("19")).toBe("19");
    expect(mapTaxPercentToSteuersatz("19.00")).toBe("19");
    expect(mapTaxPercentToSteuersatz("7")).toBe("7");
    expect(mapTaxPercentToSteuersatz("0")).toBe("0");
    expect(mapTaxPercentToSteuersatz("16")).toBe("");
  });
});

describe("parse XRechnung UBL", () => {
  it("parst Fixture zu ParsedEInvoice", () => {
    const result = parseEInvoiceXml(ublXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.format).toBe("xrechnung_ubl");
    expect(result.data.rechnungsnummer).toBe("XR-2026-0042");
    expect(result.data.rechnungsdatum).toBe("2026-08-01");
    expect(result.data.faelligkeitsdatum).toBe("2026-08-15");
    expect(result.data.waehrung).toBe("EUR");
    expect(result.data.lieferant.name).toBe("Muster Liefer GmbH");
    expect(result.data.lieferant.ust_id).toBe("DE123456789");
    expect(result.data.betrag_netto).toBe("100.00");
    expect(result.data.betrag_ust).toBe("19.00");
    expect(result.data.betrag_brutto).toBe("119.00");
    expect(result.data.steuersatz).toBe("19");
    expect(result.data.positionen?.[0]?.text).toContain("Beratung");
  });

  it("parst über File-Fassade (Bytes)", () => {
    const bytes = Buffer.from(ublXml, "utf8");
    const result = parseEInvoiceFile({
      bytes,
      filename: "xrechnung.xml",
      mimeType: "application/xml",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("XR-2026-0042");
  });
});

describe("parse ZUGFeRD CII", () => {
  it("parst CII-Fixture", () => {
    const result = parseEInvoiceXml(ciiXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.format).toBe("zugferd_cii");
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
    expect(result.data.rechnungsdatum).toBe("2026-08-05");
    expect(result.data.lieferant.name).toBe("ZUGFeRD Hosting AG");
    expect(result.data.lieferant.ust_id).toBe("DE987654321");
    expect(result.data.betrag_netto).toBe("50.00");
    expect(result.data.betrag_ust).toBe("9.50");
    expect(result.data.betrag_brutto).toBe("59.50");
    expect(result.data.steuersatz).toBe("19");
  });

  it("extrahiert XML aus PDF-Bytes light", () => {
    // Minimal: %PDF + eingebettetes CII-Fragment
    const pdfLike = Buffer.from(
      `%PDF-1.4\n1 0 obj\n<<>>\nendobj\n${ciiXml}\n%%EOF`,
      "latin1",
    );
    const extracted = extractXmlFromPdf(new Uint8Array(pdfLike));
    expect(extracted).toBeTruthy();
    expect(extracted).toContain("CrossIndustryInvoice");

    const result = parseEInvoiceFile({
      bytes: pdfLike,
      filename: "zugferd.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rechnungsnummer).toBe("ZF-2026-0007");
  });
});

describe("unparseable Guard", () => {
  it("liefert Fehler, verwirft nicht still", () => {
    const result = parseEInvoiceXml("<root>kein e-rechnung</root>");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(5);
  });

  it("lehnt leere Datei ab", () => {
    const result = parseEInvoiceFile({
      bytes: new Uint8Array(0),
      filename: "x.xml",
    });
    expect(result.ok).toBe(false);
  });

  it("PDF ohne XML → Fehler", () => {
    const pdf = Buffer.from("%PDF-1.4 empty no invoice %%EOF", "utf8");
    const result = parseEInvoiceFile({
      bytes: pdf,
      filename: "scan.pdf",
      mimeType: "application/pdf",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/XML|archiviert/i);
  });
});

describe("mapping → BelegInput", () => {
  const dto: ParsedEInvoice = {
    format: "xrechnung_ubl",
    rechnungsnummer: "XR-1",
    rechnungsdatum: "2026-08-01",
    waehrung: "EUR",
    lieferant: { name: "Liefer AG", ust_id: "DE111" },
    betrag_netto: "100.00",
    betrag_ust: "19.00",
    betrag_brutto: "119.00",
    steuersatz: "19",
  };

  it("Regelbesteuerung behält USt", () => {
    const input = mapParsedToBelegInput(dto, {
      steuermodus: "regelbesteuerung_ist",
      lieferantId: "kontakt1",
    });
    expect(input.richtung).toBe("ausgabe");
    expect(input.belegdatum).toBe("2026-08-01");
    expect(input.betrag_netto).toBe("100.00");
    expect(input.betrag_ust).toBe("19.00");
    expect(input.betrag_brutto).toBe("119.00");
    expect(input.steuersatz).toBe("19");
    expect(input.lieferant).toBe("kontakt1");
    expect(input.kategorie).toBe("E-Rechnung");
    expect(input.notiz).toContain("XR-1");
  });

  it("Kleinunternehmer setzt USt light auf 0", () => {
    const input = mapParsedToBelegInput(dto, {
      steuermodus: "kleinunternehmer",
    });
    expect(input.betrag_ust).toBe("0.00");
    expect(input.steuersatz).toBe("0");
    expect(input.betrag_brutto).toBe("119.00");
    expect(input.betrag_netto).toBe("119.00");
    expect(input.notiz).toContain("Liefer AG");
  });
});

describe("Lieferant:in Match light", () => {
  const dto: ParsedEInvoice = {
    format: "xrechnung_ubl",
    rechnungsnummer: "X",
    rechnungsdatum: "2026-01-01",
    waehrung: "EUR",
    lieferant: { name: "Muster Liefer GmbH", ust_id: "DE123456789" },
    betrag_netto: "1.00",
    betrag_ust: "0.00",
    betrag_brutto: "1.00",
  };

  it("exakter Name scoret hoch", () => {
    const score = scoreLieferantMatch(dto, {
      id: "1",
      name: "Muster Liefer GmbH",
      ist_lieferant: true,
    });
    expect(score).toBeGreaterThanOrEqual(LIEFERANT_MATCH_MIN_SCORE);
  });

  it("USt-Id in Notiz scoret", () => {
    const score = scoreLieferantMatch(dto, {
      id: "2",
      name: "Andere Firma",
      notiz: "USt-Id DE123456789",
      ist_lieferant: true,
    });
    expect(score).toBeGreaterThanOrEqual(50);
  });
});

describe("invariants", () => {
  it("validiert Dateityp und Größe", () => {
    expect(() =>
      validateERechnungDatei({
        type: "application/xml",
        size: 100,
        name: "a.xml",
      }),
    ).not.toThrow();
    expect(() =>
      validateERechnungDatei({ type: "image/png", size: 100, name: "a.png" }),
    ).toThrow(/Dateityp/);
    expect(() =>
      validateERechnungDatei({ type: "application/xml", size: 0, name: "a.xml" }),
    ).toThrow(/leer/);
  });

  it("assertCanCreateBeleg blockiert unparseable und doppelten Beleg", () => {
    expect(() =>
      assertCanCreateBeleg({
        parse_status: "fehler",
        beleg: null,
        status: "neu",
      }),
    ).toThrow(PARSE_FEHLER_BELEG_ERROR);

    expect(() =>
      assertCanCreateBeleg({
        parse_status: "ok",
        beleg: "abc",
        status: "beleg_erstellt",
      }),
    ).toThrow(/bereits/);
  });

  it("serialisiert DTO roundtrip", () => {
    const result = parseEInvoiceXml(ublXml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const raw = serializeParsed(result.data);
    const back = deserializeParsed(raw);
    expect(back?.rechnungsnummer).toBe(result.data.rechnungsnummer);
    expect(back?.betrag_brutto).toBe("119.00");
  });
});
