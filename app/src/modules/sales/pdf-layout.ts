/**
 * Reine Helfer für Angebots-/Rechnungs-PDF: Entwurf vs. Original, Dateiname,
 * Layout light (Akzentfarbe, Kopf-/Fußtext). Kein I/O, kein Nummernkreis.
 */

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

export type DokumentPdfLayout = {
  /** data:image/…;base64,… — fehlt, wenn kein Logo */
  logoDataUri?: string;
  /** Immer ein gültiges #RRGGBB */
  akzentfarbe: string;
  kopftext: string;
  fusstext: string;
};

export function defaultDokumentPdfLayout(): DokumentPdfLayout {
  return {
    akzentfarbe: DEFAULT_DOKUMENT_AKZENTFARBE,
    kopftext: "",
    fusstext: "",
  };
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
