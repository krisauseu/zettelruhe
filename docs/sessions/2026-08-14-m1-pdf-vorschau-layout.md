# Session 2026-08-14 — PDF-Vorschau, Layout, UI-Feinschliff

## Done

### M1-13 + M1-14 (gemeinsamer Schnitt)
- Entwurfs-PDF on-the-fly mit Wasserzeichen „Entwurf“, ohne Nummernkreis, ohne Persistenz, ohne Journal
- Routen: `/app/angebote/[id]/pdf/vorschau`, `/app/rechnungen/[id]/pdf/vorschau`
- Original-PDF unverändert erst bei **Senden** (Angebot) bzw. **Festschreibung** (Rechnung); `/pdf` lehnt Entwürfe ab (409)
- Vorschau nach Senden/Festschreibung abgelehnt — nur noch das Original
- UX: Senden ≠ Mail. Druck/Post über PDF; E-Mail optional und sekundär
- Invarianten + Dateiname/Nummer-Helfer getestet

### M1-10 Dokumenten-Layout light
- PB-Migration `1730001200_dokument_layout.js`: Logo, Akzentfarbe, Kopf-/Fußtext an der Firma
- `/app/firma`: Upload/Entfernen Logo, Farbwähler, Textbausteine
- Gilt für neue Vorschau- und Original-PDFs; bestehende Originale bleiben unverändert (ADR-0012)

### M1-12 UI-Feinschliff light
- Primärfarbe etwas kräftiger; Markenstrich in der Sidebar; mehr Abstand auf Dokumentseiten; Toast mit Erfolgs-Akzent
- Kein CSS-Profi-Layout (Roadmap „Später“)

## Verifikation
- Unit-Tests + `tsc --noEmit` (Anzahl im Status)
- Browser/Compose: Rebuild + manuelle Klicks auf Vorschau, Senden/Festschreiben, Original, Firma-Layout

## Explizit nicht
- Briefpapier-Hintergrund, Font-Upload, Mehrvorlagen
- GiroCode
- M1-11 Nachtest Bank/E-Rechnung
- M2 / Open Decisions

## Next step
Nachtest M1-11 oder Meilenstein 2 (UStVA/ELSTER-XML light, ZM, USt-IdNr., E-Rechnungs-Versand).
