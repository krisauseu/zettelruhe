# Zettelruhe

Open-Source-Webanwendung unter [zettelruhe.de](https://zettelruhe.de) für die Buchhaltung und Abrechnung von Solo-Selbstständigen in Deutschland — self-hosted, EÜR-orientiert, Papierkram-Alternative mit bewusstem 80%-Fokus.

## Language

### Akteure & Organisation

**Firma**:
Die rechtliche Wirtschaftseinheit, deren Bücher und Belege geführt werden. Das Datenmodell ist firma-gebunden. Eine Eigentümer:in kann mehrere Firmen anlegen und in der Session wechseln. In den Firmeneinstellungen ist der Steuer-Modus zentral (u. a. umsatzsteuerfrei über Kleinunternehmerregelung — typisch auch für Kleingewerbe am Anfang).
_Avoid_: Account, Tenant, Workspace (im Fachvokabular)

**Steuer-Modus**:
Firmeneinstellung, die alle Belege, Rechnungen, Auswertungen und Pflichttexte steuert. v1 kennt zwei Ausprägungen: **Kleinunternehmerregelung** (§ 19 UStG) und **Regelbesteuerung** (nur Ist-Versteuerung).
_Avoid_: Steuertyp (unscharf), VAT mode (im UI)

**Kleinunternehmerregelung**:
Steuer-Modus ohne Ausweis und Abführung von Umsatzsteuer: Rechnungen ohne USt-Zeilen, mit gesetzlichem Hinweis; USt-Übersicht und Vorsteuerlogik entfallen bzw. sind nicht relevant. Häufiger Startpfad inkl. Kleingewerbe — im System ist der steuermäßige Schalter die Kleinunternehmerregelung, nicht der Gewerbestatus „Kleingewerbe“ selbst.
_Avoid_: Keine USt (als alleiniger Label-Text ohne §-19-Bezug), umsatzsteuerbefreit (als Rechtsbegriff ohne § 19)

**Regelbesteuerung**:
Steuer-Modus mit Umsatzsteuer auf Ausgangsrechnungen und Vorsteuer auf Belegen; in v1 ausschließlich **Ist-Versteuerung** (keine Soll-Versteuerung).
_Avoid_: Normalbesteuerung (wenn Regelbesteuerung gemeint ist)

**Eigentümer:in**:
Die eine Person, die die self-hosted Instanz verwaltet und alle Rechte an der aktiven Firma hat. Weitere Nutzer:innen/Rollen sind im Modell vorgesehen, in v1 nicht im UI.
_Avoid_: Admin (allein als Domänenbegriff), Teammitglied

**Solo-Selbstständige:r**:
Die primäre Nutzer:in — eine Person ohne Mitarbeiter:innen und ohne Steuerberater-Rolle im System. Die Software löst deren eigenen Arbeitsalltag, nicht den einer Kanzlei.
_Avoid_: Team, Multi-User-Organisation, Kanzlei-Mandant

**Kontakt**:
Eine Person oder Organisation, mit der die Firma geschäftlich zu tun hat. Oberbegriff für Kund:innen und Lieferant:innen.
_Avoid_: Account, Partner (alleinstehend)

**Kund:in**:
Ein Kontakt, an den Angebote und Rechnungen gehen und dem Zeiten, Fahrten und Projekte zugeordnet werden.
_Avoid_: Client, Buyer

**Lieferant:in**:
Ein Kontakt, von dem Ausgabenbelege stammen.
_Avoid_: Vendor, Creditor (im UI)

### Arbeit & Abrechnung

**Projekt**:
Eine optionale Arbeitseinheit unter einer:m Kund:in. Zeiten und Fahrten hängen primär an der:m Kund:in; ein Projekt bündelt sie nur, wenn gewünscht.
_Avoid_: Job, Auftrag (solange nicht als eigener Status/Workflow definiert)

**Zeiteintrag**:
Erfasste Arbeitszeit mit Pflichtbezug zu Kund:in und optionalem Projekt; Status abrechenbar, nicht abrechenbar oder abgerechnet.
_Avoid_: Timesheet (als Entität), Timer-only

**Fahrt**:
Erfasste dienstliche Kilometer mit Pflichtbezug zu Kund:in und optionalem Projekt. Dient der Weiterberechnung an Kund:innen und/oder der steuerlichen Reisekosten; Standard ist abrechenbar.
_Avoid_: Trip, Mileage (im UI)

### Dokumente & Zahlungen

**Angebot**:
Noch nicht verbindliches Verkaufsdokument an eine:n Kund:in. Status: Entwurf, Gesendet, Angenommen, Abgelehnt, Abgelaufen, Abgerechnet.
_Avoid_: Quote (im UI)

**Rechnung**:
Zahlungsaufforderung an eine:n Kund:in; aus Angebot, Zeiten/Fahrten, wiederkehrendem Rhythmus oder frei. Status: Entwurf, Offen, Teilbezahlt, Bezahlt, Überfällig, Storniert. Die endgültige Rechnungsnummer wird erst bei Festschreiben/Senden vergeben (Entwürfe verbrauchen keinen Nummernkreis). Darstellung und Pflichtangaben folgen dem Steuer-Modus der Firma (mit/ohne USt).
_Avoid_: Bill, Invoice (im UI)

**Wiederkehrende Rechnung**:
Vorlage bzw. Rhythmus, aus dem periodisch Rechnungen erzeugt werden (Abo/Dauerrechnung) — Bestandteil von v1.
_Avoid_: Subscription (im UI)

**Gutschrift / Stornorechnung**:
Korrekturdokument zu einer Rechnung; in v1 der Weg für Korrekturen statt stiller Änderung. Keine Abschlags-/Schlussrechnungskette in v1.
_Avoid_: Credit note (im UI), Abschlagsrechnung (als v1-Feature)

**Zahlungserinnerung**:
Manuell erzeugtes Mahn-Dokument bei überfälliger Rechnung; kein automatischer 1.–3.-Mahnlauf und kein Status „Gemahnt“ in v1.
_Avoid_: Mahnlauf (als v1-Automatik)

**E-Rechnung**:
Strukturierte elektronische Rechnung nach EN 16931 (XRechnung und/oder ZUGFeRD). Empfang archiviert das Original unverändert. Versand erzeugt XML-Originale (XRechnung-UBL / ZUGFeRD-CII) aus der festgeschriebenen Rechnung — kein Hybrid-PDF/A-3, kein Zertifizierungs-Claim.
_Avoid_: PDF-Rechnung (als Synonym — PDF allein ist keine E-Rechnung)

**Beleg**:
Nachweis einer Ausgabe oder Einnahme (Datei + Metadaten), der ins Buchungsjournal eingeht.
_Avoid_: Receipt (im UI), Dokument (allein zu unscharf)

**Kategorie**:
Firma-gebundene Auswahlliste für Belege und Kassenbuch (`/app/kategorien`). Am Beleg und am Kassenbuch-Eintrag bleibt `kategorie` ein Text-Schnappschuss; Umbenennen ändert nicht die Historie.
_Avoid_: Tag, Label (im UI)

**Zahlung**:
Ausgleich einer offenen Rechnung; manuell markierbar (inkl. Teilzahlung) oder per Kontoauszugs-Import (CSV/MT940) gematcht.
_Avoid_: Transaction (allein)

**Nummernkreis**:
Konfigurierbare, fortlaufende Nummerierung je Dokumentart (Angebot, Rechnung, Gutschrift/Storno, optional Beleg, Kassenbuch-Belegnummer).

### Buchhaltung & Compliance

**EÜR**:
Einnahmen-Überschuss-Rechnung als primäres Auswertungsziel — nicht Bilanz/GuV-Vollbuchhaltung.
_Avoid_: Doppelte Buchführung (als Nutzerversprechen v1), Bilanzbuchhaltung

**Buchungsjournal**:
Unveränderbare, fortlaufende Aufzeichnung der Buchungen aus Belegen, Rechnungen und Kasse; Grundlage unter der belegorientierten UX.
_Avoid_: Ledger (im UI), Hauptbuch (als v1-Versprechen)

**Kassenbuch**:
Eigenständiges, fortlaufendes Verzeichnis von Bareinnahmen und -ausgaben mit Saldo; fließt ins Buchungsjournal; GoBD-tauglich fortgeschrieben.
_Avoid_: Cash register, Kasse (allein, wenn das Buch gemeint ist)

**Festschreibung**:
Zeitpunkt, ab dem eine Buchung oder ein Beleg nicht mehr still geändert werden darf; Korrekturen nur über Storno/Gegenbuchung.
_Avoid_: Soft delete, überschreiben

**USt-Übersicht**:
Zusammenstellung der Umsatzsteuer-Zahllast je Zeitraum zur Vorbereitung der eigenen UStVA. Nur im Steuer-Modus Regelbesteuerung relevant; unter Kleinunternehmerregelung entfällt sie als Arbeitsflow. Unter Regelbesteuerung: typische UStVA-Kennzahlen zum Selbst-Eintragen in Mein Elster plus optionaler XML-Download (light, lokal) — kein ELSTER-Versand, keine Abgabe aus der App.
_Avoid_: UStVA-Abgabe (als Versprechen), ELSTER-Versand

**Zusammenfassende Meldung (ZM)**:
Übersicht zur Vorbereitung der Zusammenfassenden Meldung in Mein Elster (innergemeinschaftliche Lieferungen/sonstige Leistungen). Nur Regelbesteuerung; Zahlen aus dem Buchungsjournal der aktiven Firma plus aktuellem Land am Kontakt. 0-USt-Einnahmen an Kontakte im übrigen EU-Gebiet erscheinen als Kandidaten — Art (Lieferung/Leistung/Dreieck) wird nicht geraten. Die USt-IdNr. kommt aus dem Kontakt-Stamm (Notiz nur Fallback); ein BZSt-Schnappschuss gilt nur für den Anfragezeitpunkt, nicht für den Umsatz. Unter Kleinunternehmerregelung typisch nicht relevant. Kein ELSTER-Versand, keine Abgabe aus der App.
_Avoid_: ZM-Abgabe (als Versprechen), ELSTER-Versand, ig. Lieferung (als festgestellte Buchungsart)

**USt-IdNr.**:
Umsatzsteuer-Identifikationsnummer. Die eigene steht an der Firma, die fremde am Kontakt. Optional in beiden Steuer-Modi — unter der Kleinunternehmerregelung kann sie vorkommen, macht USt- und ZM-Übersicht nicht relevant.
_Avoid_: VAT ID (im UI), UID (allein, außer als Import-Alias)

**BZSt-Bestätigung**:
Punktuelle Abfrage des BZSt-Auslandsverfahrens (eVatR REST) zur fremden EU-USt-IdNr. gegenüber der eigenen DE-Nummer. Ergebnis ist ein Schnappschuss zum Anfragezeitpunkt (einfach oder qualifiziert), kein Dauer-„gültig“-Stempel und keine Abgabe. DE→DE und eine isolierte Bestätigung der eigenen DE-Nummer gibt das Verfahren nicht her.
_Avoid_: USt-Id gültig (als Stammdaten-Flag), VIES (als Produktname), ELSTER-Versand

**Bankkonto**:
Zahlweg der Firma für unbare Zahlungseingänge/-ausgänge; Stammdaten für CSV/MT940-Import. Das Modell erlaubt mehrere Bankkonten; Kassenbuch bleibt davon getrennt.
_Avoid_: Konto (allein — kollidiert mit SKR-Konto)

**DATEV-Export**:
Übergabe der Buchungsdaten an die Steuerkanzlei im DATEV-Format; v1-Steuerziel statt direkter ELSTER-Integration.
_Avoid_: ELSTER (als v1-Kernfeature)

## Scope-Grenzen (bewusst)

- **Produkt**: Zettelruhe / zettelruhe.de
- **v1-Betrieb**: Self-hosted; eine Eigentümer:in; mehrere Firmen in einer Instanz (Session wechselt die aktive Firma); Schema firma-gebunden
- **Markt**: Deutschland (UStG, EÜR, DATEV, XRechnung/ZUGFeRD, GoBD-Mindeststandard ohne externe Zertifizierung)
- **Steuer v1**: Kleinunternehmerregelung (§ 19, kein USt-Ausweis/Abführen) **oder** Regelbesteuerung nur Ist-Versteuerung; Wechsel muss in Einstellungen und allen Dokument-/Auswertungsflüssen greifen
- **v1-Happy-Path**: Stammdaten inkl. Steuer-Modus → Kontakte/optionale Projekte → Zeiten/Fahrten → Angebot/Rechnung (inkl. wiederkehrend, Nummern erst bei Senden) → Belege + Kassenbuch (Kategorie aus Stammliste) + Bankkonten → Zahlung (manuell/CSV) → E-Rechnung-Empfang → EÜR (+ USt-Übersicht und ZM-Übersicht nur bei Regelbesteuerung) → DATEV + Journal + Belegarchiv-Export
- **Meilenstein 2**: Kategorien, Multi-Firma dünn, UStVA/ELSTER-XML light, ZM-Übersicht, USt-IdNr.-Prüfung und E-Rechnungs-Versand. Checkliste: `docs/funktionstest-m2.md`. HTTPS: Host-Caddy, `app.zettelruhe.de` (ADR-0023). Funktionstest M2 (lokal + Server) **bestanden**; M2-01 nachgetestet. Freigabe **M2 Alltag trägt**. Blocker keine. Zahlung erzeugt in v1 kein Journal.
- **Nicht v1**: Soll-Versteuerung, Abschlagskette, automatischer Mahnlauf, PSD2, OCR-Pflicht, REST-API-Pflicht, Kundenportal, Lieferschein, CSS-Profi-Layouts, SEPA-Mandate, PayPal/Stripe-Links, Verpflegungspauschalen, Anlagen/AfA-Vollmodul, Steuerberater-Portal, Bilanz, DACH
