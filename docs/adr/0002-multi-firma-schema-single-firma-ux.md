# Multi-Firma im Schema, eine Firma in der v1-UX

Alle firmenspezifischen Daten hängen von Anfang an an einer `Firma`-Grenze (Isolation im Datenmodell). Die erste nutzbare Version bietet nur den Betrieb einer Firma; Umschalten/Anlegen mehrerer Firmen kommt später. Begründung: Nachträgliches Multi-Tenancy in Buchhaltungsdaten ist teuer und fehleranfällig; die UX-Komplexität von Multi-Firma kann warten, die Zeilen- und Schlüsselstruktur nicht.
