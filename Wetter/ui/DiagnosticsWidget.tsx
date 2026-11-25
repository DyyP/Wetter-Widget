/**
 * Diagnose-Widget für Meilenstein 1. Es ruft keine Wetterdaten ab, sondern
 * prüft, was das spätere Wetter-Widget braucht: Kann es den Schlüsselbund
 * lesen? Darf es den Standort abfragen? Wie groß ist es wirklich? Wie oft
 * zeichnet iOS es neu?
 */

import { HStack, Spacer, Text, VStack } from "scripting"

export interface DiagnosticsData {
  version: string
  meteoblueKey: boolean
  sunsethueKey: boolean
  /** null = unbekannt */
  locationAllowed: boolean | null
  probeLine: string
  sizeLine: string
  refreshLine: string
}

const COLORS = {
  background: "#1c1c1e",
  text: "#ffffff",
  dim: "rgba(255,255,255,0.6)",
  good: "#4cd964",
  bad: "#ff6b6b",
  unknown: "#ffd60a",
}

function Check(props: { state: boolean | null; label: string; detail?: string }) {
  const symbol = props.state === null ? "?" : props.state ? "✓" : "✗"
  const color = props.state === null ? COLORS.unknown : props.state ? COLORS.good : COLORS.bad
  return (
    <HStack spacing={6}>
      <Text font={11} fontWeight="bold" foregroundStyle={color}>
        {symbol}
      </Text>
      <Text font={11} foregroundStyle={COLORS.text}>
        {props.label}
      </Text>
      <Spacer />
      {props.detail === undefined ? null : (
        <Text font={10} foregroundStyle={COLORS.dim} lineLimit={1}>
          {props.detail}
        </Text>
      )}
    </HStack>
  )
}

function Line(props: { text: string }) {
  return (
    <Text font={10} foregroundStyle={COLORS.dim} lineLimit={1} minScaleFactor={0.8}>
      {props.text}
    </Text>
  )
}

export function DiagnosticsWidget(props: { data: DiagnosticsData }) {
  const { data } = props
  return (
    <VStack alignment="leading" spacing={3} padding={{ horizontal: 14, vertical: 10 }} widgetBackground={COLORS.background}>
      <HStack>
        <Text font={13} fontWeight="bold" foregroundStyle={COLORS.text}>
          Wetter-Widget · Neubau
        </Text>
        <Spacer />
        <Text font={10} foregroundStyle={COLORS.dim}>
          {`M1 · ${data.version}`}
        </Text>
      </HStack>
      <Check state={data.meteoblueKey} label="meteoblue-Key im Widget lesbar" />
      <Check state={data.sunsethueKey} label="Sunsethue-Key im Widget lesbar" />
      <Check state={data.locationAllowed} label="Standort für Widget erlaubt" />
      <Spacer />
      <Line text={data.probeLine} />
      <Line text={data.sizeLine} />
      <Line text={data.refreshLine} />
    </VStack>
  )
}
