/**
 * Minimale Typdefinitionen für die iOS-App „Scripting“ (Thom Fang).
 *
 * Die offiziellen Typen (`scripting.d.ts`, `global.d.ts`) liefert die App
 * selbst, sobald `npx scripting-cli start` mit einem iPhone verbunden ist.
 * Bis dahin beschreibt diese Datei nur die Teilmenge, die das Projekt nutzt,
 * abgeleitet aus der Doku unter https://scriptingapp.github.io (Stand 11/2026).
 *
 * Regel: Nur hier eintragen, was im Code wirklich verwendet wird, und jede
 * Signatur gegen die Doku prüfen. Lieber eng als großzügig typisieren.
 */

// ---------------------------------------------------------------------------
// JSX
// ---------------------------------------------------------------------------

/** Ergebnis eines JSX-Ausdrucks. Die App rendert diesen Baum nativ mit SwiftUI. */
interface VirtualNode {
  readonly __virtualNode: true
}

declare function createElement(type: unknown, props: unknown, ...children: unknown[]): VirtualNode
declare const Fragment: unique symbol

declare namespace JSX {
  type Element = VirtualNode
  // Keine HTML-Elemente: nur Komponenten aus "scripting" oder eigene Funktionen.
  interface IntrinsicElements {}
  interface ElementChildrenAttribute {
    children: {}
  }
}

// ---------------------------------------------------------------------------
// Modul "scripting": Ansichten und App-APIs
// ---------------------------------------------------------------------------

declare module "scripting" {
  type Color = string
  type DynamicColor = Color | { light: Color; dark: Color }

  type FontWeight =
    | "ultraLight"
    | "thin"
    | "light"
    | "regular"
    | "medium"
    | "semibold"
    | "bold"
    | "heavy"
    | "black"

  type FontDesign = "default" | "rounded" | "monospaced" | "serif"

  /** Systemstil ("caption"), Punktgröße oder eigene Schrift. */
  type Font = string | number | { name: string; size: number }

  type EdgeLength = number | true

  type Padding =
    | true
    | number
    | {
        horizontal?: EdgeLength
        vertical?: EdgeLength
        leading?: EdgeLength
        trailing?: EdgeLength
        top?: EdgeLength
        bottom?: EdgeLength
      }

  interface Frame {
    width?: number
    height?: number
    minWidth?: number
    maxWidth?: number | "infinity"
    minHeight?: number
    maxHeight?: number | "infinity"
    alignment?: "center" | "leading" | "trailing" | "top" | "bottom"
  }

  type Children = VirtualNode | string | number | boolean | null | undefined | Children[]

  /** Modifier, die das Projekt verwendet. Weitere erst nach Doku-Abgleich ergänzen. */
  interface CommonViewProps {
    children?: Children
    padding?: Padding
    frame?: Frame
    background?: DynamicColor
    foregroundStyle?: DynamicColor
    opacity?: number
    font?: Font
    fontWeight?: FontWeight
    fontDesign?: FontDesign
    monospacedDigit?: boolean
    lineLimit?: number
    minScaleFactor?: number
    layoutPriority?: number
    widgetURL?: string
    /** Hintergrund, den das System im getönten/klaren Modus automatisch weglässt. */
    widgetBackground?: DynamicColor
  }

  interface StackProps extends CommonViewProps {
    spacing?: number
  }

  interface VStackProps extends StackProps {
    alignment?: "leading" | "center" | "trailing"
  }

  interface HStackProps extends StackProps {
    alignment?: "top" | "center" | "bottom" | "firstTextBaseline" | "lastTextBaseline"
  }

  interface SpacerProps {
    minLength?: number
  }

  function VStack(props: VStackProps): VirtualNode
  function HStack(props: HStackProps): VirtualNode
  function Spacer(props: SpacerProps): VirtualNode
  function Text(props: CommonViewProps): VirtualNode

  type WidgetFamily =
    | "systemSmall"
    | "systemMedium"
    | "systemLarge"
    | "systemExtraLarge"
    | "systemExtraLargePortrait"
    | "accessoryCircular"
    | "accessoryRectangular"
    | "accessoryInline"

  type WidgetReloadPolicy = { policy: "atEnd" } | { policy: "after"; date: Date }

