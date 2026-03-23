import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Camera, 
  CameraOff, 
  LogOut, 
  User, 
  Building2, 
  Clock,
  TrendingUp,
  AlertCircle
} from 'lucide-react'
import { connectSocket, disconnectSocket, getSocket } from '../services/socket'
import EmotionChart from '../components/EmotionChart'

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
  const videoRef = useRef<HTMLImageElement>(null)

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
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg smooth-transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Camera Feed Section */}
          <div className="lg:col-span-2 space-y-6">
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
      </main>
    </div>
  )
}

export default Dashboard

