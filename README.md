# Homedash Startpage

Homedash ist eine kleine, Docker-freundliche Startseite fuer das Heimnetz. Links, Kategorien, Seitentitel und Untertitel werden direkt im Browser gepflegt und dauerhaft in einem Docker-Volume gespeichert.

Aktuelle Version: `v1.16.2`

## Funktionen

- Browserbasierte Pflege von Links, Kategorien, Profilen, Notizen, Titel und Untertitel
- Kategorie-Farben und Sichtbarkeit fuer bessere Gruppierung
- Einklappbare Suche ueber Linktitel, Kategorie und Notiz, auch per `Cmd+K`/`Ctrl+K`
- Automatisch gruppierte Kategorien mit alphabetischer Sortierung
- JSON-Backup/Restore in der UI
- Import von Browser-Bookmarks als HTML-Datei
- Automatischer Favicon-Abruf mit lokalem Cache
- Optionale Link-Statusanzeigen fuer Proxmox VE, Proxmox Backup Server, Home Assistant, Unraid, AMP und einfache HTTP-Dienste
- Themes: Retro, Time Circuit, Fallout 4, Dark, Light und Terminal
- Startseiten- und Freigabe-Modus fuer normale Read-only Nutzung
- Widget-Galerie fuer Wetter, Notizen, Statusuebersicht und Linkstatistik

## Erster Start

Voraussetzungen:

- Docker mit Docker Compose
- Ein freier Host-Port, standardmaessig `3002`

Start lokal:

```bash
cp .env.example .env
docker compose up -d
```

Danach ist Homedash unter `http://localhost:3002` erreichbar. Im Heimnetz nutzt du die IP des Docker-Hosts, zum Beispiel:

```text
http://<server-ip>:3002/
```

Beim ersten Start erscheint ein Setup-Dialog. Dort legst du Seitentitel, erstes Profil und ein Admin-Passwort fest.

## Portainer Deploy

In Portainer kannst du Homedash als Git-Stack deployen.

- Repository URL: `https://github.com/immer-gut/Homedash.git`
- Branch: `main`
- Compose path: `docker-compose.yml`

Empfohlene Stack-Variablen:

```text
HOMEDASH_IMAGE=ghcr.io/immer-gut/homedash:v1.16.2
HOMEDASH_PORT=3002
HOMEDASH_INTERNAL_PORT=3000
HOMEDASH_VOLUME_NAME=homedash_data
```

Portainer/Docker Compose vergibt den Container-Namen automatisch mit dem Stack-Namen als Prefix. Das Daten-Volume ist standardmaessig `homedash_data`. Fuer parallele Testinstallationen setze `HOMEDASH_VOLUME_NAME` auf einen eigenen Wert, zum Beispiel `homedash_test_data`.

Testhinweise fuer Portainer:

- Fuer Tests einen eigenen externen Port und ein eigenes Volume verwenden, zum Beispiel `HOMEDASH_PORT=3003` und `HOMEDASH_VOLUME_NAME=homedash_test_data`.
- Vor Restore-Tests ein Backup ueber die UI oder das Docker-Volume erstellen.
- Nach Deploy oder Update `http://<server-ip>:<port>/api/health` pruefen und die Startseite im Browser neu laden.
- Wenn das Image auf `latest` steht, in Portainer vor dem Test ein Pull/Redeploy ausfuehren. Fuer stabile Deployments ist ein Versions-Tag wie `v1.16.2` besser, ja, erstaunlicherweise hilft Versionierung beim Versionieren.

Alternativ kannst du in Portainer einen Stack direkt mit dem Image anlegen:

```yaml
services:
  homedash:
    image: ghcr.io/immer-gut/homedash:v1.16.2
    restart: unless-stopped
    ports:
      - "3002:3000"
    environment:
      PORT: 3000
      HOST: 0.0.0.0
      DATA_DIR: /data
      ADMIN_PASSWORD:
      HOMEDASH_STATUS_TARGETS: "[]"
    volumes:
      - homedash_data:/data

volumes:
  homedash_data:
    name: homedash_data
```

Wenn Port `3002` auf dem Host schon belegt ist, aendere nur den externen Port:

```text
HOMEDASH_PORT=3003
```

Die App bleibt im Container auf `3000`, ist aber extern unter `http://<server-ip>:3003/` erreichbar.

## Environment Variablen

Die Compose-Datei verwendet `HOMEDASH_*` Variablen fuer Deployment-Details und setzt daraus die Container-Umgebung.

