/** Das mittlere Wetter-Widget im Look deines bisherigen Scripts. */

import { Circle, HStack, Image, Spacer, Text, VStack } from "scripting"
import type { DayColumn, HourSlot, Slot, SunSlot, WarningRow, WidgetModel } from "../core/model"
import { PICTO_ASPECT } from "../core/picto"
import { theme } from "./theme"

const { colors, layout, fonts } = theme
const DEG = "°"

export interface IconSource {
  /** Icon-Name → Pfad eines zeichenbaren PNG */
  paths: Map<string, string>
}

function PictoIcon(props: { name: string; width: number; icons: IconSource }) {
  const height = Math.round(props.width * PICTO_ASPECT * 10) / 10
  const path = props.icons.paths.get(props.name)
  if (path === undefined) return <VStack frame={{ width: props.width, height }} />
  return <Image filePath={path} resizable frame={{ width: props.width, height }} />
}

function slotBackground(color: string) {
  return { style: color, shape: { type: "rect" as const, cornerRadius: layout.slotCornerRadius } }
}

function HourColumn(props: { slot: HourSlot; icons: IconSource }) {
  const { slot } = props
  return (
    <VStack
      spacing={0}
      frame={{ width: layout.hourColumnWidth }}
      padding={{ vertical: layout.slotPaddingVertical }}
      {...(slot.isNow ? { background: slotBackground(colors.nowBackground) } : {})}
    >
      <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
        {slot.label}
      </Text>
      <PictoIcon name={slot.icon} width={layout.hourIconWidth} icons={props.icons} />
      <HStack spacing={1}>
        <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={colors.text}>
          {`${slot.temperature}${DEG}`}
        </Text>
        <Text font={fonts.felt} foregroundStyle={colors.textDim}>
          {`${slot.feltTemperature}${DEG}`}
        </Text>
      </HStack>
      <Text font={fonts.rain} fontWeight="bold" foregroundStyle={colors.rain}>
        {slot.rain ?? " "}
      </Text>
    </VStack>
  )
}

function SunColumn(props: { slot: SunSlot; icons: IconSource }) {
  const { slot } = props
  const accent = slot.level === null ? colors.textDim : colors.quality[slot.level]
  return (
    <VStack
      spacing={0}
      frame={{ width: layout.hourColumnWidth }}
      padding={{ vertical: layout.slotPaddingVertical }}
      background={slotBackground(colors.sunBackground)}
    >
      <HStack spacing={2}>
        <Image
          systemName={slot.type === "sunset" ? "sunset.fill" : "sunrise.fill"}
          font={fonts.sunGlyph}
          foregroundStyle={accent}
        />
        <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
          {slot.label}
        </Text>
      </HStack>
      <PictoIcon name={slot.icon} width={layout.hourIconWidth} icons={props.icons} />
      <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={accent}>
        {slot.quality === null ? "–" : `${Math.round(slot.quality * 100)}%`}
      </Text>
      <Text font={fonts.qualityLabel} fontWeight="semibold" foregroundStyle={accent} lineLimit={1} minScaleFactor={0.8}>
        {slot.qualityLabel ?? " "}
      </Text>
    </VStack>
  )
}

function SlotColumn(props: { slot: Slot; icons: IconSource }) {
  return props.slot.kind === "hour" ? (
    <HourColumn slot={props.slot} icons={props.icons} />
  ) : (
    <SunColumn slot={props.slot} icons={props.icons} />
  )
}

function DayColumnView(props: { day: DayColumn; icons: IconSource }) {
  const { day } = props
  return (
    <VStack spacing={0} frame={{ width: layout.dayColumnWidth }}>
      <HStack spacing={3}>
        <Text font={fonts.label} fontWeight="bold" foregroundStyle={colors.textDim}>
          {day.label}
        </Text>
        {day.sunsetLevel === null ? null : (
          <Circle
            fill={colors.quality[day.sunsetLevel]}
            frame={{ width: layout.sunsetDotSize, height: layout.sunsetDotSize }}
          />
        )}
      </HStack>
      <PictoIcon name={day.icon} width={layout.dayIconWidth} icons={props.icons} />
      <HStack spacing={2}>
        <Text font={fonts.temperature} fontWeight="bold" foregroundStyle={colors.text}>
          {`${day.max}${DEG}`}
        </Text>
        <Text font={fonts.temperature} foregroundStyle={colors.textDim}>
          {`${day.min}${DEG}`}
        </Text>
      </HStack>
      <Text font={fonts.rain} fontWeight="bold" foregroundStyle={colors.rain}>
        {day.rain ?? " "}
      </Text>
    </VStack>
  )
}

/** E: Warnzeile nur bei Unwetter. Text links, Linie in Warnfarbe bis zum Rand. */
function WarningLine(props: { warning: WarningRow }) {
  const color = colors.warning[props.warning.level]
  return (
    <HStack spacing={4} frame={{ width: layout.hourColumnWidth * 6 }}>
      <Image systemName="exclamationmark.triangle.fill" font={fonts.warning} foregroundStyle={color} />
      <Text font={fonts.warning} fontWeight="bold" foregroundStyle={color} lineLimit={1} minScaleFactor={0.8}>
        {props.warning.text}
      </Text>
      <VStack frame={{ height: 1, maxWidth: "infinity" }} background={color} />
    </HStack>
  )
}

function StaleHint(props: { text: string }) {
  return (
    <Text font={fonts.label} foregroundStyle={colors.textDim}>
      {props.text}
    </Text>
  )
}

export function WeatherWidget(props: { model: WidgetModel; icons: IconSource }) {
  const { model, icons } = props
  return (
    <VStack
      spacing={layout.rowSpacing}
      padding={{ vertical: layout.widgetPaddingVertical }}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      widgetBackground={colors.background}
      widgetURL={model.tapUrl}
    >
      <Spacer minLength={0} />
      <HStack spacing={0}>
        {model.slots.map((slot) => (
          <SlotColumn slot={slot} icons={icons} />
        ))}
      </HStack>
      {model.warning !== null ? (
        <WarningLine warning={model.warning} />
      ) : model.staleHint !== null ? (
        <StaleHint text={model.staleHint} />
      ) : null}
      <HStack spacing={0}>
        {model.days.map((day) => (
          <DayColumnView day={day} icons={icons} />
        ))}
      </HStack>
      <Spacer minLength={0} />
    </VStack>
  )
}

/** Hinweis statt Widget, wenn (noch) keine passenden Daten da sind. */
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
