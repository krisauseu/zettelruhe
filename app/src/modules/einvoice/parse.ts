/**
 * Parser-Fassade: Datei-Bytes → ParsedEInvoice (ADR-0015 Anti-Corruption-Layer).
 *
 * Produktionsfähig in BA12:
 * - XRechnung / UBL-XML (primär)
 * - ZUGFeRD/Factur-X CII-XML (standalone XML)
 * - ZUGFeRD-PDF: light Embedded-XML-Extraktion (kein Mustang, kein vollständiger PDF-Parser)
 *
 * Keine Live-Netzwerk-Abhängigkeit; austauschbare Adapter hinter stabilem DTO.
 */

import { parseCiiXml } from "./parse-cii";
import { parseUblXml } from "./parse-ubl";
import {
  detectXmlFormat,
  extractXmlFromPdf,
  isLikelyXml,
} from "./parse-utils";
import type { ParseEInvoiceResult } from "./types";

export type ParseFileInput = {
  bytes: Uint8Array | ArrayBuffer | Buffer;
  filename?: string;
  mimeType?: string;
};

function toUint8Array(bytes: ParseFileInput["bytes"]): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(bytes)) {
    return new Uint8Array(bytes);
  }
  return new Uint8Array(bytes as ArrayBuffer);
}

function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Parst E-Rechnungsdatei. Wirft nicht bei unparseable — liefert `{ ok: false }`.
 */
export function parseEInvoiceFile(input: ParseFileInput): ParseEInvoiceResult {
  const bytes = toUint8Array(input.bytes);
  if (bytes.length === 0) {
    return { ok: false, error: "Datei ist leer.", format: "unbekannt" };
  }

  const filename = (input.filename ?? "").toLowerCase();
  const mime = (input.mimeType ?? "").toLowerCase();
  const isPdf =
    filename.endsWith(".pdf") ||
    mime === "application/pdf" ||
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44); // %PDF

  let xml: string | null = null;

  if (isPdf) {
    xml = extractXmlFromPdf(bytes);
    if (!xml) {
      return {
        ok: false,
        error:
          "PDF ohne erkennbares eingebettetes E-Rechnungs-XML (ZUGFeRD/Factur-X). Original wurde archiviert. Bitte XRechnung-XML hochladen oder Beleg manuell anlegen.",
        format: "unbekannt",
      };
    }
  } else {
    const text = bytesToUtf8(bytes);
    if (!isLikelyXml(text)) {
      return {
        ok: false,
        error:
          "Datei ist weder XML noch PDF mit E-Rechnungs-Inhalt. Original wurde archiviert.",
        format: "unbekannt",
      };
    }
    xml = text;
  }

  return parseEInvoiceXml(xml);
}

/** XML-String parsen (UBL oder CII). */
export function parseEInvoiceXml(xml: string): ParseEInvoiceResult {
  if (!xml?.trim()) {
    return { ok: false, error: "XML ist leer.", format: "unbekannt" };
  }

  const format = detectXmlFormat(xml);

  if (format === "zugferd_cii") {
    return parseCiiXml(xml);
  }

  if (format === "xrechnung_ubl") {
    return parseUblXml(xml);
  }

  // Heuristik: beide versuchen
  const ubl = parseUblXml(xml);
  if (ubl.ok) return ubl;

  const cii = parseCiiXml(xml);
  if (cii.ok) return cii;

  return {
    ok: false,
    error:
      ubl.ok === false
        ? ubl.error
        : "Unbekanntes E-Rechnungsformat. Erwartet XRechnung (UBL) oder ZUGFeRD (CII).",
    format: "unbekannt",
  };
}
