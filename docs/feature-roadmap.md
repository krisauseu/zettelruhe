# Zettelruhe — Feature-Roadmap

Abgeleitet aus dem Grill-with-Docs (Scope: Solo-Selbstständige DE, self-hosted, EÜR).  
Glossary: [`CONTEXT.md`](../CONTEXT.md) · ADRs: [`docs/adr/`](./adr/)

---

## v1 — Erster brauchbarer Stand (Must)

*Happy Path ohne OCR, PSD2, API, Kundenportal, automatischen Mahnlauf.*

**Status (2026-08-18):** Meilenstein 1 ist **hartbar abgeschlossen**. Meilenstein 2 ist **abgeschlossen**. Funktionstest M2 (lokal + HTTPS) **bestanden**; M2-01 nachgetestet (`13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine. Setup-verified erledigt. Dokumenten-Layout (Angebot/Rechnung über light hinaus) erledigt. Marke (Logo/Favicon) erledigt. Ist-Versteuerung (Journal-Nachzug Zahlungen, ADR-0024) erledigt. **Multi-User / grobe Rechte (ADR-0025) erledigt.** **Eigenes Passwort ändern erledigt.** **UX/UI erster Keil und Rest erledigt** (Tokens/Shell/Listen; Sidebar mobil Off-Canvas; Detailköpfe). **Übersicht / Dashboard erster Keil und Follow-up erledigt** (Fälligkeiten, §-19-Wächter, Verlauf; Donut Kategorien, letzte Buchungen). **Hybrid-PDF:** Schnitt dokumentiert, **kein Bau** (ADR-0026). **Kassenbuch aus Barzahlung:** Schnitt dokumentiert, **kein Bau** (ADR-0027) — Zufluss bleibt an der Zahlung; kein automatischer Kassenbuch-Eintrag. **MT940:** klassisches SWIFT/STA, eigener Parser (ADR-0028); CSV bleibt Alltagsimport. Ausblick: Tool für jedermann (verschiedene Steuer-Modi, Firmagrößen, mehrere Nutzer:innen) — die Arbeitsfirma auf `app.zettelruhe.de` verengt das nicht. Als Nächstes: übrige Open Decision (robustes ZUGFeRD-Empfang-Parsing). Dokumenten-Layout-Vertiefung unter „Später“.

### Fundament & Stammdaten

- Mehrere Firmen in einer Instanz betreiben (anlegen + Session-Wechsel; Schema firma-gebunden)
- Mehrere Nutzer:innen je Firma über Mitgliedschaft; grobe Rollen Eigentümer:in / Bearbeiten / Lesen; Einladen im UI (ADR-0025)
- Unternehmensdaten, Logo
- Nummernkreise: Angebot, Rechnung, Gutschrift/Storno, optional Beleg, Kassenbuch-Belegnr.
- **Nummernvergabe erst bei Festschreiben/Senden** (Entwürfe ohne Nummernkreis-Verbrauch)
- Kontenrahmen wählbar: SKR03 / SKR04
- **Steuer-Modus (Firmeneinstellung, greift global):**
  - **Kleinunternehmerregelung (§ 19 UStG)** — kein USt-Ausweis, keine USt-Abführung; typischer Start u. a. für Kleingewerbe
  - **Regelbesteuerung** — nur **Ist-Versteuerung** (keine Soll-Versteuerung in v1)
- Folgen des Steuer-Modus in allen Abläufen: Angebots-/Rechnungs-PDF und E-Rechnung, Positionslogik (mit/ohne USt), Belegerfassung (Vorsteuer ja/nein), Dashboard, EÜR-Zuordnung, Ein-/Ausblenden der USt-Übersicht, Pflichttexte (§-19-Hinweis)
- Wechsel des Steuer-Modus nur bewusst (Einstellung); bestehende festgeschriebene Belege bleiben historisch korrekt
- Produkt- & Leistungskatalog (Preise; Steuersätze relevant nur unter Regelbesteuerung), CSV-Import
- Bankkonten als Stammdaten (mehrere möglich) neben dem Kassenbuch

### Kontakte, Projekte, Zeit & Fahrten

- Kontaktverwaltung: Kund:innen & Lieferant:innen
- Ansprechpartner, Adressen, Bankdaten (IBAN)
- CSV-Import/Export Kontakte
- **Projekt** optional je Kund:in (keine Budget-Pflicht)
- **Zeiteinträge** (Kunde Pflicht, Projekt optional; abrechenbar / nicht / abgerechnet)
- **Fahrten** (km; Default abrechenbar an Kund:in; alternativ/zusätzlich steuerlich)
- 1-Klick: offene Zeiten/Fahrten eines Kunden in Rechnungspositionen

### Angebote & Rechnungen

- Layout Angebot/Rechnung: DIN-ähnlicher Briefkopf, Logo, Akzentfarbe, Textbausteine, Sichtbarkeit Header/Fuß/Zahlblock; GiroCode auf der Rechnung bei IBAN. Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen → Später
- Dokumente folgen Steuer-Modus: **ohne USt + §-19-Hinweis** bzw. **mit USt-Ausweis** (Regelbesteuerung)
- Angebote: Positionen, Mengen, Preise, Rabatte, Freitext; PDF; Übersicht + CSV
- Angebotsstatus: Entwurf → Gesendet → Angenommen / Abgelehnt / Abgelaufen → Abgerechnet
- Rechnungen: aus Angebot, aus Zeiten/Fahrten, oder frei; PDF; Übersicht + CSV
- **Wiederkehrende Rechnungen** (Abo/Dauerrechnung)
- Rechnungsstatus: Entwurf → Offen → Teilbezahlt → Bezahlt → Überfällig → Storniert
- Gutschrift / Stornorechnung (rechtskonform; **keine** Abschlags-/Schlusskette)
- EU-Ausland / Drittland: Reverse-Charge-Hinweise (**primär Regelbesteuerung**; unter Kleinunternehmerregelung entsprechend vereinfacht/ausgeblendet wo unzulässig)
- GiroCode (EPC-QR) auf PDF
- SMTP-Versand für Angebote, Rechnungen, Zahlungserinnerungen
- Zahlungserinnerung manuell (kein 1.–3.-Mahnlauf, kein Status „Gemahnt“)
- Fälligkeit aus Zahlungsziel; Überfällig-Status

### Belege, Kasse, Bank

- Manuelle Belegerfassung (Datum, Lieferant, Kategorie aus gemeinsamer Stammliste, Beträge; USt/Vorsteuer nur unter Regelbesteuerung sinnvoll erfassbar)
- Datei-Upload am Beleg (PDF/Bild)
- Filterbare Belegübersicht + CSV
- **Kassenbuch**: Bareinnahmen/-ausgaben, fortlaufender Saldo, Belegnummern; manuell, nicht aus Rechnungs-Barzahlung (ADR-0027)
- **Buchungsjournal** unveränderbar (Belege + Kasse + Rechnungs-Festschreibung + Zahlungs-Zufluss)
- Zahlung manuell markieren (inkl. Teilzahlung); **Zufluss-Journal** (Ist-Versteuerung / EÜR, ADR-0024)
- Bank: CSV/MT940-Import je Bankkonto + Matching gegen offene Rechnungen/Belege (Match schreibt Zahlung inkl. Journal)

### E-Rechnung

- **Empfang**: XRechnung / ZUGFeRD parsen → Beleg vorbefüllen
- Revisionssicheres Ablegen der Originaldatei
- **Versand**: XRechnung-UBL / ZUGFeRD-CII als XML-Original aus festgeschriebener Rechnung; Validierung mit Fehlerliste; kein Hybrid-PDF/A-3 (ADR-0026: erst mit eigener PDF/A-3-Pipeline)

### Auswertungen & Export

- Dashboard light: Umsatz, offene Posten, Ausgaben-Trend (ohne USt-Zahllast-Widgets im Kleinunternehmer-Modus)
- EÜR nach amtlichen Kategorien (beide Steuer-Modi)
- USt-Übersicht (Monat/Quartal/Jahr) — **nur Regelbesteuerung**; UStVA-Kennzahlen + ELSTER-XML light (Self-File), kein ELSTER-Versand
- Zusammenfassende Meldung (ZM) Übersicht — **nur Regelbesteuerung**; Kandidaten aus 0-USt-Einnahmen + Kontakt-Land (Self-File), kein ELSTER-Versand
- BWA light / einfache Einnahmen-Ausgaben-Sicht je Zeitraum
- DATEV-Export (CSV/EXTF)
- Vollständiger CSV-Export relevanter Tabellen
- Belegarchiv-Export (ZIP) für Prüfung
- GoBD-Mindeststandard: Festschreibung, keine stille Änderung, Beleg↔Buchung, Verfahrensdoku-Vorlage

### Betrieb & Härten (BA14)

- Backup/Restore PocketBase-Volume (`docs/betrieb.md`)
- Security light: Secrets in `.env`, Session/CSRF-Hinweise, Header light
- Healthcheck `/health` + Compose-Healthchecks
- UX-Polish: leere States, Nav-Gruppen, Übersicht-Schnellstart

### Suche

- Volltextsuche light über Rechnungen, Belege, Kontakte, Angebote (BA14; kein eigener Suchindex)

---

## Meilenstein 2 — Steuer & Compliance vertiefen

**Einstieg (vereinbart 2026-08-15, nach M1-11):** nicht mit UStVA starten.

1. **Kategorien** — gemeinsame Auswahlliste für Belege und Kassenbuch, CRUD in den Stammdaten (vor M2-Steuerkeilen) ← erledigt
2. **Multi-Firma dünn** — Firma anlegen + wechseln, eine Eigentümer:in; kein Einladen, keine Rollen-UI (ADR-0018) ← erledigt
3. **UStVA-Zahlen / ELSTER-XML light** (Self-File-Vorbereitung) ← erledigt (ADR-0019)
4. Zusammenfassende Meldung (ZM) Übersicht ← erledigt (ADR-0020)
5. USt-IdNr.-Validierung (BZSt) ← erledigt (ADR-0021)
6. E-Rechnungs-Versand robust (Profile, Validierung, Fehlerfeedback) ← erledigt (ADR-0022); Browser kf 2026-08-15 ohne Fehler
7. Funktionstest M2 ← **bestanden** ([`funktionstest-m2.md`](./funktionstest-m2.md), [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md)); HTTPS ADR-0023 in Betrieb. **M2-01** nachgetestet (`13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine.

**Meilenstein 2 abgeschlossen.**

Erledigt und nicht vermischen: Kategorien, Multi-Firma dünn, UStVA/ZM light, USt-IdNr., E-Rechnungs-Versand, Dokumenten-Layout (Angebot/Rechnung über light hinaus), Marke (Logo/Favicon), Ist-Versteuerung (Journal-Nachzug Zahlungen), Multi-User / grobe Rechte, eigenes Passwort.

---

## Nach Meilenstein 2

Nicht durch den aktuellen Server-Stand verengen. Produktziel: Tool für jedermann — verschiedene Steuer-Modi, verschiedene Firmagrößen, mehrere Nutzer:innen. Die Arbeitsfirma auf `app.zettelruhe.de` ist Betrieb, nicht Scope-Deckel.

1. **Eigenes Passwort ändern** ← erledigt. `/app/passwort`; jede angemeldete Nutzer:in ändert nur das eigene (alt + neu + Bestätigung, 8 Zeichen). Fremdes Passwort unter `/app/nutzer` unverändert. Next-Session bleibt gültig.
2. **UX/UI (App-Layout / CSS-Modernisierung)** — erster Keil erledigt (Tokens, Tinte-Sidebar, Primitives, PageHeader, Übersicht, Login). Rest erledigt: Sidebar mobil Off-Canvas, PageHeader auf Firma / Nutzer:innen / Passwort (nur Optik) / Dokument-Details. Nicht Marke, nicht das erledigte Dokumenten-Layout Angebot/Rechnung, nicht M1-12 zurückbauen. Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen, CSS-Profi-Layouts der Dokumente bleiben unter „Später“.
3. **Multi-User / grobe Rechte** ← erledigt (ADR-0025); Server-Nachtest inkl. SMTP durch kf ohne Fehler. Eigenes Passwort (Punkt 1) nachgezogen.
4. **Übersicht / Dashboard** — erster Keil erledigt: Fälligkeiten, §-19-Jahresbalken (nur Kleinunternehmerregelung, Grenzen aus geltendem § 19 Abs. 1), Verlauf 6/Jahr/12. Follow-up erledigt: Ausgaben nach Kategorien (Donut, Monat/Quartal), letzte Buchungen aus dem Journal.

Daneben separat: **Kassenbuch aus Barzahlung** ← erledigt als Schnitt, kein Bau (ADR-0027). **MT940** ← erledigt (ADR-0028, klassisches SWIFT/STA). Übrige Open Decision: ZUGFeRD-PDF-Parsing. Hybrid-PDF Schnitt erledigt, Bau zurückgestellt (ADR-0026). Ist-Versteuerung (Journal-Nachzug) ist erledigt (ADR-0024).

---

## Später — Komfort & Skalierung

- OCR / KI-Belegerkennung
- REST-API (Shop-Anbindung etc.)
- Live-Bank PSD2
- Automatischer Mahnlauf (1.–3., Gebühren, Zinsen)
- Abschlags- & Schlussrechnungskette
- Lieferscheine
- Kundenportal (Angebot annehmen, Rechnung laden, Pay-Link)
- PayPal/Stripe-Zahllinks
- Dokumenten-Layout nochmal ansehen (Schnitt 2026-08-16 bewusst schlank): Briefpapier-Hintergrund (PNG sowie PDF-Stempel Seite 1 / Folgeseiten), Schrift-Upload und mitgelieferte Hausschrift, Inhaber:in an der Firma, Kunden-Nr. am Kontakt, Ansprechpartner „z. Hd.“ auf dem PDF, AGB als weitere Seiten, Live-Vorschau/Studio in den Einstellungen, Mehrvorlagen, CSS-Profi-Layouts
- SEPA-Mandate
- Verpflegungspauschalen / erweiterte Reisekosten
- Anlagenverzeichnis, GWG, AfA
- Projekt-Budgets / Stundendeckel
- Steuerberater-Lesezugriff / DATEV-Services-Push
- Mobile-optimierte Erfassung (PWA o. Ä.)

---

## Bewusst nicht (vorerst)

- Feature-Parität zu Papierkram
- Bilanz / vollständige doppelte Buchführung als Produktversprechen
- Soll-Versteuerung
- DACH/EU-Steuerprofile von Tag 1
- Mitarbeiter-HR / Lohn
- Kanzlei-Mandantenverwaltung
- GoBD-Zertifikat als Kaufargument v1
- Managed SaaS als Pflicht (Self-hosted first; Cloud optional später)
- „Kleingewerbe“ als eigener Gewerberecht-Workflow (Handelsregister o. Ä.) — steuermäßig zählt der **Steuer-Modus** (§ 19 vs. Regelbesteuerung), nicht der Gewerbestatus-Label

---

## Abgelöste Phasen-Skizze

Die frühere Datei `Umsetzungsentwurf Papierkram.de v1.md` bleibt als Rohidee; **verbindlich für Scope ist diese Roadmap** plus `CONTEXT.md`.
