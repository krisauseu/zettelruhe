# Status — Zettelruhe

_Last updated: 2026-08-16_

**Last session:** 2026-08-16 — Meilenstein 2 geschlossen (M2-01 nachgetestet, Freigabe „M2 Alltag trägt“). Setup-verified: Eigentümer:in beim Anlegen automatisch verifiziert; Login hängt nicht an `users.verified`.

## What's done

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0023
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
- 373 Unit-Tests grün (nach Setup-verified)
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

## What's next

**Vereinbarte Reihenfolge (nicht vermischen):**

1. **Dokumenten-Layout** — Angebote und Rechnungen überarbeiten (über das heutige light: Logo, Akzent, Kopf-/Fußtext hinaus).
2. **Marke** — Zettelruhe-Logo und Favicon, oben links in der Shell.

Danach weiter separat: Ist-Versteuerung, Multi-User, Hybrid-PDF, Open Decisions.

Invarianten unverändert: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt in v1 kein Journal. Eine Eigentümer:in, mehrere Firmen über die Session. de-DE im UI.

## Follow-up

- **Dokumenten-Layout:** Angebote und Rechnungen überarbeiten (über das heutige light hinaus).
- **Marke:** Zettelruhe-Logo und Favicon entwerfen, oben links in der Shell einsetzen.

## Open decisions

- Journal-Nachzug für Zahlungen (Ist-Versteuerung / EÜR) — bewusst nicht in Abschn. 8/11/13/14
- Automatische Kassenbuch-Buchung aus Rechnungszahlung (Zahlungsweg bar) — bewusst nicht in Abschn. 9
- MT940-Parser — Follow-up (CSV in v1 produktionsfähig)
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
5. Diese Datei · letzte Session: [`sessions/2026-08-16-setup-verified.md`](./sessions/2026-08-16-setup-verified.md)
