# Status — Zettelruhe

_Last updated: 2026-08-18_

**Last session:** 2026-08-18 — MT940 bunq-Nachzug (`c769bcd`): `:25:` ohne Währung, `:86:` REMI/NAME.

## What's done

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0028
- **Bauabschnitt 1–14** erledigt (Fundament → Härten)
- **Funktionstest M1** manuell durchgeführt: **bestanden mit Mängeln** — Rohbericht [`issues/ergebnis-funktionstest-m1.md`](./issues/ergebnis-funktionstest-m1.md)
- **M1-Nachzug** aus dem Test:
  - Storno mindert in EÜR/BWA/USt die Ursprungskategorie (nicht Gegenrichtung)
  - Rechnungsstatus wird beim Storno zuverlässig **storniert**; Storno-UI + Bestätigungs-Modal
  - Firma: Anschrift im Setup; `/app/firma` editierbar inkl. Nummernkreise und Steuer-Modus-Wechsel
  - Kontakt-CSV inkl. Ansprechpartner; Katalog-Einheiten als Auswahlliste; Zeiten 15-Min-Raster
  - Globale Toasts für schreibende Aktionen
- **M1-13 + M1-14:** Entwurfs-PDF on-the-fly (Wasserzeichen „Entwurf“, kein Nummernkreis, kein Journal); Original erst bei Senden / Festschreibung; E-Mail optional
- **M1-10:** Dokumenten-Layout light (Logo, Akzentfarbe, Kopf-/Fußtext) an der Firma
- **M1-12:** UI-Akzente light (kein CSS-Profi-Layout)
- 389 Unit-Tests grün (nach Dokumenten-Layout)
- **M1-11 nachgetestet** (2026-08-15): Bank-CSV de-DE inkl. Idempotenz und Match gegen offene Rechnung; E-Rechnung-Empfang mit beiden Fixtures. Zahlung erzeugt kein Journal. Mangel M1-15 (`NEXT_REDIRECT` nach Import / Beleg-Entwurf) — nicht blockierend
- **Kategorien** (ADR-0017): gemeinsame Auswahlliste für Belege und Kassenbuch, CRUD unter `/app/kategorien`
- **Multi-Firma dünn** (ADR-0018): zweite Firma anlegen + in der Shell wechseln; `users.firma` bleibt 1:1 (zuletzt aktiv); Isolation über `session.firmaId`. Kein Einladen, keine zweite Rolle, Setup unverändert. 277 Unit-Tests grün. Browser-Nachtest durch kf 2026-08-15.
- **Sidebar:** Gruppen kollabierbar (Default offen), Zustand + Favoriten in localStorage, Auto-Open der aktiven Route, „Alle öffnen/schließen“, „Nur Favoriten“. 291 Unit-Tests.
- **UStVA / ELSTER-XML light** (ADR-0019): unter Regelbesteuerung Kennzahlen 81/86/66/83 aus dem Journal der aktiven Firma; XML-Download (Mein-Elster-Nutzdaten, kein Versand) für Monat/Quartal. Kleinunternehmerregelung unverändert „nicht relevant“. 308 Unit-Tests. Browser-Nachtest durch kf 2026-08-15: keine Probleme.
- **ZM-Übersicht** (ADR-0020): unter Regelbesteuerung Kandidaten aus 0-USt-Einnahmen plus Land am Kontakt (`/app/zm`); Art nicht geführt; CSV light, kein Versand. Kleinunternehmerregelung „nicht relevant“. Browser-Nachtest durch kf 2026-08-15: keine Fehler.
- **USt-IdNr.-Validierung (BZSt)** (ADR-0021): `ust_id` am Kontakt; eigene Nummer an der Firma als Anfragende; eVatR-REST einfach/qualifiziert als Schnappschuss, kein Dauer-Stempel. Kleinunternehmerregelung: Nummer erlaubt, USt/ZM unverändert nicht relevant. Browser (kf, 2026-08-15, lokal HTTP): Eingabe und Speichern der USt-IdNr. ohne Fehler. Klick-Prüfung beim BZSt lokal nicht prüfbar (kein HTTPS / ausgehender eVatR-Zugang).
- **E-Rechnungs-Versand** (ADR-0022): aus festgeschriebener Rechnung der aktiven Firma XML-Original (Profil XRechnung 3.0 UBL oder ZUGFeRD/Factur-X EN 16931 CII). Pflichtfeld- und Steuer-Modus-Prüfung mit de-DE-Fehlerliste; Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis. Archiv in `e_rechnungen_versand`, Rechnungs-PDF unangetastet. Kein Hybrid-PDF/A-3, kein KoSIT-Claim, Empfangspfad unverändert. 362 Unit-Tests. Lokal hinter Caddy (2026-08-15): Prüfung, Erzeugung beider Profile auf R-0004, PDF unverändert, Isolation über `session.firmaId`. **Browser-Nachtest durch kf 2026-08-15: keine Fehler.**
- **Funktionstest-Protokoll M2:** [`funktionstest-m2.md`](./funktionstest-m2.md) (Vorlage M1; nur M2-Keile plus gezielte Regression und Server-Nachtest). M1-Checkliste nicht umgebaut.
- **HTTPS / Caddy (ADR-0023):** Caddy nativ auf dem Server (`app.zettelruhe.de`, Let’s Encrypt). Compose-Caddy nur lokal (HTTP:80). Overlay `docker-compose.server.yml`, Site-Block `deploy/Caddyfile.host`. `/_/` über denselben Host (explizit). Next↔PocketBase intern. Server-Nachtest durch kf (2026-08-15/16) über `https://app.zettelruhe.de`.
- **Funktionstest M2** (kf, lokal + Server HTTPS): **bestanden**. Rohbericht [`issues/ergebnis-funktionstest-m2.md`](./issues/ergebnis-funktionstest-m2.md). **M2-01** (Steuersatz festgeschriebener Rechnungen ins Journal / in die USt-Auswertung) deployed und nachgetestet (`13da9e7`). Freigabe **M2 Alltag trägt**. Blocker keine. Arbeitsfirma auf `app.zettelruhe.de`: Kleinunternehmerregelung.
- **Setup-verified:** Beim Anlegen der Eigentümer:in `users.verified = true`. `users.authRule` leer — Login hängt nicht an `verified` und nicht an SMTP. Bestehende unverifizierte User einmalig nachziehen; bereits verifizierte bleiben verifiziert. Multi-Firma (ADR-0018) und Setup-Wizard unverändert.
- **Dokumenten-Layout (über M1-10 hinaus):** Angebot und Rechnung teilen ein DIN-ähnliches Gerüst (Fenstertasche, Akzent-Tabelle, Summen). Unter Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis. Bankzeile aus dem ersten aktiven Bankkonto mit IBAN; GiroCode (EPC) nur auf der Rechnung. Schalter Header/Fuß/Zahlblock an der Firma. Entwurf weiter ohne Nummernkreis, mit Wasserzeichen. Bestehende Originale unverändert (ADR-0012). E-Rechnungs-XML unangetastet.
- **Marke (Logo/Favicon):** App-Marke aus `docs/logo-512x512-transparent.png` (Z ohne Schriftzug). Shell oben links, Login und Setup; Favicon + 32×32 + Apple-Touch + PWA-Icons 192/512. Unabhängig von `firmen.logo` auf Angebot/Rechnung.
- **Ist-Versteuerung / Journal-Nachzug Zahlungen (ADR-0024):** Zahlung (manuell oder Bank-Match) erzeugt festgeschriebene Journal-Zeilen (`quelle_typ=zahlung`, Buchungsdatum = Zahlungsdatum), anteilig nach Steuerstaffel. EÜR, USt, ZM, BWA, Dashboard und DATEV zählen den Zufluss, nicht die Forderungsbuchung der Rechnungs-Festschreibung. Löschen storniert das Zahlungsjournal; Rechnungs-Storno storniert es mit. Bestehende Zahlungen werden idempotent nachgezogen.
- **Multi-User / grobe Rechte (ADR-0025):** Mitgliedschaft User↔Firma; Rollen Eigentümer:in / Bearbeiten / Lesen. Einladen unter `/app/nutzer` (Startpasswort, kein SMTP-Pflicht; Hinweis-Mail ohne Passwort wenn SMTP steht). `users.firma` bleibt zuletzt aktiv. Instanz-Eigentümer:in legt weitere Firmen an. Isolation: Session nur mit Mitgliedschaft. Backfill: bestehende Instanz-Eigentümer:innen werden Eigentümer:in aller vorhandenen Firmen. Schreib-Actions serverseitig geprüft. Commit `1ae4965`. **Server-Nachtest kf inkl. SMTP: keine Fehler.**
- **Eigenes Passwort ändern** (Nachzug ADR-0025): `/app/passwort` — jede angemeldete Nutzer:in (Instanz-Eigentümer:in und Eingeladene, alle drei Rollen inkl. Lesen) ändert nur das eigene Passwort (alt + neu + Bestätigung, mindestens 8 Zeichen). Fremdes Passwort unter `/app/nutzer` unverändert. Kein SMTP, kein Reset-per-Mail. Next-Session bleibt gültig (ADR-0009).
- **UX/UI erster Keil (App-Layout / CSS):** Tokens (Papier-Canvas, Tinte-Sidebar, Primärfarbe an der Z-Marke), gemeinsame Primitives, PageHeader auf Alltagslisten, Übersicht und Login/Setup. M1-12 und Marke nicht zurückgebaut. Toast unten rechts. Lokal hinter Caddy nachgetestet.
- **UX/UI Rest:** Sidebar mobil Off-Canvas (unter `md`; Desktop fest). Esc, Overlay, Nav-Link schließt, Fokus. PageHeader auf Firma, Nutzer:innen, Passwort (nur Optik) und Dokument-Details (Angebot, Rechnung, Beleg). Nav-Logik und erster Keil unangetastet. 437 Unit-Tests. Lokal hinter Caddy nachgetestet.
- **Übersicht / Dashboard (erster Keil):** Fläche unter den KPI-Karten. Fälligkeiten (überfällig + 14 Tage, Link zur Rechnung, „Zahlung erfassen“ nur bei Schreibrecht). §-19-Jahresbalken nur unter Kleinunternehmerregelung — Grenzen aus § 19 Abs. 1 UStG (Staffel ab 2025: 25.000 / 100.000, kein 22.000-Default), Umsatz light nach Zufluss, unter Regelbesteuerung keine Karte. Verlauf 6 / Jahr / 12 Monate (SVG, kein Chart-Paket).
- **Übersicht Follow-up:** Ausgaben nach Kategorien (Donut Top 5 + „Weitere“, Monat/Quartal; Schnappschuss am Beleg/Kassenbuch, Storno mindert die Ursprungskategorie) und letzte Buchungen (Journal-Tail, Link zum Datensatz). Zweite 65/35-Zeile, erster Keil unverändert. 462 Unit-Tests. Donut-Farben: je Kategorie ein Token (nicht Violett-in-Violett).
- **Hybrid-PDF (ADR-0026):** Schnitt, kein Bau. Factur-X/ZUGFeRD-Hybrid verlangt PDF/A-3; `@react-pdf/renderer` liefert das nicht, `pdf-lib` macht es nicht ehrlich, Mustang/Chromium bleiben ausgeschlossen. Versand bleibt XML-Original (ADR-0022) neben dem Festschreibungs-PDF. Kein Kleber ohne Claim.
- **Kassenbuch aus Barzahlung (ADR-0027):** Schnitt, kein Bau. Zahlung mit Zahlungsweg `bar` erzeugt keinen Kassenbuch-Eintrag. Zufluss bleibt allein `quelle_typ=zahlung` (ADR-0024). Manuelles Kassenbuch unverändert (`quelle_typ=kasse`). Formular-Hinweis warnt vor doppelter Bareinnahme. Kein Hook, kein Nachzug, keine EÜR-Entkopplung.
- **MT940-Parser (ADR-0028):** klassisches SWIFT-MT940 / STA (`:20:` / `:25:` / `:61:` / `:86:` / `:62F:`). Eigener Parser nach `ParsedBankZeile`; Persistenz und Idempotenz wie CSV; Lauf `format=mt940`. Valuta und C/D/RC/RD nur aus `:61:`. `:25:`-IBAN nach Ländercode (DE = 22), angehängtes `EUR` gehört nicht zur Konto-ID. bunq-`:86:` `/IBAN/` `/NAME/` `/REMI/`: Liste zeigt REMI oder NAME, gespeichert bleibt der volle Text. Encoding UTF-8 oder Windows-1252. Kein CAMT.053, kein MT942, keine Lib. Matching unverändert (Bestätigung, `createZahlung`). Import-Erfolg-`redirect` liegt außerhalb von `try` (dieser Pfad, M1-15). 489 Unit-Tests. Commits `2341199`, `c769bcd`.

