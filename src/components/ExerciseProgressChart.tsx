import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { ExerciseProgressPoint } from '../types/domain'

type ExerciseProgressChartMode = 'strength-weight' | 'cardio-speed'

interface ExerciseProgressChartProps {
  points: ExerciseProgressPoint[]
  mode: ExerciseProgressChartMode
  exerciseDescription: string
}

interface StrengthChartPoint {
  workoutDate: string
  displayDate: string
  setValues: Array<number | null>
  [key: string]: string | Array<number | null> | number | null
}

interface CardioChartPoint {
  workoutDate: string
  displayDate: string
  speedMph: number
  durationMinutes: number | null
}

const parseWeightValue = (weightDescription: string | null): number | null => {
  if (!weightDescription) {
    return null
  }

  const match = weightDescription.match(/(\d+(?:\.\d+)?)/)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const formatDateLabel = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) {
    return isoDate
  }

  return `${month}/${day}`
}

const toStrengthPoints = (
  points: ExerciseProgressPoint[],
): { chartData: StrengthChartPoint[]; setCount: number } => {
  const groupedByWorkout = new Map<string, { workoutDate: string; weights: number[] }>()

  points.forEach((point) => {
    const weight = parseWeightValue(point.weightDescription)
    if (weight === null) {
      return
    }

    const workoutKey = `${point.workoutId}:${point.workoutDate}`
    const existing = groupedByWorkout.get(workoutKey)
    if (!existing) {
      groupedByWorkout.set(workoutKey, { workoutDate: point.workoutDate, weights: [weight] })
      return
    }

    existing.weights.push(weight)
  })

  const sortedWorkouts = Array.from(groupedByWorkout.values()).sort((a, b) =>
    a.workoutDate.localeCompare(b.workoutDate),
  )

  const setCount = sortedWorkouts.reduce((max, workout) => Math.max(max, workout.weights.length), 0)

  const chartData = sortedWorkouts.map((workout) => {
    const sortedWeights = [...workout.weights].sort((a, b) => a - b)
    const setValues = Array.from({ length: setCount }, (_unused, index) => sortedWeights[index] ?? null)
    const setSeries = Object.fromEntries(setValues.map((value, index) => [`set-${index + 1}`, value]))

    return {
      workoutDate: workout.workoutDate,
      displayDate: formatDateLabel(workout.workoutDate),
      setValues,
      ...setSeries,
    }
  })

  return { chartData, setCount }
}

const toCardioPoints = (points: ExerciseProgressPoint[]): CardioChartPoint[] => {
  return points
    .map((point) => {
      if (point.speedMph === null) {
        return null
      }

      return {
        workoutDate: point.workoutDate,
        displayDate: formatDateLabel(point.workoutDate),
        speedMph: point.speedMph,
        durationMinutes: point.durationMinutes,
      }
    })
    .filter((point): point is CardioChartPoint => point !== null)
}

export const ExerciseProgressChart = ({
  points,
  mode,
  exerciseDescription,
}: ExerciseProgressChartProps): JSX.Element => {
  if (mode === 'cardio-speed') {
    const cardioChartData = toCardioPoints(points)

    return (
      <article className="panel-block" aria-label="cardio-progress-chart">
        <h2>Speed Over Time</h2>
        {cardioChartData.length === 0 ? (
          <p>Cardio points are available, but no speed values were found for charting.</p>
        ) : (
          <div className="progress-chart-shell" role="img" aria-label={`Speed trend chart for ${exerciseDescription}`}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart
                data={cardioChartData}
                margin={{ top: 16, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(127, 164, 196, 0.35)" />
                <XAxis
                  dataKey="displayDate"
                  tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                  minTickGap={24}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(127, 164, 196, 0.45)' }}
                />
                <YAxis
                  tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                  width={44}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(127, 164, 196, 0.45)' }}
                  domain={['dataMin - 0.5', 'dataMax + 0.5']}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(11, 20, 34, 0.95)',
                    border: '1px solid rgba(127, 164, 196, 0.45)',
                    borderRadius: '8px',
                    color: 'var(--ink)',
                  }}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as CardioChartPoint | undefined
                    return point?.workoutDate ?? ''
                  }}
                  formatter={(value, _name, context) => {
                    const point = context.payload as CardioChartPoint
                    const durationLabel = point.durationMinutes !== null ? `${point.durationMinutes} min` : 'duration n/a'
                    return [`${value} mph (${durationLabel})`, 'Speed']
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="speedMph"
                  stroke="var(--brand-color)"
                  strokeWidth={3}
                  activeDot={{ r: 7 }}
                  dot={{ r: 4, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </article>
    )
  }

  const { chartData, setCount } = toStrengthPoints(points)

  return (
    <article className="panel-block" aria-label="strength-progress-chart">
      <h2>Weight Over Time</h2>
      <p className="chart-subtext">Showing all logged sets as separate lines (ordered light-to-heavy per workout).</p>
      {chartData.length === 0 ? (
        <p>Strength points are available, but no numeric weight entries were found for charting.</p>
      ) : (
        <div className="progress-chart-shell" role="img" aria-label={`Weight trend chart for ${exerciseDescription}`}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 16, right: 12, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(127, 164, 196, 0.35)" />
              <XAxis
                dataKey="displayDate"
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                minTickGap={24}
                tickLine={false}
                axisLine={{ stroke: 'rgba(127, 164, 196, 0.45)' }}
              />
              <YAxis
                tick={{ fill: 'var(--ink-soft)', fontSize: 12 }}
                width={44}
                tickLine={false}
                axisLine={{ stroke: 'rgba(127, 164, 196, 0.45)' }}
                domain={['dataMin - 5', 'dataMax + 5']}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(11, 20, 34, 0.95)',
                  border: '1px solid rgba(127, 164, 196, 0.45)',
                  borderRadius: '8px',
                  color: 'var(--ink)',
                }}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload as StrengthChartPoint | undefined
                  return point?.workoutDate ?? ''
                }}
                  formatter={(value, _name, context) => {
                    const dataKey = context.dataKey as string | number
                    const setMatch = `${dataKey}`.match(/^set-(\d+)$/)
                    const setLabel = setMatch ? `Set ${setMatch[1]}` : 'Set'
                    return [`${value} lbs`, setLabel]
                }}
              />
                {Array.from({ length: setCount }, (_unused, index) => {
                  const hue = 95 + index * 25
                  return (
                    <Line
                      key={`set-line-${index + 1}`}
                      type="monotone"
                      dataKey={`set-${index + 1}`}
                      name={`Set ${index + 1}`}
                      stroke={`hsl(${hue}, 70%, 62%)`}
                      strokeWidth={3}
                      activeDot={{ r: 7 }}
                      dot={{ r: 4, strokeWidth: 2 }}
                      connectNulls={false}
                    />
                  )
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  )
}