| Variable | Standard | Beschreibung |
| --- | --- | --- |
| `HOMEDASH_IMAGE` | `ghcr.io/immer-gut/homedash:v1.16.2` | Docker Image fuer den Stack. Fuer einfache Tests kann `latest` genutzt werden, fuer Portainer besser einen Versions-Tag setzen. |
| `HOMEDASH_PORT` | `3002` | Externer Host-Port. |
| `HOMEDASH_INTERNAL_PORT` | `3000` | Interner Container-Port und Wert fuer `PORT`. Normalerweise unveraendert lassen. |
| `HOMEDASH_VOLUME_NAME` | `homedash_data` | Docker-Volume fuer Daten und Favicons. Fuer mehrere Stacks jeweils einen eigenen Namen setzen. |
| `ADMIN_PASSWORD` | leer | Optionales Admin-Passwort. Alternativ kann das Passwort beim ersten Start im Setup gesetzt werden. |
| `HOMEDASH_STATUS_TARGETS` | `[]` | Optionales JSON fuer Link-Statusanzeigen. Secrets bleiben in der Container-Umgebung. |

Container-interne Variablen:

- `PORT`: Wird von `HOMEDASH_INTERNAL_PORT` gesetzt.
- `HOST`: Wird im Container auf `0.0.0.0` gesetzt.
- `DATA_DIR`: Wird im Container auf `/data` gesetzt.

## Docker Image

Das Image wird per GitHub Actions automatisch gebaut und in GitHub Container Registry veroeffentlicht:

```text
ghcr.io/immer-gut/homedash:v1.16.2
```

Bei Pushes auf `main` wird `latest` aktualisiert. Git-Tags im Format `vX.Y.Z`, zum Beispiel `v1.1.1`, erzeugen zusaetzliche versionierte Image-Tags. Pull Requests werden nur gebaut, aber nicht gepusht.

## Versionierung

Homedash nutzt ab `v1.1.0` semantische Versionierung:

- Patch-Versionen wie `v1.1.1`: Fehlerkorrekturen ohne neue Bedienung.
- Minor-Versionen wie `v1.2.0`: neue Widgets, neue Integrationen oder sichtbare Funktionen.
- Major-Versionen wie `v2.0.0`: inkompatible Aenderungen an Datenformat, API oder Deployment.

Fuer Portainer wird ein gepinnter Image-Tag empfohlen:

```text
ghcr.io/immer-gut/homedash:v1.16.2
```

`latest` bleibt verfuegbar, ist aber beweglich. Praktisch fuer Tests, weniger praktisch, wenn man spaeter wissen will, was eigentlich laeuft. Verrueckte Idee, ich weiss.

Fuer lokale Entwicklung mit Build aus dem Repository:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

## Projektstruktur

- `server.js` bleibt Einstiegspunkt fuer HTTP-Routing, API-Endpunkte und externe Status-Integrationen.
- `server/auth.js` enthaelt Admin-Login, Sessions, Cookies, Passwort-Hashing und Public-Data-Redaction.
- `server/data-store.js` enthaelt Datei-Erstellung, Migration, Lesen/Schreiben und Secret-Erhalt.
- `server/normalize.js` enthaelt Default-Daten, Migration und Normalisierung des gespeicherten Datenmodells.
- `server/http.js` buendelt wiederverwendbare HTTP-Requests fuer Metadaten, Wetter und Status-Integrationen.
- `server/link-metadata.js` enthaelt Seitentitel- und Favicon-Erkennung fuer Links.
- `server/weather.js` enthaelt Wetterabruf und Wetterformatierung.
- `server/status/` enthaelt ausgelagerte Status-Provider fuer Proxmox VE, Proxmox Backup Server, Home Assistant, Generic HTTP, Unraid und AMP.
- `public/app.js` rendert die Browser-Oberflaeche; normale Frontend-Widgets werden ueber die Widget-Registry eingetragen.
- Neue Datenfelder zuerst in `server/normalize.js` absichern und danach in der UI nutzen. Das ist weniger dramatisch als spontane Datenarchaeologie in drei Monaten.

## Profile

Profile werden direkt im Browser verwaltet. Jedes Profil hat eigene Kategorien und Links, teilt sich aber Titel, Theme, Widgets und Favicon-Cache mit der Homedash-Instanz.

