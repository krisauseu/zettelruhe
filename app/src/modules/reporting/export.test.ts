import { describe, expect, it } from "vitest";
import type { JournalEintrag } from "@/modules/journal/types";
import { serializeJournalCsv, moneyDe } from "./export-csv";
import {
  datevBelegdatum,
  DATEV_FORMAT_ID,
  serializeDatevCsv,
} from "./export-datev";
import { buildZip } from "./zip";
import { crc32 } from "./crc32";

function je(partial: Partial<JournalEintrag> = {}): JournalEintrag {
  return {
    id: partial.id ?? "abc",
    firma: "f1",
    laufende_nr: partial.laufende_nr ?? 1,
    buchungsdatum: partial.buchungsdatum ?? "2026-08-10",
    belegdatum: partial.belegdatum ?? "2026-08-09",
    buchungstext: partial.buchungstext ?? "Rechnung R-0001",
    richtung: partial.richtung ?? "einnahme",
    betrag_netto: partial.betrag_netto ?? "100.00",
    betrag_ust: partial.betrag_ust ?? "19.00",
    betrag_brutto: partial.betrag_brutto ?? "119.00",
    steuersatz: partial.steuersatz ?? "19",
    konto: partial.konto ?? "8400",
    kontakt: null,
    quelle_typ: partial.quelle_typ ?? "rechnung",
    quelle_id: partial.quelle_id ?? "r1",
    storno_von: null,
    festgeschrieben_am: "2026-08-10T10:00:00.000Z",
  };
}

describe("moneyDe / Journal CSV", () => {
  it("formatiert Beträge de-DE", () => {
    expect(moneyDe("119.00")).toBe("119,00");
    expect(moneyDe("0.00")).toBe("0,00");
  });

  it("serialisiert Journal mit BOM und Semikolon", () => {
    const csv = serializeJournalCsv([je()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("laufende_nr;buchungsdatum");
    expect(csv).toContain("119,00");
    expect(csv).toContain("einnahme");
  });
});

describe("DATEV light", () => {
  it("Belegdatum DDMM", () => {
    expect(datevBelegdatum("2026-08-10")).toBe("1008");
  });

  it("exportiert Soll/Haben und Format-ID", () => {
    const { csv, meta } = serializeDatevCsv(
      [
        je({ richtung: "einnahme" }),
        je({
          id: "2",
          richtung: "ausgabe",
          betrag_brutto: "50.00",
          betrag_netto: "50.00",
          betrag_ust: "0.00",
          steuersatz: "",
          quelle_typ: "beleg",
        }),
      ],
      { von: "2026-08-01", bis: "2026-08-31" },
    );
    expect(meta.format_id).toBe(DATEV_FORMAT_ID);
    expect(meta.anzahl_zeilen).toBe(2);
    expect(csv).toContain(DATEV_FORMAT_ID);
    expect(csv).toContain(";H;");
    expect(csv).toContain(";S;");
    expect(csv).toContain("119,00");
  });
});

describe("crc32 / ZIP store", () => {
  it("crc32 bekanntes Muster", () => {
    // "123456789" → 0xCBF43926
    const data = new TextEncoder().encode("123456789");
    expect(crc32(data)).toBe(0xcbf43926);
  });

  it("baut lesbares Store-ZIP mit PK-Signatur", () => {
    const zip = buildZip([
      {
        name: "readme.txt",
        data: new TextEncoder().encode("hello"),
      },
      {
        name: "dateien/a.bin",
        data: new Uint8Array([1, 2, 3]),
      },
    ]);
    // Local file header signature
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    expect(zip.length).toBeGreaterThan(50);
  });
});
