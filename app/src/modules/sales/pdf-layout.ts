/**
 * Reine Helfer für Angebots-/Rechnungs-PDF: Entwurf vs. Original, Dateiname,
 * Layout (Akzentfarbe, Kopf-/Fußtext, Sichtbarkeit, Bankzeile).
 * Kein I/O, kein Nummernkreis.
 */

import { formatMoneyDe } from "@/lib/money";

function ibanCompact(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export const PDF_WASSERZEICHEN_ENTWURF = "Entwurf";

export const DEFAULT_DOKUMENT_AKZENTFARBE = "#1F2937";

export const DOKUMENT_KOPFTEXT_MAX = 500;
export const DOKUMENT_FUSSTEXT_MAX = 1000;
export const DOKUMENT_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const DOKUMENT_LOGO_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type DokumentArt = "angebot" | "rechnung";

export type DokumentBank = {
  name: string;
  iban: string;
  bic: string;
};

export type DokumentPdfLayout = {
  /** data:image/…;base64,… — fehlt, wenn kein Logo */
  logoDataUri?: string;
  /** Immer ein gültiges #RRGGBB */
  akzentfarbe: string;
  kopftext: string;
  fusstext: string;
  headerDrucken: boolean;
  fussDrucken: boolean;
  zahlblock: boolean;
  bank?: DokumentBank;
};

export function defaultDokumentPdfLayout(): DokumentPdfLayout {
  return {
    akzentfarbe: DEFAULT_DOKUMENT_AKZENTFARBE,
    kopftext: "",
    fusstext: "",
    headerDrucken: true,
    fussDrucken: true,
    zahlblock: true,
  };
}

/** Fehlend oder nicht false → an (bisheriges Verhalten). */
export function dokumentSchalterWert(
  raw: boolean | undefined | null,
): boolean {
  return raw !== false;
}

export function parseDokumentSchalterForm(raw: unknown): boolean {
  return raw === "1" || raw === "on" || raw === true || raw === "true";
}

/**
 * Erstes aktives Bankkonto mit IBAN (Liste bereits sortiert).
 * Ohne IBAN kein GiroCode und keine Bankzeile.
 */
export function pickDokumentBankkonto(
  konten: Array<{
    name: string;
    iban?: string;
    bic?: string;
    aktiv?: boolean;
  }>,
): DokumentBank | undefined {
  for (const k of konten) {
    if (k.aktiv === false) continue;
    const iban = ibanCompact(k.iban ?? "");
    if (!iban) continue;
    return {
      name: (k.name ?? "").trim(),
      iban,
      bic: (k.bic ?? "").replace(/\s+/g, "").toUpperCase(),
    };
  }
  return undefined;
}

export function formatIbanAnzeige(iban: string): string {
  const n = ibanCompact(iban);
  return n.replace(/(.{4})/g, "$1 ").trim();
}

export function formatPdfDateDe(iso: string): string {
  if (!iso || iso.length < 10) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function formatLeistungszeitraum(von?: string, bis?: string): string {
  const a = formatPdfDateDe(von ?? "");
  const b = formatPdfDateDe(bis ?? "");
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
}

export function firmaAbsenderzeile(opts: {
  name: string;
  strasse?: string;
  plz?: string;
  ort?: string;
}): string {
  const city = [opts.plz, opts.ort].filter(Boolean).join(" ");
  return [opts.name, opts.strasse, city].filter(Boolean).join(" · ");
}

export function footerBankzeile(bank?: DokumentBank): string {
  if (!bank?.iban) return "";
  const parts: string[] = [];
  if (bank.name) parts.push(`Bank: ${bank.name}`);
  parts.push(`IBAN: ${formatIbanAnzeige(bank.iban)}`);
  if (bank.bic) parts.push(`BIC: ${bank.bic}`);
  return parts.join("  ·  ");
}

export function dokumentTitel(opts: {
  art: DokumentArt;
  entwurf: boolean;
  nummer?: string | null;
}): string {
  const label = opts.art === "angebot" ? "Angebot" : "Rechnung";
  if (opts.entwurf) return `${label} (Entwurf)`;
  const n = (opts.nummer ?? "").trim();
  return n ? `${label} Nr. ${n}` : label;
}

export function zahlungshinweisRechnung(opts: {
  betrag: string;
  faelligAm?: string;
  entwurf: boolean;
  hatBank: boolean;
}): string {
  const betrag = formatMoneyDe(opts.betrag, { currency: true });
  const bis = formatPdfDateDe(opts.faelligAm ?? "");
  const nr = opts.entwurf
    ? "unter Angabe der späteren Rechnungsnummer"
    : "unter Angabe der Rechnungsnummer";
  const ziel = opts.hatBank ? " auf unser Bankkonto" : "";
  if (bis) {
    return `Bitte überweisen Sie den Betrag von ${betrag} bis zum ${bis} ${nr}${ziel}.`;
  }
  return `Bitte überweisen Sie den Betrag von ${betrag} ${nr}${ziel}.`;
}

/** Weiß auf dunklem Akzent, sonst dunkel — Tabellenkopf. */
export function kontrastTextAuf(hex: string): "#FFFFFF" | "#111111" {
  const n = normalizeAkzentfarbe(hex) ?? DEFAULT_DOKUMENT_AKZENTFARBE;
  const r = parseInt(n.slice(1, 3), 16);
  const g = parseInt(n.slice(3, 5), 16);
  const b = parseInt(n.slice(5, 7), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.55 ? "#111111" : "#FFFFFF";
}

/**
 * Nummer auf dem PDF: Entwurf zeigt nie eine Kreisnummer.
 */
export function pdfNummerAnzeige(opts: {
  entwurf: boolean;
  nummer?: string | null;
}): string {
  if (opts.entwurf) return PDF_WASSERZEICHEN_ENTWURF;
  const n = (opts.nummer ?? "").trim();
  return n || "—";
}

export function pdfDateiname(opts: {
  art: DokumentArt;
  entwurf: boolean;
  nummer?: string | null;
}): string {
  if (opts.entwurf) {
    return opts.art === "angebot"
      ? "Angebot-Entwurf.pdf"
      : "Rechnung-Entwurf.pdf";
  }
  const n = (opts.nummer ?? "").trim();
  if (n) return `${n}.pdf`;
  return opts.art === "angebot" ? "Angebot.pdf" : "Rechnung.pdf";
}

/** #RGB oder #RRGGBB → #RRGGBB; leer → Default; ungültig → null */
export function normalizeAkzentfarbe(
  raw: string | undefined | null,
): string | null {
  const s = (raw ?? "").trim();
  if (!s) return DEFAULT_DOKUMENT_AKZENTFARBE;
  const hex = s.startsWith("#") ? s.slice(1) : s;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const [r, g, b] = hex.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }
  return null;
}

export function validateDokumentTexte(input: {
  kopftext?: string;
  fusstext?: string;
}): { kopftext: string; fusstext: string } {
  const kopftext = (input.kopftext ?? "").trim();
  const fusstext = (input.fusstext ?? "").trim();
  if (kopftext.length > DOKUMENT_KOPFTEXT_MAX) {
    throw new Error(
      `Kopftext ist zu lang (max. ${DOKUMENT_KOPFTEXT_MAX} Zeichen).`,
    );
  }
  if (fusstext.length > DOKUMENT_FUSSTEXT_MAX) {
    throw new Error(
      `Fußtext ist zu lang (max. ${DOKUMENT_FUSSTEXT_MAX} Zeichen).`,
    );
  }
  return { kopftext, fusstext };
}

export function validateDokumentAkzentfarbe(
  raw: string | undefined | null,
): string {
  const n = normalizeAkzentfarbe(raw);
  if (!n) {
    throw new Error(
      "Akzentfarbe muss leer bleiben oder #RGB / #RRGGBB sein.",
    );
  }
  return n;
}

export function guessImageMime(
  filename: string,
  contentType?: string | null,
): string {
  const ct = (contentType ?? "").split(";")[0]?.trim().toLowerCase();
  if (ct && (DOKUMENT_LOGO_MIME as readonly string[]).includes(ct)) {
    return ct;
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export function assertLogoUpload(file: {
  size: number;
  type: string;
}): void {
  if (file.size <= 0) {
    throw new Error("Logo-Datei ist leer.");
  }
  if (file.size > DOKUMENT_LOGO_MAX_BYTES) {
    throw new Error("Logo darf höchstens 2 MB groß sein.");
  }
  const type = (file.type || "").toLowerCase();
  if (!(DOKUMENT_LOGO_MIME as readonly string[]).includes(type)) {
    throw new Error("Logo: nur PNG, JPEG oder WebP.");
  }
}
