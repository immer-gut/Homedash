# Changelog

Alle nennenswerten Aenderungen an Homedash werden ab `v1.1.0` in dieser Datei dokumentiert.

## v1.13.0 - 2026-06-25

- AMP-Statusintegration nach `server/status/amp.js` verschoben.
- Damit liegen alle Status-Provider unter `server/status/`.
- `server.js` weiter auf Routing, Datenfluss, Wetter, Link-Metadaten und Admin/Auth reduziert.
- Standard-Image-Tag auf `v1.13.0` angehoben.

## v1.12.0 - 2026-06-25

- Home-Assistant-Statusintegration nach `server/status/home-assistant.js` verschoben.
- Generic-HTTP-Statusintegration nach `server/status/generic.js` verschoben.
- Unraid-Statusintegration nach `server/status/unraid.js` verschoben.
- `server.js` weiter auf Routing, Datenfluss, Wetter, Link-Metadaten und AMP reduziert.
- Standard-Image-Tag auf `v1.12.0` angehoben.

## v1.11.0 - 2026-06-25

- Gemeinsame HTTP-Helfer aus `server.js` nach `server/http.js` ausgelagert.
- Proxmox-VE-Statusintegration nach `server/status/proxmox.js` verschoben.
- Proxmox-Backup-Server-Statusintegration nach `server/status/proxmox-backup.js` verschoben.
- Keine geplante Aenderung an Status-API, UI oder gespeicherten Daten.
- Standard-Image-Tag auf `v1.11.0` angehoben.

## v1.10.1 - 2026-06-25

- Docker-Image korrigiert: das neue `server/`-Verzeichnis wird jetzt ins Image kopiert.
- Behebt Container-Restarts nach `v1.10.0`, weil `server/normalize.js` im Image fehlte.
- Standard-Image-Tag auf `v1.10.1` angehoben.

## v1.10.0 - 2026-06-25

- Server-Normalisierung in `server/normalize.js` ausgelagert.
- Default-Datenmodell zentralisiert, damit neue Datenfelder nicht mehr direkt in `server.js` verteilt werden.
- Vorbereitung fuer weitere Backend-Aufteilung ohne Aenderung an Status-Integrationen oder UI-Verhalten.
- Standard-Image-Tag auf `v1.10.0` angehoben.

## v1.9.0 - 2026-06-25

- Erste Frontend-Widget-Registry eingefuehrt.
- Rendering fuer Wetter, Statusuebersicht, Linkstatistik, Datums-Eintraege und Notizen vereinheitlicht.
- Widget-Einstellungen fuer Wetter, Statusuebersicht, Linkstatistik und Datums-Eintraege ueber eine gemeinsame Settings-Registry gebuendelt.
- Keine Aenderung an den Status-Integrationen selbst.
- Standard-Image-Tag auf `v1.9.0` angehoben.

## v1.8.3 - 2026-06-25

- Systemstatus-Widget wieder vollbreit dargestellt, wenn Datums-Eintraege darueber aktiv sind.
- Standard-Image-Tag auf `v1.8.3` angehoben.

## v1.8.2 - 2026-06-25

- Datums-Eintraege als vollbreite Leiste oberhalb der Systemstatus-Uebersicht platziert.
- Datums-Karten verteilen sich automatisch je nach Anzahl der Eintraege.
- Standard-Image-Tag auf `v1.8.2` angehoben.

## v1.8.1 - 2026-06-25

- Datums-Widget auf mehrere Datums-Eintraege erweitert.
- Datums-Eintraege werden jetzt oben links neben Wetter/Uhr angezeigt.
- Bestehende einzelne Datums-Konfiguration wird automatisch uebernommen.
- Standard-Image-Tag auf `v1.8.1` angehoben.

## v1.8.0 - 2026-06-25

- Neues Datums-Widget ergaenzt.
- Das Widget berechnet Tage bis zu einem zukuenftigen Datum oder Tage seit einem vergangenen Datum.
- Datums-Widget in den Einstellungen mit Titel und Datum konfigurierbar.
- Standard-Image-Tag auf `v1.8.0` angehoben.

## v1.7.5 - 2026-06-11

- Statusuebersicht zeigt jetzt alle Widget-Metriken an.
- Linkkarten bleiben weiterhin auf wenige Metriken begrenzt.
- Standard-Image-Tag auf `v1.7.5` angehoben.

## v1.7.4 - 2026-06-11

- Statusuebersicht groesser und lesbarer gestaltet.
- Proxmox-/PBS-Metriken nutzen groessere Chips mit mehr Platz und besserem Umbruch.
- Home-Assistant-Sensoren in der Statusuebersicht ebenfalls vergroessert.
- Standard-Image-Tag auf `v1.7.4` angehoben.

## v1.7.3 - 2026-06-11

- Textkontrast im Fallout-Theme deutlich erhoeht.
- Kontrast der gedimmten Texte in Dark-, Terminal- und Time-Circuit-Theme angehoben.
- Standard-Image-Tag auf `v1.7.3` angehoben.

