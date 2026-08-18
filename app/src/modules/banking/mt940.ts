/**
 * Parser für klassisches SWIFT-MT940 / STA → ParsedBankZeile.
 * Gehaltener Dialekt: :20: / :25: / :61: / :86: / :62F:|:62M:.
 * Kein CAMT.053, kein MT942. Betrag und Richtung nur aus :61:, nie geraten.
 */

import {
  isPlausibleIban,
  isValidIsoDate,
  normalizeIban,
  parseSignedBetrag,
} from "./invariants";
import type { BankBewegungRichtung, ParsedBankZeile } from "./types";

export const MT940_DIALEKT_HINWEIS =
  "Klassisches SWIFT-MT940 / STA. Valuta und Soll/Haben aus :61: (C/D/RC/RD, Komma als Dezimal). Kein CAMT.053, kein MT942.";

const TAG_START = /^:(\d{2}[A-Z]?):(.*)$/;
const ALLOWED_TAGS = new Set([
  "20",
  "21",
  "25",
  "28",
  "28C",
  "60F",
  "60M",
  "61",
  "86",
  "62F",
  "62M",
  "64",
  "65",
  "NS",
]);
const MT942_TAGS = new Set(["34F", "13", "13D", "90C", "90D"]);

export type Mt940ParseFehler = { zeile: number; meldung: string };

export type Mt940ParseResult = {
  zeilen: ParsedBankZeile[];
  fehler: Mt940ParseFehler[];
  warnungen: string[];
  /** Rohe :25:-Werte in Dateireihenfolge */
  kontoIds: string[];
};

type Field = { tag: string; value: string; line: number };

export function unwrapSwiftBlocks(text: string): string {
  const re = /\{4:\r?\n?([\s\S]*?)-\}/g;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1]!.replace(/\s+$/, ""));
  }
  return blocks.length > 0 ? blocks.join("\n-\n") : text;
}

