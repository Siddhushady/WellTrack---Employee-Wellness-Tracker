import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { 
  Camera, 
  CameraOff, 
  LogOut, 
  User, 
  Building2, 
  Clock,
  TrendingUp,
  AlertCircle,
  AlertTriangle,
  FileText,
  Eye,
  Download,
  ShieldAlert
} from 'lucide-react'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'
import EmotionChart from '../components/EmotionChart'
import { reportAPI, type WellnessReport } from '../services/api'

interface EmotionStats {
  angry: number
  disgust: number
  fear: number
  happy: number
  neutral: number
  sad: number
  surprise: number
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

const EMOTION_LABELS: Record<string, string> = {
  angry: 'Angry',
  disgust: 'Disgust',
  fear: 'Fear',
  happy: 'Happy',
  neutral: 'Neutral',
  sad: 'Sad',
  surprise: 'Surprise',
}

const reportMarkdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="mt-8 first:mt-0 text-2xl font-bold text-slate-950 tracking-normal">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mt-8 first:mt-0 border-l-4 border-primary-500 pl-3 text-xl font-bold text-slate-900">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mt-6 text-base font-semibold uppercase text-slate-700">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-3 text-[15px] leading-7 text-slate-700">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-4 list-decimal space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-4 pl-8">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="ml-4 text-[15px] leading-7 text-slate-700 marker:text-primary-500">{children}</li>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-slate-950">{children}</strong>
  ),
  hr: () => <div className="my-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />,
}