## v1.7.2 - 2026-06-11

- Metrik-Chips in der Statusuebersicht umbrechen jetzt sauber und zentrieren ihren Text.
- Standard-Image-Tag auf `v1.7.2` angehoben.

## v1.7.1 - 2026-06-11

- Statusuebersicht nutzt jetzt dieselbe kompakte Panel-Darstellung wie Statusanzeigen in Linkkarten.
- Status-Widgets enthalten einen `Oeffnen`-Link zum jeweiligen System.
- Standard-Image-Tag auf `v1.7.1` angehoben.

## v1.7.0 - 2026-06-10

- Neues Theme `Fallout 4` ergaenzt.
- Standard-Image-Tag auf `v1.7.0` angehoben.

## v1.6.1 - 2026-06-09

- Tastenkombination `Ctrl+Alt+L` fuer passwortloses Admin-Entsperren ergaenzt.
- Standard-Image-Tag auf `v1.6.1` angehoben.

## v1.6.0 - 2026-06-09

- Anzeigenamen fuer Home-Assistant-Sensoren ergaenzt.
- HA-Sensoren koennen als `entity_id=Name` oder `entity_id|Name` gepflegt werden.
- Standard-Image-Tag auf `v1.6.0` angehoben.

## v1.5.0 - 2026-06-09

- Home-Assistant-Widget von Schalter-Buttons auf Sensorwert-Anzeige umgestellt.
- Konfigurierte HA-Entities zeigen jetzt aktuellen State inklusive Einheit, zum Beispiel Temperatur- oder Feuchtigkeitssensoren.
- Alte Home-Assistant-Toggle-API entfernt.
- Standard-Image-Tag auf `v1.5.0` angehoben.

## v1.4.1 - 2026-06-08

- CPU-Auslastung im Proxmox-VE-Widget ergaenzt.
- Standard-Image-Tag auf `v1.4.1` angehoben.

## v1.4.0 - 2026-06-08

- Links und Status-Widgets im Datenmodell und in der UI getrennt.
- Eigenen `+ Widget` Dialog fuer Service-, Proxmox-, Proxmox Backup Server-, Unraid-, AMP- und Home-Assistant-Widgets ergaenzt.
- Bestehende alte Link-Widgets werden automatisch in separate Status-Targets migriert.
- Widget-Secrets werden auch im neuen `statusTargets` Modell beim Speichern erhalten.
- Standard-Image-Tag auf `v1.4.0` angehoben.

## v1.3.1 - 2026-06-06

- Ausgeblendete Kategorien werden nicht mehr als leere Kategorien auf der Startseite angezeigt.
- Standard-Image-Tag auf `v1.3.1` angehoben.

## v1.3.0 - 2026-06-06

- Kategorie-Sichtbarkeit im Kategorien-Dialog ergaenzt.
- Ausgeblendete Kategorien bleiben gespeichert und koennen weiter Status-Widgets liefern, werden aber nicht mehr als Linkkarten auf der Startseite angezeigt.
- Standard-Image-Tag auf `v1.3.0` angehoben.

## v1.2.2 - 2026-06-06

- Versionsanzeige in der Weboberflaeche ergaenzt.
- App-Version wird serverseitig aus `package.json` gelesen und an das Frontend ausgeliefert.
- Standard-Image-Tag auf `v1.2.2` angehoben.

## v1.2.1 - 2026-06-06

- PBS Snapshot-Auswertung auf Root- und Unter-Namespaces erweitert.
- Letztes Backup beruecksichtigt jetzt Snapshots aus allen sichtbaren PBS-Namespaces.
- Standard-Image-Tag auf `v1.2.1` angehoben.

## v1.2.0 - 2026-06-06

- Proxmox Backup Server Widget um letzte Snapshots/Backups erweitert.
- PBS Task-Auswertung fuer laufende Jobs, fehlgeschlagene Tasks und Verify-Hinweise ergaenzt.
- PBS Linkkarten duerfen mehr Metriken anzeigen, damit neue Backup-/Fehlerwerte CPU/RAM nicht verdraengen.
- Standard-Image-Tag auf `v1.2.0` angehoben.

## v1.1.1 - 2026-06-05

- README-Portainer-Beispiel mit `docker-compose.yml` abgeglichen.
- Copy/Paste-Stack um `HOMEDASH_STATUS_TARGETS` und expliziten Volume-Namen ergaenzt.
- Standard-Image-Tag auf `v1.1.1` angehoben.

## v1.1.0 - 2026-06-05

- Proxmox Backup Server als eigener Status-Widget-Typ hinzugefuegt.
- Proxmox/PBS/Home-Assistant-Secrets bleiben beim Speichern erhalten, auch wenn der Browser zuvor redaktierte Daten geladen hat.
- Portainer-Standardport auf `3002` gesetzt, Container-Port bleibt `3000`.
- Projektname, Image-Pfade und Dokumentation auf Homedash umgestellt.
- Erste versionierte Release-Basis mit Git-Tag und GHCR-Tag `v1.1.0`.