  class Widget {
    static readonly family: WidgetFamily
    static readonly displaySize: { width: number; height: number }
    static readonly parameter: string
    static present(element: VirtualNode, reloadPolicy?: WidgetReloadPolicy): void
    static reloadAll(): void
    static reloadUserWidgets(): Promise<void> | void
  }

  class Script {
    static readonly name: string
    static readonly directory: string
    /** z. B. "index" (App), "widget", "intent" */
    static readonly env: string
    static readonly metadata: { name?: string; version?: string }
    static exit(result?: unknown): void
    static createImportScriptsURLScheme(urls: string[]): string
  }
}

// ---------------------------------------------------------------------------
// Globale APIs (in Scripting ohne Import verfügbar)
// ---------------------------------------------------------------------------

declare const console: {
  log(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

declare namespace Keychain {
  type Accessibility =
    | "passcode"
    | "unlocked"
    | "unlocked_this_device"
    | "first_unlock"
    | "first_unlock_this_device"
  interface Options {
    accessibility?: Accessibility
    synchronizable?: boolean
  }
  function set(key: string, value: string, options?: Options): boolean
  function get(key: string, options?: Options): string | null
  function remove(key: string, options?: Options): boolean
  function contains(key: string, options?: Options): boolean
}

declare namespace Dialog {
  function alert(options: { message: string; title?: string; buttonLabel?: string }): Promise<void>
  function confirm(options: {
    message: string
    title?: string
    cancelLabel?: string
    confirmLabel?: string
  }): Promise<boolean>
  function prompt(options: {
    title: string
    message?: string
    defaultValue?: string
    obscureText?: boolean
    selectAll?: boolean
    placeholder?: string
    cancelLabel?: string
    confirmLabel?: string
  }): Promise<string | null>
  function actionSheet(options: {
    title: string
    message?: string
    cancelButton?: boolean
    actions: { label: string; destructive?: boolean }[]
  }): Promise<number | null>
}

declare namespace FileManager {
  /** Für App und Widget gemeinsam lesbar, nicht in der Dateien-App sichtbar. */
  const appGroupDocumentsDirectory: string
  const isiCloudEnabled: boolean
  /** Wirft, wenn iCloud aus ist. Vorher `isiCloudEnabled` prüfen. */
  const iCloudDocumentsDirectory: string
  /** In der Dateien-App sichtbar, aber nicht vom Widget lesbar. */
  const documentsDirectory: string
  function exists(path: string): Promise<boolean>
  function createDirectory(path: string, recursive?: boolean): Promise<void>
  function readAsString(path: string): Promise<string>
  function writeAsString(path: string, content: string): Promise<void>
  function appendText(path: string, content: string): Promise<void>
  function remove(path: string): Promise<void>
}

declare namespace Location {
  type Accuracy =
    | "best"
    | "tenMeters"
    | "hundredMeters"
    | "kilometer"
    | "threeKilometers"
    | "bestForNavigation"
    | "reduced"
  interface LocationInfo {
    latitude: number
    longitude: number
    timestamp: number
  }
  /** Ob dieses Widget Standort-Updates erhalten darf. */
  const isAuthorizedForWidgetUpdates: boolean
  function setAccuracy(accuracy: Accuracy): Promise<void>
  function requestCurrent(options?: { forceRequest?: boolean }): Promise<LocationInfo | null>
}

declare namespace Safari {
  function openURL(url: string): Promise<boolean>
}

// --- fetch (Scripting-Variante des Web-Standards) ---------------------------

declare class Headers {
  get(name: string): string | null
  has(name: string): boolean
  forEach(callback: (value: string, name: string) => void): void
  entries(): [string, string][]
}

declare class Response {
  readonly ok: boolean
  readonly status: number
  readonly headers: Headers
  json(): Promise<unknown>
  text(): Promise<string>
}

declare class AbortSignal {
  static timeout(milliseconds: number): AbortSignal
}

interface RequestInit {
  method?: string
  headers?: Record<string, string>
  body?: string
  /** Sekunden */
  timeout?: number
  signal?: AbortSignal
  debugLabel?: string
}

declare function fetch(url: string, init?: RequestInit): Promise<Response>