- `+ Profil` erstellt ein neues Profil.
- `Profil loeschen` entfernt das aktive Profil, solange mindestens ein weiteres Profil existiert.
- Das Profil-Dropdown wechselt zwischen Profilen.
- `Demo-Profil` in den Einstellungen erstellt ein anonymes Beispielprofil fuer Tests oder Screenshots.

## Admin-Modus

Homedash startet im Startseiten-Modus: Links und Widgets sind sichtbar, Bearbeitung bleibt verborgen. Wenn ein Admin-Passwort gesetzt ist, sind Bearbeiten, Import, Backup/Restore und Profilverwaltung gesperrt. Ueber `Admin gesperrt` kannst du entsperren. Ueber `Admin offen` sperrst du die Bearbeitung wieder.

Mit `Ctrl+Alt+L` kann der Admin-Modus ohne Passwort entsperrt oder wieder gesperrt werden. Das ist bequem fuer lokale Dashboards, aber natuerlich kein Hochsicherheitstresor. Wer Homedash in ein offenes Netz stellt und dann ueberraschend Ueberraschungen bekommt, hat zumindest konsistent gehandelt.

Der Freigabe-Modus blendet im gesperrten Zustand den Admin-Hinweis aus. Das ist fuer Familien-, Werkstatt- oder Tablet-Ansichten gedacht, bei denen Homedash wie eine ruhige Startseite wirken soll.

Das Passwort kann entweder per `ADMIN_PASSWORD` als Environment-Variable gesetzt werden oder beim ersten Start im Setup. Das Setup-Passwort wird gehasht in `homedash.json` gespeichert.

## Themes

Das Theme-Dropdown wechselt zwischen `Retro`, `Time Circuit`, `Fallout 4`, `Dark`, `Light` und `Terminal`. Die Auswahl wird in `homedash.json` gespeichert.

## Import, Backup und Restore

Backup:

- Im Browser unter `Einstellungen` ein Backup herunterladen.
- Alternativ `http://<server-ip>:<port>/api/homedash/export` aufrufen.
- Die Datei wird als `homedash.json` heruntergeladen.

Restore:

- Im Browser unter `Einstellungen` ein Restore starten.
- JSON-Datei auswaehlen oder JSON direkt einfuegen.
- `Importieren` ersetzt die aktuelle Konfiguration.

Browser-Bookmarks:

- HTML-Export aus dem Browser waehlen, zum Beispiel `bookmarks.html`.
- Homedash liest Ordner als Kategorien und Lesezeichen als Links ein.
- Pruefe nach dem Import Kategorien, Dubletten und fehlende URLs.

Die Datei liegt im Container unter:

```text
/data/homedash.json
```

Beim Schreiben normalisiert Homedash Daten wie fehlende IDs, Kategorien und URLs. Gueltige URLs duerfen mit `http://`, `https://`, `mailto:` oder `tel:` beginnen.

## Backups

Wichtige Daten liegen im Docker-Volume:

- `homedash.json`: Startseiten-Konfiguration
- `favicons/`: Lokaler Favicon-Cache

Ein einfaches Backup ist der UI-Backup-Download im Browser. Fuer ein vollstaendiges Volume-Backup sichere das Docker-Volume aus `HOMEDASH_VOLUME_NAME`, standardmaessig `homedash_data`.

Beispiel mit einem temporaeren Alpine-Container:

```bash
docker run --rm \
  -v homedash_data:/data:ro \
  -v "$PWD":/backup \
  alpine tar czf /backup/homedash_data.tar.gz -C /data .
```

Restore:

```bash
docker compose down
docker run --rm \
  -v homedash_data:/data \
  -v "$PWD":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/homedash_data.tar.gz -C /data"
docker compose up -d
```

Pruefe vor dem Restore, dass der Volume-Name zum Zielsystem passt.

## Favicon Cache

Favicons werden automatisch ueber `/api/favicon?url=...` geladen und unter `/data/favicons/` gecacht. Der Browser darf Favicons bis zu sieben Tage cachen.

Wenn ein Icon falsch oder veraltet ist:

1. Container stoppen.
2. Den Ordner `favicons/` im Daten-Volume loeschen oder einzelne Cache-Dateien entfernen.
3. Container starten.
4. Browser-Cache hart aktualisieren, falls das alte Icon weiterhin angezeigt wird.

Wenn kein Icon geladen werden kann, zeigt Homedash ein eingebautes Fallback-Icon.

## Widgets

Diese Version enthaelt diese Widgets:

