import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'


const EmployeeInsightsPage = () => {
  const navigate = useNavigate()
  const defaultPromptWeek = 'Analyze their emotional trends over the past week. Are they showing signs of burnout? What specific interventions do you recommend based on this data?'
  const defaultPromptMonth = 'Analyze their emotional trends over the past month. Are they showing signs of burnout? What specific interventions do you recommend based on this data?'

  const [employeeId, setEmployeeId] = useState('')
  const [timeframe, setTimeframe] = useState<'week' | 'month'>('month')
  const [prompt, setPrompt] = useState(defaultPromptMonth)

  const handleTimeframeChange = (newTimeframe: 'week' | 'month') => {
    setTimeframe(newTimeframe)
    if (prompt === defaultPromptWeek || prompt === defaultPromptMonth) {
      setPrompt(newTimeframe === 'week' ? defaultPromptWeek : defaultPromptMonth)
    }
  }
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [agentStatus, setAgentStatus] = useState<{ agent: string; status: string; message: string } | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = () => {
    if (!employeeId.trim() || !prompt.trim()) return

    setIsAnalyzing(true)
    setAgentStatus(null)
    setResult(null)
    setError(null)

    const url = new URL(`${import.meta.env?.VITE_API_URL || 'http://localhost:8000'}/analyze/employee/stream`)
    url.searchParams.append('employee_id', employeeId)
    url.searchParams.append('prompt', prompt)
    url.searchParams.append('timeframe', timeframe)

    const eventSource = new EventSource(url.toString())

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.status === 'complete') {
          setResult(data.result)
          setIsAnalyzing(false)
          eventSource.close()
        } else if (data.status === 'error') {
          setError(data.message)
          setIsAnalyzing(false)
          eventSource.close()
        } else {
          setAgentStatus({
            agent: data.agent,
            status: data.status,
            message: data.message
          })
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err)
      }
    }

    eventSource.onerror = () => {
      setError('Lost connection to the analysis server.')
      setIsAnalyzing(false)
      eventSource.close()
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="glass-effect border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-100 rounded-lg smooth-transition"
            >
              <span className="text-gray-600 font-medium">← Back</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Deep Employee Analysis</h1>
              <p className="text-sm text-gray-600">Multi-agent AI analysis of individual emotional histories</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Input Section */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1 space-y-6"
          >
            <div className="glass-effect rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                Analysis Parameters
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="e.g. EMP001"
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    disabled={isAnalyzing}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
                  <select
                    value={timeframe}
                    onChange={(e) => handleTimeframeChange(e.target.value as 'week' | 'month')}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    disabled={isAnalyzing}
                  >
                    <option value="week">Past Week (7 Days)</option>
                    <option value="month">Past Month (30 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Analysis Prompt</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={5}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white/80 text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-400 text-sm resize-none"
                    disabled={isAnalyzing}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Instruct the Analysis Agent on what specifically to look for in the data.
                  </p>
                </div>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !employeeId.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>{isAnalyzing ? 'Analyzing...' : 'Generate Insights'}</span>
                </button>
              </div>
            </div>

            {/* Live Agent Status Box */}
            {(isAnalyzing || agentStatus) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-effect rounded-2xl p-6 border-l-4 border-indigo-500"
              >
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  Multi-Agent Activity Log
                </h3>
                
                {agentStatus && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                        {agentStatus.agent}
                      </span>
                      {agentStatus.status === 'working' ? (
                        <span className="text-amber-500 text-xs font-semibold">[Working...]</span>
                      ) : agentStatus.status === 'done' ? (
                        <span className="text-green-500 text-xs font-semibold">[Done]</span>
                      ) : (
                        <span className="text-red-500 text-xs font-semibold">[Error]</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 pl-1">{agentStatus.message}</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>

          {/* Results Section */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2"
          >
            <div className="glass-effect rounded-2xl p-6 min-h-[500px]">
              <h2 className="text-xl font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">
                Generated Insights
              </h2>
              
              {error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
                  <p className="font-semibold">Error:</p>
                  <p>{error}</p>
                </div>
              ) : result ? (
                <div className="prose prose-indigo max-w-none text-gray-700">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              ) : isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <p>Agents are actively reasoning over the data...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                  <p>Enter an Employee ID and click Generate Insights to begin.</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  )
}

export default EmployeeInsightsPage
