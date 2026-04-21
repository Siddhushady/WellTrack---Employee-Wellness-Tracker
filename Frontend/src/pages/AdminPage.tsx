import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { adminAPI, AdminStatsResponse, AdminEmotionStat, CurrentWeekStats, FlaggedEmployee } from '../services/api'
import EmotionChart from '../components/EmotionChart'
import { AlertCircle, BarChart2, Activity, LogOut, Building2, LineChart, HeartPulse } from 'lucide-react'

const EMOTIONS = ['happy', 'neutral', 'surprise', 'sad', 'fear', 'angry', 'disgust'] as const

const EMOTION_LABELS: Record<string, string> = {
  angry: 'Angry',
  disgust: 'Disgust',
  fear: 'Fear',
  happy: 'Happy',
  neutral: 'Neutral',
  sad: 'Sad',
  surprise: 'Surprise',
}

const EMOTION_COLORS: Record<string, string> = {
  angry: '#dc2626',
  disgust: '#f59e0b',
  fear: '#3b82f6',
  happy: '#10b981',
  neutral: '#fbbf24',
  sad: '#ef4444',
  surprise: '#a855f7',
}

const AdminPage = () => {
  const navigate = useNavigate()
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [currentWeekStats, setCurrentWeekStats] = useState<CurrentWeekStats | null>(null)
  const [flags, setFlags] = useState<FlaggedEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [pieRange, setPieRange] = useState<'Today' | 'Last 7 Days' | 'Last 30 Days' | 'All Time'>('Last 30 Days')
  const [pieEmotions, setPieEmotions] = useState<AdminEmotionStat[]>([])

  const [selectedDepartment, setSelectedDepartment] = useState<string>('All')
  const [departmentEmotions, setDepartmentEmotions] = useState<AdminEmotionStat[]>([])

  const emotionTotals = useMemo(() => {
    const source: AdminEmotionStat[] = pieEmotions.length > 0 ? pieEmotions : (stats?.emotions ?? [])
    const base = { angry: 0, disgust: 0, fear: 0, happy: 0, neutral: 0, sad: 0, surprise: 0 }
    source.forEach(e => {
      if (e.status in base) {
        ;(base as Record<string, number>)[e.status] = e.total
      }
    })
    return base
  }, [pieEmotions, stats])

  const departmentEmotionTotals = useMemo(() => {
    const base = { angry: 0, disgust: 0, fear: 0, happy: 0, neutral: 0, sad: 0, surprise: 0 }
    departmentEmotions.forEach(e => {
      if (e.status in base) {
        ;(base as Record<string, number>)[e.status] = e.total
      }
    })
    return base
  }, [departmentEmotions])

  const departmentOptions = useMemo(() => {
    const names = (stats?.departments ?? []).map(d => d.department)
    return ['All', ...names.filter(name => name !== 'All')]
  }, [stats])

  useEffect(() => {
    const role = localStorage.getItem('role')
    const employeeId = localStorage.getItem('employee_id')

    if (!employeeId || role !== 'HR/Manager') {
      navigate('/login')
      return
    }

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError('')
        const [data, weekData, flagsData] = await Promise.all([
          adminAPI.getStats(),
          adminAPI.getCurrentWeekStats(),
          adminAPI.getFlags()
        ])
        setStats(data)
        setCurrentWeekStats(weekData)
        setFlags(flagsData)
      } catch (err) {
        console.error(err)
        setError('Failed to load analytics. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [navigate])

  useEffect(() => {
    const fetchPie = async () => {
      try {
        const data = await adminAPI.getStats({
          date_range: pieRange,
        })
        setPieEmotions(data.emotions)
      } catch (err) {
        console.error(err)
      }
    }

    fetchPie()
  }, [pieRange])

  useEffect(() => {
    const fetchDepartmentEmotions = async () => {
      try {
        const data = await adminAPI.getStats({
          department: selectedDepartment,
          date_range: 'Last 30 Days',
        })
        setDepartmentEmotions(data.emotions)
      } catch (err) {
        console.error(err)
      }
    }

    fetchDepartmentEmotions()
  }, [selectedDepartment])

  const departments = stats?.departments ?? []

  const departmentEmotionTotalCount = Object.values(departmentEmotionTotals).reduce((sum, count) => sum + count, 0)

  const departmentEmotionBars = EMOTIONS.map(emotion => {
    const count = departmentEmotionTotals[emotion] ?? 0
    const percentage = departmentEmotionTotalCount > 0 ? (count / departmentEmotionTotalCount) * 100 : 0
    return { emotion, count, percentage }
  }).filter(item => item.count > 0)

  const departmentLineData = [...departments]
    .filter(d => d.employee_count > 0)
    .sort((a, b) => a.department.localeCompare(b.department))

  const lineChartPoints = useMemo(() => {
    if (departmentLineData.length === 0) {
      return [] as Array<{ x: number; y: number; label: string; value: number }>
    }

    if (departmentLineData.length === 1) {
      return [{
        x: 200,
        y: 170 - (departmentLineData[0].happy_pct / 100) * 140,
        label: departmentLineData[0].department,
        value: departmentLineData[0].happy_pct,
      }]
    }

    return departmentLineData.map((dept, index) => {
      const x = 40 + (index * 320) / (departmentLineData.length - 1)
      const y = 170 - (dept.happy_pct / 100) * 140
      return {
        x,
        y,
        label: dept.department,
        value: dept.happy_pct,
      }
    })
  }, [departmentLineData])

  const linePath = lineChartPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  const weekEmotionTotals = useMemo(() => {
    const base = { angry: 0, disgust: 0, fear: 0, happy: 0, neutral: 0, sad: 0, surprise: 0 }
    if (currentWeekStats?.emotions) {
      currentWeekStats.emotions.forEach(e => {
        if (e.status in base) {
          ;(base as Record<string, number>)[e.status] = e.total
        }
      })
    }
    return base
  }, [currentWeekStats])

  const totalDetections = Object.values(weekEmotionTotals).reduce((sum, count) => sum + count, 0)
  const positiveDetections = weekEmotionTotals.happy + weekEmotionTotals.neutral
  const negativeDetections = weekEmotionTotals.angry + weekEmotionTotals.sad + weekEmotionTotals.fear + weekEmotionTotals.disgust
  const positiveRatio = totalDetections > 0 ? (positiveDetections / totalDetections) * 100 : 0
  const negativeRatio = totalDetections > 0 ? (negativeDetections / totalDetections) * 100 : 0

  const negativeEmotions = ['angry', 'sad', 'fear', 'disgust'] as const
  let strongestNegativeEmotion: (typeof negativeEmotions)[number] = 'angry'
  negativeEmotions.forEach(emotion => {
    if (weekEmotionTotals[emotion] > weekEmotionTotals[strongestNegativeEmotion]) {
      strongestNegativeEmotion = emotion
    }
  })

  const lowestHappinessDepartment = [...(currentWeekStats?.departments ?? [])]
    .filter(d => d.employee_count > 0)
    .sort((a, b) => a.happy_pct - b.happy_pct)[0]

  return (
    <div className="min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-indigo-50 to-purple-50" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(139,92,246,0.1),transparent_50%)]" />
      </div>
      <header className="glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-lg">
                <BarChart2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">Emotion Analytics</h1>
            </div>
            <p className="text-sm text-gray-600">
              Overview of employee emotional wellness across the organisation.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('employee_id')
              localStorage.removeItem('department')
              localStorage.removeItem('role')
              navigate('/')
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-medium text-white smooth-transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading && !stats && (
          <p className="text-sm text-gray-500">Loading analytics...</p>
        )}

        {error && (
          <div className="glass-effect rounded-2xl p-4 flex items-center space-x-2 bg-red-50 border border-red-200 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-effect rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-800">Overall emotional distribution</h2>
              </div>
              <select
                value={pieRange}
                onChange={e => setPieRange(e.target.value as typeof pieRange)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white/80 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              >
                <option value="Today">Today</option>
                <option value="Last 7 Days">Last 7 days</option>
                <option value="Last 30 Days">Last 30 days</option>
                <option value="All Time">All time</option>
              </select>
            </div>
            <EmotionChart stats={emotionTotals} />
            <p className="mt-4 text-xs text-gray-600">
              Distribution for {pieRange.toLowerCase()} across all employee emotion detections.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-effect rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-800">Department emotion profile</h2>
              </div>
              <select
                value={selectedDepartment}
                onChange={e => setSelectedDepartment(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white/80 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400"
              >
                {departmentOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {departmentEmotionBars.length > 0 ? (
              <div className="space-y-3">
                {departmentEmotionBars.map(({ emotion, count, percentage }) => (
                  <div key={emotion} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{EMOTION_LABELS[emotion]}</span>
                      <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${percentage}%`, backgroundColor: EMOTION_COLORS[emotion] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
                No emotion data available for this department in the last 30 days.
              </div>
            )}
            <p className="mt-4 text-xs text-gray-600">
              Compare emotional mix between departments in a fixed 30-day window by switching the dropdown.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-effect rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-800">Department happiness line</h2>
            </div>
            {lineChartPoints.length > 0 ? (
              <div className="w-full h-64">
                <svg viewBox="0 0 400 220" className="w-full h-full">
                  <line x1="40" y1="170" x2="360" y2="170" stroke="#d1d5db" strokeWidth="1" />
                  <line x1="40" y1="30" x2="40" y2="170" stroke="#d1d5db" strokeWidth="1" />
                  <text x="8" y="34" className="fill-gray-400 text-[10px]">100%</text>
                  <text x="14" y="174" className="fill-gray-400 text-[10px]">0%</text>

                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}

                  {lineChartPoints.map(point => (
                    <g key={point.label}>
                      <circle cx={point.x} cy={point.y} r="5" fill="#4f46e5" />
                      <text x={point.x} y="188" textAnchor="middle" className="fill-gray-600 text-[10px]">
                        {point.label}
                      </text>
                      <text x={point.x} y={point.y - 10} textAnchor="middle" className="fill-gray-700 text-[10px] font-medium">
                        {point.value.toFixed(1)}%
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No department wellbeing trend data available.</p>
            )}
            <p className="mt-4 text-xs text-gray-600">
              Percentage of happy detections per department (higher is better).
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-effect rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <HeartPulse className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-800">Wellness insight summary</h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Positive ratio</span>
                <span className="font-semibold text-green-700">{positiveRatio.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Negative ratio</span>
                <span className="font-semibold text-red-700">{negativeRatio.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-600">Most frequent negative emotion</span>
                <span className="font-semibold text-gray-800">{EMOTION_LABELS[strongestNegativeEmotion]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Department needing attention</span>
                <span className="font-semibold text-gray-800">{lowestHappinessDepartment?.department ?? 'N/A'}</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-600 leading-relaxed">
              <p>
                A quick triage snapshot of positive versus strain-heavy signals, the strongest negative pattern, and the department most worth reviewing next.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={() => navigate('/admin/employee-insights')}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md smooth-transition"
              >
                <span>View Detailed Employee Insights</span>
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-effect rounded-2xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-800">Employee Flags</h2>
            </div>
            {flags.length > 0 ? (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                {flags.map(emp => (
                  <div
                    key={emp.employee_id}
                    className="flex items-center justify-between text-sm border-b last:border-b-0 border-gray-100 pb-3 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{emp.employee_id}</p>
                      <p className="text-xs text-gray-500">{emp.department}</p>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <p className="text-red-600 font-medium">
                        {emp.negative_ratio.toFixed(1)}% negative
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {emp.negative_count} of {emp.total_count} detections
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No flags detected recently.</p>
            )}
            <p className="mt-4 text-xs text-gray-600 mb-4">
              Employees with more negative emotions than positive/neutral/surprise.
            </p>
            <div className="mt-auto pt-4 border-t border-gray-100">
              <button
                onClick={() => navigate('/admin/flags')}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-lg font-medium shadow-sm hover:shadow-md smooth-transition"
              >
                <span>View All Flagged Data</span>
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export default AdminPage