- Uhrzeit
- Wetter per Open-Meteo ohne API-Key
- Datums-Widget fuer mehrere Tage bis zu einem Datum oder Tage seit einem Datum
- Mehrere Notizen
- Optionale Linkstatistik
- Optionale Statusuebersicht
- Status-Widgets mit eigener Verwaltung, unabhaengig von Linkkarten

Frontend-Widgets werden intern ueber eine gemeinsame Widget-Registry gerendert und in den Einstellungen gebuendelt. Neue normale Widgets sollen dort eingetragen werden, statt eigene Sonderwege in `renderWidgets()` und `saveSettings()` zu bauen. Ja, Ordnung, dieses wilde Konzept.

## Einstellungen

Im Browser-Menue `Einstellungen` kannst du Titel und Untertitel pflegen und Anzeigeoptionen umschalten:

- Kategorie-Zahlen anzeigen
- Freigabe-Modus aktivieren
- Uebersicht-Widget anzeigen
- Status-Widget anzeigen
- Wetter-Widget anzeigen
- Datums-Widget anzeigen
- Status an Linkkarten anzeigen
- Notizenbereich anzeigen
- Links in neuem Tab oeffnen

Kategorien koennen im Kategorien-Dialog neben dem Namen auch eine Farbe bekommen. Die fruehere Icon-Auswahl ist entfernt; fehlende oder alte Ordner-Werte werden intern als Link-Icon behandelt.

Kategorien koennen im Kategorien-Dialog auch ausgeblendet werden. Die Links bleiben gespeichert, werden aber nicht mehr als normale Linkkarten oder leere Kategorien auf der Startseite angezeigt.

Das Wetter-Widget nutzt Open-Meteo. Dafuer brauchst du nur einen Anzeigenamen sowie Breiten- und Laengengrad des Standorts.

Das Datums-Widget nutzt mehrere Eintraege mit Titel und Datum im Format `YYYY-MM-DD`. Liegt ein Datum in der Zukunft, zeigt Homedash die Tage bis dahin. Liegt es in der Vergangenheit, zeigt Homedash die Tage seitdem. Liegt es auf heute, steht da ausnahmsweise mal etwas Beruhigendes: `Heute`. Die Datums-Karten erscheinen als vollbreite Leiste oberhalb der Systemstatus-Uebersicht und verteilen sich automatisch je nach Anzahl der Eintraege.

## Status Widgets

Statusanzeigen werden unabhaengig von Links gepflegt:

- Oben `+ Widget` waehlen
- Namen, Typ und Status-URL eintragen
- Die passenden Zugangsdaten eintragen
- Speichern

Die Status-URL wird in der Statusuebersicht auch als `Oeffnen`-Link zum jeweiligen System genutzt. Wenn du also Homedash selbst als Widget/Link fuehrst, waere das zum Beispiel `http://192.168.188.120:3002/`.

Bestehende Installationen mit alten Link-Widgets werden automatisch migriert. Links bleiben danach normale Links, die Widget-Konfiguration liegt separat im Profil. Ja, weniger doppelte Eintraege; manchmal gewinnt die Vernunft knapp.

Proxmox mit API-Token:

- Widget: `Proxmox`
- Token-ID: zum Beispiel `root@pam!homedash`
- Token-Secret: dein Proxmox API-Token

Ohne Proxmox-Token prueft Homedash nur die API-Erreichbarkeit. Mit Token zeigt es zusaetzlich Nodes, laufende VM/CT, offene Updates, CPU-Auslastung und RAM-Nutzung an. Die genaue APT-Update-Liste braucht in Proxmox `Sys.Modify`; falls dein Token nur `Sys.Audit` hat, nutzt Homedash automatisch die Proxmox-Paketversionen als lesbaren Fallback und zeigt die Zahl mit `+`, zum Beispiel `4+`. Unraid nutzt einen API-Key fuer `/graphql`; AMP nutzt Benutzername und Passwort fuer `Core/Login` und `Core/GetStatus`.

Proxmox Backup Server mit API-Token:

- Widget: `Proxmox Backup Server`
- Status-URL: deine PBS-URL, zum Beispiel `https://<pbs-ip>:8007`
- Token-ID: zum Beispiel `root@pam!homedash`
- Token-Secret: dein PBS API-Token