function normalizeNewlines(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function hasTag(text: string, tag: string): boolean {
  const t = normalizeNewlines(unwrapSwiftBlocks(text));
  return new RegExp(`(?:^|\\n):${tag}:`).test(t);
}

export function looksLikeMt940(text: string): boolean {
  return hasTag(text, "61") && (hasTag(text, "20") || hasTag(text, "25"));
}

export function looksLikeCamt(text: string): boolean {
  const head = text.trimStart().slice(0, 400);
  return (
    /^<\?xml/i.test(head) ||
    /<(Document|BkToCstmrStmt)\b/i.test(head) ||
    /camt\.053/i.test(head)
  );
}

export function looksLikeMt942(text: string): boolean {
  return (
    hasTag(text, "34F") ||
    hasTag(text, "13D") ||
    hasTag(text, "90C") ||
    hasTag(text, "90D")
  );
}

export function looksLikePdf(text: string): boolean {
  return text.trimStart().startsWith("%PDF");
}

/**
 * Erkennt das Importformat. CAMT, MT942 und PDF werden abgelehnt, nicht umgebogen.
 */
export function detectBankImportFormat(
  text: string,
  filename?: string,
): "csv" | "mt940" {
  if (looksLikeCamt(text)) {
    throw new Error(
      "CAMT/XML wird nicht unterstützt. Bitte CSV oder klassisches SWIFT-MT940 (STA) verwenden.",
    );
  }
  if (looksLikeMt942(text)) {
    throw new Error(
      "MT942 (Zwischensaldo) wird nicht unterstützt. Bitte einen Tagesauszug MT940/STA oder CSV verwenden.",
    );
  }
  if (looksLikePdf(text)) {
    throw new Error(
      "PDF wird nicht unterstützt. Bitte CSV oder SWIFT-MT940 (STA) verwenden.",
    );
  }
  if (looksLikeMt940(text)) {
    return "mt940";
  }
  const name = (filename ?? "").toLowerCase();
  if (/\.(sta|mt940)$/.test(name)) {
    throw new Error(
      "Die Datei endet auf .sta/.mt940, ist aber kein SWIFT-MT940 (erwartet :20: oder :25: und :61:).",
    );
  }
  return "csv";
}

export function parseSwiftYymmdd(raw: string): string {
  if (!/^\d{6}$/.test(raw)) {
    throw new Error(`Ungültiges SWIFT-Datum: ${raw}`);
  }
  const yy = raw.slice(0, 2);
  const mm = raw.slice(2, 4);
  const dd = raw.slice(4, 6);
  const n = Number.parseInt(yy, 10);
  const yyyy = n >= 70 ? `19${yy}` : `20${yy}`;
  const iso = `${yyyy}-${mm}-${dd}`;
  if (!isValidIsoDate(iso)) {
    throw new Error(`Ungültiges SWIFT-Datum: ${raw}`);
  }
  return iso;
}

export function extractIbanFromKontoId(raw: string): string | null {
  const t = raw.toUpperCase().replace(/[\s/\-]/g, "");
  for (let i = 0; i <= t.length - 15; i++) {
    if (!/^[A-Z]{2}[0-9]{2}/.test(t.slice(i, i + 4))) continue;
    for (let len = Math.min(34, t.length - i); len >= 15; len--) {
      const cand = t.slice(i, i + len);
      if (isPlausibleIban(cand)) return cand;
    }
  }
  return null;
}

export function pruefeMt940KontoIds(
  kontoIds: string[],
  kontoIban: string,
): { ablehnen?: string; warnungen: string[] } {
  const warnungen: string[] = [];
  if (kontoIds.length === 0) {
    warnungen.push(
      "Auszug ohne Konto-ID (:25:) — Zuordnung zum gewählten Bankkonto nicht geprüft.",
    );
    return { warnungen };
  }

  const ibans = [
    ...new Set(
      kontoIds
        .map((id) => extractIbanFromKontoId(id))
        .filter((v): v is string => Boolean(v)),
    ),
  ];

  if (ibans.length > 1) {
    return {
      ablehnen:
        "Der Auszug enthält mehrere verschiedene IBANs in :25:. Bitte nur einen Auszug des gewählten Bankkontos importieren.",
      warnungen,
    };
  }

  const fileIban = ibans[0];
  const stamm = normalizeIban(kontoIban);

  if (fileIban) {
    if (!stamm) {
      return {
        ablehnen:
          "Am Bankkonto ist keine IBAN hinterlegt. Für MT940 bitte die IBAN in den Stammdaten ergänzen, damit :25: geprüft werden kann.",
        warnungen,
      };
    }
    if (fileIban !== stamm) {
      return {
        ablehnen:
          "Konto-ID im Auszug (:25:) passt nicht zur IBAN des gewählten Bankkontos. Import abgebrochen.",
        warnungen,
      };
    }
    return { warnungen };
  }

  warnungen.push(
    "Konto-ID im Auszug (:25:) ist keine IBAN — Zuordnung zum gewählten Bankkonto nicht geprüft.",
  );
  return { warnungen };
}

function splitFields(text: string): Field[] {
  const lines = normalizeNewlines(unwrapSwiftBlocks(text)).split("\n");
  const fields: Field[] = [];
  let current: Field | null = null;

  const flush = () => {
    if (current) fields.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed === "-" || trimmed.startsWith("-}")) {
      flush();
      fields.push({ tag: "-", value: "", line: i + 1 });
      continue;
    }
    const m = line.match(TAG_START);
    if (m) {
      flush();
      current = { tag: m[1]!, value: m[2] ?? "", line: i + 1 };
      continue;
    }
    if (current) {
      current.value += `\n${line}`;
    }
  }
  flush();
  return fields;
}

