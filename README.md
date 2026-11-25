# Wetter-Widget

Mittleres Home-Bildschirm-Widget für die iOS-App [Scripting](https://apps.apple.com/app/id6479691128).
Es zeigt Wetterdaten von [meteoblue](https://www.meteoblue.com) mit den offiziellen meteoblue-Icons,
die Sonnenuntergangs-Qualität von [Sunsethue](https://sunsethue.com) und amtliche DWD-Unwetterwarnungen.

| Meilenstein | Inhalt | Status |
|---|---|---|
| M1 | Projektgerüst, Keys im Schlüsselbund, Kostenmessung | erledigt |
| M2 | Widget im bisherigen Look mit Abruf-Planer, Sonnen-Slot und DWD-Warnungen | erledigt (0.2.6) |
| M3 | Look-Feinschliff | als Nächstes |

## Was das Widget zeigt

- **Stundenreihe:** JETZT plus die nächsten Stunden mit meteoblue-Icon (Tag/Nacht), Temperatur, gefühlter Temperatur und Regen.
- **Sonnen-Slot:** Sonnenauf- oder -untergang als eigene Spalte in der Zeitleiste. Er zeigt das Wetter-Icon dieser Stunde als Tag-Variante, die Qualität von Sunsethue in % und eine deutsche Bewertung. Ohne Sunsethue berechnet das Widget die Uhrzeit selbst.
- **Tagesreihe:** HEUTE plus 4 Tage mit Icon, Max/Min und Regen. Für heute bis übermorgen gibt es einen Punkt in der Farbe der Sonnenuntergangs-Qualität.
- **Warnzeile:** nur bei amtlichen DWD-Unwettern ab Stufe 3.
- **Hinweis** „Stand …“, wenn die Daten älter als 12 Stunden sind.
- **Antippen** öffnet die meteoblue-App am Ort der Daten.

## Wie es aktuell bleibt

- **meteoblue:** um 06, 12 und 17 Uhr (beim ersten Widget-Durchlauf danach) und bei Ortswechsel über 5 km. Höchstens 23 Abrufe in 7 Tagen, das sind hochgerechnet 9,6 Mio. der 10 Mio. Credits pro Jahr. Ein Abruf kostet laut Header `MB-Credits-Accounted` 8.000 Credits.
- **Dazwischen:** Das Widget berechnet zu jeder vollen Stunde aus den gespeicherten Stundenwerten neu, „JETZT“ stimmt also immer.
- **Sunsethue:** nach jedem seiner 6-Stunden-Updates.
- **DWD-Warnungen:** alle 30 Minuten.

## Einrichtung auf dem iPhone

1. **Scripting** aus dem App Store installieren, die kostenlose Version reicht.
2. In Scripting ein Script `Wetter` anlegen und in seinen Einstellungen als Remote-Quelle eintragen:
   `https://github.com/DyyP/Wetter-Widget/tree/widget/Wetter`
   Automatische Updates einschalten.
3. Script `Wetter` starten:
   - **API-Keys einrichten:** meteoblue- und Sunsethue-Key. Sie liegen nur im Schlüsselbund dieses iPhones.
   - **Jetzt aktualisieren:** holt einmal alle Daten, merkt sich den Standort und rendert die 87 meteoblue-Icons als scharfe Bilder. Danach arbeitet das Widget selbstständig.
4. **Widget hinzufügen:** Home-Bildschirm lange drücken → `+` → Scripting → mittleres Widget → *Widget bearbeiten* → Script `Wetter`. Parameter leer lassen, „Remote Updates“ aus.
5. **Standort für Widgets erlauben:** iOS-Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Scripting → *Beim Verwenden der App oder Widgets*.

**Status anzeigen** im Script zeigt Keys, letzte Abrufe, Budget und das Ergebnis des letzten Widget-Durchlaufs samt Fehlern.

## Entwicklung

```bash
npm ci
npm run check
```

`npm run check` führt Typprüfung (TypeScript 7) und Tests (Vitest) aus, CI macht dasselbe bei jedem Push.

```text
Wetter/                 Das Scripting-Script (Remote-Quelle der App)
  script.json           Name, Version, Symbol
  index.tsx             App-Einstieg: Menü
  widget.tsx            Widget-Einstieg: auffrischen, Modell bauen, zeichnen
  core/                 Reine Logik ohne Scripting-APIs, vollständig getestet
    meteoblue.ts        API-URL, Antwortprüfung, Credits
    sunsethue.ts        Sonnen-Qualität und Bewertung
    dwd.ts              DWD-Warnungen über Bright Sky
    sun.ts              Sonnenzeiten offline
    planner.ts          Wann wird was abgerufen
    model.ts            Was das Widget zeigt
    picto.ts            Namen der meteoblue-Icons
    svg.ts              Löst <use>-Verweise der Icons für den Scripting-Renderer auf
    format.ts, geo.ts   Formatierung, Koordinaten, Kalendertage
  data/refresh.ts       Abrufablauf für Widget und App
  platform/             Dünne Hüllen um Scripting-APIs: Speicher, Netz, Ortung, Schlüsselbund, Icons
  app/                  Menü, Keys, Aktualisieren, Status
  ui/                   theme.ts (alle Design-Tokens) und die Widget-Ansicht
test/                   Vitest-Tests für core/
types/scripting.d.ts    Typen der genutzten Scripting-APIs
```

### Regeln

- **Keine Keys im Repo.** Das Repo ist öffentlich, Keys liegen nur im iOS-Schlüsselbund.
- **Keine meteoblue-Icons im Repo.** Sie gehören meteoblue und werden auf dem iPhone geladen und gespeichert.
- **Kein Standort im Repo.** Testdaten nutzen öffentliche Orte (Berlin).
- **`core/` bleibt rein:** keine Scripting-APIs, damit alles in Node testbar ist.
- **Im Widget keine SVGs:** Das Umrechnen sprengt das Speicherlimit des Widgets. SVGs rendert nur die App zu PNGs.
- **SVGs vor dem Rendern auflösen:** Scripting vererbt keine Stile über `<use>`, die meteoblue-Wolken würden schwarz. `core/svg.ts` macht daraus reine Pfade; im Browser pixelgleich mit dem Original (alle 87 Icons geprüft).
- **Typen nur für Genutztes:** `types/scripting.d.ts` enthält nur, was der Code verwendet. Die offiziellen Typen schreibt `npx scripting-cli start` nach `dts/`.

### Branches

- `claude/peaceful-cray-qt71lz`: Arbeits-Branch
- `widget`: freigegebener Stand, von dem sich die App aktualisiert