## What's next

**Ausblick (nicht durch den aktuellen Server-Stand verengen):**
Zettelruhe soll ein Tool für jedermann werden — verschiedene Steuer-Modi, verschiedene Firmagrößen, mehrere Nutzer:innen. Die Arbeitsfirma auf `app.zettelruhe.de` (Kleinunternehmerregelung, eine Eigentümer:in) ist der heutige Betrieb, nicht das Produkt. Priorisierung und nächste Schnitte daran nicht festmachen.

**Als Nächstes sichtbar, noch nicht gebaut** (nicht vermischen mit Erledigtem):

- Robustes ZUGFeRD-Empfang-Parsing — Kickoff: [`sessions/2026-08-18-zugferd-empfang-parsing-prompt.md`](./sessions/2026-08-18-zugferd-empfang-parsing-prompt.md).

Erledigt und hier nicht wieder aufmachen: Marke, Dokumenten-Layout (über light hinaus), UStVA/ZM light, E-Rechnung (XML-Versand), Hybrid-Schnitt (kein Bau, ADR-0026), Kassenbuch aus Barzahlung (kein Bau, ADR-0027), MT940 (ADR-0028), Multi-Firma dünn, Ist-Versteuerung (Journal-Nachzug Zahlungen), Multi-User / grobe Rechte, eigenes Passwort, UX/UI erster Keil (Tokens/Shell/Listen), UX/UI Rest (Sidebar mobil, Detailköpfe), Übersicht erster Keil (Fälligkeiten, §-19-Wächter, Verlauf), Übersicht Follow-up (Donut Kategorien, letzte Buchungen).

