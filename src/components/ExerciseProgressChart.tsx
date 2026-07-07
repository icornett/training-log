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
  weight: number
  weightLabel: string
  repsLabel: string
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

const toStrengthPoints = (points: ExerciseProgressPoint[]): StrengthChartPoint[] => {
  return points
    .map((point) => {
      const weight = parseWeightValue(point.weightDescription)
      if (weight === null) {
        return null
      }

      return {
        workoutDate: point.workoutDate,
        displayDate: formatDateLabel(point.workoutDate),
        weight,
        weightLabel: point.weightDescription ?? `${weight}`,
        repsLabel:
          point.numSets !== null && point.numReps !== null ? `${point.numSets} x ${point.numReps}` : '-',
      }
    })
    .filter((point): point is StrengthChartPoint => point !== null)
}

export const ExerciseProgressChart = ({
  points,
  mode,
  exerciseDescription,
}: ExerciseProgressChartProps): JSX.Element => {
  if (mode === 'cardio-speed') {
    return (
      <article className="panel-block" aria-label="cardio-progress-chart-placeholder">
        <h2>Speed Over Time</h2>
        <p>Cardio chart support is planned for a follow-up release.</p>
      </article>
    )
  }

  const chartData = toStrengthPoints(points)

  return (
    <article className="panel-block" aria-label="strength-progress-chart">
      <h2>Weight Over Time</h2>
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
                  const point = context.payload as StrengthChartPoint
                  return [`${value} lbs (${point.repsLabel})`, 'Weight']
                }}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="var(--accent-strong)"
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
