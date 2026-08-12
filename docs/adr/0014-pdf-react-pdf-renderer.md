# PDF-Erzeugung mit @react-pdf/renderer

Angebots-, Rechnungs- und Zahlungserinnerungs-PDFs werden mit **`@react-pdf/renderer`** erzeugt — nicht über HTML/Chromium (Playwright/Puppeteer) und nicht primär über low-level `pdf-lib`. GiroCode wird als QR-Grafik (z. B. `qrcode`) eingebettet. Begründung: schlankes Docker-Image ohne Browser-Runtime; ausreichend für Layout light; Chromium-Pipeline bleibt Ausweichoption, falls CSS-Layout später zwingend wird.
