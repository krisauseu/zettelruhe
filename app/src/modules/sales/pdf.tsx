/**
 * Rechnungs- und Angebots-PDF mit @react-pdf/renderer (ADR-0014).
 * DIN-ähnlicher Briefkopf, Akzent-Tabelle, Bankzeile; GiroCode nur auf Rechnungen.
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
import { buildGirocodePayload } from "./girocode";
import { renderGirocodeDataUri } from "./girocode-qr";
import { KLEINUNTERNEHMER_HINWEIS, einheitlicherSteuersatz } from "./invariants";
import {
  DEFAULT_DOKUMENT_AKZENTFARBE,
  PDF_WASSERZEICHEN_ENTWURF,
  defaultDokumentPdfLayout,
  dokumentTitel,
  firmaAbsenderzeile,
  footerBankzeile,
  formatLeistungszeitraum,
  formatPdfDateDe,
  kontrastTextAuf,
  zahlungshinweisRechnung,
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
    paddingTop: 44,
    paddingHorizontal: 48,
    paddingBottom: 86,
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
    alignItems: "flex-start",
    marginBottom: 22,
  },
  empfaengerCol: {
    width: "58%",
    paddingRight: 16,
  },
  firmaCol: {
    width: "40%",
    alignItems: "flex-end",
  },
  absenderzeile: {
    fontSize: 7.5,
    color: "#555",
    marginBottom: 3,
  },
  absenderlinie: {
    borderBottomWidth: 1,
    marginBottom: 8,
    width: "92%",
  },
  logo: {
    width: 110,
    height: 40,
    objectFit: "contain",
    marginBottom: 6,
  },
  firmaName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    textAlign: "right",
  },
  firmaZeile: {
    fontSize: 8.5,
    color: "#444",
    lineHeight: 1.35,
    textAlign: "right",
  },
  empfaengerName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  empfaengerZeile: {
    fontSize: 10,
    lineHeight: 1.35,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
    gap: 8,
  },
  metaItem: {
    marginRight: 18,
    fontSize: 9,
    color: "#333",
  },
  metaLabel: {
    color: "#555",
  },
  kopftext: {
    marginBottom: 14,
    fontSize: 9.5,
    color: "#222",
    lineHeight: 1.45,
  },
  table: {
    marginTop: 4,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 9,
    alignItems: "flex-start",
  },
  totals: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  totalBold: {
    fontFamily: "Helvetica-Bold",
    marginTop: 4,
    borderTopWidth: 1.5,
    paddingTop: 5,
    fontSize: 10,
  },
  zahlblock: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    gap: 14,
  },
  girocode: {
    width: 78,
    height: 78,
  },
  zahltext: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.45,
    color: "#222",
  },
  hinweis: {
    marginTop: 16,
    fontSize: 8.5,
    color: "#333",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  notiz: {
    marginTop: 14,
    fontSize: 9,
    lineHeight: 1.4,
  },
  notizLabel: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 48,
    right: 48,
    fontSize: 7.5,
    color: "#555",
    borderTopWidth: 0.6,
    borderTopColor: "#ccc",
    paddingTop: 6,
  },
  footerBlock: {
    marginBottom: 2,
    lineHeight: 1.35,
  },
});

type PdfPosition = {
  id?: string;
  sortierung: number;
  bezeichnung: string;
  menge: string;
  einheit: string;
  einzelpreis: string;
  steuersatz: string;
  betrag_netto: string;
  betrag_brutto: string;
};

function resolveLayout(layout?: DokumentPdfLayout): DokumentPdfLayout {
  return layout ?? defaultDokumentPdfLayout();
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

function colWidths(showUst: boolean) {
  return showUst
    ? {
        pos: "7%",
        bez: "35%",
        menge: "14%",
        preis: "16%",
        ust: "10%",
        summe: "18%",
      }
    : {
        pos: "8%",
        bez: "42%",
        menge: "16%",
        preis: "17%",
        ust: "0%",
        summe: "17%",
      };
}

function FirmaBlock({
  firma,
  layout,
  accent,
}: {
  firma: FirmaRecord;
  layout: DokumentPdfLayout;
  accent: string;
}) {
  if (!layout.headerDrucken) return null;
  const extra = [
    firma.steuernummer ? `Steuernr.: ${firma.steuernummer}` : "",
    firma.ust_id ? `USt-IdNr.: ${firma.ust_id}` : "",
  ].filter(Boolean);
  return (
    <View style={styles.firmaCol}>
      {layout.logoDataUri ? (
        <Image src={layout.logoDataUri} style={styles.logo} />
      ) : null}
      <Text style={[styles.firmaName, { color: accent }]}>{firma.name}</Text>
      {firma.strasse ? (
        <Text style={styles.firmaZeile}>{firma.strasse}</Text>
      ) : null}
      {firma.plz || firma.ort ? (
        <Text style={styles.firmaZeile}>
          {[firma.plz, firma.ort].filter(Boolean).join(" ")}
        </Text>
      ) : null}
      {extra.map((l) => (
        <Text key={l} style={styles.firmaZeile}>
          {l}
        </Text>
      ))}
    </View>
  );
}

function EmpfaengerBlock({
  firma,
  kunde,
  layout,
  accent,
}: {
  firma: FirmaRecord;
  kunde: Kontakt;
  layout: DokumentPdfLayout;
  accent: string;
}) {
  const kundeLines = addressLines({
    name: kunde.name,
    strasse: kunde.strasse,
    plz: kunde.plz,
    ort: kunde.ort,
    land: kunde.land,
  });
  const absender = firmaAbsenderzeile({
    name: firma.name,
    strasse: firma.strasse,
    plz: firma.plz,
    ort: firma.ort,
  });
  return (
    <View style={styles.empfaengerCol}>
      {layout.headerDrucken && absender ? (
        <>
          <Text style={styles.absenderzeile}>{absender}</Text>
          <View style={[styles.absenderlinie, { borderBottomColor: accent }]} />
        </>
      ) : null}
      {kundeLines.map((l, i) => (
        <Text
          key={`${i}-${l}`}
          style={i === 0 ? styles.empfaengerName : styles.empfaengerZeile}
        >
          {l}
        </Text>
      ))}
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
  if (!layout.fussDrucken) return null;
  const bank = footerBankzeile(layout.bank);
  const stammdaten = [
    firma.name,
    firma.steuernummer ? `St.-Nr. ${firma.steuernummer}` : "",
    firma.ust_id ? `USt-IdNr. ${firma.ust_id}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  if (!layout.fusstext && !bank && !stammdaten) return null;
  return (
    <View style={styles.footer} fixed>
      {layout.fusstext ? (
        <Text style={styles.footerBlock}>{layout.fusstext}</Text>
      ) : null}
      {bank ? <Text style={styles.footerBlock}>{bank}</Text> : null}
      {stammdaten ? <Text>{stammdaten}</Text> : null}
    </View>
  );
}

function Positionstabelle({
  positionen,
  showUst,
  accent,
}: {
  positionen: PdfPosition[];
  showUst: boolean;
  accent: string;
}) {
  const w = colWidths(showUst);
  const headColor = kontrastTextAuf(accent);
  const sorted = [...positionen].sort((a, b) => a.sortierung - b.sortierung);
  return (
    <View style={styles.table}>
      <View
        style={[
          styles.tableHeader,
          { backgroundColor: accent, color: headColor },
        ]}
      >
        <Text style={{ width: w.pos }}>Pos</Text>
        <Text style={{ width: w.bez }}>Beschreibung</Text>
        <Text style={{ width: w.menge, textAlign: "right" }}>Menge</Text>
        <Text style={{ width: w.preis, textAlign: "right" }}>
          {showUst ? "Einzelpreis (Netto)" : "Einzelpreis"}
        </Text>
        {showUst ? (
          <Text style={{ width: w.ust, textAlign: "right" }}>MwSt.</Text>
        ) : null}
        <Text style={{ width: w.summe, textAlign: "right" }}>
          {showUst ? "Gesamt (Netto)" : "Gesamt"}
        </Text>
      </View>
      {sorted.map((p, i) => {
        const menge = [p.menge.replace(".", ","), p.einheit]
          .filter((x) => x && x !== "—")
          .join(" ");
        return (
          <View
            key={p.id || `${p.sortierung}-${p.bezeichnung}`}
            wrap={false}
            style={[
              styles.tableRow,
              i % 2 === 0 ? { backgroundColor: "#F4F4F5" } : {},
            ]}
          >
            <Text style={{ width: w.pos }}>{String(i + 1)}</Text>
            <Text style={{ width: w.bez }}>{p.bezeichnung}</Text>
            <Text style={{ width: w.menge, textAlign: "right" }}>
              {menge || "—"}
            </Text>
            <Text style={{ width: w.preis, textAlign: "right" }}>
              {formatMoneyDe(p.einzelpreis, { currency: true })}
            </Text>
            {showUst ? (
              <Text style={{ width: w.ust, textAlign: "right" }}>
                {p.steuersatz ? `${p.steuersatz} %` : "—"}
              </Text>
            ) : null}
            <Text style={{ width: w.summe, textAlign: "right" }}>
              {formatMoneyDe(showUst ? p.betrag_netto : p.betrag_brutto, {
                currency: true,
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Summenblock({
  showUst,
  steuersatzLabel,
  betragNetto,
  betragUst,
  betragBrutto,
  accent,
}: {
  showUst: boolean;
  steuersatzLabel: string;
  betragNetto: string;
  betragUst: string;
  betragBrutto: string;
  accent: string;
}) {
  if (!showUst) {
    return (
      <View style={styles.totals} wrap={false}>
        <View
          style={[
            styles.totalRow,
            styles.totalBold,
            { borderTopColor: accent, color: accent },
          ]}
        >
          <Text>Gesamt</Text>
          <Text>{formatMoneyDe(betragBrutto, { currency: true })}</Text>
        </View>
      </View>
    );
  }
  const ustLabel = steuersatzLabel ? `USt. (${steuersatzLabel} %)` : "USt.";
  return (
    <View style={styles.totals} wrap={false}>
      <View style={styles.totalRow}>
        <Text>Gesamt Netto</Text>
        <Text>{formatMoneyDe(betragNetto, { currency: true })}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text>{ustLabel}</Text>
        <Text>{formatMoneyDe(betragUst, { currency: true })}</Text>
      </View>
      <View
        style={[
          styles.totalRow,
          styles.totalBold,
          { borderTopColor: accent, color: accent },
        ]}
      >
        <Text>Gesamt Brutto</Text>
        <Text>{formatMoneyDe(betragBrutto, { currency: true })}</Text>
      </View>
    </View>
  );
}

type MetaItem = { label: string; value: string };

function DokumentSeite({
  firma,
  kunde,
  layout,
  entwurf,
  titel,
  meta,
  positionen,
  showUst,
  steuersatzLabel,
  betragNetto,
  betragUst,
  betragBrutto,
  kleinunternehmer,
  notiz,
  zahlungstext,
  girocodeDataUri,
}: {
  firma: FirmaRecord;
  kunde: Kontakt;
  layout: DokumentPdfLayout;
  entwurf: boolean;
  titel: string;
  meta: MetaItem[];
  positionen: PdfPosition[];
  showUst: boolean;
  steuersatzLabel: string;
  betragNetto: string;
  betragUst: string;
  betragBrutto: string;
  kleinunternehmer: boolean;
  notiz?: string;
  zahlungstext?: string;
  girocodeDataUri?: string;
}) {
  const accent = layout.akzentfarbe || DEFAULT_DOKUMENT_AKZENTFARBE;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {entwurf ? (
          <Text style={styles.watermark}>{PDF_WASSERZEICHEN_ENTWURF}</Text>
        ) : null}

        <View style={styles.headerRow}>
          <EmpfaengerBlock
            firma={firma}
            kunde={kunde}
            layout={layout}
            accent={accent}
          />
          <FirmaBlock firma={firma} layout={layout} accent={accent} />
        </View>

        <Text style={[styles.title, { color: accent }]}>{titel}</Text>

        {meta.length > 0 ? (
          <View style={styles.metaRow}>
            {meta.map((m) => (
              <Text key={m.label} style={styles.metaItem}>
                <Text style={styles.metaLabel}>{m.label}: </Text>
                {m.value}
              </Text>
            ))}
          </View>
        ) : null}

        {layout.kopftext ? (
          <Text style={styles.kopftext}>{layout.kopftext}</Text>
        ) : null}

        <Positionstabelle
          positionen={positionen}
          showUst={showUst}
          accent={accent}
        />

        <Summenblock
          showUst={showUst}
          steuersatzLabel={steuersatzLabel}
          betragNetto={betragNetto}
          betragUst={betragUst}
          betragBrutto={betragBrutto}
          accent={accent}
        />

        {zahlungstext ? (
          <View style={styles.zahlblock} wrap={false}>
            {girocodeDataUri ? (
              <Image src={girocodeDataUri} style={styles.girocode} />
            ) : null}
            <Text style={styles.zahltext}>{zahlungstext}</Text>
          </View>
        ) : null}

        {kleinunternehmer ? (
          <Text style={styles.hinweis}>{KLEINUNTERNEHMER_HINWEIS}</Text>
        ) : null}

        {notiz ? (
          <View style={styles.notiz}>
            <Text style={styles.notizLabel}>Hinweis</Text>
            <Text>{notiz}</Text>
          </View>
        ) : null}

        <DokumentFooter firma={firma} layout={layout} />
      </Page>
    </Document>
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

function rechnungMeta(rechnung: Rechnung): MetaItem[] {
  const items: MetaItem[] = [];
  const datum = formatPdfDateDe(rechnung.rechnungsdatum);
  if (datum) items.push({ label: "Datum", value: datum });
  const faellig = formatPdfDateDe(rechnung.faellig_am);
  if (faellig) items.push({ label: "Zahlbar bis", value: faellig });
  const leistung = formatLeistungszeitraum(
    rechnung.leistungszeitraum_von,
    rechnung.leistungszeitraum_bis,
  );
  if (leistung) {
    const von = formatPdfDateDe(rechnung.leistungszeitraum_von);
    const bis = formatPdfDateDe(rechnung.leistungszeitraum_bis);
    const label =
      von && bis && von !== bis ? "Leistungszeitraum" : "Leistungsdatum";
    items.push({ label, value: leistung });
  }
  return items;
}

export async function renderRechnungPdf(
  data: RechnungPdfData,
): Promise<Buffer> {
  const layout = resolveLayout(data.layout);
  const entwurf = Boolean(data.entwurf);
  const nummer = data.rechnungsnummer || data.rechnung.rechnungsnummer;
  const showUst = data.rechnung.steuermodus === "regelbesteuerung_ist";
  const satz = einheitlicherSteuersatz(
    data.positionen,
    data.rechnung.steuermodus,
  );

  let girocodeDataUri: string | undefined;
  let zahlungstext: string | undefined;
  if (layout.zahlblock) {
    zahlungstext = zahlungshinweisRechnung({
      betrag: data.rechnung.betrag_brutto,
      faelligAm: data.rechnung.faellig_am,
      entwurf,
      hatBank: Boolean(layout.bank?.iban),
    });
    if (layout.bank?.iban) {
      const payload = buildGirocodePayload({
        empfaenger: data.firma.name,
        iban: layout.bank.iban,
        bic: layout.bank.bic,
        betrag: data.rechnung.betrag_brutto,
        verwendungszweck: entwurf
          ? "Rechnung (Entwurf)"
          : (nummer || "").trim() || "Rechnung",
      });
      if (payload) {
        girocodeDataUri = await renderGirocodeDataUri(payload);
      }
    }
  }

  const instance = pdf(
    <DokumentSeite
      firma={data.firma}
      kunde={data.kunde}
      layout={layout}
      entwurf={entwurf}
      titel={dokumentTitel({ art: "rechnung", entwurf, nummer })}
      meta={rechnungMeta(data.rechnung)}
      positionen={data.positionen}
      showUst={showUst}
      steuersatzLabel={satz}
      betragNetto={data.rechnung.betrag_netto}
      betragUst={data.rechnung.betrag_ust}
      betragBrutto={data.rechnung.betrag_brutto}
      kleinunternehmer={data.rechnung.steuermodus === "kleinunternehmer"}
      notiz={data.rechnung.notiz}
      zahlungstext={zahlungstext}
      girocodeDataUri={girocodeDataUri}
    />,
  );
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

function angebotMeta(angebot: Angebot): MetaItem[] {
  const items: MetaItem[] = [];
  const datum = formatPdfDateDe(angebot.angebotsdatum);
  if (datum) items.push({ label: "Datum", value: datum });
  const bis = formatPdfDateDe(angebot.gueltig_bis);
  if (bis) items.push({ label: "Gültig bis", value: bis });
  return items;
}

export async function renderAngebotPdf(data: AngebotPdfData): Promise<Buffer> {
  const layout = resolveLayout(data.layout);
  const entwurf = Boolean(data.entwurf);
  const nummer = data.angebotsnummer || data.angebot.angebotsnummer;
  const showUst = data.angebot.steuermodus === "regelbesteuerung_ist";
  const satz = einheitlicherSteuersatz(
    data.positionen,
    data.angebot.steuermodus,
  );

  const instance = pdf(
    <DokumentSeite
      firma={data.firma}
      kunde={data.kunde}
      layout={layout}
      entwurf={entwurf}
      titel={dokumentTitel({ art: "angebot", entwurf, nummer })}
      meta={angebotMeta(data.angebot)}
      positionen={data.positionen}
      showUst={showUst}
      steuersatzLabel={satz}
      betragNetto={data.angebot.betrag_netto}
      betragUst={data.angebot.betrag_ust}
      betragBrutto={data.angebot.betrag_brutto}
      kleinunternehmer={data.angebot.steuermodus === "kleinunternehmer"}
      notiz={data.angebot.notiz}
    />,
  );
  const blob = await instance.toBlob();
  const ab = await blob.arrayBuffer();
  return Buffer.from(ab);
}
