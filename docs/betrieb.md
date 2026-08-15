# Betrieb — Zettelruhe (self-hosted Solo)

Praxishinweise für eine Instanz mit **einer:m Eigentümer:in** und einer oder mehreren Firmen (Session wechselt die aktive Firma).  
Stack: Caddy + Next.js + PocketBase (SQLite), Named Volume `zettelruhe_pb_data` (ADR-0007).

---

## 1. Was gehört zum System

| Komponente | Inhalt | Persistenz |
|------------|--------|------------|
| **PocketBase** | Auth, Collections, Dateien (Belege, PDFs, E-Rechnungen) | Volume `zettelruhe_pb_data` → `/pb_data` |
| **Next.js** | UI, Domain-Logik, Session, Jobs, Exporte | Stateless (keine App-DB) |
| **Caddy** | Reverse Proxy Port 80 | Stateless |
| **`.env`** | Secrets und URLs | Host-Dateisystem (nicht im Volume) |

**Ein Backup des PB-Volumes sichert die Fachdaten.**  
`.env` und ggf. TLS-Zertifikate separat sichern (nicht im Volume).

---

## 2. Backup

### Was

1. **Pflicht:** Named Volume `zettelruhe_pb_data` (SQLite `data.db` + `storage/` Dateien)
2. **Empfohlen:** `.env` (ohne sie startet die App mit anderen Secrets → Sessions/Superuser inkonsistent)
3. **Optional:** Compose-/Caddy-Config, falls angepasst

### Wann

| Rhythmus | Empfehlung |
|----------|------------|
| Täglich | Automatisiert (cron / Backup-Tool des Hosts) |
| Vor Updates | Manuell vor `docker compose pull` / Image-Rebuild |
| Nach Importen | Nach großem CSV-/Bank-Import einmal extra |

Aufbewahrung: mindestens so lang wie steuerliche Aufbewahrungsfristen der Belege (lokal festlegen, siehe Verfahrensdokumentation).

### Wie (tar aus dem Volume)

Stack idealerweise **kurz stoppen** (konsistentes SQLite), oder Offline-Kopie des Volumes erzeugen:

```bash
# Optional: Stack stoppen für ruhige SQLite-Datei
docker compose stop next caddy
# PocketBase kann mitlaufen; sauberer: alles stoppen
docker compose stop

docker run --rm \
  -v zettelruhe_pb_data:/data:ro \
  -v "$(pwd)/backups":/backup \
  alpine \
  tar czf "/backup/pb_data-$(date +%Y%m%d-%H%M).tar.gz" -C /data .

docker compose start
```

Volume-Pfad prüfen:

```bash
docker volume inspect zettelruhe_pb_data
```

### Was nicht reicht

- Nur `data.db` ohne `storage/` → Belegdateien und PDFs fehlen
- Snapshot der Next-Container-Layer → enthält keine Fachdaten
- Git-Repo / `.env.example` → keine Produktivdaten

---

## 3. Restore

1. Stack stoppen: `docker compose down` (Volume **nicht** mit `-v` löschen, außer bewusst)
2. Volume leeren bzw. frisches Volume anlegen (nur wenn Restore ins leere Volume):

```bash
docker compose down
# Achtung: löscht alle aktuellen PB-Daten
docker volume rm zettelruhe_pb_data
docker volume create zettelruhe_pb_data

docker run --rm \
  -v zettelruhe_pb_data:/data \
  -v "$(pwd)/backups":/backup:ro \
  alpine \
  sh -c 'cd /data && tar xzf /backup/pb_data-YYYYMMDD-HHMM.tar.gz'
```

3. `.env` vom Backup-Zeitpunkt wiederherstellen (gleiche `SESSION_SECRET` / Superuser, sofern möglich)
4. `docker compose up -d`
5. Login prüfen; Stichprobe Beleg-PDF und Journal

**Test der Wiederherstellung** mindestens einmal pro Jahr (oder nach Host-Wechsel) dokumentieren.

---

## 4. Secrets & ENV

Siehe `.env.example`. **Niemals** Beispielwerte in Produktion belassen.

| Variable | Hinweis |
|----------|---------|
| `SESSION_SECRET` | ≥ 32 Zufallszeichen; Wechsel loggt alle Sessions aus |
| `PB_SUPERUSER_*` | Nur Betrieb/Schema (`/_/`), **nicht** App-Login |
| `APP_URL` | Öffentliche URL **ohne** trailing slash (`https://buchhaltung.example.de`) |
| `PB_URL` | In Compose: `http://pocketbase:8090` (intern) |
| `SMTP_*` | Optional; ohne Host läuft die App, Versand meldet de-DE-Hinweis |

Erzeugen z. B.:

```bash
openssl rand -base64 48   # SESSION_SECRET
```

`.env` liegt **nicht** im Git (`.gitignore`). Rechte am Host einschränken (`chmod 600 .env`).

---

## 5. Session & CSRF (light)

- App-Session: httpOnly-Cookie `zettelruhe_session`, Signatur HMAC (`SESSION_SECRET`), `SameSite=Lax`
- `Secure`-Flag nur wenn `APP_URL` mit `https://` beginnt
- TTL: 14 Tage (Idle-Logout light über JWT-Ablauf)
- Login/Setup: klassischer Form-POST auf Route-Handler (zuverlässig hinter Reverse-Proxy)
- Server Actions: Next prüft Origin; Host aus `APP_URL` muss zur erreichbaren URL passen (Build/Compose, siehe README)
- Finanz-Writes nur serverseitig über Next (ADR-0006) — nicht mit Client-PB-Rechten auf Journal/Belege

**Empfehlungen Self-hosted**

- Produktion hinter HTTPS (Caddy reverse_proxy + TLS am Host oder vorangestelltes TLS)
- PocketBase-Admin `/_/` nicht öffentlich im Internet freigeben (Firewall / VPN / IP-Allowlist)
- Starke Passwörter für Eigentümer:in und Superuser

---

## 6. Healthcheck

| Endpoint | Zweck |
|----------|--------|
| `GET /health` (Next, über Caddy) | Liveness der App; optional PB-Erreichbarkeit |
| PocketBase `GET /api/health` | Intern im Compose-Healthcheck |

```bash
curl -sS http://localhost/health
# {"ok":true,"service":"zettelruhe",...}
```

Compose: Services `next` und `pocketbase` haben Healthchecks (siehe `docker-compose.yml`).

---

## 7. Updates

1. Backup Volume + `.env`
2. `git pull` (oder Image-Tags anpassen)
3. `docker compose build --pull && docker compose up -d`
4. Migrationen laufen beim PB-Start (`pb_migrations`)
5. Smoke: Login, Übersicht, eine Liste, Export-Download

---

## 8. Jobs & SMTP

- In-Process-Scheduler im Next-Container (ADR-0010)
- Abschalten: `JOBS_DISABLED=true`
- Intervall: `JOB_TICK_INTERVAL_MS` (min. 60000)
- SMTP optional; ohne Konfiguration bleiben Mail-Buttons mit de-DE-Hinweis

---

## 9. GoBD / Exporte (Verweis)

- Festschreibung, Journal, Verfahrensdoku: [`verfahrensdokumentation.md`](./verfahrensdokumentation.md)
- DATEV light / Journal-CSV / Belegarchiv: UI **Export** (`/app/export`)
- Keine GoBD- oder DATEV-Zertifizierung (ADR-0004)

## 10. Funktionstest vor M2

Manuelle Checkliste (Happy Path + Backup/Restore): [`funktionstest-m1.md`](./funktionstest-m1.md).

---

_Stand: Bauabschnitt 14 (Härten)._
