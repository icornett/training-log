export interface TeamPalette {
  'base-bg': string
  panel: string
  ink: string
  'ink-soft': string
  accent: string
  'accent-strong': string
  'brand-color': string
  'brand-surface': string
  'brand-surface-border': string
  'on-accent': string
  'on-accent-strong': string
  link: string
  'link-hover': string
  'bg-glow-a': string
  'bg-glow-b': string
  line: string
  headline: string
  body: string
}

export interface LeagueOverrideConfig {
  hueBase: number
  hueSpread: number
  accentSaturation: number
  accentLightness: number
  panelLightness: number
  baseLightness: number
  headlineFonts: readonly string[]
  bodyFonts: readonly string[]
}
