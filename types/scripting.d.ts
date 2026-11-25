/**
 * Typdefinitionen für die iOS-App „Scripting“ (Thom Fang), beschränkt auf
 * die APIs, die dieses Projekt nutzt. Abgeleitet aus der Doku unter
 * https://scriptingapp.github.io (Stand 11/2026) und auf dem iPhone geprüft.
 *
 * Die vollständigen offiziellen Typen schreibt `npx scripting-cli start`
 * nach `dts/`, sobald ein Computer mit dem iPhone verbunden ist.
 * Regel: nur eintragen, was der Code wirklich verwendet.
 */

// ---------------------------------------------------------------------------
// JSX
// ---------------------------------------------------------------------------

/** Ergebnis eines JSX-Ausdrucks; die App rendert den Baum nativ mit SwiftUI */
interface VirtualNode {
  readonly __virtualNode: true
}

declare function createElement(type: unknown, props: unknown, ...children: unknown[]): VirtualNode
declare const Fragment: unique symbol

declare namespace JSX {
  type Element = VirtualNode
  interface IntrinsicElements {}
  interface ElementChildrenAttribute {
    children: {}
  }
}

// ---------------------------------------------------------------------------
// Modul "scripting"
// ---------------------------------------------------------------------------

declare module "scripting" {
  type Color = string

  type FontWeight = "ultraLight" | "thin" | "light" | "regular" | "medium" | "semibold" | "bold" | "heavy" | "black"

  /** Systemstil ("caption") oder Punktgröße */
  type Font = string | number

  type EdgeLength = number | true

  type Padding =
    | true
    | number
    | { horizontal?: EdgeLength; vertical?: EdgeLength; leading?: EdgeLength; trailing?: EdgeLength; top?: EdgeLength; bottom?: EdgeLength }

  interface Frame {
    width?: number
    height?: number
    maxWidth?: number | "infinity"
    maxHeight?: number | "infinity"
  }

  type Children = VirtualNode | string | number | boolean | null | undefined | Children[]

  interface CommonViewProps {
    children?: Children
    padding?: Padding
    frame?: Frame
    /** Farbe, oder Farbe in einer Form (abgerundetes Rechteck) */
    background?: Color | { style: Color; shape: { type: "rect"; cornerRadius: number } }
    foregroundStyle?: Color
    font?: Font
    fontWeight?: FontWeight
    lineLimit?: number
    minScaleFactor?: number
    /** Darstellung von Buttons; "plain" zeigt nur den Inhalt */
    buttonStyle?: "automatic" | "bordered" | "borderedProminent" | "borderless" | "plain"
    /** Hintergrund, den iOS im getönten oder klaren Modus automatisch weglässt */
    widgetBackground?: Color
  }

  interface StackProps extends CommonViewProps {
    spacing?: number
  }

  interface ImageProps extends CommonViewProps {
    /** Name eines SF Symbols */
    systemName?: string
    filePath?: string
    /** Bild füllt den Rahmen; Seitenverhältnis über `frame` setzen */
    resizable?: boolean
  }

  function VStack(props: StackProps): VirtualNode
  function HStack(props: StackProps): VirtualNode
  function Spacer(props: { minLength?: number }): VirtualNode
  function Text(props: CommonViewProps): VirtualNode
  function Image(props: ImageProps): VirtualNode
  function Circle(props: CommonViewProps & { fill?: Color }): VirtualNode
  function Rectangle(props: CommonViewProps & { fill?: Color }): VirtualNode
  /** Im Widget löst ein Tipp die AppIntent aus (Hintergrund, app_intents.tsx) */
  function Button(props: CommonViewProps & { intent: AppIntent<unknown> }): VirtualNode
  /** Nur in der App verwenden: Im Widget sprengt das Umrechnen das Speicherlimit */
  function SVG(props: CommonViewProps & { filePath: string; resizable?: boolean }): VirtualNode

  interface AppIntent<T> {
    readonly name: string
    readonly params: T
  }

  enum AppIntentProtocol {
    AppIntent = 0,
  }

  /** AppIntents müssen in app_intents.tsx registriert werden */
  class AppIntentManager {
    static register<T = undefined>(options: {
      name: string
      protocol: AppIntentProtocol
      perform: (params: T) => Promise<void>
    }): (params: T) => AppIntent<T>
  }

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
    /** Tatsächliche Größe des Widgets in pt */
    static readonly displaySize: { width: number; height: number }
    /** Nach dem Aufruf läuft im Widget kein weiterer Code */
    static present(element: VirtualNode, reloadPolicy?: WidgetReloadPolicy): void
    /** Nur in der App: rendert widget.tsx als Vorschau */
    static preview(options?: { family?: WidgetFamily }): Promise<void>
    static reloadAll(): void
  }

  /** Nur in der App: zeichnet eine Ansicht zu einem Bild */
  class ImageRenderer {
    static toUIImage(element: VirtualNode, options?: { scale?: number; opaque?: boolean }): Promise<UIImage>
  }

  class Script {
    static readonly metadata: { version?: string } | undefined
    static exit(result?: unknown): void
  }
}

// ---------------------------------------------------------------------------
// Globale APIs (ohne Import verfügbar)
// ---------------------------------------------------------------------------

declare function setTimeout(handler: () => void, milliseconds?: number): number
declare function clearTimeout(id: number | undefined): void

declare class Data {}

declare class UIImage {
  toPNGData(): Data | null
}

declare namespace Keychain {
  interface Options {
    accessibility?: "passcode" | "unlocked" | "unlocked_this_device" | "first_unlock" | "first_unlock_this_device"
    synchronizable?: boolean
  }
  function set(key: string, value: string, options?: Options): boolean
  function get(key: string, options?: Options): string | null
  function remove(key: string, options?: Options): boolean
}

declare namespace Dialog {
  function alert(options: { message: string; title?: string; buttonLabel?: string }): Promise<void>
  function confirm(options: { message: string; title?: string; cancelLabel?: string; confirmLabel?: string }): Promise<boolean>
  function prompt(options: {
    title: string
    message?: string
    placeholder?: string
    obscureText?: boolean
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
  /** Für App und Widget gemeinsam, nicht in der Dateien-App sichtbar */
  const appGroupDocumentsDirectory: string
  function exists(path: string): Promise<boolean>
  function createDirectory(path: string, recursive?: boolean): Promise<void>
  function readAsString(path: string): Promise<string>
  function writeAsString(path: string, content: string): Promise<void>
  function writeAsData(path: string, data: Data): Promise<void>
  /** Löscht eine Datei oder einen Ordner samt Inhalt */
  function remove(path: string): Promise<void>
}

declare namespace Location {
  /** Ob iOS diesem Widget Standortabfragen erlaubt */
  const isAuthorizedForWidgetUpdates: boolean
  function setAccuracy(accuracy: "best" | "tenMeters" | "hundredMeters" | "kilometer" | "threeKilometers"): Promise<void>
  /** Liefert einen gespeicherten Ort sofort, sonst eine neue Ortung */
  function requestCurrent(): Promise<{ latitude: number; longitude: number; timestamp: number } | null>
}

declare class Headers {
  entries(): [string, string][]
}

declare class Response {
  readonly ok: boolean
  readonly status: number
  readonly headers: Headers
  text(): Promise<string>
}

interface RequestInit {
  method?: string
  headers?: Record<string, string>
  /** Sekunden */
  timeout?: number
}

declare function fetch(url: string, init?: RequestInit): Promise<Response>
