/**
 * Parse and format a workout date string (ISO "YYYY-MM-DD") for local display.
 *
 * Dates are stored in PostgreSQL as the `date` type (no time component, no
 * timezone). When a plain ISO string like "2022-01-03" is passed to the
 * JavaScript Date constructor it is treated as UTC midnight, which causes the
 * date to appear one day earlier in timezones west of UTC. This helper avoids
 * that shift by constructing the Date in local time.
 *
 * Any full timestamps persisted in future tables should be stored as
 * `timestamptz` (UTC) and localized here via `toLocaleString()`.
 */
export const formatWorkoutDate = (isoDate: string): string => {
  const parts = isoDate.split('-').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) {
    return isoDate
  }
  const [year, month, day] = parts
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
