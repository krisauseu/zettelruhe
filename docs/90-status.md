# Status — Zettelruhe

_Last updated: 2026-08-14_

**Last session:** 2026-08-14 — PDF/Layout auf `main` (`2ce18d9`); Reihenfolge fest: zuerst M1-11 nachtesten, dann M2 mit UStVA/ELSTER-XML light

## What's done

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0016
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
- 261 Unit-Tests grün

## What's next

**Vereinbarte Reihenfolge (2026-08-14, nicht vermischen):**

1. **M1-11 nur nachtesten** — Bank-CSV-Import und E-Rechnung-Empfang. Fixtures: `app/src/modules/einvoice/fixtures/`. Checkliste: [`funktionstest-m1.md`](./funktionstest-m1.md) Abschnitte 7 und 8. **Kein Feature-Bau.**
2. **Meilenstein 2, erster Keil:** UStVA-Zahlen / ELSTER-XML light (Self-File-Vorbereitung). Danach ZM, USt-IdNr., E-Rechnungs-Versand, optional Multi-Firma-UI.
3. **Open Decisions** weiter separat — nicht in M1-11 und nicht in den ersten M2-Keil.

Invarianten unverändert: Anlegen ≠ stilles Ändern festgeschriebener Dokumente. Rechnungsnummer und Journal erst bei Festschreibung. Zahlung erzeugt in v1 kein Journal. Eine Firma, eine Eigentümer:in. de-DE im UI.

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
5. Diese Datei · letzte Session: [`sessions/2026-08-14-m1-pdf-vorschau-layout.md`](./sessions/2026-08-14-m1-pdf-vorschau-layout.md)
