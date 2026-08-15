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
| **Caddy** | Reverse Proxy + Security-Header light |
| **Docker Compose** | Caddy + Next + PocketBase, Volume `zettelruhe_pb_data` |

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
# Optional Prod: APP_URL=https://dein-host

docker compose up --build
```

App: [http://localhost](http://localhost) (Caddy Port `CADDY_HTTP_PORT`, default 80)  
Health: [http://localhost/health](http://localhost/health)

Beim ersten Start:

1. PocketBase wendet `pocketbase/pb_migrations` an und legt den Superuser an
2. Die leere Instanz zeigt den **Setup-Wizard** (Eigentümer:in, erste Firma, Steuer-Modus)
3. Danach Login/Logout über httpOnly Session-Cookie; weitere Firmen unter `/app/firma/neu`, Wechsel in der Shell

PocketBase-Admin (Betrieb/Schema, **nicht** App-Login): [http://localhost/_/](http://localhost/_/)  
In Produktion Admin-UI nicht öffentlich freigeben (Firewall/VPN).

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
app/                 Next.js (src/modules/*, src/lib/*)
pocketbase/          Dockerfile, pb_migrations/
Caddyfile
docker-compose.yml
.env.example
docs/                Roadmap, ADRs, Status, Betrieb, Verfahrensdoku
CONTEXT.md           Domain-Sprache
LICENSE              AGPL-3.0
```

## Dokumentation

| Datei | Zweck |
|-------|--------|
| [`CONTEXT.md`](./CONTEXT.md) | Glossary und Scope |
| [`docs/feature-roadmap.md`](./docs/feature-roadmap.md) | v1 / M2 / später |
| [`docs/betrieb.md`](./docs/betrieb.md) | Backup, Secrets, Health, Updates |
| [`docs/funktionstest-m1.md`](./docs/funktionstest-m1.md) | Manueller Funktionstest vor M2 |
| [`docs/verfahrensdokumentation.md`](./docs/verfahrensdokumentation.md) | GoBD-Vorlage |
| [`docs/adr/`](./docs/adr/) | Architekturentscheidungen |
| [`docs/90-status.md`](./docs/90-status.md) | Projektstand |

## Status

**v1 Meilenstein 1 (Bauabschnitte 1–14)** — fachlich und betrieblich hartbar abgeschlossen  
(Happy Path Solo-DE inkl. Reporting/Export, Backup/Security light, UX-Polish).  
Danach: **Kategorien** (Beleg + Kassenbuch), **Multi-Firma dünn** (anlegen + wechseln), **UStVA/ELSTER-XML light** (Self-File auf `/app/ust`, kein Versand), **ZM-Übersicht** (Self-File auf `/app/zm`, kein Versand; Browser-Nachtest 2026-08-15).  

Details: [`docs/90-status.md`](./docs/90-status.md).  
Nächster Keil (M2): USt-IdNr.-Validierung (BZSt).
