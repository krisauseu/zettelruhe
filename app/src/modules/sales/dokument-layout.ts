/**
 * Lädt Layout der Firma für PDF-Erzeugung (Logo, Texte, Schalter, Bankkonto).
 * Fehlt das Logo oder die Felder (alte Instanz), fällt auf Defaults zurück.
 */

import { fetchRecordFile, type FirmaRecord } from "@/lib/pb";
import { listBankkonten } from "@/modules/banking";
import {
  defaultDokumentPdfLayout,
  dokumentSchalterWert,
  guessImageMime,
  pickDokumentBankkonto,
  validateDokumentAkzentfarbe,
  validateDokumentTexte,
  type DokumentPdfLayout,
} from "./pdf-layout";

export async function loadDokumentLayout(
  firma: FirmaRecord,
): Promise<DokumentPdfLayout> {
  const layout = defaultDokumentPdfLayout();
  try {
    layout.akzentfarbe = validateDokumentAkzentfarbe(
      firma.dokument_akzentfarbe,
    );
  } catch {
    /* Default behalten */
  }
  const texte = validateDokumentTexte({
    kopftext: firma.dokument_kopftext,
    fusstext: firma.dokument_fusstext,
  });
  layout.kopftext = texte.kopftext;
  layout.fusstext = texte.fusstext;
  layout.headerDrucken = dokumentSchalterWert(firma.dokument_header_drucken);
  layout.fussDrucken = dokumentSchalterWert(firma.dokument_fuss_drucken);
  layout.zahlblock = dokumentSchalterWert(firma.dokument_zahlblock);

  try {
    const konten = await listBankkonten(firma.id, { aktiv: true }, 1, 50);
    const bank = pickDokumentBankkonto(konten.items);
    if (bank) layout.bank = bank;
  } catch {
    /* PDF ohne Bankzeile */
  }

  const logoName = (firma.logo ?? "").trim();
  if (!logoName) return layout;

  try {
    const res = await fetchRecordFile("firmen", firma.id, logoName);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return layout;
    const mime = guessImageMime(logoName, res.headers.get("content-type"));
    layout.logoDataUri = `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    /* PDF ohne Logo */
  }
  return layout;
}
