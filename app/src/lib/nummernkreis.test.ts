import { describe, expect, it } from "vitest";
import {
  DEFAULT_NUMMERNKREISE,
  formatNummernkreis,
  mergeNummernkreise,
} from "./pb";

describe("formatNummernkreis", () => {
  it("setzt Prefix und füllt Stellen mit Nullen", () => {
    expect(
      formatNummernkreis({ prefix: "KT-", digits: 4, next: 1 }, "KT-"),
    ).toBe("KT-0001");
    expect(
      formatNummernkreis({ prefix: "KD-", digits: 4, next: 42 }, "KT-"),
    ).toBe("KD-0042");
  });

  it("nutzt den Fallback-Prefix wenn prefix fehlt", () => {
    expect(
      formatNummernkreis(
        { prefix: undefined as unknown as string, digits: 3, next: 7 },
        "KT-",
      ),
    ).toBe("KT-007");
  });
});

describe("mergeNummernkreise", () => {
  it("füllt fehlenden Kontakt-Kreis aus dem Default", () => {
    const merged = mergeNummernkreise({
      angebot: { prefix: "A-", digits: 4, next: 1 },
      rechnung: { prefix: "R-", digits: 4, next: 3 },
      gutschrift: { prefix: "G-", digits: 4, next: 1 },
      beleg: { prefix: "B-", digits: 4, next: 1 },
      kasse: { prefix: "K-", digits: 4, next: 1 },
    });
    expect(merged.kontakt).toEqual(DEFAULT_NUMMERNKREISE.kontakt);
    expect(merged.rechnung.next).toBe(3);
  });

  it("behält ein vorhandenes Kontakt-Prefix", () => {
    const merged = mergeNummernkreise({
      ...DEFAULT_NUMMERNKREISE,
      kontakt: { prefix: "KD-", digits: 5, next: 12 },
    });
    expect(merged.kontakt).toEqual({ prefix: "KD-", digits: 5, next: 12 });
  });

  it("liefert die Defaults bei leerem Stand", () => {
    expect(mergeNummernkreise(null)).toEqual(DEFAULT_NUMMERNKREISE);
    expect(mergeNummernkreise(undefined)).toEqual(DEFAULT_NUMMERNKREISE);
  });
});
