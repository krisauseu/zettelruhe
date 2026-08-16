# Zettelruhe — Feature-Roadmap

Abgeleitet aus dem Grill-with-Docs (Scope: Solo-Selbstständige DE, self-hosted, EÜR).  
Glossary: [`CONTEXT.md`](../CONTEXT.md) · ADRs: [`docs/adr/`](./adr/)

---

## v1 — Erster brauchbarer Stand (Must)

*Happy Path ohne OCR, PSD2, API, Kundenportal, automatischen Mahnlauf.*

**Status (2026-08-16):** Meilenstein 1 ist **hartbar abgeschlossen**. Funktionstest M2 (lokal + HTTPS) **bestanden mit Mängeln** — Blocker M2-01 (Steuersatz der Rechnung fehlt im Journal/UStVA); Fix committed, Nachtest auf der Instanz offen. Kategorien, Multi-Firma dünn, UStVA/ELSTER-XML light, ZM-Übersicht, USt-IdNr.-Prüfung (BZSt) und E-Rechnungs-Versand stehen. HTTPS: Host-Caddy, `app.zettelruhe.de` (ADR-0023), Server-Nachtest gelaufen. Als Nächstes: M2-01 deployen und nachtesten.

### Fundament & Stammdaten

- Mehrere Firmen in einer Instanz betreiben (anlegen + Session-Wechsel; Schema firma-gebunden)
- Eine:n Eigentümer:in (Schema multi-user-fähig, UI ohne Einladen/Rollen)
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

- Layout light: Logo, Briefpapier-Hintergrund optional, Textbausteine
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
- **Kassenbuch**: Bareinnahmen/-ausgaben, fortlaufender Saldo, Belegnummern
- **Buchungsjournal** unveränderbar (Belege + Kasse + Rechnungsbuchungen)
- Zahlung manuell markieren (inkl. Teilzahlung)
- Bank: CSV/MT940-Import je Bankkonto + Matching gegen offene Rechnungen/Belege

### E-Rechnung

- **Empfang**: XRechnung / ZUGFeRD parsen → Beleg vorbefüllen
- Revisionssicheres Ablegen der Originaldatei
- **Versand**: XRechnung-UBL / ZUGFeRD-CII als XML-Original aus festgeschriebener Rechnung; Validierung mit Fehlerliste; kein Hybrid-PDF/A-3

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
7. Funktionstest M2 ← durchgeführt ([`funktionstest-m2.md`](./funktionstest-m2.md), [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md)); HTTPS ADR-0023 in Betrieb. **M2-01** (USt-Satz Rechnung → Journal) blockiert die Freigabe, Fix committed.

Später: Multi-User / grobe Rechte. Follow-ups ohne M2-Prio: Setup-`verified`, Dokumenten-Layout, Logo/Favicon.

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
- CSS-Profi-Layouts, Font-Upload, Mehrvorlagen
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