function parseField61(
  raw: string,
  lineNo: number,
): {
  datum: string;
  richtung: BankBewegungRichtung;
  betrag: string;
  referenz: string;
  zusatz: string;
} {
  const compact = raw.replace(/^\s+/, "");
  const parts = compact.split("\n");
  const firstLine = (parts[0] ?? "").trim();
  const zusatz = parts.slice(1).join("").trim();

  if (firstLine.length < 7) {
    throw new Error(`:61: in Zeile ${lineNo} ist zu kurz.`);
  }
  const valuta = firstLine.slice(0, 6);
  if (!/^\d{6}$/.test(valuta)) {
    throw new Error(
      `:61: in Zeile ${lineNo}: Valuta (YYMMDD) fehlt oder ungültig.`,
    );
  }
  const datum = parseSwiftYymmdd(valuta);

  let i = 6;
  const afterFour = firstLine.slice(i + 4);
  if (
    /^\d{4}/.test(firstLine.slice(i)) &&
    /^(RC|RD|C|D)/.test(afterFour)
  ) {
    i += 4;
  }

  let mark: "C" | "D" | "RC" | "RD";
  if (firstLine.startsWith("RD", i)) {
    mark = "RD";
    i += 2;
  } else if (firstLine.startsWith("RC", i)) {
    mark = "RC";
    i += 2;
  } else if (firstLine[i] === "C") {
    mark = "C";
    i += 1;
  } else if (firstLine[i] === "D") {
    mark = "D";
    i += 1;
  } else {
    throw new Error(
      `:61: in Zeile ${lineNo}: Richtung nicht erkannt (erwartet C, D, RC oder RD).`,
    );
  }

  const next = firstLine[i] ?? "";
  const next2 = firstLine[i + 1] ?? "";
  if (/^[A-Za-z]$/.test(next) && /^\d$/.test(next2)) {
    i += 1;
  }

  const restAmt = firstLine.slice(i);
  const amtMatch = restAmt.match(/^(\d+,\d{0,2}|\d+)/);
  if (!amtMatch) {
    throw new Error(
      `:61: in Zeile ${lineNo}: Betrag fehlt oder nicht im SWIFT-Format (Komma als Dezimalzeichen).`,
    );
  }
  const amtRaw = amtMatch[1]!;
  const afterAmt = restAmt[amtRaw.length] ?? "";
  if (afterAmt === "." || afterAmt === ",") {
    throw new Error(
      `:61: in Zeile ${lineNo}: Betrag nicht im SWIFT-Format (Komma als Dezimal, ohne Tausenderpunkt).`,
    );
  }
  i += amtRaw.length;

  const richtung: BankBewegungRichtung =
    mark === "C" || mark === "RD" ? "eingang" : "ausgang";
  const { betrag } = parseSignedBetrag(amtRaw, richtung);

  let rest = firstLine.slice(i);
  if (/^[NFSnfs][A-Za-z0-9]{3}/.test(rest)) {
    rest = rest.slice(4);
  }
  const cust = (rest.split("//")[0] ?? "").trim();
  const referenz = !cust || cust.toUpperCase() === "NONREF" ? "" : cust;

  return { datum, richtung, betrag, referenz, zusatz };
}

export function parseMt940Info86(raw: string): {
  vwz: string;
  name: string;
  iban: string;
} {
  const compact = raw.replace(/\r?\n/g, "");
  if (!/\?\d{2}/.test(compact)) {
    return { vwz: compact.trim(), name: "", iban: "" };
  }

  const fields = new Map<string, string>();
  for (const m of compact.matchAll(/\?(\d{2})([^?]*)/g)) {
    const code = m[1]!;
    fields.set(code, (fields.get(code) ?? "") + (m[2] ?? ""));
  }

  let vwz = "";
  for (let n = 20; n <= 29; n++) {
    vwz += fields.get(String(n).padStart(2, "0")) ?? "";
  }
  vwz = vwz.trim();
  if (!vwz) {
    vwz = (fields.get("00") ?? "").trim();
  }

  const name = `${fields.get("32") ?? ""}${fields.get("33") ?? ""}`.trim();
  let iban = "";
  for (const code of ["38", "31"]) {
    const cand = normalizeIban(fields.get(code) ?? "");
    if (cand && isPlausibleIban(cand)) {
      iban = cand;
      break;
    }
  }
  return { vwz, name, iban };
}

/**
 * Parst SWIFT-MT940 / STA. Unvollständige Sätze (Umsätze ohne :62F:/:62M:)
 * werden nicht übernommen. Einzelne unlesbare :61:-Zeilen landen in fehler.
 */
