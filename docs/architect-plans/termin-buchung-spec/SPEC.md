# SPEC — Termin-Buchung für eine kleine Praxis

Version 1.0 · Auftraggeber: Praxis Dr. Meier

## Ziel
Patientinnen und Patienten buchen online einen freien Termin. Die Praxis pflegt Öffnungszeiten und sieht ihre Termine.
Node.js ohne Framework (http-Modul), Daten in einer JSON-Datei, eine schlichte Weboberfläche (HTML/CSS/JS ohne Build).

## Verträge
- HTTP-API unter `/api`: `GET /api/slots?date=YYYY-MM-DD`, `POST /api/bookings` {slotId, name, email}, `DELETE /api/bookings/:id?token=…`,
  `GET /api/admin/bookings?date=…` (Header `x-admin-key`), `PUT /api/admin/hours` (Öffnungszeiten).
- Speicher: `data/store.json`, Zugriff nur über das Modul `src/store.js` (load, save, transaction).
- Weboberfläche: `public/index.html` (Buchen), `public/admin.html` (Praxis). E-Mails werden nur in `data/outbox.json` geschrieben.

## Anforderungen nach Feature
### F1 Server und Speicher
| B-01 | Server antwortet auf /health mit 200 | B-02 | store.json wird atomar geschrieben (tmp + rename) |
### F2 Öffnungszeiten und freie Slots
| B-03 | Slots im 20-Minuten-Raster aus den Öffnungszeiten | B-04 | belegte Slots sind nicht frei | B-05 | Feiertage aus data/holidays.json sind geschlossen |
### F3 Buchen
| B-06 | POST bucht, doppelte Buchung desselben Slots → 409 | B-07 | Pflichtfelder geprüft, E-Mail-Format | B-08 | Bestätigung landet in outbox.json mit Storno-Link |
### F4 Stornieren
| B-09 | DELETE mit gültigem Token storniert, Slot wird wieder frei | B-10 | falsches Token → 403 |
### F5 Praxis-Ansicht
| B-11 | admin/bookings nur mit x-admin-key | B-12 | Öffnungszeiten änderbar, bestehende Buchungen bleiben |
### F6 Buchungsseite
| B-13 | public/index.html zeigt freie Slots eines Tages und bucht per Formular | B-14 | Fehlermeldungen der API werden lesbar angezeigt |
### F7 Praxisseite
| B-15 | public/admin.html listet Termine eines Tages, Öffnungszeiten editierbar |
### F8 Erinnerungen
| B-16 | ein Befehl `node src/remind.js` schreibt Erinnerungen für Termine von morgen in outbox.json |
