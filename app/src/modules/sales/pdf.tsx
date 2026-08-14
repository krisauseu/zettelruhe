/**
 * Rechnungs- und Angebots-PDF mit @react-pdf/renderer (ADR-0014).
 * Layout light — Logo/Akzent/Textbausteine aus der Firma; kein Briefpapier.
 * Entwurf: Wasserzeichen, keine Nummer. Original: persistiert, ohne Wasserzeichen.
 * Nur serverseitig aufrufen.
 */

import React from "react";
import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { formatMoneyDe } from "@/lib/money";
import type { FirmaRecord, Steuermodus } from "@/lib/pb";
import type { Kontakt } from "@/modules/contacts/types";
import { KLEINUNTERNEHMER_HINWEIS } from "./invariants";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_WASSERZEICHEN_ENTWURF,
  defaultDokumentPdfLayout,
  pdfNummerAnzeige,
  type DokumentPdfLayout,
} from "./pdf-layout";
import type {
  Angebot,
  Angebotsposition,
  Rechnung,
  Rechnungsposition,
} from "./types";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 72,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111",
  },
  watermark: {
    position: "absolute",
    top: 300,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 64,
    fontFamily: "Helvetica-Bold",
    color: "#D0D0D0",
    letterSpacing: 6,
    transform: "rotate(-28deg)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  logo: {
    width: 110,
    height: 44,
    objectFit: "contain",
    marginBottom: 8,
  },
  firmaName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  muted: {
    color: "#555",
    fontSize: 9,
    lineHeight: 1.4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  kopftext: {
    marginBottom: 14,
    fontSize: 9,
    color: "#333",
    lineHeight: 1.4,
  },
  metaBlock: {
    marginBottom: 20,
  },
  metaLine: {
    marginBottom: 2,
  },
  label: {
    fontFamily: "Helvetica-Bold",
  },
  table: {
    marginTop: 8,
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    paddingBottom: 4,
    marginBottom: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    fontSize: 9,
  },
  colBez: { width: "38%" },
  colMenge: { width: "12%", textAlign: "right" },
  colEinheit: { width: "10%" },
  colPreis: { width: "15%", textAlign: "right" },
  colUst: { width: "10%", textAlign: "right" },
  colSumme: { width: "15%", textAlign: "right" },
  totals: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginBottom: 3,
  },
  totalBold: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
    paddingTop: 4,
  },
  hinweis: {
    marginTop: 20,
    fontSize: 9,
    color: "#333",
    fontStyle: "italic",
  },
  notiz: {
    marginTop: 16,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#666",
    borderTopWidth: 0.5,
    borderTopColor: "#ccc",
    paddingTop: 6,
  },
  footerBlock: {
    marginBottom: 3,
    lineHeight: 1.35,
  },
});