export function parseMt940(text: string): Mt940ParseResult {
  const zeilen: ParsedBankZeile[] = [];
  const fehler: Mt940ParseFehler[] = [];
  const warnungen: string[] = [];
  const kontoIds: string[] = [];

  const trimmed = text.trim();
  if (!trimmed) {
    return {
      zeilen: [],
      fehler: [{ zeile: 0, meldung: "MT940-Datei ist leer." }],
      warnungen,
      kontoIds,
    };
  }

  const fields = splitFields(text);
  let sawMovement = false;
  let statementClosed = true;
  let pending: Array<{ zeile: ParsedBankZeile; line: number }> = [];

  const rejectPending = (meldung: string) => {
    if (pending.length === 0) return;
    for (const p of pending) {
      fehler.push({ zeile: p.line, meldung });
    }
    pending = [];
    sawMovement = false;
  };

  const flushPending = () => {
    for (const p of pending) {
      zeilen.push(p.zeile);
    }
    pending = [];
    sawMovement = false;
    statementClosed = true;
  };

  for (const field of fields) {
    if (field.tag === "-") {
      if (sawMovement && !statementClosed) {
        rejectPending(
          "Umsatzzeile ohne Schlusssaldo (:62F:/:62M:) — Auszug unvollständig.",
        );
      } else if (statementClosed) {
        pending = [];
      }
      continue;
    }

    if (MT942_TAGS.has(field.tag)) {
      return {
        zeilen: [],
        fehler: [
          {
            zeile: field.line,
            meldung:
              "MT942 oder verwandter Dialekt (:34F:/:13D:/:90:) wird nicht unterstützt.",
          },
        ],
        warnungen,
        kontoIds,
      };
    }

    if (!ALLOWED_TAGS.has(field.tag)) {
      warnungen.push(
        `Feld :${field.tag}: in Zeile ${field.line} ignoriert (nicht im gehaltenen Dialekt).`,
      );
      continue;
    }

    if (field.tag === "20") {
      if (sawMovement && !statementClosed) {
        rejectPending(
          "Umsatzzeile ohne Schlusssaldo (:62F:/:62M:) — Auszug unvollständig.",
        );
      }
      statementClosed = false;
      continue;
    }

    if (field.tag === "25") {
      const id = field.value.replace(/\s+/g, "").trim();
      if (id) kontoIds.push(id);
      statementClosed = false;
      continue;
    }

    if (field.tag === "61") {
      try {
        const p = parseField61(field.value, field.line);
        pending.push({
          line: field.line,
          zeile: {
            datum: p.datum,
            richtung: p.richtung,
            betrag: p.betrag,
            verwendungszweck: p.zusatz,
            gegenkonto_name: "",
            gegenkonto_iban: "",
            referenz: p.referenz,
          },
        });
        sawMovement = true;
        statementClosed = false;
      } catch (e) {
        fehler.push({
          zeile: field.line,
          meldung: e instanceof Error ? e.message : ":61: ungültig.",
        });
      }
      continue;
    }

    if (field.tag === "86") {
      const last = pending[pending.length - 1];
      if (!last) {
        fehler.push({
          zeile: field.line,
          meldung: ":86: ohne vorausgehende :61:-Zeile.",
        });
        continue;
      }
      const info = parseMt940Info86(field.value);
      last.zeile = {
        ...last.zeile,
        verwendungszweck: info.vwz || last.zeile.verwendungszweck,
        gegenkonto_name: info.name,
        gegenkonto_iban: info.iban,
      };
      continue;
    }

    if (field.tag === "62F" || field.tag === "62M") {
      flushPending();
      continue;
    }
  }

  if (sawMovement && !statementClosed) {
    rejectPending(
      "Umsatzzeile ohne Schlusssaldo (:62F:/:62M:) — Auszug unvollständig.",
    );
  }

  if (zeilen.length === 0 && fehler.length === 0) {
    fehler.push({
      zeile: 0,
      meldung: "Keine Umsatzzeilen (:61:) gefunden.",
    });
  }

  return { zeilen, fehler, warnungen, kontoIds };
}
