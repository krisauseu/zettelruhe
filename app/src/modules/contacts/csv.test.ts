import { describe, expect, it } from "vitest";
import { parseCsvRows, parseKontakteCsv, serializeKontakteCsv } from "./csv";
import type { Kontakt } from "./types";

describe("parseCsvRows", () => {
  it("parst Semikolon-CSV", () => {
    const rows = parseCsvRows("a;b;c\n1;2;3");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("parst Komma-CSV und Quotes", () => {
    const rows = parseCsvRows('name,ort\n"Muster, GmbH","Berlin"');
    expect(rows).toEqual([
      ["name", "ort"],
      ["Muster, GmbH", "Berlin"],
    ]);
  });

  it("parst escaped Quotes", () => {
    const rows = parseCsvRows('name\n"Firma ""X"""');
    expect(rows[1][0]).toBe('Firma "X"');
  });
});

describe("parseKontakteCsv", () => {
  it("parst de-DE Header und Bool-Werte", () => {
    const csv = [
      "name;ist_kunde;ist_lieferant;email;ort",
      "Alpha GmbH;ja;nein;a@example.de;Berlin",
      "Beta AG;0;1;b@example.de;Hamburg",
    ].join("\n");

    const result = parseKontakteCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      name: "Alpha GmbH",
      ist_kunde: true,
      ist_lieferant: false,
      email: "a@example.de",
      ort: "Berlin",
    });
    expect(result.items[1]).toMatchObject({
      name: "Beta AG",
      ist_kunde: false,
      ist_lieferant: true,
    });
  });

  it("setzt Default Kund:in wenn keine Rolle", () => {
    const csv = "name;email\nNur Name;x@y.de\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].ist_kunde).toBe(true);
    expect(result.items[0].ist_lieferant).toBe(false);
  });

  it("akzeptiert Alias Firma als name", () => {
    const csv = "Firma;Kunde\nTestfirma;ja\n";
    const result = parseKontakteCsv(csv);
    expect(result.items[0].name).toBe("Testfirma");
    expect(result.items[0].ist_kunde).toBe(true);
  });

  it("meldet fehlenden name-Header", () => {
    const result = parseKontakteCsv("email;ort\na@b.de;X\n");
    expect(result.items).toHaveLength(0);
    expect(result.errors[0]).toMatch(/name/i);
  });

  it("überspringt leere Namen", () => {
    const csv = "name;email\n;a@b.de\nOk;c@d.de\n";
    const result = parseKontakteCsv(csv);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });
});

describe("serializeKontakteCsv", () => {
  it("roundtrip basic fields", () => {
    const items: Kontakt[] = [
      {
        id: "1",
        firma: "f",
        name: "Test; Firma",
        ist_kunde: true,
        ist_lieferant: false,
        strasse: "A 1",
        plz: "12345",
        ort: "Köln",
        land: "DE",
        email: "t@example.de",
        telefon: "",
        iban: "DE89370400440532013000",
        bic: "COBADEFFXXX",
        notiz: 'Zeile "eins"',
      },
    ];
    const csv = serializeKontakteCsv(items);
    const body = csv.replace(/^\uFEFF/, "");
    const result = parseKontakteCsv(body);
    expect(result.items[0].name).toBe("Test; Firma");
    expect(result.items[0].iban).toBe("DE89370400440532013000");
    expect(result.items[0].notiz).toBe('Zeile "eins"');
  });
});
