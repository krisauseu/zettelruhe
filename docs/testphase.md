# Testphase-Log

Funde aus dem Alltagstest nach Meilenstein 2: kleine Bugs, Verbesserungen, Änderungen.

- Eine Zeile pro Fund. IDs `TP-001`, `TP-002`, … fortlaufend.
- Art: `Bug` | `Verbesserung` | `Änderung`.
- Datum: `YYYY-MM-DD` (Meldung). In **Notiz** nach Erledigung: Owner-Datei und Testkommando.
- Dieses Log ist die Tracking-Datei der Testphase. `docs/90-status.md` bleibt der Meilenstein-Status; Session-Logs unter `docs/sessions/` nur bei größeren Schnitten.
- Der Skill `/testphase-fix` schreibt hier mit.

## Offen

| ID | Datum | Art | Bereich | Kurz |
|----|-------|-----|---------|------|

_Keine offenen Einträge._

## Erledigt

| ID | Datum | Art | Bereich | Kurz | Notiz |
|----|-------|-----|---------|------|-------|
| TP-001 | 2026-08-20 | Änderung | Kontakte | Kontaktnummer je Kontakt (ein Nummernkreis, Prefix an der Firma; PB-ID bleibt Verknüpfung) | Owner: `contacts/*`, `lib/pb.ts`, `platform/firma-*`, Migration `1730002000_kontaktnummer.js`. Tests: `cd app && npx vitest run src/lib/nummernkreis.test.ts src/modules/contacts src/modules/search src/modules/sales/pdf-render.test.ts src/modules/einvoice/outbound.test.ts`. Browser kf nach Docker-Rebuild: keine Fehler. |
