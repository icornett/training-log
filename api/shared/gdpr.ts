export const GDPR_CONSENT_VERSION = 'v1'
export const GDPR_RETENTION_DAYS = 30

export const getRetentionCutoffIso = (now = new Date()): string => {
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - GDPR_RETENTION_DAYS)
  return cutoff.toISOString()
}

export const toCsv = (headers: string[], rows: Array<Array<string | number | null>>): string => {
  const escapeCell = (value: string | number | null): string => {
    if (value === null) {
      return ''
    }

    const asString = String(value)
    const escaped = asString.replaceAll('"', '""')
    return `"${escaped}"`
  }

  const headerLine = headers.map((h) => escapeCell(h)).join(',')
  const rowLines = rows.map((row) => row.map((cell) => escapeCell(cell)).join(','))
  return [headerLine, ...rowLines].join('\n')
}
