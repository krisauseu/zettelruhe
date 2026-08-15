# Status — Zettelruhe

_Last updated: 2026-08-15_

**Last session:** 2026-08-15 — E-Rechnungs-Versand auf `origin/main`; Browser-Nachtest kf ohne Fehler. Nächster Chat: Funktionstest-Protokoll M2 + HTTPS/Caddy auf dem Server

## What's done

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0022
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
- 277 Unit-Tests grün
- **M1-11 nachgetestet** (2026-08-15): Bank-CSV de-DE inkl. Idempotenz und Match gegen offene Rechnung; E-Rechnung-Empfang mit beiden Fixtures. Zahlung erzeugt kein Journal. Mangel M1-15 (`NEXT_REDIRECT` nach Import / Beleg-Entwurf) — nicht blockierend
- **Kategorien** (ADR-0017): gemeinsame Auswahlliste für Belege und Kassenbuch, CRUD unter `/app/kategorien`
- **Multi-Firma dünn** (ADR-0018): zweite Firma anlegen + in der Shell wechseln; `users.firma` bleibt 1:1 (zuletzt aktiv); Isolation über `session.firmaId`. Kein Einladen, keine zweite Rolle, Setup unverändert. 277 Unit-Tests grün. Browser-Nachtest durch kf 2026-08-15.
- **Sidebar:** Gruppen kollabierbar (Default offen), Zustand + Favoriten in localStorage, Auto-Open der aktiven Route, „Alle öffnen/schließen“, „Nur Favoriten“. 291 Unit-Tests.
- **UStVA / ELSTER-XML light** (ADR-0019): unter Regelbesteuerung Kennzahlen 81/86/66/83 aus dem Journal der aktiven Firma; XML-Download (Mein-Elster-Nutzdaten, kein Versand) für Monat/Quartal. Kleinunternehmerregelung unverändert „nicht relevant“. 308 Unit-Tests. Browser-Nachtest durch kf 2026-08-15: keine Probleme.
- **ZM-Übersicht** (ADR-0020): unter Regelbesteuerung Kandidaten aus 0-USt-Einnahmen plus Land am Kontakt (`/app/zm`); Art nicht geführt; CSV light, kein Versand. Kleinunternehmerregelung „nicht relevant“. Browser-Nachtest durch kf 2026-08-15: keine Fehler.
- **USt-IdNr.-Validierung (BZSt)** (ADR-0021): `ust_id` am Kontakt; eigene Nummer an der Firma als Anfragende; eVatR-REST einfach/qualifiziert als Schnappschuss, kein Dauer-Stempel. Kleinunternehmerregelung: Nummer erlaubt, USt/ZM unverändert nicht relevant. Browser (kf, 2026-08-15, lokal HTTP): Eingabe und Speichern der USt-IdNr. ohne Fehler. Klick-Prüfung beim BZSt lokal nicht prüfbar (kein HTTPS / ausgehender eVatR-Zugang).
- **E-Rechnungs-Versand** (ADR-0022): aus festgeschriebener Rechnung der aktiven Firma XML-Original (Profil XRechnung 3.0 UBL oder ZUGFeRD/Factur-X EN 16931 CII). Pflichtfeld- und Steuer-Modus-Prüfung mit de-DE-Fehlerliste; Kleinunternehmerregelung ohne USt-Zeilen + §-19-Hinweis; Regelbesteuerung mit Ausweis. Archiv in `e_rechnungen_versand`, Rechnungs-PDF unangetastet. Kein Hybrid-PDF/A-3, kein KoSIT-Claim, Empfangspfad unverändert. 362 Unit-Tests. Lokal hinter Caddy (2026-08-15): Prüfung, Erzeugung beider Profile auf R-0004, PDF unverändert, Isolation über `session.firmaId`. **Browser-Nachtest durch kf 2026-08-15: keine Fehler.**

## What's next

**Vereinbarte Reihenfolge (2026-08-15, nicht vermischen):**

1. **M1-11 nachgetestet** — Bank-CSV und E-Rechnung-Empfang tragen.
2. **Kategorien erledigt** — gemeinsame Liste Beleg + Kasse, CRUD `/app/kategorien` (ADR-0017).
3. **Multi-Firma dünn erledigt** — Firma anlegen + wechseln (ADR-0018).
4. **UStVA/ELSTER-XML light erledigt** — Self-File, kein Versand (ADR-0019).
5. **ZM-Übersicht erledigt** — Self-File, kein Versand (ADR-0020).
6. **USt-IdNr.-Validierung (BZSt) erledigt** — Schnappschuss, kein Versand (ADR-0021).
7. **E-Rechnungs-Versand erledigt** — XML-Profile, Validierung, Fehlerfeedback (ADR-0022).
8. **Als Nächstes: Funktionstest-Protokoll M2** (analog [`funktionstest-m1.md`](./funktionstest-m1.md)) **und HTTPS auf dem Server** (Caddy im Compose vs. nativ). Danach Server-Nachtest inkl. BZSt-Klick.
9. **Open Decisions** weiter separat. Multi-User später.

Invarianten unverändert: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt in v1 kein Journal. Eine Eigentümer:in, mehrere Firmen über die Session. de-DE im UI.

## Follow-up (nicht M2-Keil)

Kein Prio außer **HTTPS auf dem Server** — ohne das bleibt die BZSt-Prüfung später nicht ehrlich testbar.

- **HTTPS / Caddy (Prio vor BZSt-Servertest):** Zurzeit nur HTTP. Entweder Caddy aus Compose nehmen (nativ auf dem Server) oder im Compose belassen und Frontend — optional auch PocketBase-Admin — von außen über HTTPS erreichbar machen. Interne Next↔PocketBase-Kommunikation bleibt im Docker-Netz.
- **Setup: User nicht verifiziert:** Nach initialem Registrieren/Firma-Anlegen ist Login oft gesperrt, bis `users.verified` in PocketBase manuell `true` ist. Final: automatisch verifizieren (eine Eigentümer:in, self-hosted) oder E-Mail-Bestätigung, wenn SMTP steht.
- **Dokumenten-Layout:** Angebote und Rechnungen überarbeiten (über das heutige light: Logo, Akzent, Kopf-/Fußtext hinaus).
- **Marke:** Zettelruhe-Logo und Favicon entwerfen, oben links in der Shell einsetzen.

## Open decisions

- Journal-Nachzug für Zahlungen (Ist-Versteuerung / EÜR) — bewusst nicht in Abschn. 8/11/13/14
- Automatische Kassenbuch-Buchung aus Rechnungszahlung (Zahlungsweg bar) — bewusst nicht in Abschn. 9
- MT940-Parser — Follow-up (CSV in v1 produktionsfähig)
- Robustes ZUGFeRD-PDF-Attachment-Parsing — light Scan in BA12, Follow-up möglich

## Blockers

- Keine

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
5. Diese Datei · letzte Session: [`sessions/2026-08-15-e-rechnung-versand.md`](./sessions/2026-08-15-e-rechnung-versand.md)
