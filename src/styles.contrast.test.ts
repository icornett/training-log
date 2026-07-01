import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8')

const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/)
const themeBlocks = [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\}/g)]

const parseTokens = (block: string): Record<string, string> => {
  const tokens: Record<string, string> = {}
  for (const match of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim()
  }
  return tokens
}

const rootTokens = parseTokens(rootMatch?.[1] ?? '')

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

const assertAaContrast = (theme: string, foregroundName: string, foreground: string, backgroundName: string, background: string): void => {
  const ratio = contrastRatio(foreground, background)
  expect(
    ratio,
    `${theme}: ${foregroundName} (${foreground}) on ${backgroundName} (${background}) must be >= 4.5:1 (got ${ratio.toFixed(2)}:1)`,
  ).toBeGreaterThanOrEqual(4.5)
}

describe('theme contrast tokens meet WCAG 2.1 AA', () => {
  it('keeps key foreground tokens readable for every theme', () => {
    expect(themeBlocks.length).toBeGreaterThan(0)

    for (const [, themeName, block] of themeBlocks) {
      const tokens = { ...rootTokens, ...parseTokens(block) }

      assertAaContrast(themeName, 'ink', tokens.ink, 'base-bg', tokens['base-bg'])
      assertAaContrast(themeName, 'ink', tokens.ink, 'panel', tokens.panel)
      assertAaContrast(themeName, 'link', tokens.link, 'base-bg', tokens['base-bg'])
      assertAaContrast(themeName, 'link', tokens.link, 'panel', tokens.panel)
      assertAaContrast(themeName, 'brand-color', tokens['brand-color'], 'base-bg', tokens['base-bg'])
      assertAaContrast(themeName, 'brand-color', tokens['brand-color'], 'panel', tokens.panel)
      assertAaContrast(themeName, 'on-accent', tokens['on-accent'], 'accent', tokens.accent)
      assertAaContrast(
        themeName,
        'on-accent-strong',
        tokens['on-accent-strong'],
        'accent-strong',
        tokens['accent-strong'],
      )
    }
  })
})
