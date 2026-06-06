# Changelog

Alle nennenswerten Aenderungen an Homedash werden ab `v1.1.0` in dieser Datei dokumentiert.

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
