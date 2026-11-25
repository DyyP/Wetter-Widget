# Wetter-Widget

Mittleres Home-Bildschirm-Widget für die iOS-App [Scripting](https://apps.apple.com/app/id6479691128).
Es zeigt Wetterdaten von [meteoblue](https://www.meteoblue.com) mit den offiziellen meteoblue-Icons,
die Sonnenuntergangs-Qualität von [Sunsethue](https://sunsethue.com) und amtliche DWD-Unwetterwarnungen.

## Stand: Meilenstein 1 – Fundament und Kassensturz

| Meilenstein | Inhalt | Status |
|---|---|---|
| M1 | Projektgerüst, API-Keys im Schlüsselbund, Test-Abruf mit Credit-Messung, Diagnose-Widget | **aktuell** |
| M2 | Neubau mit deinem Look: Abruf-Planer, Sonnen-Slot, DWD-Warnungen, offizielle SVG-Icons | geplant |
| M3 | Look-Feinschliff mit Theme, Demo-Szenarien und Vorschau | geplant |
| M4 | Extras nach Wahl | geplant |

Das Widget aus M1 ruft noch **kein** Wetter ab. Es prüft, was das spätere Widget braucht:

- Kann das Widget die API-Keys aus dem Schlüsselbund lesen?
- Darf es den Standort abfragen?
- Wie groß ist es auf deinem iPhone wirklich?
- Wie oft zeichnet iOS es neu?

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
   2. **Test-Abruf (8.000 Credits):** prüft Key und Credits. Die Antwort wird als Datei gespeichert unter Dateien-App → iCloud Drive → Scripting → `Wetter-Widget`.
4. **Widget hinzufügen:** Home-Bildschirm lange drücken → `+` → Scripting → mittleres Widget. Dann das Widget lange drücken → *Widget bearbeiten* → Script `Wetter`.
5. **Standort für Widgets erlauben:** iOS-Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Scripting → *Beim Verwenden der App oder Widgets*.

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
  index.tsx             App-Einstieg: Menü für Einrichtung und Diagnose
  widget.tsx            Widget-Einstieg
  core/                 Reine Logik ohne Scripting-APIs, vollständig getestet
  platform/             Dünne Hüllen um Scripting-APIs (Schlüsselbund, Dateien, Netz, Standort)
  app/                  Abläufe in der App (Keys, Test-Abruf, Status)
  ui/                   Widget-Ansichten (TSX)
test/                   Vitest-Tests für core/
types/scripting.d.ts    Typen der genutzten Scripting-APIs (aus der Doku abgeleitet)
```

### Regeln

- **Keine Keys im Repo.** Das Repo ist öffentlich, Keys liegen nur im iOS-Schlüsselbund.
- **Keine meteoblue-Icons im Repo.** Sie gehören meteoblue und werden zur Laufzeit von `static.meteoblue.com` geladen.
- **`core/` bleibt rein:** keine globalen Scripting-APIs, damit alles in Node testbar ist.
- **Offizielle Typen:** Mit `npx scripting-cli start` auf einem Computer im selben WLAN schreibt die App ihre echten Typen nach `dts/`. `types/scripting.d.ts` ist bis dahin der Ersatz.

### Branches

- `claude/peaceful-cray-qt71lz`: Arbeits-Branch
- `widget`: freigegebener Stand, von dem sich die App aktualisiert
