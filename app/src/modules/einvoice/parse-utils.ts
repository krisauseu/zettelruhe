/**
 * Hilfen für XML-Parse (namespaces strippen, Beträge/Daten normalisieren).
 * Keine externe Parser-Lib — light, austauschbar hinter Adapter (ADR-0015).
 */

import { money, moneyToString } from "@/lib/money";
import type { Steuersatz } from "@/modules/expenses/types";

/** Entfernt XML-Namespace-Präfixe an Tags (`cbc:ID` → `ID`), xmlns-Deklarationen weg */
export function stripXmlNamespaces(xml: string): string {
  return xml
    .replace(/<\/([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)/g, "</$2")
    .replace(/<([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)/g, "<$2")
    .replace(/\sxmlns(?::[A-Za-z_][\w.-]*)?="[^"]*"/g, "")
    .replace(/\sxmlns(?::[A-Za-z_][\w.-]*)?='[^']*'/g, "");
}

/**
 * Erste Text-Inhalte eines Local-Name-Tags (nach Namespace-Strip).
 * `tag` ohne spitze Klammern, z. B. "ID", "Name".
 */
export function firstTagText(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    "i",
  );
  const m = xml.match(re);
  if (!m) return "";
  return decodeXmlEntities(m[1].replace(/<[^>]+>/g, "").trim());
}

/** Alle Text-Inhalte eines Tags */
export function allTagTexts(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(decodeXmlEntities(m[1].replace(/<[^>]+>/g, "").trim()));
  }
  return out;
}

/** Erster Block-Inhalt eines Tags inkl. Kind-Elemente */
export function firstTagBlock(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return m ? m[1] : "";
}

/** Alle Blöcke eines Tags */
export function allTagBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`,
    "gi",
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * UBL/CII Datum: YYYY-MM-DD oder YYYYMMDD → YYYY-MM-DD
 */
export function normalizeEInvoiceDate(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  if (/^\d{8}$/.test(t)) {
    return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  }
  // ISO mit Zeit
  if (/^\d{4}-\d{2}-\d{2}T/.test(t)) return t.slice(0, 10);
  return "";
}

/**
 * Betragsstring aus E-Rechnung (Punkt-Dezimal üblich) → "12.34"
 */
export function normalizeEInvoiceAmount(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return "";
  let normalized = trimmed;
  if (normalized.includes(",") && normalized.includes(".")) {
    // 1.234,56
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  const d = money(normalized);
  if (d.isNaN() || !d.isFinite() || d.isNegative()) {
    return "";
  }
  return moneyToString(d);
}

/** Prozent → Steuersatz light 0|7|19 wenn nahe genug */
export function mapTaxPercentToSteuersatz(raw: string): Steuersatz | "" {
  const n = Number.parseFloat(raw.replace(",", "."));
  if (Number.isNaN(n)) return "";
  if (Math.abs(n - 19) < 0.01) return "19";
  if (Math.abs(n - 7) < 0.01) return "7";
  if (Math.abs(n) < 0.01) return "0";
  return "";
}

/**
 * Versucht eingebettetes XML aus PDF-Bytes (ZUGFeRD/Factur-X light).
 * Kein vollständiger PDF-Parser — sucht typische Invoice-XML-Blöcke.
 */
export function extractXmlFromPdf(bytes: Uint8Array): string | null {
  // latin1 behält Byte-Werte 0–255 als Zeichen
  const asLatin1 = Buffer.from(bytes).toString("latin1");

  const patterns: RegExp[] = [
    /<\?xml[\s\S]*?<\/rsm:CrossIndustryInvoice>/i,
    /<\?xml[\s\S]*?<\/CrossIndustryInvoice>/i,
    /<rsm:CrossIndustryInvoice[\s\S]*?<\/rsm:CrossIndustryInvoice>/i,
    /<CrossIndustryInvoice[\s\S]*?<\/CrossIndustryInvoice>/i,
    /<\?xml[\s\S]*?<\/ubl:Invoice>/i,
    /<\?xml[\s\S]*?<\/Invoice>/i,
    /<Invoice[\s\S]*?xmlns[\s\S]*?<\/Invoice>/i,
  ];

  for (const re of patterns) {
    const m = asLatin1.match(re);
    if (m && m[0].length > 200) {
      // PDF escaped streams manchmal mit \n — bereinigen
      return m[0].replace(/\\n/g, "\n").replace(/\\r/g, "");
    }
  }
  return null;
}

export function isLikelyXml(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("<?xml") || t.startsWith("<Invoice") || t.startsWith("<rsm:") || t.includes("CrossIndustryInvoice") || t.includes("urn:oasis:names:specification:ubl");
}

export function detectXmlFormat(xml: string): "xrechnung_ubl" | "zugferd_cii" | "unbekannt" {
  const lower = xml.toLowerCase();
  if (
    lower.includes("crossindustryinvoice") ||
    lower.includes("urn:un:unece:uncefact")
  ) {
    return "zugferd_cii";
  }
  if (
    lower.includes("urn:oasis:names:specification:ubl") ||
    /<invoice[\s>]/i.test(xml)
  ) {
    return "xrechnung_ubl";
  }
  return "unbekannt";
}