const Dashboard = () => {
  const navigate = useNavigate()
  const [employeeId, setEmployeeId] = useState<string>('')
  const [department, setDepartment] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [currentFrame, setCurrentFrame] = useState<string>('')
  const [currentEmotion, setCurrentEmotion] = useState<string>('No emotion detected')
  const [emotionStats, setEmotionStats] = useState<EmotionStats>({
    angry: 0,
    disgust: 0,
    fear: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprise: 0,
  })
  const [sessionTime, setSessionTime] = useState<string>('00:00:00')
  const [error, setError] = useState<string>('')
  const [activeView, setActiveView] = useState<'tracker' | 'reports'>('tracker')
  const [reports, setReports] = useState<WellnessReport[]>([])
  const [selectedReport, setSelectedReport] = useState<WellnessReport | null>(null)
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const videoRef = useRef<HTMLImageElement>(null)
  const personalReportRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // Get employee info from localStorage
    const storedId = localStorage.getItem('employee_id')
    const storedDept = localStorage.getItem('department')
    const storedRole = localStorage.getItem('role')

    if (!storedId || !storedDept || storedRole !== 'Employee') {
      navigate('/login')
      return
    }

    setEmployeeId(storedId)
    setDepartment(storedDept)

    // Connect to Socket.IO
    const socket = connectSocket()

    // Set up connection handler
    const handleConnect = () => {
      console.log('✅ Connected to server')
      setIsConnected(true)
      setError('')
      
      // Set employee ID on server after connection
      setTimeout(() => {
        if (socket.connected) {
          console.log('Setting employee_id:', storedId)
          socket.emit('set_employee_id', { employee_id: storedId })
        }
      }, 500)
    }

    const handleDisconnect = (reason: string) => {
      console.log('⚠️ Disconnected from server:', reason)
      setIsConnected(false)
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect()
      }
    }

    const handleConnectError = (error: Error) => {
      console.error('❌ Connection error:', error)
      setIsConnected(false)
      setError(`Connection failed: ${error.message}. Make sure the backend server is running on ${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}`)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)

    socket.on('connection_success', (data: { message: string }) => {
      console.log('✅ Connection success:', data.message)
      setIsConnected(true)
    })

    socket.on('frame', (data: {
      frame: string
      stats: EmotionStats
      status: string
      sessionTime: string
    }) => {
      setCurrentFrame(`data:image/jpeg;base64,${data.frame}`)
      setEmotionStats(data.stats)
      setCurrentEmotion(data.status)
      setSessionTime(data.sessionTime)
      setIsCameraActive(true)
    })

    socket.on('error', (data: { message: string }) => {
      console.error('❌ Socket error:', data.message)
      setError(data.message)
    })

    socket.on('camera_stopped', () => {
      console.log('📷 Camera stopped')
      setIsCameraActive(false)
      setCurrentFrame('')
    })

    // Check initial connection status
    if (socket.connected) {
      handleConnect()
    }

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      // Don't disconnect on cleanup, let it stay connected
    }
  }, [navigate])

  useEffect(() => {
    if (!employeeId) return

    const fetchReports = async () => {
      try {
        setReportsLoading(true)
        setReportsError('')
        const data = await reportAPI.getEmployeeReports(employeeId)
        setReports(data)
        setSelectedReport(current => current ?? data[0] ?? null)
      } catch (err) {
        console.error('Failed to fetch personal reports:', err)
        setReportsError('Unable to load personal reports right now.')
      } finally {
        setReportsLoading(false)
      }
    }

    fetchReports()
  }, [employeeId])

  const handleStartCamera = () => {
    const socket = getSocket()
    if (!socket) {
      setError('Socket not initialized. Please refresh the page.')
      return
    }

    if (!socket.connected) {
      setError('Not connected to server. Trying to reconnect...')
      socket.connect()
      // Wait a bit and try again
      setTimeout(() => {
        if (socket && socket.connected) {
          setError('')
          setIsCameraActive(true)
          socket.emit('start_camera')
        } else {
          setError('Could not connect to server. Please check if the backend is running.')
        }
      }, 2000)
      return
    }

    setError('')
    setIsCameraActive(true)
    console.log('📷 Starting camera...')
    socket.emit('start_camera')
  }

  const handleStopCamera = () => {
    const socket = getSocket()
    if (socket && socket.connected) {
      socket.emit('stop_camera')
    }
    setIsCameraActive(false)
    setCurrentFrame('')
  }

  const handleLogout = () => {
    handleStopCamera()
    disconnectSocket()
    localStorage.removeItem('employee_id')
    localStorage.removeItem('department')
    navigate('/')
  }

  // Calculate total detections and percentages
  const totalDetections = Object.values(emotionStats).reduce((sum, val) => sum + val, 0)
  const emotionPercentages = Object.entries(emotionStats).map(([emotion, count]) => ({
    emotion,
    count,
    percentage: totalDetections > 0 ? (count / totalDetections) * 100 : 0,
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count)

  const latestFlaggedReport = reports.find(report => report.report_type === 'flagged') ?? null

  const selectedReportStats = selectedReport?.report_summary.emotions.reduce<EmotionStats>((totals, emotion) => {
    const key = emotion.status.trim().toLowerCase() as keyof EmotionStats
    if (key in totals) {
      totals[key] += Number(emotion.total) || 0
    }
    return totals
  }, {
    angry: 0,
    disgust: 0,
    fear: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprise: 0,
  })

  const downloadPersonalReport = () => {
    if (!personalReportRef.current || !selectedReport) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.print()
      return
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => {
        if (node instanceof HTMLLinkElement) {
          return `<link rel="stylesheet" href="${node.href}">`
        }

        return node.outerHTML
      })
      .join('\n')

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${selectedReport.employee_id}-personal-report</title>
          ${styles}
          <style>
            @page { size: A4; margin: 14mm; }
            html, body {
              background: #ffffff !important;
              margin: 0;
              font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            #personal-report-print {
              border-radius: 0 !important;
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              overflow: visible !important;
              width: 100% !important;
            }
            #personal-report-print section,
            #personal-report-print .rounded-2xl,
            #personal-report-print h1,
            #personal-report-print h2,
            #personal-report-print h3,
            #personal-report-print ul,
            #personal-report-print ol {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            #personal-report-print svg { max-height: 230px; }
            * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          </style>
        </head>
        <body>${personalReportRef.current.outerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 500)
  }

  const openFlaggedReport = () => {
    if (!latestFlaggedReport) return
    setSelectedReport(latestFlaggedReport)
    setActiveView('reports')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Wellness Tracker</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{employeeId}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Building2 className="w-4 h-4" />
                    <span>{department}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
                isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg smooth-transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
          <aside className="glass-effect rounded-2xl p-3 h-fit">
            <button
              onClick={() => setActiveView('tracker')}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold smooth-transition ${
                activeView === 'tracker' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Camera className="h-5 w-5" />
              <span>Live Tracker</span>
            </button>
            <button
              onClick={() => setActiveView('reports')}
              className={`mt-2 w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold smooth-transition ${
                activeView === 'reports' ? 'bg-primary-600 text-white shadow-lg' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className="h-5 w-5" />
              <span>View Personal Reports</span>
            </button>
          </aside>

          {activeView === 'tracker' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed Section */}
          <div className="lg:col-span-2 space-y-6">
            {latestFlaggedReport && (
              <button
                onClick={openFlaggedReport}
                className="w-full rounded-2xl border-2 border-red-300 bg-gradient-to-r from-red-700 to-rose-700 p-5 text-left text-white shadow-2xl shadow-red-200 smooth-transition hover:-translate-y-0.5 hover:shadow-red-300"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15">
                    <ShieldAlert className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-red-100">Burnout Risk Alert</p>
                    <h2 className="mt-1 text-2xl font-black">You may be at risk of burnout</h2>
                    <p className="mt-2 text-sm leading-6 text-red-50">
                      Click here to view your detailed report and remedial measures shared by HR/Manager.
                    </p>
                  </div>
                </div>
              </button>
            )}
            {/* Camera Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-effect rounded-2xl p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Live Camera Feed</h2>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono">{sessionTime}</span>
                </div>
              </div>
              
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                {currentFrame ? (
                  <img
                    ref={videoRef}
                    src={currentFrame}
                    alt="Camera feed"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <CameraOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Camera feed will appear here</p>
                    <p className="text-sm mt-2">Click "Start Camera" to begin</p>
                  </div>
                )}
              </div>

              {/* Current Emotion Display */}
              {currentEmotion !== 'No emotion detected' && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-4 p-4 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-xl border-2 border-primary-200"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Current Emotion</p>
                      <p className="text-2xl font-bold text-gray-800">{currentEmotion}</p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-indigo-500 flex items-center justify-center">
                      <TrendingUp className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}

              {/* Control Buttons */}
              <div className="mt-6 flex space-x-4">
                {!isCameraActive ? (
                  <button
                    onClick={handleStartCamera}
                    disabled={false}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl smooth-transition transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Camera className="w-5 h-5" />
                    <span>
                      {isConnected ? 'Start Camera' : 'Start Camera (Connecting...)'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopCamera}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl smooth-transition transform hover:-translate-y-0.5"
                  >
                    <CameraOff className="w-5 h-5" />
                    <span>Stop Camera</span>
                  </button>
                )}
              </div>
              
              {/* Connection Help */}
              {!isConnected && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    ⚠️ Not Connected to Backend
                  </p>
                  <p className="text-xs text-yellow-700">
                    Make sure your backend server is running on <code className="bg-yellow-100 px-1 rounded">http://localhost:8000</code>
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    The camera will work once connected. The backend handles camera access and emotion detection.
                  </p>
                </div>
              )}
            </motion.div>
          </div>

          {/* Statistics Section */}
          <div className="space-y-6">
            {/* Emotion Statistics */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-effect rounded-2xl p-6"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-4">Emotion Statistics</h2>
              
              {totalDetections === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">No emotions detected yet</p>
                  <p className="text-xs mt-2">Start the camera to begin tracking</p>
                </div>
              ) : (
                <>
                  {/* Pie Chart */}
                  <div className="mb-6">
                    <EmotionChart stats={emotionStats} />
                  </div>
                  
                  {/* Progress Bars */}
                  <div className="space-y-3">
                    {emotionPercentages.map(({ emotion, count, percentage }) => (
                      <div key={emotion} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {EMOTION_LABELS[emotion]}
                          </span>
                          <span className="text-gray-600">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: EMOTION_COLORS[emotion] }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>

            {/* Summary Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-effect rounded-2xl p-6 bg-gradient-to-br from-primary-50 to-indigo-50"
            >
              <h3 className="text-lg font-bold text-gray-800 mb-4">Session Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Detections</span>
                  <span className="font-bold text-gray-800">{totalDetections}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Session Duration</span>
                  <span className="font-bold text-gray-800 font-mono">{sessionTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-bold ${
                    isCameraActive ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {isCameraActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
          </div>
          ) : (
            <div className="space-y-6">
              <div className="glass-effect rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-800">View Personal Reports</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Reports appear here only after HR/Manager sends a copy to you.
                </p>
              </div>

              {reportsError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                  {reportsError}
                </div>
              )}

              {reportsLoading ? (
                <div className="glass-effect rounded-2xl p-8 text-center text-gray-500">
                  Loading reports...
                </div>
              ) : reports.length === 0 ? (
                <div className="glass-effect rounded-2xl p-8 text-center text-gray-500">
                  No personal reports have been sent yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
                  <div className="glass-effect rounded-2xl p-4 space-y-3 h-fit">
                    {reports.map(report => (
                      <button
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className={`w-full rounded-xl border p-4 text-left smooth-transition ${
                          selectedReport?.id === report.id
                            ? 'border-primary-300 bg-primary-50 shadow-md'
                            : 'border-gray-200 bg-white/80 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {report.report_type === 'flagged' ? (
                            <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
                          ) : (
                            <FileText className="mt-0.5 h-5 w-5 text-primary-600" />
                          )}
                          <div>
                            <p className="font-semibold text-gray-800 flex items-center gap-2">
                              <span>
                                {report.report_type === 'flagged'
                                  ? `Burnout Risk Report (${report.timeframe === 'week' ? '7-Day' : '30-Day'})`
                                  : `${report.timeframe === 'week' ? '7-Day' : '30-Day'} Insight Report`}
                              </span>
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Sent {new Date(report.sent_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedReport && selectedReportStats && (
                    <div className="space-y-4">
                      <article
                        id="personal-report-print"
                        ref={personalReportRef}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70"
                      >
                        <div className={`${selectedReport.report_type === 'flagged' ? 'bg-red-800' : 'bg-slate-950'} px-6 py-7 text-white sm:px-8`}>
                          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase text-cyan-100">
                                {selectedReport.report_type === 'flagged' ? (
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                                {selectedReport.report_type === 'flagged' ? 'Burnout Risk Alert' : 'Personal Wellness Report'}
                              </div>
                              <h2 className="text-3xl font-bold tracking-normal sm:text-4xl">
                                {selectedReport.report_type === 'flagged' ? 'Burnout Risk Report' : 'Emotion Analysis Report'}
                              </h2>
                              <p className="mt-2 text-sm leading-6 text-slate-300">
                                Sent by HR/Manager on {new Date(selectedReport.sent_at).toLocaleString()}.
                              </p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                              <div className="rounded-xl bg-white/10 p-3">
                                <p className="text-xs uppercase text-slate-400">Employee</p>
                                <p className="mt-1 font-bold text-white">{selectedReport.employee_id}</p>
                              </div>
                              <div className="rounded-xl bg-white/10 p-3">
                                <p className="text-xs uppercase text-slate-400">Department</p>
                                <p className="mt-1 font-bold text-white">{selectedReport.report_summary.department}</p>
                              </div>
                              <div className="rounded-xl bg-white/10 p-3">
                                <p className="text-xs uppercase text-slate-400">Data Range</p>
                                <p className="mt-1 font-bold text-white">
                                  {selectedReport.report_summary.start_date} to {selectedReport.report_summary.end_date}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-6 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-6 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <h3 className="font-bold text-slate-900">Emotional Distribution</h3>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                {Object.values(selectedReportStats).reduce((sum, count) => sum + count, 0)} detections
                              </span>
                            </div>
                            <EmotionChart stats={selectedReportStats} />
                          </section>

                          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                              <FileText className="h-5 w-5 text-primary-600" />
                              <h3 className="font-bold text-slate-900">Report Summary</h3>
                            </div>
                            <div className="space-y-3">
                              {selectedReport.report_summary.emotions
                                .map(emotion => ({
                                  status: emotion.status.trim().toLowerCase(),
                                  total: Number(emotion.total) || 0,
                                }))
                                .filter(emotion => emotion.total > 0)
                                .sort((a, b) => b.total - a.total)
                                .map(emotion => {
                                  const total = Object.values(selectedReportStats).reduce((sum, count) => sum + count, 0)
                                  const percentage = total > 0 ? (emotion.total / total) * 100 : 0
                                  return (
                                    <div key={emotion.status}>
                                      <div className="mb-1 flex items-center justify-between text-sm">
                                        <span className="font-semibold text-slate-700">
                                          {EMOTION_LABELS[emotion.status] ?? emotion.status}
                                        </span>
                                        <span className="text-slate-500">{emotion.total} ({percentage.toFixed(1)}%)</span>
                                      </div>
                                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                          className="h-full rounded-full"
                                          style={{
                                            width: `${percentage}%`,
                                            backgroundColor: EMOTION_COLORS[emotion.status] ?? '#64748b',
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </section>
                        </div>

                        <div className="border-t border-slate-200 bg-white p-6 sm:p-8">
                          <div className="employee-report-markdown">
                            <ReactMarkdown components={reportMarkdownComponents}>{selectedReport.report_content}</ReactMarkdown>
                          </div>
                        </div>
                      </article>

                      <div className="flex justify-center">
                        <button
                          onClick={downloadPersonalReport}
                          className="inline-flex items-center gap-2 rounded-xl border border-primary-200 bg-white px-5 py-3 text-sm font-semibold text-primary-700 shadow-lg shadow-primary-100/60 smooth-transition hover:border-primary-300 hover:bg-primary-50 hover:shadow-xl"
                        >
                          <Download className="h-5 w-5" />
                          <span>Download Report as PDF</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard

