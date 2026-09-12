import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'

export interface SCurvePoint {
  date: string
  raw_date: string
  planned_value: number
  earned_value: number | null
  forecast_value: number | null
  variance: number | null
  is_current?: boolean
}

interface SCurveChartProps {
  data: SCurvePoint[]
  height?: number
}

export const SCurveChart: React.FC<SCurveChartProps> = ({ data, height = 360 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
        No schedule activities available to plot S-Curve.
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0]?.payload as SCurvePoint
      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 p-3 rounded-xl shadow-2xl text-xs space-y-1.5 min-w-[200px]">
          <p className="font-bold text-slate-300 border-b border-slate-700/60 pb-1 flex items-center justify-between">
            <span>{label}</span>
            {p.is_current && <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold">TODAY</span>}
          </p>
          <div className="flex justify-between items-center text-blue-400 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Planned Baseline:</span>
            <span>{p.planned_value}%</span>
          </div>
          {p.earned_value !== null && (
            <div className="flex justify-between items-center text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Actual Earned:</span>
              <span>{p.earned_value}%</span>
            </div>
          )}
          {p.forecast_value !== null && (
            <div className="flex justify-between items-center text-amber-400 font-medium">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> Forecast Projected:</span>
              <span>{p.forecast_value}%</span>
            </div>
          )}
          {p.variance !== null && (
            <div className={`flex justify-between items-center pt-1 border-t border-slate-800 font-bold ${p.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>Variance (EV - PV):</span>
              <span>{p.variance > 0 ? `+${p.variance}` : p.variance}%</span>
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full">
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 15, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1', strokeOpacity: 0.5 }}
              dy={8}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              dx={-5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 12, fontSize: 12 }}
            />
            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="2 2" strokeOpacity={0.4} />

            {/* Planned Baseline S-Curve */}
            <Line
              type="monotone"
              dataKey="planned_value"
              name="Planned Value (PV Baseline)"
              stroke="#3b82f6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#3b82f6' }}
              activeDot={{ r: 6 }}
            />

            {/* Actual Earned S-Curve */}
            <Line
              type="monotone"
              dataKey="earned_value"
              name="Earned Value (EV Actual)"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 7 }}
              connectNulls={false}
            />

            {/* Projected Forecast S-Curve */}
            <Line
              type="monotone"
              dataKey="forecast_value"
              name="Projected Forecast (EAC)"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#f59e0b' }}
              activeDot={{ r: 6 }}
              connectNulls={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