Invarianten unverändert: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt eine Zufluss-Buchung im Journal (ADR-0024). Zugang zu Firmen über Mitgliedschaft (ADR-0025). de-DE im UI.

## Follow-up

- Übrige Open Decision (ZUGFeRD-Empfang-Parsing) — weiter separat
- Hybrid-PDF — erledigt als Schnitt (kein Bau); später nur mit eigener PDF/A-3-Pipeline (ADR-0026)
- Kassenbuch aus Barzahlung — erledigt als Schnitt (kein Bau, ADR-0027)
- MT940 — erledigt (ADR-0028, klassisches SWIFT/STA)

## Open decisions

UX/UI erster Keil und Rest (mobil Off-Canvas, Detailköpfe) stehen. Die Liste hier ist kein Tunnelblick auf die aktuelle Kleinunternehmer-Arbeitsfirma.

- Robustes ZUGFeRD-PDF-Attachment-Parsing — light Scan in BA12, Follow-up möglich

## Blockers

- keine

## Bauabschnitte v1 (verbindlich)

1. Fundament ← **erledigt**
2. Kontakte + Katalog ← **erledigt**
3. Journal-Kern ← **erledigt**
4. Belege manuell + Dateien ← **erledigt**
5. Sales light (Rechnung Festschreiben/PDF/Journal) ← **erledigt**
6. Angebote ← **erledigt**
7. Zeit & Fahrten ← **erledigt**
8. Zahlungen manuell ← **erledigt**
9. Kassenbuch ← **erledigt**
10. Wiederkehrend + SMTP + Jobs ← **erledigt**
11. Bank-Import + Matching ← **erledigt**
12. E-Rechnung Empfang ← **erledigt**
13. Reporting/Export ← **erledigt**
14. Härten ← **erledigt** (M1 hartbar abgeschlossen)

## Lesereihenfolge

1. `CONTEXT.md`
2. `docs/feature-roadmap.md`
3. `docs/betrieb.md` (Betrieb/Backup)
4. `docs/adr/*.md`
5. Diese Datei · letzte Session: [`sessions/2026-08-18-mt940-bunq.md`](./sessions/2026-08-18-mt940-bunq.md)
