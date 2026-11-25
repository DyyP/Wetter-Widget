# Wetter-Widget

Mittleres Home-Bildschirm-Widget für die iOS-App [Scripting](https://apps.apple.com/app/id6479691128).
Es zeigt Wetterdaten von [meteoblue](https://www.meteoblue.com) mit den offiziellen meteoblue-Icons,
die Sonnenuntergangs-Qualität von [Sunsethue](https://sunsethue.com) und amtliche DWD-Unwetterwarnungen.

## Stand: Meilenstein 2 – Neubau mit deinem Look

| Meilenstein | Inhalt | Status |
|---|---|---|
| M1 | Projektgerüst, API-Keys im Schlüsselbund, Test-Abruf mit Credit-Messung, Diagnose-Widget | erledigt |
| M2 | Echtes Widget: Abruf-Planer, Sonnen-Slot, DWD-Warnungen, offizielle SVG-Icons | **aktuell** |
| M3 | Look-Feinschliff mit Theme, Demo-Szenarien und Vorschau | geplant |
| M4 | Extras nach Wahl | geplant |

Was das Widget zeigt:

- **Stundenreihe:** JETZT plus die nächsten Stunden mit offiziellem meteoblue-Icon (Tag/Nacht), Temperatur, gefühlter Temperatur und Regen.
- **Sonnen-Slot:** Sonnenauf- oder -untergang als eigene Spalte in der Zeitleiste. Er zeigt das Wetter-Icon dieser Stunde als Tag-Variante, die Qualität von Sunsethue in % und eine deutsche Bewertung.
- **Tagesreihe:** HEUTE plus 4 Tage mit Tages-Icon, Max/Min und Regen. Ein farbiger Punkt zeigt die Sonnenuntergangs-Qualität für heute bis übermorgen.
- **Warnzeile:** Sie erscheint nur bei amtlichen DWD-Unwettern ab Stufe 3 (rot) bzw. 4 (violett), mit Text und Uhrzeit.
- **Antippen** öffnet die meteoblue-App an deinem Ort.

So bleibt es aktuell, ohne das Credit-Kontingent zu sprengen:

- **meteoblue:** Abruf um 06, 12 und 17 Uhr (jeweils beim ersten Widget-Durchlauf danach) und bei Ortswechsel über 5 km. Höchstens 23 Abrufe in 7 Tagen, das sind hochgerechnet 9,6 Mio. von 10 Mio. Credits pro Jahr.
- **Dazwischen** rechnet das Widget jede volle Stunde aus den gespeicherten Stundenwerten neu. „JETZT“ stimmt also immer.
- **Sunsethue** nach jedem seiner 6-Stunden-Updates, **DWD-Warnungen** alle 30 Minuten. Beides kostet keine meteoblue-Credits.

## Installation auf dem iPhone

1. **Scripting** aus dem App Store installieren. Die kostenlose Version reicht.
2. **Script aus GitHub holen.** Weg A ist der einfachste:
   - **Weg A:** In Scripting ein neues Script namens `Wetter` anlegen. In seinen Einstellungen als Remote-Quelle eintragen:
     `https://github.com/DyyP/Wetter-Widget/tree/widget/Wetter`
     Dann jetzt aktualisieren und automatische Updates einschalten (z. B. stündlich).
   - **Weg B:** Ein beliebiges neues Script anlegen, diesen Code in `index.tsx` einfügen und ausführen. Scripting importiert dann das Script.

     ```tsx
     import { Script } from "scripting"

     async function main() {
       const url = Script.createImportScriptsURLScheme([
         "https://github.com/DyyP/Wetter-Widget/tree/widget/Wetter",
       ])
       await Safari.openURL(url)
       Script.exit()
     }

     main()
     ```
3. **Script `Wetter` in der App starten** und im Menü:
   1. **API-Keys einrichten:** meteoblue- und Sunsethue-Key eingeben. Sie werden nur im Schlüsselbund dieses iPhones gespeichert und nie ins Repo geschrieben.
   2. **Jetzt aktualisieren:** holt einmal alle Daten und merkt sich deinen Standort. Danach arbeitet das Widget selbstständig.
   3. **Widget-Vorschau:** zeigt das Widget direkt in der App.
4. **Widget hinzufügen:** Home-Bildschirm lange drücken → `+` → Scripting → mittleres Widget. Dann das Widget lange drücken → *Widget bearbeiten* → Script `Wetter`.
5. **Standort für Widgets erlauben:** iOS-Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Scripting → *Beim Verwenden der App oder Widgets*.
6. **Diagnose:** Mit dem Widget-Parameter `diagnose` zeigt ein Widget stattdessen Keys, Standortfreigabe, Größe und den Aktualisierungs-Rhythmus. *Status anzeigen* im App-Menü zeigt zusätzlich die letzten Abrufe und das Budget.

## Credits

Laut der offiziellen [meteoblue-API-Referenz](https://my.meteoblue.com/packages/redoc) kostet ein Abruf von `basic-1h` und `basic-day` zusammen **8.000 Credits**. Es wird nur die teuerste Auflösung desselben Pakets berechnet. Die Free Weather API enthält 10 Mio. Credits pro Jahr, das sind rund 27.400 pro Tag oder etwa 3 Abrufe. Das Widget rechnet deshalb die aktuelle Stunde selbst aus den gespeicherten Stundenwerten und ruft nur nach Plan neu ab.

## Entwicklung

```bash
npm ci
npm run check
```

`npm run check` führt die Typprüfung (TypeScript 7) und die Tests (Vitest) aus. CI macht dasselbe bei jedem Push.

### Aufbau

```text
Wetter/                 Das Scripting-Script (Remote-Quelle für die App)
  script.json           Name, Version, Symbol
  index.tsx             App-Einstieg: Menü
  widget.tsx            Widget-Einstieg: auffrischen, Modell bauen, zeichnen
  core/                 Reine Logik ohne Scripting-APIs, vollständig getestet
    meteoblue.ts        API-URL, Antwortprüfung, Credits
    sunsethue.ts        Sonnen-Qualität und Bewertung
    dwd.ts              DWD-Warnungen über Bright Sky
    sun.ts              Sonnenzeiten offline
    planner.ts          Wann wird was abgerufen (Zeitfenster, Budget, Ortswechsel)
    model.ts            Was das Widget zeigt (Slots, Tage, Warnzeile)
  data/refresh.ts       Abruf-Ablauf für Widget und App
  platform/             Dünne Hüllen um Scripting-APIs (Schlüsselbund, Dateien, Netz, Standort, Icons)
  app/                  Abläufe in der App (Keys, Aktualisieren, Status, Diagnose)
  ui/                   Widget-Ansichten (TSX) und theme.ts mit allen Design-Tokens
test/                   Vitest-Tests für core/
types/scripting.d.ts    Typen der genutzten Scripting-APIs (aus der Doku abgeleitet)
```

### Regeln

- **Keine Keys im Repo.** Das Repo ist öffentlich, Keys liegen nur im iOS-Schlüsselbund.
- **Keine meteoblue-Icons im Repo.** Sie gehören meteoblue. Das Widget lädt sie zur Laufzeit von `static.meteoblue.com` und speichert sie auf dem iPhone.
- **Kein Standort im Repo.** Testdaten nutzen öffentliche Orte (Berlin), nie echte Aufenthaltsorte.
- **`core/` bleibt rein:** keine globalen Scripting-APIs, damit alles in Node testbar ist.
- **Offizielle Typen:** Mit `npx scripting-cli start` auf einem Computer im selben WLAN schreibt die App ihre echten Typen nach `dts/`. `types/scripting.d.ts` ist bis dahin der Ersatz.

### Branches

- `claude/peaceful-cray-qt71lz`: Arbeits-Branch
- `widget`: freigegebener Stand, von dem sich die App aktualisiert