function formatDateDe(iso: string): string {
  if (!iso || iso.length < 10) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function addressLines(opts: {
  name: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
}): string[] {
  const lines = [opts.name];
  if (opts.strasse) lines.push(opts.strasse);
  const city = [opts.plz, opts.ort].filter(Boolean).join(" ");
  if (city) lines.push(city);
  if (opts.land && opts.land !== "DE") lines.push(opts.land);
  return lines;
}

function resolveLayout(layout?: DokumentPdfLayout): DokumentPdfLayout {
  return layout ?? defaultDokumentPdfLayout();
}

function FirmaBlock({
  firma,
  layout,
}: {
  firma: FirmaRecord;
  layout: DokumentPdfLayout;
}) {
  const firmaLines = addressLines({
    name: firma.name,
    strasse: firma.strasse,
    plz: firma.plz,
    ort: firma.ort,
    land: firma.land,
  });
  return (
    <View>
      {layout.logoDataUri ? (
        <Image src={layout.logoDataUri} style={styles.logo} />
      ) : null}
      {firmaLines.map((l) => (
        <Text
          key={l}
          style={l === firma.name ? styles.firmaName : styles.muted}
        >
          {l}
        </Text>
      ))}
      {firma.steuernummer ? (
        <Text style={styles.muted}>St.-Nr.: {firma.steuernummer}</Text>
      ) : null}
      {firma.ust_id ? (
        <Text style={styles.muted}>USt-IdNr.: {firma.ust_id}</Text>
      ) : null}
    </View>
  );
}

function DokumentFooter({
  firma,
  layout,
}: {
  firma: FirmaRecord;
  layout: DokumentPdfLayout;
}) {
  return (
    <View style={styles.footer} fixed>
      {layout.fusstext ? (
        <Text style={styles.footerBlock}>{layout.fusstext}</Text>
      ) : null}
      <Text>
        {firma.name}
        {firma.steuernummer ? ` · St.-Nr. ${firma.steuernummer}` : ""}
        {firma.ust_id ? ` · USt-IdNr. ${firma.ust_id}` : ""}
      </Text>
    </View>
  );
}

export type RechnungPdfData = {
  rechnung: Rechnung;
  positionen: Rechnungsposition[];
  firma: FirmaRecord;
  kunde: Kontakt;
  /** Bereits vergebene Nummer (bei Festschreibung); leer im Entwurf */
  rechnungsnummer?: string;
  entwurf?: boolean;
  layout?: DokumentPdfLayout;
};

function RechnungDocument({
  rechnung,
  positionen,
  firma,
  kunde,
  rechnungsnummer,
  entwurf = false,
  layout: layoutIn,
}: RechnungPdfData) {
  const layout = resolveLayout(layoutIn);
  const accent = layout.akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE;
  const showUst = rechnung.steuermodus === "regelbesteuerung_ist";
  const nummer = pdfNummerAnzeige({
    entwurf,
    nummer: rechnungsnummer || rechnung.rechnungsnummer,
  });
  const kundeLines = addressLines({
    name: kunde.name,
    strasse: kunde.strasse,
    plz: kunde.plz,
    ort: kunde.ort,
    land: kunde.land,
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {entwurf ? (
          <Text style={styles.watermark}>{PDF_WASSERZEICHEN_ENTWURF}</Text>
        ) : null}

        <View style={styles.headerRow}>
          <FirmaBlock firma={firma} layout={layout} />
          <View>
            <Text style={[styles.title, { color: accent }]}>
              {entwurf ? "Rechnung (Entwurf)" : "Rechnung"}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.label}>Nr.: </Text>
              {nummer}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.label}>Datum: </Text>
              {formatDateDe(rechnung.rechnungsdatum)}
            </Text>
            {rechnung.faellig_am ? (
              <Text style={styles.metaLine}>
                <Text style={styles.label}>Fällig am: </Text>
                {formatDateDe(rechnung.faellig_am)}
              </Text>
            ) : null}
            {rechnung.leistungszeitraum_von || rechnung.leistungszeitraum_bis ? (
              <Text style={styles.metaLine}>
                <Text style={styles.label}>Leistungszeitraum: </Text>
                {formatDateDe(
                  rechnung.leistungszeitraum_von || rechnung.rechnungsdatum,
                )}
                {" – "}
                {formatDateDe(
                  rechnung.leistungszeitraum_bis ||
                    rechnung.leistungszeitraum_von ||
                    rechnung.rechnungsdatum,
                )}
              </Text>
            ) : null}
          </View>
        </View>

        {layout.kopftext ? (
          <Text style={styles.kopftext}>{layout.kopftext}</Text>
        ) : null}

        <View style={styles.metaBlock}>
          <Text style={styles.label}>Rechnungsempfänger:in</Text>
          {kundeLines.map((l) => (
            <Text key={l}>{l}</Text>
          ))}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHeader, { borderBottomColor: accent }]}>
            <Text style={styles.colBez}>Bezeichnung</Text>
            <Text style={styles.colMenge}>Menge</Text>
            <Text style={styles.colEinheit}>Einh.</Text>
            <Text style={styles.colPreis}>Einzel (€)</Text>
            {showUst ? <Text style={styles.colUst}>USt</Text> : null}
            <Text style={styles.colSumme}>Summe (€)</Text>
          </View>
          {positionen.map((p) => (
            <View
              key={p.id || `${p.sortierung}-${p.bezeichnung}`}
              style={styles.tableRow}
            >
              <Text style={styles.colBez}>{p.bezeichnung}</Text>
              <Text style={styles.colMenge}>{p.menge.replace(".", ",")}</Text>
              <Text style={styles.colEinheit}>{p.einheit || "—"}</Text>
              <Text style={styles.colPreis}>
                {formatMoneyDe(p.einzelpreis)}
              </Text>
              {showUst ? (
                <Text style={styles.colUst}>
                  {p.steuersatz ? `${p.steuersatz} %` : "—"}
                </Text>
              ) : null}
              <Text style={styles.colSumme}>
                {formatMoneyDe(showUst ? p.betrag_netto : p.betrag_brutto)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {showUst ? (
            <>
              <View style={styles.totalRow}>
                <Text>Netto</Text>
                <Text>
                  {formatMoneyDe(rechnung.betrag_netto, { currency: true })}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text>USt</Text>
                <Text>
                  {formatMoneyDe(rechnung.betrag_ust, { currency: true })}
                </Text>
              </View>
              <View
                style={[
                  styles.totalRow,
                  styles.totalBold,
                  { borderTopColor: accent },
                ]}
              >
                <Text>Brutto</Text>
                <Text>
                  {formatMoneyDe(rechnung.betrag_brutto, { currency: true })}
                </Text>
              </View>
            </>
          ) : (
            <View
              style={[
                styles.totalRow,
                styles.totalBold,
                { borderTopColor: accent },
              ]}
            >
              <Text>Gesamt</Text>
              <Text>
                {formatMoneyDe(rechnung.betrag_brutto, { currency: true })}
              </Text>
            </View>
          )}
        </View>

        {rechnung.steuermodus === "kleinunternehmer" ? (
          <Text style={styles.hinweis}>{KLEINUNTERNEHMER_HINWEIS}</Text>
        ) : null}

        {rechnung.notiz ? (
          <View style={styles.notiz}>
            <Text style={styles.label}>Hinweis</Text>
            <Text>{rechnung.notiz}</Text>
          </View>
        ) : null}

        <DokumentFooter firma={firma} layout={layout} />
      </Page>
    </Document>
  );
}

/** Erzeugt PDF-Bytes für eine Rechnung. */
export async function renderRechnungPdf(
  data: RechnungPdfData,
): Promise<Buffer> {
  const instance = pdf(<RechnungDocument {...data} />);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}

export function steuermodusLabel(m: Steuermodus): string {
  return m === "kleinunternehmer"
    ? "Kleinunternehmerregelung (§ 19 UStG)"
    : "Regelbesteuerung";
}

export type AngebotPdfData = {
  angebot: Angebot;
  positionen: Angebotsposition[];
  firma: FirmaRecord;
  kunde: Kontakt;
  angebotsnummer?: string;
  entwurf?: boolean;
  layout?: DokumentPdfLayout;
};

function AngebotDocument({
  angebot,
  positionen,
  firma,
  kunde,
  angebotsnummer,
  entwurf = false,
  layout: layoutIn,
}: AngebotPdfData) {
  const layout = resolveLayout(layoutIn);
  const accent = layout.akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE;
  const showUst = angebot.steuermodus === "regelbesteuerung_ist";
  const nummer = pdfNummerAnzeige({
    entwurf,
    nummer: angebotsnummer || angebot.angebotsnummer,
  });
  const kundeLines = addressLines({
    name: kunde.name,
    strasse: kunde.strasse,
    plz: kunde.plz,
    ort: kunde.ort,
    land: kunde.land,
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {entwurf ? (
          <Text style={styles.watermark}>{PDF_WASSERZEICHEN_ENTWURF}</Text>
        ) : null}

        <View style={styles.headerRow}>
          <FirmaBlock firma={firma} layout={layout} />
          <View>
            <Text style={[styles.title, { color: accent }]}>
              {entwurf ? "Angebot (Entwurf)" : "Angebot"}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.label}>Nr.: </Text>
              {nummer}
            </Text>
            <Text style={styles.metaLine}>
              <Text style={styles.label}>Datum: </Text>
              {formatDateDe(angebot.angebotsdatum)}
            </Text>
            {angebot.gueltig_bis ? (
              <Text style={styles.metaLine}>
                <Text style={styles.label}>Gültig bis: </Text>
                {formatDateDe(angebot.gueltig_bis)}
              </Text>
            ) : null}
          </View>
        </View>

        {layout.kopftext ? (
          <Text style={styles.kopftext}>{layout.kopftext}</Text>
        ) : null}

        <View style={styles.metaBlock}>
          <Text style={styles.label}>Angebotsempfänger:in</Text>
          {kundeLines.map((l) => (
            <Text key={l}>{l}</Text>
          ))}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableHeader, { borderBottomColor: accent }]}>
            <Text style={styles.colBez}>Bezeichnung</Text>
            <Text style={styles.colMenge}>Menge</Text>
            <Text style={styles.colEinheit}>Einh.</Text>
            <Text style={styles.colPreis}>Einzel (€)</Text>
            {showUst ? <Text style={styles.colUst}>USt</Text> : null}
            <Text style={styles.colSumme}>Summe (€)</Text>
          </View>
          {positionen.map((p) => (
            <View
              key={p.id || `${p.sortierung}-${p.bezeichnung}`}
              style={styles.tableRow}
            >
              <Text style={styles.colBez}>{p.bezeichnung}</Text>
              <Text style={styles.colMenge}>{p.menge.replace(".", ",")}</Text>
              <Text style={styles.colEinheit}>{p.einheit || "—"}</Text>
              <Text style={styles.colPreis}>
                {formatMoneyDe(p.einzelpreis)}
              </Text>
              {showUst ? (
                <Text style={styles.colUst}>
                  {p.steuersatz ? `${p.steuersatz} %` : "—"}
                </Text>
              ) : null}
              <Text style={styles.colSumme}>
                {formatMoneyDe(showUst ? p.betrag_netto : p.betrag_brutto)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          {showUst ? (
            <>
              <View style={styles.totalRow}>
                <Text>Netto</Text>
                <Text>
                  {formatMoneyDe(angebot.betrag_netto, { currency: true })}
                </Text>
              </View>
              <View style={styles.totalRow}>
                <Text>USt</Text>
                <Text>
                  {formatMoneyDe(angebot.betrag_ust, { currency: true })}
                </Text>
              </View>
              <View
                style={[
                  styles.totalRow,
                  styles.totalBold,
                  { borderTopColor: accent },
                ]}
              >
                <Text>Brutto</Text>
                <Text>
                  {formatMoneyDe(angebot.betrag_brutto, { currency: true })}
                </Text>
              </View>
            </>
          ) : (
            <View
              style={[
                styles.totalRow,
                styles.totalBold,
                { borderTopColor: accent },
              ]}
            >
              <Text>Gesamt</Text>
              <Text>
                {formatMoneyDe(angebot.betrag_brutto, { currency: true })}
              </Text>
            </View>
          )}
        </View>

        {angebot.steuermodus === "kleinunternehmer" ? (
          <Text style={styles.hinweis}>{KLEINUNTERNEHMER_HINWEIS}</Text>
        ) : null}

        {angebot.notiz ? (
          <View style={styles.notiz}>
            <Text style={styles.label}>Hinweis</Text>
            <Text>{angebot.notiz}</Text>
          </View>
        ) : null}

        <DokumentFooter firma={firma} layout={layout} />
      </Page>
    </Document>
  );
}

/** Erzeugt PDF-Bytes für ein Angebot. */
export async function renderAngebotPdf(
  data: AngebotPdfData,
): Promise<Buffer> {
  const instance = pdf(<AngebotDocument {...data} />);
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
