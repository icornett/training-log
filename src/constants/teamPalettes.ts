import { TEAM_OPTIONS, type League } from './teamCatalog'
import { MLB_TEAM_OVERRIDES } from './teamPalette/mlb'
import { MLS_TEAM_OVERRIDES } from './teamPalette/mls'
import { NBA_TEAM_OVERRIDES } from './teamPalette/nba'
import { NFL_TEAM_OVERRIDES } from './teamPalette/nfl'
import { NHL_TEAM_OVERRIDES } from './teamPalette/nhl'
import { onColor, withAlpha } from './teamPalette/shared'
import type { TeamPalette } from './teamPalette/types'

export type { TeamPalette } from './teamPalette/types'

const FALLBACK_TEAM_KEY = 'nfl:seahawks'

const LEAGUE_BASES: Record<League, Pick<TeamPalette, 'base-bg' | 'panel' | 'ink' | 'ink-soft' | 'line' | 'headline' | 'body'>> = {
  NFL: {
    'base-bg': '#0A1526',
    panel: '#1B2636',
    ink: '#EAF2FF',
    'ink-soft': '#8BA8C5',
    line: '#3D4A5D',
    headline: '"Archivo Narrow", "Rajdhani", "Space Grotesk", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Manrope", "Segoe UI", sans-serif',
  },
  MLB: {
    'base-bg': '#071D1C',
    panel: '#0F3B3A',
    ink: '#E8F7F6',
    'ink-soft': '#8AB8B5',
    line: '#1D6160',
    headline: '"Cinzel", "Cormorant SC", "Space Grotesk", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Source Sans 3", "Segoe UI", sans-serif',
  },
  MLS: {
    'base-bg': '#0B1716',
    panel: '#1C2A2A',
    ink: '#EAF5EF',
    'ink-soft': '#94B9A7',
    line: '#3E5A52',
    headline: '"Oswald", "Teko", "Space Grotesk", "Segoe UI", sans-serif',
    body: '"Source Sans 3", "Manrope", "Segoe UI", sans-serif',
  },
  NHL: {
    'base-bg': '#0A1730',
    panel: '#23314A',
    ink: '#E7F3FF',
    'ink-soft': '#95AEC8',
    line: '#3B5A7A',
    headline: '"Orbitron", "Exo 2", "Space Grotesk", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Exo 2", "Segoe UI", sans-serif',
  },
  NBA: {
    'base-bg': '#061A12',
    panel: '#0F2F23',
    ink: '#EAF6EE',
    'ink-soft': '#99B7A7',
    line: '#2E6F56',
    headline: '"Barlow Condensed", "Anton", "Space Grotesk", "Segoe UI", sans-serif',
    body: '"Instrument Sans", "Saira Condensed", "Segoe UI", sans-serif',
  },
}

const ALL_TEAM_OVERRIDES: Readonly<Record<string, Partial<TeamPalette>>> = Object.freeze({
  ...NFL_TEAM_OVERRIDES,
  ...MLB_TEAM_OVERRIDES,
  ...MLS_TEAM_OVERRIDES,
  ...NHL_TEAM_OVERRIDES,
  ...NBA_TEAM_OVERRIDES,
})

const buildPalette = (teamKey: string, league: League): TeamPalette => {
  const base = LEAGUE_BASES[league]
  const override = ALL_TEAM_OVERRIDES[teamKey] ?? {}

  const accent = override.accent ?? '#5FA9FF'
  const accentStrong = override['accent-strong'] ?? '#8BC4FF'

  return {
    ...base,
    ...override,
    accent,
    'accent-strong': accentStrong,
    'brand-color': override['brand-color'] ?? base.ink,
    'brand-surface': override['brand-surface'] ?? withAlpha(override['base-bg'] ?? base['base-bg'], 0.74),
    'brand-surface-border': override['brand-surface-border'] ?? withAlpha(base.ink, 0.42),
    'on-accent': override['on-accent'] ?? onColor(accent),
    'on-accent-strong': override['on-accent-strong'] ?? onColor(accentStrong),
    link: override.link ?? base.ink,
    'link-hover': override['link-hover'] ?? '#FFFFFF',
    'bg-glow-a': override['bg-glow-a'] ?? withAlpha(accent, 0.34),
    'bg-glow-b': override['bg-glow-b'] ?? withAlpha(accentStrong, 0.24),
    headline: override.headline ?? base.headline,
    body: override.body ?? base.body,
  }
}

const paletteEntries = TEAM_OPTIONS.map((team) => [team.key, buildPalette(team.key, team.league)] as const)

export const TEAM_PALETTES: Readonly<Record<string, TeamPalette>> = Object.freeze(
  Object.fromEntries(paletteEntries),
)

export const getTeamPalette = (teamKey: string | null | undefined): TeamPalette => {
  if (!teamKey) {
    return TEAM_PALETTES[FALLBACK_TEAM_KEY]
  }
  return TEAM_PALETTES[teamKey] ?? TEAM_PALETTES[FALLBACK_TEAM_KEY]
}
