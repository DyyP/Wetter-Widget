/** Das mittlere Wetter-Widget im Look deines bisherigen Scripts. */

import { Button, Circle, HStack, Image, Rectangle, Text, VStack, type AppIntent } from "scripting"
import type { DayColumn, HourSlot, Notice, SunSlot, WarningRow, WidgetModel } from "../core/model"
import { PICTO_ASPECT } from "../core/picto"
import { theme, type Grid } from "./theme"

const { colors, layout, fonts } = theme
const DEG = "°"

/** Icon-Name → Pfad des vorgerenderten PNG */
type Icons = Map<string, string>

interface ColumnProps {
  grid: Grid
  icons: Icons
  /** Ob die Reihe eine 4. Zeile hat (Regen bzw. Sonnen-Bewertung) */
  extraRow: boolean
}

function PictoIcon(props: { name: string; width: number; icons: Icons }) {
  const height = Math.round(props.width * PICTO_ASPECT * 10) / 10
  const path = props.icons.get(props.name)
  if (path === undefined) return <VStack frame={{ width: props.width, height }} />
  return <Image filePath={path} resizable frame={{ width: props.width, height }} />
}

function slotBackground(color: string) {
  return { style: color, shape: { type: "rect" as const, cornerRadius: layout.slotCornerRadius } }
}

function RainText(props: { value: string | null }) {
  return (
    <Text font={fonts.rain} fontWeight="bold" foregroundStyle={colors.rain}>
      {props.value ?? " "}
    </Text>
  )
}

function HourColumn(props: ColumnProps & { slot: HourSlot }) {
  const { slot, grid } = props
  return (
    <VStack
      spacing={0}
      frame={{ width: grid.hourColumnWidth }}
      padding={{ vertical: layout.slotPaddingVertical }}
      {...(slot.isNow ? { background: slotBackground(colors.nowBackground) } : {})}
    >
      <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
        {slot.label}
      </Text>
      <PictoIcon name={slot.icon} width={grid.hourIconWidth} icons={props.icons} />
      <HStack spacing={1}>
        <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={colors.text}>
          {`${slot.temperature}${DEG}`}
        </Text>
        <Text font={fonts.felt} foregroundStyle={colors.textDim}>
          {`${slot.feltTemperature}${DEG}`}
        </Text>
      </HStack>
      {props.extraRow ? <RainText value={slot.rain} /> : null}
    </VStack>
  )
}

function SunColumn(props: ColumnProps & { slot: SunSlot }) {
  const { slot, grid } = props
  const accent = slot.level === null ? colors.textDim : colors.quality[slot.level]
  return (
    <VStack
      spacing={0}
      frame={{ width: grid.hourColumnWidth }}
      padding={{ vertical: layout.slotPaddingVertical }}
      background={slotBackground(colors.sunBackground)}
    >
      <HStack spacing={2}>
        <Image systemName={slot.type === "sunset" ? "sunset.fill" : "sunrise.fill"} font={fonts.sunGlyph} foregroundStyle={accent} />
        <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
          {slot.label}
        </Text>
      </HStack>
      <PictoIcon name={slot.icon} width={grid.hourIconWidth} icons={props.icons} />
      <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={accent}>
        {slot.quality === null ? "–" : `${Math.round(slot.quality * 100)}%`}
      </Text>
      <Text font={fonts.qualityLabel} fontWeight="semibold" foregroundStyle={accent} lineLimit={1} minScaleFactor={0.8}>
        {slot.qualityLabel ?? " "}
      </Text>
    </VStack>
  )
}

function DayColumnView(props: ColumnProps & { day: DayColumn }) {
  const { day, grid } = props
  return (
    <VStack spacing={0} frame={{ width: grid.dayColumnWidth }}>
      <HStack spacing={3}>
        <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
          {day.label}
        </Text>
        {day.sunsetLevel === null ? null : (
          <Circle fill={colors.quality[day.sunsetLevel]} frame={{ width: layout.sunsetDotSize, height: layout.sunsetDotSize }} />
        )}
      </HStack>
      <PictoIcon name={day.icon} width={grid.dayIconWidth} icons={props.icons} />
      <HStack spacing={2}>
        <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={colors.text}>
          {`${day.max}${DEG}`}
        </Text>
        <Text font={fonts.temperature} foregroundStyle={colors.textDim}>
          {`${day.min}${DEG}`}
        </Text>
      </HStack>
      {props.extraRow ? <RainText value={day.rain} /> : null}
    </VStack>
  )
}

/**
 * Trenner zwischen Stunden und Tagen: ein feiner Strich über die ganze Breite.
 * E: Bei Unwetter wird er zur Warnzeile in Warnfarbe mit Text. Sonst steht
 * vorne am Strich ein Hinweis, falls nötig: Key prüfen oder alter Datenstand.
 */
function Divider(props: { width: number; warning: WarningRow | null; notice: Notice | null }) {
  const { warning, notice } = props
  const lineColor = warning === null ? colors.divider : colors.warning[warning.level]
  const label = warning?.text ?? notice?.text ?? null
  const labelColor = warning !== null ? lineColor : notice?.kind === "key" ? colors.notice : colors.textDim
  return (
    <HStack spacing={4} frame={{ width: props.width, height: layout.dividerHeight }}>
      {warning === null ? null : <Image systemName="exclamationmark.triangle.fill" font={fonts.divider} foregroundStyle={lineColor} />}
      {label === null ? null : (
        <Text font={fonts.divider} fontWeight="bold" foregroundStyle={labelColor} lineLimit={1} minScaleFactor={0.8}>
          {label}
        </Text>
      )}
      <Rectangle fill={lineColor} frame={{ height: 1 }} />
    </HStack>
  )
}

/** `tapIntent` läuft beim Antippen im Hintergrund (Ort und Datenstand prüfen, neu zeichnen). */
export function WeatherWidget(props: { model: WidgetModel; icons: Icons; grid: Grid; tapIntent: AppIntent<undefined> }) {
  const { model, icons, grid } = props
  return (
    <VStack
      padding={{ vertical: layout.widgetPaddingVertical }}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      widgetBackground={colors.background}
    >
      <Button intent={props.tapIntent} buttonStyle="plain">
        <VStack spacing={layout.rowSpacing}>
          <HStack spacing={0}>
            {model.slots.map((slot) =>
              slot.kind === "hour" ? (
                <HourColumn slot={slot} grid={grid} icons={icons} extraRow={model.hourRainRow} />
              ) : (
                <SunColumn slot={slot} grid={grid} icons={icons} extraRow={model.hourRainRow} />
              ),
            )}
          </HStack>
          <Divider width={grid.rowWidth} warning={model.warning} notice={model.notice} />
          <HStack spacing={0}>
            {model.days.map((day) => (
              <DayColumnView day={day} grid={grid} icons={icons} extraRow={model.dayRainRow} />
            ))}
          </HStack>
        </VStack>
      </Button>
    </VStack>
  )
}

/** Hinweis statt Wetter, z. B. ohne Key oder Daten */
export function MessageWidget(props: { title: string; message: string }) {
  return (
    <VStack spacing={4} padding frame={{ maxWidth: "infinity", maxHeight: "infinity" }} widgetBackground={colors.background}>
      <Text font={12} fontWeight="bold" foregroundStyle={colors.text}>
        {props.title}
      </Text>
      <Text font={10} foregroundStyle={colors.textDim} minScaleFactor={0.8}>
        {props.message}
      </Text>
    </VStack>
  )
}
