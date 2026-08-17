import { describe, expect, it } from "vitest";
import type { JournalEintrag } from "@/modules/journal/types";
import { buildFaelligkeiten, buildMonatlicheReihe } from "./uebersicht";

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

describe("buildMonatlicheReihe", () => {
  it("bildet 12 Monate und zählt Zufluss, nicht die Forderungsbuchung", () => {
    const reihe = buildMonatlicheReihe(
      [
        je({
          id: "r",
          richtung: "einnahme",
          betrag_brutto: "900.00",
          quelle_typ: "rechnung",
          buchungsdatum: "2026-03-02",
        }),
        je({
          id: "z",
          richtung: "einnahme",
          betrag_brutto: "120.00",
          quelle_typ: "zahlung",
          buchungsdatum: "2026-03-15",
        }),
        je({
          id: "b",
          richtung: "ausgabe",
          betrag_brutto: "40.00",
          quelle_typ: "beleg",
          buchungsdatum: "2026-03-20",
        }),
      ],
      { von: "2025-09-01", bis: "2026-08-31" },
    );
    expect(reihe).toHaveLength(12);
    expect(reihe[0].key).toBe("2025-09");
    expect(reihe[11].key).toBe("2026-08");
    const maerz = reihe.find((m) => m.key === "2026-03");
    expect(maerz?.einnahmen_brutto).toBe("120.00");
    expect(maerz?.ausgaben_brutto).toBe("40.00");
    expect(maerz?.ueberschuss_brutto).toBe("80.00");
    const jan = reihe.find((m) => m.key === "2026-01");
    expect(jan?.einnahmen_brutto).toBe("0.00");
  });

  it("mindert den Ursprungsmonat nicht — Storno zählt im Buchungsmonat", () => {
    const reihe = buildMonatlicheReihe(
      [
        je({
          id: "z1",
          richtung: "einnahme",
          betrag_brutto: "80.00",
          quelle_typ: "zahlung",
          buchungsdatum: "2026-01-10",
        }),
        je({
          id: "s1",
          richtung: "ausgabe",
          betrag_brutto: "80.00",
          quelle_typ: "storno",
          storno_von: "z1",
          buchungsdatum: "2026-02-03",
        }),
      ],
      { von: "2026-01-01", bis: "2026-02-28" },
    );
    expect(reihe.find((m) => m.key === "2026-01")?.einnahmen_brutto).toBe(
      "80.00",
    );
    expect(reihe.find((m) => m.key === "2026-02")?.einnahmen_brutto).toBe(
      "-80.00",
    );
    expect(reihe.find((m) => m.key === "2026-02")?.ueberschuss_brutto).toBe(
      "-80.00",
    );
  });
});

describe("buildFaelligkeiten", () => {
  const basis = {
    rechnungId: "a",
    rechnungsnummer: "R-1",
    kundeName: "Müller",
    offen: "10.00",
    status: "offen",
    faellig_am: "2026-08-17",
  };

  it("trennt überfällig und die nächsten 14 Tage", () => {
    const b = buildFaelligkeiten(
      [
        { ...basis, rechnungId: "1", rechnungsnummer: "R-alt", faellig_am: "2026-08-01", status: "ueberfaellig" },
        { ...basis, rechnungId: "2", rechnungsnummer: "R-heute", faellig_am: "2026-08-17" },
        { ...basis, rechnungId: "3", rechnungsnummer: "R-bald", faellig_am: "2026-08-31" },
        { ...basis, rechnungId: "4", rechnungsnummer: "R-spaet", faellig_am: "2026-09-01" },
      ],
      "2026-08-17",
      14,
    );
    expect(b.horizon_bis).toBe("2026-08-31");
    expect(b.ueberfaellig.map((e) => e.rechnungsnummer)).toEqual(["R-alt"]);
    expect(b.ueberfaellig[0].tage_verzug).toBe(16);
    expect(b.bald.map((e) => e.rechnungsnummer)).toEqual(["R-heute", "R-bald"]);
  });

  it("ordnet Überfällige ohne Datum in die Überfällig-Liste", () => {
    const b = buildFaelligkeiten(
      [
        {
          ...basis,
          rechnungId: "x",
          rechnungsnummer: "R-x",
          faellig_am: "",
          status: "ueberfaellig",
        },
      ],
      "2026-08-17",
    );
    expect(b.ueberfaellig).toHaveLength(1);
    expect(b.ueberfaellig[0].tage_verzug).toBe(0);
    expect(b.bald).toHaveLength(0);
  });
});
