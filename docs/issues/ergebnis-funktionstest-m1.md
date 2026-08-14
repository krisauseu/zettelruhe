Bug-Report & Refactoring-Aufgaben (Meilenstein 1)

_Nachzug 2026-08-14: Prio 1–3 sowie Steuer-Modus-Wechsel und Status-Badges umgesetzt. Nachprüfung durch kf: Änderungen i. O._

Umgesetzt 2026-08-14 (M1-13, M1-14, M1-10, M1-12). Auf `main` (`2ce18d9`).

Offen nur Nachtest, **als Nächstes** (vereinbart, vor M2):

- **M1-11 Nachtest:** Bank-CSV-Import; E-Rechnung-Empfang (Fixtures unter `app/src/modules/einvoice/fixtures/`). Kein Feature-Bau.

Danach M2, erster Keil: UStVA/ELSTER-XML light. Open Decisions nicht vermischen.

Details Nachzug: `docs/sessions/2026-08-14-m1-funktionstest-nachzug.md`.  
PDF/Layout: `docs/sessions/2026-08-14-m1-pdf-vorschau-layout.md`.

Priorität 1: Kritische Rechenfehler & Datenintegrität (Abschnitt 1 & 6).
Priorität 2: Daten-Export & Validierung (Abschnitt 2).
Priorität 3: Globale UX/UI-Feedbacks (Toasts, Bestätigungs-Dialoge, 15-Min-Raster).
Priorität 4: Feature-Erweiterungen (Einstellungen, Layouts, Steuermodus-Wechsel).

0. Vorbereitung & Deployment
⚬	Status: OK (Keine Fehler)
1. Fundament: Setup, Auth, Shell
⚬	Bugs / Blocker:
⚬	Stammdaten-Setup unvollständig: Beim initialen Setup der Firma werden Anschrift und weitere Stammdaten nicht persistent erfasst.
⚬	Fehlende Editierbarkeit: Auf der Firmeneinstellungsseite (/app/firma) können Firmendaten und Nummernkreise/Buchungskreise nachträglich nicht mehr bearbeitet oder ergänzt werden.
⚬	Erweiterung:
⚬	Steuer-Modus-Wechsel: Es muss möglich sein, nachträglich von Kleinunternehmerregelung (§ 19 UStG) auf Regelbesteuerung (Ist-Versteuerung) umzustellen (relevant bei Überschreiten der 25.000 € Grenze).
2. Stammdaten: Kontakte & Katalog
⚬	Bugs / Mängel:
⚬	Fehlendes UI-Feedback: Kein sichtbares Feedback (Toast/Notification) nach dem erfolgreichen Speichern eines Kontakts oder eines Katalog-Artikels.
⚬	CSV-Export unvollständig: Ansprechpartner werden beim CSV-Export nicht exportiert, da sie in einer separaten PocketBase-Collection liegen.
⚬	Refactoring-Vorschlag: Prüfen, ob Ansprechpartner als optionale Felder direkt in die kontakte-Collection migriert oder im Export-Job per Relation aufgelöst werden können.
⚬	Verbesserungen:
⚬	Katalog-Einheiten: Dropdown/Auswahlliste für standardisierte Einheiten implementieren (z. B. Stück, Stunde, Artikel, Karton, Pauschal).
3. Arbeit: Projekte, Zeiten, Fahrten
⚬	Verbesserungen:
⚬	Zeitraster: Zeiterfassung nicht nur in vollen Stunden, sondern in 15-Minuten-Schritten (0,25 h) ermöglichen.
4. Verkauf: Angebot → Rechnung
⚬	Bugs / UX:
⚬	Fehlendes UI-Feedback: Beim Speichern von Angeboten/Rechnungen fehlt eine klare visuelle Bestätigung (Toast-Meldung).
⚬	Erweiterungen / Feature-Wunsch:
⚬	Dokumenten-Layout & Branding: Eigenes Einstellungsmodul für Angebots-/Rechnungslayouts (Logo-Upload, Farb-Akzente, Textbausteine für Kopf-/Fußzeilen).
5. Zahlungen & offene Posten
⚬	Status: OK (Keine Fehler)
6. Belege, Kasse, Journal
⚬	Kritische Bugs (Prio 1):
⚬	Vorzeichen-/Zuordnungsfehler bei Storno in Auswertungen:
⚬	Das Stornieren einer Ausgabe wird in den Auswertungen fälschlicherweise als Einnahme addiert (statt die Ausgaben zu mindern / als Minus-Ausgabe zu laufen).
⚬	Das Stornieren einer Rechnung wird in den Auswertungen fälschlicherweise als Ausgabe gewertet.
⚬	(Referenz: Siehe Screenshots im Ordner ./docs/issues)
⚬	Rechnungsstatus: Stornierte Rechnungen ändern ihren Status in der Rechnungsübersicht nicht zuverlässig auf storniert.
⚬	UX & Sicherheit:
⚬	Sicherheitsabfrage: Vor dem Ausführen einer Stornobuchung muss ein Bestätigungs-Modal (Pop-up) erscheinen.
⚬	Erfolgsmeldung: Nach erfolgreichem Storno fehlt eine explizite Bestätigungsmeldung.
7. Bank & Matching
⚬	Status: Kontoanlage erfolgreich. (CSV-Import steht noch aus).
8. E-Rechnung Empfang
⚬	Status: Offen (Mangels XML-Dateien noch nicht manuell verifiziert).
9. Auswertungen, Export, Suche
⚬	Status: Funktional i. O., hängt jedoch direkt an der Korrektur der Storno-Logik aus Punkt 6.
10. GoBD / Immutability
⚬	Status: OK (Keine Fehler)
11. Betrieb, Backup, Security
⚬	Status: OK (Keine Fehler)
12. Regression & Übergreifendes UI/UX
⚬	Modernisierung: Das UI/UX wirkt zu monoton (reines S/W). Akzentfarben, visuelle Status-Badges und sauberere Abstände einführen.
⚬	Globales Feedback-System: Sicherstellen, dass jede schreibende Aktion (Create/Update/Delete/Storno) einen eindeutigen Toast auslöst.