PBS nutzt einen eigenen Authorization-Header (`PBSAPIToken=TOKENID:TOKENSECRET`). Mit Token zeigt Homedash Version, Datastores, Speicherbelegung, CPU/RAM, letztes Backup, Task-Fehler, laufende Jobs und Verify-Hinweise an. Snapshots werden ueber Root- und Unter-Namespaces gelesen. Fuer Datastore-, Namespace-, Snapshot- und Task-Metriken braucht der Token passende PBS-Rechte, typischerweise Audit-/Read-Rechte auf den Datastore- und Systempfaden.

Home Assistant:

- Widget: `Home Assistant`
- Status-URL: deine Home-Assistant-URL, zum Beispiel `http://homeassistant.local:8123`
- API-Key / Long-Lived Token: in Home Assistant unter Profil -> Sicherheit -> Long-Lived Access Tokens erstellen
- HA Sensoren: Entity-IDs fuer angezeigte Werte, zum Beispiel `sensor.wohnzimmer_temperatur, sensor.luftfeuchte`
- Optionaler Anzeigename: `sensor.wohnzimmer_temperatur=Wohnzimmer` oder `sensor.wohnzimmer_temperatur|Wohnzimmer`

Homedash liest damit `/api/`, `/api/config` und `/api/states` und zeigt Version, Entities sowie deine konfigurierten Sensorwerte inklusive Einheit an. Genau, Temperatur darf jetzt Temperatur sein und muss nicht mehr als Lichtschalter verkleidet werden.

Die Suche auf der Startseite kann ausserdem direkt Google oeffnen: Suchbegriff eingeben und `Enter` druecken. In der Befehlspalette (`Cmd/Ctrl + K`) erscheint bei Suchtext ebenfalls ein Google-Treffer.

Status-Zugangsdaten werden in `homedash.json` unter `statusTargets` gespeichert und sind damit auch im JSON-Export enthalten. Wenn du Secrets lieber ausschliesslich als Container-Environment halten willst, funktioniert `HOMEDASH_STATUS_TARGETS` weiterhin als Fallback:

```text
HOMEDASH_STATUS_TARGETS=[{"type":"proxmox","name":"Proxmox","url":"https://<proxmox-ip>:8006","tokenId":"root@pam!homedash","tokenSecret":"dein-token-secret"},{"type":"proxmoxbackup","name":"PBS","url":"https://<pbs-ip>:8007","tokenId":"root@pam!homedash","tokenSecret":"dein-token-secret"}]
```

Beim gesperrten Admin-Modus liefert Homedash gespeicherte Tokens/API-Keys nicht an den Browser aus. Beim Speichern bleiben vorhandene Secrets serverseitig erhalten, solange Widget-ID und Widget-Typ gleich bleiben.

## Updates

Lokales Update:

```bash
git pull
docker compose pull
docker compose up -d
```

Portainer Update:

1. Stack oeffnen.
2. Bei gepinnten Versionen `HOMEDASH_IMAGE` auf den neuen Tag setzen, zum Beispiel `ghcr.io/immer-gut/homedash:v1.16.2`.
3. `Pull image/redeploy` oder `Update the stack` ausfuehren.
4. Bei Git-Stacks sicherstellen, dass Branch `main` und Compose path `docker-compose.yml` weiterhin stimmen.

Das Daten-Volume bleibt bei normalen Updates erhalten. Loesche das Volume nur, wenn du bewusst alle Homedash-Daten entfernen willst.

Nach dem Update:

- `http://<server-ip>:<port>/api/health` sollte `{"ok":true}` liefern.
- Startseite im Browser neu laden.
- Backup und Restore testen, wenn Datenmigrationen erwartet werden.

## Bedienung im Browser

- `+ Link` legt neue Links an.
- `+ Widget` legt Status-Widgets an, ohne dafuer einen Link zu erzeugen.
- `...` an einem Link bearbeitet oder loescht ihn.
- `+ Profil` erstellt ein weiteres Profil.
- `Demo-Profil` erstellt Testdaten ohne private Links oder Zugangsdaten.
- `Cmd+K` oder `Ctrl+K` oeffnet die schnelle Suche.
- `Ctrl+Alt+L` entsperrt oder sperrt den Admin-Modus ohne Passwort.
- `Einstellungen` aendert Titel, Untertitel, Anzeigeoptionen, Widget-Galerie, Kategorien, Import, Backup und Restore.

Kategorien und Links werden alphabetisch angezeigt. Linkkarten zeigen Titel, Favicon und optionale Notiz; die URL bleibt als Klickziel hinterlegt, wird aber nicht extra angezeigt.
