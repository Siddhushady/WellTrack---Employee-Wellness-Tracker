import { motion } from 'framer-motion'

interface EmotionChartProps {
  stats: {
    angry: number
    disgust: number
    fear: number
    happy: number
    neutral: number
    sad: number
    surprise: number
  }
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

const EmotionChart = ({ stats }: EmotionChartProps) => {
  const total = Object.values(stats).reduce((sum, val) => sum + val, 0)
  
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p className="text-sm">No data to display</p>
      </div>
    )
  }

  const emotions = Object.entries(stats)
    .map(([emotion, count]) => ({
      emotion,
      label: EMOTION_LABELS[emotion],
      count,
      percentage: (count / total) * 100,
      color: EMOTION_COLORS[emotion],
    }))
    .filter(item => item.count > 0)
    .sort((a, b) => b.count - a.count)

  // Calculate angles for pie chart
  let currentAngle = -90
  const segments = emotions.map((item) => {
    const angle = (item.percentage / 100) * 360
    const startAngle = currentAngle
    currentAngle += angle
    return {
      ...item,
      startAngle,
      angle,
    }
  })

  const radius = 80
  const centerX = 100
  const centerY = 100

  const createPath = (startAngle: number, angle: number) => {
    const start = (startAngle * Math.PI) / 180
    const end = ((startAngle + angle) * Math.PI) / 180
    
    const x1 = centerX + radius * Math.cos(start)
    const y1 = centerY + radius * Math.sin(start)
    const x2 = centerX + radius * Math.cos(end)
    const y2 = centerY + radius * Math.sin(end)
    
    const largeArc = angle > 180 ? 1 : 0
    
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="w-full">
      <svg viewBox="0 0 200 200" className="w-full h-64">
        {segments.map((segment, index) => (
          <motion.path
            key={segment.emotion}
            d={createPath(segment.startAngle, segment.angle)}
            fill={segment.color}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
            className="hover:opacity-80 smooth-transition"
          />
        ))}
      </svg>
      
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        {emotions.map((item) => (
          <div key={item.emotion} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-600">{item.label}</span>
            <span className="text-xs font-semibold text-gray-800 ml-auto">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default EmotionChart

