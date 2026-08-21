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
| TP-002 | 2026-08-21 | Verbesserung | Belege | Handyfotos vor dem Speichern auf JPEG ≤2000 px Kante / q=0.82; PDF unverändert | Owner: `expenses/beleg-datei-input.tsx`, `expenses/compress-beleg-image.ts`. Tests: `cd app && npx vitest run src/modules/expenses` (24). Chrome: 4000×3000 JPEG 92 KB → 24 KB, PDF unverändert. Seite `/app/belege/neu` nicht live (kein Compose/Session). |
| TP-003 | 2026-08-21 | Bug | Belege | Hochgeladene Dateien wieder anzeigen/entfernen: je Datei Lupe + X | Owner: `expenses/beleg-datei-input.tsx`, `expenses/beleg-datei-zeilen.ts`, `expenses/beleg-form.tsx`, `app/belege/[id]/page.tsx`. Tests: `cd app && npx vitest run src/modules/expenses` (27). Browser kf: keine Probleme. |
| TP-004 | 2026-08-21 | Verbesserung | Belege | Mehrere Dateien je Beleg (bis 10); neue Fotos hängen an, ersetzen nicht | Owner: Migration `1730002100_belege_datei_mehrfach.js`, `expenses/*`, `app/belege/[id]`, `reporting/repository.ts`. Tests: `cd app && npx vitest run src/modules/expenses` (31). Compose-Rebuild: Next+PB grün, `datei.maxSelect=10` in PB. Browser kf: keine Probleme. |
