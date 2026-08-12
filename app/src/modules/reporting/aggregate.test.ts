import { describe, expect, it } from "vitest";
import type { JournalEintrag } from "@/modules/journal/types";
import {
  buildBwaLight,
  buildDashboard,
  buildEur,
  buildUstUebersicht,
  mapEurKategorie,
  sumOffenePosten,
} from "./aggregate";

function je(
  partial: Partial<JournalEintrag> &
    Pick<JournalEintrag, "richtung" | "betrag_brutto">,
): JournalEintrag {
  return {
    id: partial.id ?? "x",
    firma: "f1",
    laufende_nr: partial.laufende_nr ?? 1,
    buchungsdatum: partial.buchungsdatum ?? "2026-08-10",
    belegdatum: partial.belegdatum ?? "2026-08-10",
    buchungstext: partial.buchungstext ?? "Test",
    richtung: partial.richtung,
    betrag_netto: partial.betrag_netto ?? partial.betrag_brutto,
    betrag_ust: partial.betrag_ust ?? "0.00",
    betrag_brutto: partial.betrag_brutto,
    steuersatz: partial.steuersatz ?? "",
    konto: partial.konto ?? "",
    kontakt: null,
    quelle_typ: partial.quelle_typ ?? "manuell",
    quelle_id: partial.quelle_id ?? "",
    storno_von: partial.storno_von ?? null,
    festgeschrieben_am: "2026-08-10T10:00:00.000Z",
  };
}

const Z = { von: "2026-08-01", bis: "2026-08-31" };

describe("mapEurKategorie", () => {
  it("ordnet Quellen zu", () => {
    expect(
      mapEurKategorie(je({ richtung: "einnahme", betrag_brutto: "1", quelle_typ: "rechnung" })),
    ).toBe("umsatzerloese");
    expect(
      mapEurKategorie(je({ richtung: "einnahme", betrag_brutto: "1", quelle_typ: "kasse" })),
    ).toBe("bareinnahmen");
    expect(
      mapEurKategorie(je({ richtung: "ausgabe", betrag_brutto: "1", quelle_typ: "beleg" })),
    ).toBe("betriebsausgaben");
    expect(
      mapEurKategorie(je({ richtung: "ausgabe", betrag_brutto: "1", quelle_typ: "kasse" })),
    ).toBe("barausgaben");
  });
});

describe("buildEur", () => {
  it("summiert Einnahmen und Ausgaben inkl. Storno-Netto", () => {
    const items = [
      je({
        id: "1",
        richtung: "einnahme",
        betrag_brutto: "119.00",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        quelle_typ: "rechnung",
      }),
      je({
        id: "2",
        richtung: "ausgabe",
        betrag_brutto: "50.00",
        betrag_netto: "50.00",
        betrag_ust: "0.00",
        quelle_typ: "beleg",
      }),
      // Storno der Rechnung: Gegenbuchung als Ausgabe
      je({
        id: "3",
        richtung: "ausgabe",
        betrag_brutto: "119.00",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        quelle_typ: "storno",
        storno_von: "1",
      }),
    ];
    const eur = buildEur(items, Z);
    expect(eur.summe_einnahmen_brutto).toBe("119.00");
    // 50 + 119 Storno
    expect(eur.summe_ausgaben_brutto).toBe("169.00");
    expect(eur.ueberschuss_brutto).toBe("-50.00");
    expect(eur.anzahl_buchungen).toBe(3);
  });

  it("füllt alle Kategorien (auch 0)", () => {
    const eur = buildEur([], Z);
    expect(eur.einnahmen).toHaveLength(3);
    expect(eur.ausgaben).toHaveLength(3);
    expect(eur.ueberschuss_brutto).toBe("0.00");
  });
});

describe("buildUstUebersicht", () => {
  it("unter Kleinunternehmerregelung nicht verfügbar", () => {
    const items = [
      je({
        richtung: "einnahme",
        betrag_brutto: "119.00",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        steuersatz: "19",
      }),
    ];
    const u = buildUstUebersicht(items, Z, "kleinunternehmer");
    expect(u.verfuegbar).toBe(false);
    expect(u.zeilen).toHaveLength(0);
    expect(u.hinweis).toMatch(/Kleinunternehmerregelung/);
  });

  it("aggregiert USt und Vorsteuer unter Regelbesteuerung", () => {
    const items = [
      je({
        richtung: "einnahme",
        betrag_brutto: "119.00",
        betrag_netto: "100.00",
        betrag_ust: "19.00",
        steuersatz: "19",
        quelle_typ: "rechnung",
      }),
      je({
        richtung: "ausgabe",
        betrag_brutto: "107.00",
        betrag_netto: "100.00",
        betrag_ust: "7.00",
        steuersatz: "7",
        quelle_typ: "beleg",
      }),
    ];
    const u = buildUstUebersicht(items, Z, "regelbesteuerung_ist");
    expect(u.verfuegbar).toBe(true);
    expect(u.summe_ust_einnahmen).toBe("19.00");
    expect(u.summe_vorsteuer).toBe("7.00");
    expect(u.zahllast).toBe("12.00");
  });
});

describe("buildBwaLight / Dashboard", () => {
  it("BWA light", () => {
    const bwa = buildBwaLight(
      [
        je({ richtung: "einnahme", betrag_brutto: "200.00" }),
        je({ richtung: "ausgabe", betrag_brutto: "80.00" }),
      ],
      Z,
    );
    expect(bwa.einnahmen_brutto).toBe("200.00");
    expect(bwa.ausgaben_brutto).toBe("80.00");
    expect(bwa.ergebnis_brutto).toBe("120.00");
  });

  it("Dashboard ohne USt-Zahllast bei Kleinunternehmer", () => {
    const d = buildDashboard(
      [je({ richtung: "einnahme", betrag_brutto: "10.00" })],
      Z,
      "kleinunternehmer",
      { summe: "5.00", anzahl: 1 },
    );
    expect(d.ust_zahllast).toBeNull();
    expect(d.offene_posten_summe).toBe("5.00");
    expect(d.offene_posten_anzahl).toBe(1);
  });

  it("Dashboard mit USt-Hinweis bei Regelbesteuerung", () => {
    const d = buildDashboard(
      [
        je({
          richtung: "einnahme",
          betrag_brutto: "119.00",
          betrag_netto: "100.00",
          betrag_ust: "19.00",
          steuersatz: "19",
        }),
      ],
      Z,
      "regelbesteuerung_ist",
      { summe: "0.00", anzahl: 0 },
    );
    expect(d.ust_zahllast).toBe("19.00");
  });
});

describe("sumOffenePosten", () => {
  it("summiert decimal-sicher", () => {
    const r = sumOffenePosten([
      { offen: "10.10" },
      { offen: "0.20" },
      { offen: "5.00" },
    ]);
    expect(r.summe).toBe("15.30");
    expect(r.anzahl).toBe(3);
  });
});
