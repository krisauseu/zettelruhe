import { describe, expect, it } from "vitest";
import {
  kategorieNameKey,
  kategorieNamenFuerSelect,
  normalizeKategorieName,
  validateKategorieInput,
} from "./invariants";

describe("normalizeKategorieName", () => {
  it("trimmt und zieht Whitespace zusammen", () => {
    expect(normalizeKategorieName("  Büro   material ")).toBe("Büro material");
  });
});

describe("validateKategorieInput", () => {
  it("lehnt leeren Namen ab", () => {
    expect(() => validateKategorieInput({ name: "   " })).toThrow(
      /erforderlich/,
    );
  });

  it("lehnt zu lange Namen ab", () => {
    expect(() => validateKategorieInput({ name: "x".repeat(121) })).toThrow(
      /zu lang/,
    );
  });

  it("normalisiert und setzt aktiv default true", () => {
    const v = validateKategorieInput({ name: "  Porto  " });
    expect(v.name).toBe("Porto");
    expect(v.aktiv).toBe(true);
    expect(v.notiz).toBe("");
  });

  it("respektiert aktiv=false", () => {
    const v = validateKategorieInput({ name: "Alt", aktiv: false });
    expect(v.aktiv).toBe(false);
  });
});

describe("kategorieNameKey", () => {
  it("vergleicht case-insensitive de-DE", () => {
    expect(kategorieNameKey("Büro")).toBe(kategorieNameKey("büro"));
  });
});

describe("kategorieNamenFuerSelect", () => {
  it("sortiert, dedupliziert und hängt historischen Wert an", () => {
    expect(kategorieNamenFuerSelect(["Porto", "Büro", "porto"], "Alt")).toEqual(
      ["Alt", "Büro", "Porto"],
    );
  });

  it("hängt aktuellen Wert nicht doppelt an", () => {
    expect(kategorieNamenFuerSelect(["Büro"], "Büro")).toEqual(["Büro"]);
  });
});
