# Verfahrensdokumentation (Vorlage) — Zettelruhe

_GoBD-Mindeststandard light (ADR-0004). Keine externe Zertifizierung.  
Anpassungen an den eigenen Betrieb sind Pflicht der betreibenden Person._

## 1. Zweck und Geltungsbereich

Diese Vorlage beschreibt, wie in **Zettelruhe** (self-hosted) Belege, Buchungen und
Auswertungen für eine Solo-Firma in Deutschland geführt werden. Sie ist als
Ausgangspunkt für die individuelle Verfahrensdokumentation gedacht.

| Punkt | Inhalt v1 |
|-------|-----------|
| System | Zettelruhe (Next.js + PocketBase/SQLite) |
| Nutzerkreis | Eigentümer:in der Instanz |
| Steuerziel | EÜR; optional USt-Übersicht bei Regelbesteuerung (Ist-Versteuerung) |
| Standort Daten | Volume `zettelruhe_pb_data` (Docker Compose) bzw. konfigurierter PB-Datenpfad |

## 2. Verantwortlichkeiten

- **Eigentümer:in**: Betrieb, Backup, Zugangsdaten, inhaltliche Richtigkeit der Buchungen.
- **System**: Erzwingt Festschreibung (keine stillen Änderungen an Journal/Belegdateien),
  firmengebundene Datentrennung im Schema, Exporte nur für authentifizierte Session.

## 3. Beleg- und Buchungsprozess (Überblick)

1. **Stammdaten**: Firma inkl. Steuer-Modus (Kleinunternehmerregelung oder Regelbesteuerung/Ist-Versteuerung).
2. **Belege**: Entwurf mit optionaler Datei → **Festschreibung** → Journal-Eintrag + Belegnummer; Datei danach immutable.
3. **Rechnungen**: Entwurf → Festschreibung → Rechnungsnummer, PDF, Journal.
4. **Kassenbuch**: Anlegen = Festschreibung → Journal; Korrektur nur Storno/Gegenbuchung.
5. **Manuelle Journal-Buchung**: Anlegen = Festschreibung.
6. **Storno**: Gegenbuchung mit Verweis `storno_von`; Original bleibt erhalten.
7. **Zahlungen**: Manuell oder per Bank-Match; **erzeugen in v1 kein Journal** (Open Decision Ist-Versteuerung).
8. **E-Rechnung Empfang**: Original archivieren → optional Beleg-Entwurf → Festschreibung wie Beleg.

## 4. Unveränderbarkeit und Korrekturen

- Festgeschriebene Journal-Zeilen: kein Update/Delete über die Anwendung.
- Festgeschriebene Belegdateien und Rechnungs-PDFs: keine stille Ersetzung.
- Korrekturen: Storno/Gegenbuchung bzw. neuer Beleg/neue Rechnung — nachvollziehbar im Journal.

## 5. Auswertungen und Export

| Export | Inhalt | Hinweis |
|--------|--------|---------|
| EÜR light | Summen aus Journal, Kategorien light | Beide Steuer-Modi |
| USt-Übersicht | USt/Vorsteuer aus Journal | Nur Regelbesteuerung; kein ELSTER-Versand |
| UStVA / ELSTER-XML light | Kz 81/86/66/83 aus Journal | Self-File (`zettelruhe-ustva-elster-xml-light-v1`); kein Versand; Monat/Quartal |
| DATEV light CSV | Journal-Zeilen EXTF-ähnlich | Format-ID `zettelruhe-datev-csv-light-v1`, **nicht** DATEV-zertifiziert |
| Journal-CSV | Alle Felder der Journal-Zeilen | Semikolon, UTF-8 BOM |
| Belegarchiv-ZIP | Metadaten + Dateien festgeschriebener Belege | Zeitraum nach Belegdatum |
| Kontakte/Katalog-CSV | Stammdaten | Bestehende Modul-Exporte |

Perioden und steuerliche Tagesgrenzen: **Europe/Berlin** (ADR-0016).

## 6. Datensicherung

Konkrete Befehle und Restore: [`docs/betrieb.md`](./betrieb.md).

| Punkt | Vorgabe v1 / Vorlage |
|-------|----------------------|
| Was | Volume `zettelruhe_pb_data` (SQLite + Dateien); plus `.env` separat |
| Wann | Täglich empfohlen; vor Updates und großen Importen extra |
| Wo | _[Aufbewahrungsort hier eintragen]_ |
| Prüfung | Restore mindestens jährlich testen und hier datieren: _[ ]_ |

Wiederherstellung nur aus geprüften Backups; nach Restore Login und Stichprobe Beleg/Journal.

## 7. Zugriffs- und Betriebssicherheit

- Authentifizierung über PocketBase-Nutzer; Next.js Session (httpOnly Cookie, `SameSite=Lax`).
- Finanz-Writes nur serverseitig über Next (nicht Client-direkt an PB für Finanzaggregate).
- Superuser-Zugangsdaten und `SESSION_SECRET` nur in `.env` / Host-Secret — nicht im Git.
- Production: HTTPS, keine Default-Secrets, PocketBase-Admin `/_/` nicht öffentlich exponieren.
- Details: [`docs/betrieb.md`](./betrieb.md) Abschnitte Secrets und Session.

## 8. Individuell zu ergänzen

- [ ] Konkrete Backup-Rhythmus und Aufbewahrungsort  
- [ ] Letzter erfolgreicher Restore-Test (Datum)  
- [ ] Verantwortliche Person / Vertretung  
- [ ] Hardware-/Hosting-Standort  
- [ ] Ablage gescannter Papierbelege außerhalb des Systems (falls vorhanden)  
- [ ] Steuerberater-Übergabeprozess (DATEV-Datei / Zeitraum)  

---

_Stand Vorlage: Bauabschnitt 14 (Härten). Bei Software-Updates Prozessänderungen nachziehen._
