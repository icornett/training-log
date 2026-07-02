import { describe, expect, it } from 'vitest'

import { TEAM_KEYS } from './constants/teamCatalog'
import { getTeamPalette, TEAM_PALETTES } from './constants/teamPalettes'

const hexToRgb = (hex: string): [number, number, number] => {
  const normalized = hex.trim().replace(/^#/, '')
  const expanded = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Expected hex color, received: ${hex}`)
  }

  return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16) / 255) as [number, number, number]
}

const toLinear = (channel: number): number =>
  channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(toLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (foreground: string, background: string): number => {
  const l1 = luminance(foreground)
  const l2 = luminance(background)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const assertAaContrast = (
  theme: string,
  foregroundName: string,
  foreground: string,
  backgroundName: string,
  background: string,
): void => {
  const ratio = contrastRatio(foreground, background)
  expect(
    ratio,
    `${theme}: ${foregroundName} (${foreground}) on ${backgroundName} (${background}) must be >= 4.5:1 (got ${ratio.toFixed(2)}:1)`,
  ).toBeGreaterThanOrEqual(4.5)
}

describe('team palettes', () => {
  it('contains an entry for every team key', () => {
    for (const key of TEAM_KEYS) {
      expect(TEAM_PALETTES[key]).toBeDefined()
    }
  })

  it('generates valid font stacks for every team', () => {
    for (const key of TEAM_KEYS) {
      const { headline, body } = getTeamPalette(key)

      for (const stack of [headline, body]) {
        const families = stack
          .split(',')
          .map((segment) => segment.trim())

        expect(families.length).toBeGreaterThan(0)
        expect(families).not.toContain('')
        expect(families).not.toContain('null')
        expect(families).not.toContain('undefined')
      }
    }
  })

  it('keeps key foreground tokens readable for every team', () => {
    for (const key of TEAM_KEYS) {
      const tokens = getTeamPalette(key)

      assertAaContrast(key, 'ink', tokens.ink, 'base-bg', tokens['base-bg'])
      assertAaContrast(key, 'ink', tokens.ink, 'panel', tokens.panel)
      assertAaContrast(key, 'link', tokens.link, 'base-bg', tokens['base-bg'])
      assertAaContrast(key, 'link', tokens.link, 'panel', tokens.panel)
      assertAaContrast(key, 'brand-color', tokens['brand-color'], 'base-bg', tokens['base-bg'])
      assertAaContrast(key, 'brand-color', tokens['brand-color'], 'panel', tokens.panel)
      assertAaContrast(key, 'on-accent', tokens['on-accent'], 'accent', tokens.accent)
      assertAaContrast(
        key,
        'on-accent-strong',
        tokens['on-accent-strong'],
        'accent-strong',
        tokens['accent-strong'],
      )
    }
  })

  it('applies a distinct commanders override', () => {
    const commanders = getTeamPalette('nfl:washington-commanders')
    const seahawks = getTeamPalette('nfl:seahawks')

    expect(commanders.accent).toBe('#5A1414')
    expect(commanders['accent-strong']).toBe('#FFB612')
    expect(commanders['base-bg']).toBe('#1A0B0D')
    expect(commanders.headline).toContain('"Anton"')
    expect(commanders.body).toContain('"Saira Condensed"')
    expect(commanders.accent).not.toBe(seahawks.accent)
    expect(commanders['base-bg']).not.toBe(seahawks['base-bg'])
  })
})