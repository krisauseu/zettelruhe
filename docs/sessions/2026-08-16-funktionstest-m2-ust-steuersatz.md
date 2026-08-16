# Session 2026-08-16 — Funktionstest M2 auswerten + M2-01 USt-Satz

## Done

M2 lokal und auf dem Server (HTTPS) durch kf: **bestanden mit Mängeln**, ein Blocker.

Auswertung: [`issues/ergebnis-funktionstest-m2.md`](../issues/ergebnis-funktionstest-m2.md). Screenshot: [`issues/Fehler.UST-Auswertung.png`](../issues/Fehler.UST-Auswertung.png).

### M2-01 (Blocker)

Festgeschriebene Rechnung unter Regelbesteuerung: Satz in den Positionen gewählt, Beträge richtig (95,00 € netto / 18,05 € USt), Journal-`steuersatz` leer. USt-Übersicht „ohne Satz“, Kz 81 = 0, ELSTER-XML ohne Umsatz.

- Schreiben: `einheitlicherSteuersatz` aus den Positionen → Journal bei Festschreibung.
- Lesen: USt-Übersicht/UStVA inferiert 19/7 aus Beträgen, wenn das Feld leer und die Rundung exakt trifft. Journal unverändert.
- Gemischt bleibt leer; 0 % wird nicht geraten; Kleinunternehmerregelung unverändert ohne Satz.

Keine stillen Journal-Updates. Setup-`verified`, Layout, Logo/Favicon, Multi-User, Open Decisions, Hybrid-PDF nicht angefasst. Commit/Push auf ausdrückliche Bitte.

### Tests

370 Unit-Tests + `tsc` grün.

## Nicht angefasst

- Commit/Push
- Gemischte Sätze auf einer Rechnung (weiter eine Journal-Zeile, Satz leer)
- DATEV-BU-Schlüssel für Alt-Zeilen ohne Satz
- Follow-ups aus Protokoll Abschnitt 9

## Next step

Nach Deploy: `/app/ust` an der bestehenden 95-€-Rechnung (19 % / Kz 81 / Kz 83 = 10,07 €). Neue Rechnung festschreiben und Journal-Satz prüfen. Danach Open Decisions / Multi-User weiter separat.
