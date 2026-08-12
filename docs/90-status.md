# Status — Zettelruhe

_Last updated: 2026-08-12_

**Last session:** 2026-08-12 — BA14 + GitHub private repo + Funktionstest-Checkliste M1

## What's done

- Funktionsumfang und Tech-Stack (Grill-with-Docs); DOMAIN/ADRs 0001–0016
- **Bauabschnitt 1–13** erledigt (Fundament → Reporting/Export) — siehe frühere Status-Einträge / Session-Logs
- **Bauabschnitt 14 (Härten)** umgesetzt:
  - Betrieb: `docs/betrieb.md` (Backup/Restore Volume, Secrets, Session/CSRF, Health, Updates)
  - README / `.env.example` / Verfahrensdoku poliert; keine Prod-Default-Claims
  - Security light: ENV-Check + Startup-Warnungen, Caddy-Header, `APP_URL` → Server-Action-Origins
  - Health: `GET /health` + Compose-Healthchecks (next, pocketbase)
  - UX: Nav-Gruppen, Übersicht-Schnellstart, EmptyStates an kritischen Listen, de-DE Login-Fehler unverändert ok
  - Suche light: `/app/suche` über Kontakte/Rechnungen/Belege/Angebote
  - 237 Unit-Tests grün; `docker compose up` healthy
- **v1 Meilenstein 1** als **hartbar abgeschlossen** markiert (Roadmap + README)

## What's next

- **Funktionstest M1** vor M2: [`docs/funktionstest-m1.md`](./funktionstest-m1.md) (Happy Path + Betrieb/Backup)
- Danach Meilenstein 2 (Roadmap): Steuer & Compliance vertiefen (UStVA/ELSTER-XML light, ZM, USt-IdNr., E-Rechnungs-Versand, optional Multi-Firma-UI)
- Optional Feinschliff: Open Decisions (Journal↔Zahlungen), MT940, robusteres ZUGFeRD-PDF

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
5. Diese Datei · letzte Session: [`sessions/2026-08-12-bauabschnitt-14-haerten.md`](./sessions/2026-08-12-bauabschnitt-14-haerten.md)
