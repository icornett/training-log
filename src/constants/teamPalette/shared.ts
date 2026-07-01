import { TEAM_OPTIONS, type League } from '../teamCatalog'
import type { LeagueOverrideConfig, TeamPalette } from './types'

const uniqueByOrder = <T>(values: readonly T[]): T[] => {
  const result: T[] = []
  const seen = new Set<T>()
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  return result
}

export const hashString = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash
}

export const hslToHex = (h: number, s: number, l: number): string => {
  const hue = ((h % 360) + 360) % 360
  const sat = Math.max(0, Math.min(100, s)) / 100
  const light = Math.max(0, Math.min(100, l)) / 100

  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = light - chroma / 2

  let redPrime = 0
  let greenPrime = 0
  let bluePrime = 0

  if (hue < 60) {
    redPrime = chroma
    greenPrime = x
  } else if (hue < 120) {
    redPrime = x
    greenPrime = chroma
  } else if (hue < 180) {
    greenPrime = chroma
    bluePrime = x
  } else if (hue < 240) {
    greenPrime = x
    bluePrime = chroma
  } else if (hue < 300) {
    redPrime = x
    bluePrime = chroma
  } else {
    redPrime = chroma
    bluePrime = x
  }

  const red = Math.round((redPrime + match) * 255)
  const green = Math.round((greenPrime + match) * 255)
  const blue = Math.round((bluePrime + match) * 255)

  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '')
  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})`
}

const relativeLuminance = (hex: string): number => {
  const normalized = hex.replace('#', '')
  const red = parseInt(normalized.slice(0, 2), 16) / 255
  const green = parseInt(normalized.slice(2, 4), 16) / 255
  const blue = parseInt(normalized.slice(4, 6), 16) / 255

  const toLinear = (value: number): number =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4

  return 0.2126 * toLinear(red) + 0.7152 * toLinear(green) + 0.0722 * toLinear(blue)
}

const contrastRatio = (foreground: string, background: string): number => {
  const l1 = relativeLuminance(foreground)
  const l2 = relativeLuminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export const onColor = (background: string): string => {
  const candidates = ['#041320', '#000000', '#FFFFFF']
  return candidates.reduce((best, current) =>
    contrastRatio(current, background) > contrastRatio(best, background) ? current : best,
  candidates[0])
}

const buildFontPool = (
  teamKey: string,
  headlineFonts: readonly string[],
  bodyFonts: readonly string[],
): { headline: string; body: string } => {
  const seed = hashString(teamKey)
  const headlinePrimary = headlineFonts[seed % headlineFonts.length]
  const headlineSecondary = headlineFonts[(seed >>> 3) % headlineFonts.length]
  const bodyPrimary = bodyFonts[(seed >>> 5) % bodyFonts.length]
  const bodySecondary = bodyFonts[(seed >>> 7) % bodyFonts.length]

  const headline = `${uniqueByOrder([headlinePrimary, headlineSecondary]).join(', ')}, "Space Grotesk", "Segoe UI", sans-serif`
  const body = `${uniqueByOrder([bodyPrimary, bodySecondary]).join(', ')}, "Segoe UI", sans-serif`

  return { headline, body }
}

export const buildLeagueOverrides = (
  league: League,
  config: LeagueOverrideConfig,
): Readonly<Record<string, Partial<TeamPalette>>> => {
  const teamKeys = TEAM_OPTIONS.filter((team) => team.league === league).map((team) => team.key)

  const entries = teamKeys.map((teamKey) => {
    const seed = hashString(teamKey)
    const hue = config.hueBase + (seed % config.hueSpread)
    const accent = hslToHex(hue, config.accentSaturation, config.accentLightness + ((seed >>> 2) % 6) - 3)
    const accentStrong = hslToHex(hue + 8, Math.max(42, config.accentSaturation - 8), Math.min(74, config.accentLightness + 14))
    const baseBg = hslToHex(hue - 6, 36, config.baseLightness + ((seed >>> 9) % 3) - 1)
    const panel = hslToHex(hue - 4, 34, config.panelLightness + ((seed >>> 11) % 3) - 1)
    const line = hslToHex(hue - 2, 38, Math.min(40, config.panelLightness + 14))
    const { headline, body } = buildFontPool(teamKey, config.headlineFonts, config.bodyFonts)

    const override: Partial<TeamPalette> = {
      'base-bg': baseBg,
      panel,
      line,
      accent,
      'accent-strong': accentStrong,
      'on-accent': onColor(accent),
      'on-accent-strong': onColor(accentStrong),
      'bg-glow-a': withAlpha(accent, 0.34),
      'bg-glow-b': withAlpha(accentStrong, 0.24),
      headline,
      body,
    }

    return [teamKey, override] as const
  })

  return Object.freeze(Object.fromEntries(entries))
}
