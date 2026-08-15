# Zettelruhe

Self-hosted Open-Source-Buchhaltung für Solo-Selbstständige in Deutschland  
Website: [zettelruhe.de](https://zettelruhe.de)

Papierkram-Alternative mit 80%-Fokus (EÜR, DE; eine Eigentümer:in, mehrere Firmen in einer Instanz).

Lizenz: [AGPL-3.0](./LICENSE)

## Stack (v1)

| Komponente | Rolle |
|------------|--------|
| **Next.js 16** (App Router, Server Actions) | UI + Domain + Session-Gate |
| **PocketBase** (SQLite) | Auth-Quelle, Daten, Dateien |
| **Caddy** | Reverse Proxy + Security-Header light (lokal im Compose; Server nativ auf dem Host, ADR-0023) |
| **Docker Compose** | Caddy + Next + PocketBase lokal; auf dem Server Next + PocketBase hinter Host-Caddy, Volume `zettelruhe_pb_data` |

Finanz-Writes laufen nur über Next (nicht per Client-PB-SDK). Details: `docs/adr/`.  
Betrieb (Backup, Secrets, Health): [`docs/betrieb.md`](./docs/betrieb.md).

## Schnellstart

### Voraussetzungen

- Docker + Docker Compose
- Kopie von `.env.example` → `.env` mit **echten** Secrets (keine `change-me`-Werte in Produktion)

```bash
cp .env.example .env
# Pflicht setzen:
#   SESSION_SECRET  → openssl rand -base64 48  (≥ 32 Zeichen)
#   PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD  → starke, einzigartige Werte
# Server: APP_URL=https://app.zettelruhe.de  (ADR-0023)

docker compose up --build
```

App: [http://localhost](http://localhost) (Caddy Port `CADDY_HTTP_PORT`, default 80)  
Health: [http://localhost/health](http://localhost/health)

**Server** (Host-Caddy, Let’s Encrypt, `app.zettelruhe.de`): Site-Block [`deploy/Caddyfile.host`](./deploy/Caddyfile.host), Stack mit Overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

Details: [`docs/betrieb.md`](./docs/betrieb.md) Abschnitt 5, ADR-0023.

Beim ersten Start:

1. PocketBase wendet `pocketbase/pb_migrations` an und legt den Superuser an
2. Die leere Instanz zeigt den **Setup-Wizard** (Eigentümer:in, erste Firma, Steuer-Modus)
3. Danach Login/Logout über httpOnly Session-Cookie; weitere Firmen unter `/app/firma/neu`, Wechsel in der Shell

PocketBase-Admin (Betrieb/Schema, **nicht** App-Login): [http://localhost/_/](http://localhost/_/)  
Auf `app.zettelruhe.de` bewusst über denselben Host (`/_/`). Superuser stark halten.

### Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|----------|---------|--------------|
| `APP_URL` | ja | Öffentliche URL der App (ohne `/` am Ende); `https://` → Secure-Cookie |
| `PB_URL` | ja | PocketBase aus Sicht von Next (`http://pocketbase:8090` in Compose) |
| `PB_SUPERUSER_EMAIL` | ja | PB-Superuser (nur Betrieb) |
| `PB_SUPERUSER_PASSWORD` | ja | PB-Superuser-Passwort |
| `SESSION_SECRET` | ja | Signatur Session-Cookie (≥ 32 Zeichen Zufall) |
| `SMTP_*` | nein | Optional; E-Mail Angebot/Rechnung/Zahlungserinnerung |
| `JOB_TICK_INTERVAL_MS` | nein | Optional; Intervall In-Process-Jobs (Default 15 min) |
| `JOBS_DISABLED` | nein | Optional; `true` schaltet Scheduler ab |

Siehe [`.env.example`](./.env.example) und [`docs/betrieb.md`](./docs/betrieb.md).

### Entwicklung ohne Compose (optional)

```bash
# PocketBase lokal (Binary + Migrationen), dann:
cd app
cp ../.env.example .env.local
# PB_URL=http://127.0.0.1:8090 und Secrets anpassen
npm install
npm run dev
```

### Tests

```bash
cd app
npm test
```

## Backup & Restore

**Ein Volume trägt die Fachdaten:** `zettelruhe_pb_data` (SQLite + Dateien).  
`.env` separat sichern. Ausführlich: [`docs/betrieb.md`](./docs/betrieb.md).

```bash
docker compose stop

docker run --rm \
  -v zettelruhe_pb_data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf "/backup/pb_data-$(date +%Y%m%d-%H%M).tar.gz" -C /data .

docker compose start
```

Wiederherstellung: Stack stoppen, Archiv ins Volume entpacken, `.env` abstimmen, `docker compose up -d`. Restore einmal testen und dokumentieren.

## Sicherheit (light)

- Secrets nur in `.env` / Host-Secret — nicht committen, keine Defaults in Produktion
- Session: httpOnly, `SameSite=Lax`, HMAC; Secure nur bei HTTPS-`APP_URL`
- CSRF light: Origin-Prüfung der Server Actions; Login per Form-POST
- Caddy setzt u. a. `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Finanzaggregate: Writes nur Next-Server (ADR-0006)

Details und Empfehlungen: [`docs/betrieb.md`](./docs/betrieb.md).

## Repo-Layout

```
app/                      Next.js (src/modules/*, src/lib/*)
pocketbase/               Dockerfile, pb_migrations/
Caddyfile                 lokal (HTTP :80)
docker-compose.yml
docker-compose.server.yml Server-Overlay (kein Compose-Caddy)
deploy/Caddyfile.host     Host-Caddy + TLS
.env.example
docs/                     Roadmap, ADRs, Status, Betrieb, Verfahrensdoku
CONTEXT.md                Domain-Sprache
LICENSE                   AGPL-3.0
```

## Dokumentation

| Datei | Zweck |
|-------|--------|
| [`CONTEXT.md`](./CONTEXT.md) | Glossary und Scope |
| [`docs/feature-roadmap.md`](./docs/feature-roadmap.md) | v1 / M2 / später |
| [`docs/betrieb.md`](./docs/betrieb.md) | Backup, Secrets, Health, Updates |
| [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md) | Manueller Funktionstest Meilenstein 1 |
| [`docs/funktionstest-m2.md`](./docs/funktionstest-m2.md) | Manueller Funktionstest Meilenstein 2 (M2-Keile) |
| [`docs/verfahrensdokumentation.md`](./docs/verfahrensdokumentation.md) | GoBD-Vorlage |
| [`docs/adr/`](./docs/adr/) | Architekturentscheidungen |
| [`docs/90-status.md`](./docs/90-status.md) | Projektstand |

## Status

**v1 Meilenstein 1 (Bauabschnitte 1–14)** — fachlich und betrieblich hartbar abgeschlossen  
(Happy Path Solo-DE inkl. Reporting/Export, Backup/Security light, UX-Polish).  
Funktionstest: [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md) — bestanden mit Mängeln.

**Meilenstein 2 (Steuer & Compliance)** — Keile gebaut:

| Keil | Ort | Hinweis |
|------|-----|---------|
| Kategorien | `/app/kategorien` | gemeinsame Liste Beleg + Kassenbuch |
| Multi-Firma dünn | Shell + `/app/firma/neu` | eine Eigentümer:in, Session wechselt |
| UStVA / ELSTER-XML light | `/app/ust` | Self-File, kein Versand |
| ZM-Übersicht | `/app/zm` | Self-File, kein Versand |
| USt-IdNr.-Prüfung (BZSt) | Firma + Kontakt | Schnappschuss, kein Dauer-Stempel |
| E-Rechnungs-Versand | festgeschriebene Rechnung | XRechnung-UBL / ZUGFeRD-CII als XML, kein Hybrid-PDF |

Browser-Nachtest Versand durch kf (2026-08-15): keine Fehler. Die BZSt-Klick-Prüfung braucht ausgehenden HTTPS-Zugang zum eVatR und steht zusammen mit dem **Server-Nachtest M2** aus.

Manuelle Checkliste: [`docs/funktionstest-m2.md`](./docs/funktionstest-m2.md) (M1 bleibt [`funktionstest-m1.md`](./docs/funktionstest-m1.md)).

**Als Nächstes:** Host-Caddy auf dem Server aktivieren (`app.zettelruhe.de`, Overlay + `deploy/Caddyfile.host`), dann **Server-Nachtest** inkl. BZSt-Klick ([`funktionstest-m2.md`](./docs/funktionstest-m2.md) Abschnitt 8). Follow-ups ohne diese Prio: Setup-`verified`, Dokumenten-Layout, Logo/Favicon.

Details: [`docs/90-status.md`](./docs/90-status.md).
